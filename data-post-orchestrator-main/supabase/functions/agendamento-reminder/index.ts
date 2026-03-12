import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Strip non-digits, drop leading zeros, and prepend Brazilian country code 55
 * when absent.
 */
function formatPhone(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

/**
 * POST a text message via UAZAPI. Returns true on success.
 */
async function sendWhatsApp(
  apiUrl: string,
  token: string,
  phone: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/send/text`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number: formatPhone(phone), text }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(
        `[REMINDER] Send failed: ${response.status} ${err}`
      );
      return false;
    }

    return true;
  } catch (e) {
    console.error("[REMINDER] Send error:", (e as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agendamento {
  id: string;
  nome: string | null;
  telefone: string;
  data_marcada: string | null;
  horario: string | null;
  dentista: string | null;
  tratamento: string | null;
  tenant_id: string | null;
}

interface UazapiInstance {
  token: string;
  api_url: string | null;
  name: string;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const results = {
      confirmations: 0,
      reminders_24h: 0,
      reminders_1h: 0,
      errors: 0,
    };

    // -----------------------------------------------------------------------
    // 1. Confirmation messages — sent immediately after scheduling.
    //    Scope: confirmation_sent = false AND created in the last 24 h.
    // -----------------------------------------------------------------------
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingConfirmations, error: confError } = await supabase
      .from("agendamento")
      .select(
        "id, nome, telefone, data_marcada, horario, dentista, tratamento, tenant_id"
      )
      .eq("confirmation_sent", false)
      .not("telefone", "is", null)
      .gte("created_at", since24h);

    if (confError) {
      console.error("[REMINDER] Error fetching confirmations:", confError.message);
    }

    // -----------------------------------------------------------------------
    // 2. 24 h reminders — appointment falls within ±1 h of "tomorrow"
    //    (i.e., between 23 h and 25 h from now).
    // -----------------------------------------------------------------------
    const tomorrowMinus1h = new Date(
      now.getTime() + 23 * 60 * 60 * 1000
    ).toISOString();
    const tomorrowPlus1h = new Date(
      now.getTime() + 25 * 60 * 60 * 1000
    ).toISOString();

    const { data: pending24h, error: err24h } = await supabase
      .from("agendamento")
      .select(
        "id, nome, telefone, data_marcada, horario, dentista, tratamento, tenant_id"
      )
      .eq("reminder_24h_sent", false)
      .eq("confirmation_sent", true)
      .not("telefone", "is", null)
      .gte("data_marcada", tomorrowMinus1h)
      .lte("data_marcada", tomorrowPlus1h);

    if (err24h) {
      console.error("[REMINDER] Error fetching 24h reminders:", err24h.message);
    }

    // -----------------------------------------------------------------------
    // 3. 1 h reminders — appointment falls between 30 min and 90 min from now.
    // -----------------------------------------------------------------------
    const plus30min = new Date(
      now.getTime() + 30 * 60 * 1000
    ).toISOString();
    const plus90min = new Date(
      now.getTime() + 90 * 60 * 1000
    ).toISOString();

    const { data: pending1h, error: err1h } = await supabase
      .from("agendamento")
      .select(
        "id, nome, telefone, data_marcada, horario, dentista, tratamento, tenant_id"
      )
      .eq("reminder_1h_sent", false)
      .eq("reminder_24h_sent", true)
      .not("telefone", "is", null)
      .gte("data_marcada", plus30min)
      .lte("data_marcada", plus90min);

    if (err1h) {
      console.error("[REMINDER] Error fetching 1h reminders:", err1h.message);
    }

    // -----------------------------------------------------------------------
    // Helper: resolve the UAZAPI instance for a given tenant.
    // -----------------------------------------------------------------------
    async function getInstanceForTenant(
      tenantId: string
    ): Promise<{ token: string; apiUrl: string } | null> {
      const { data, error } = await supabase
        .from("uazapi_instances")
        .select("token, api_url, name")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single<UazapiInstance>();

      if (error || !data) {
        if (error) {
          console.error(
            `[REMINDER] Could not fetch instance for tenant ${tenantId}:`,
            error.message
          );
        }
        return null;
      }

      return {
        token: data.token,
        apiUrl: data.api_url || "https://oralaligner.uazapi.com",
      };
    }

    // -----------------------------------------------------------------------
    // Process confirmation messages
    // -----------------------------------------------------------------------
    for (const ag of (pendingConfirmations as Agendamento[]) || []) {
      const tenantId = ag.tenant_id || "oralaligner";
      const instance = await getInstanceForTenant(tenantId);

      if (!instance) {
        results.errors++;
        continue;
      }

      const horario = ag.horario || "";
      const dataFormatada = ag.data_marcada
        ? new Date(ag.data_marcada).toLocaleDateString("pt-BR")
        : "";

      const msg =
        `Olá ${ag.nome || "paciente"}! 😊\n\n` +
        `Sua consulta${ag.tratamento ? ` de ${ag.tratamento}` : ""} está confirmada!\n\n` +
        `📅 Data: ${dataFormatada}\n` +
        `⏰ Horário: ${horario}\n` +
        (ag.dentista ? `👨‍⚕️ Profissional: ${ag.dentista}` : "") +
        `\n\nCaso precise reagendar, nos avise com antecedência. Aguardamos você!`;

      const sent = await sendWhatsApp(
        instance.apiUrl,
        instance.token,
        ag.telefone,
        msg
      );

      if (sent) {
        const { error: updateError } = await supabase
          .from("agendamento")
          .update({ confirmation_sent: true })
          .eq("id", ag.id);

        if (updateError) {
          console.error(
            `[REMINDER] Failed to update confirmation_sent for ${ag.id}:`,
            updateError.message
          );
          results.errors++;
        } else {
          results.confirmations++;
        }
      } else {
        results.errors++;
      }
    }

    // -----------------------------------------------------------------------
    // Process 24 h reminders
    // -----------------------------------------------------------------------
    for (const ag of (pending24h as Agendamento[]) || []) {
      const tenantId = ag.tenant_id || "oralaligner";
      const instance = await getInstanceForTenant(tenantId);

      if (!instance) {
        results.errors++;
        continue;
      }

      const horario = ag.horario || "";

      const msg =
        `Olá ${ag.nome || "paciente"}! 👋\n\n` +
        `Lembrando que sua consulta${ag.tratamento ? ` de ${ag.tratamento}` : ""} é *amanhã* às ${horario}.\n` +
        (ag.dentista ? `👨‍⚕️ Profissional: ${ag.dentista}\n` : "") +
        `\nVocê confirma presença? Responda *SIM* para confirmar ou entre em contato para reagendar.`;

      const sent = await sendWhatsApp(
        instance.apiUrl,
        instance.token,
        ag.telefone,
        msg
      );

      if (sent) {
        const { error: updateError } = await supabase
          .from("agendamento")
          .update({ reminder_24h_sent: true })
          .eq("id", ag.id);

        if (updateError) {
          console.error(
            `[REMINDER] Failed to update reminder_24h_sent for ${ag.id}:`,
            updateError.message
          );
          results.errors++;
        } else {
          results.reminders_24h++;
        }
      } else {
        results.errors++;
      }
    }

    // -----------------------------------------------------------------------
    // Process 1 h reminders
    // -----------------------------------------------------------------------
    for (const ag of (pending1h as Agendamento[]) || []) {
      const tenantId = ag.tenant_id || "oralaligner";
      const instance = await getInstanceForTenant(tenantId);

      if (!instance) {
        results.errors++;
        continue;
      }

      const horario = ag.horario || "";

      const msg =
        `Olá ${ag.nome || "paciente"}! ⏰\n\n` +
        `Sua consulta é *daqui a pouco* às ${horario}!\n` +
        (ag.dentista ? `👨‍⚕️ Profissional: ${ag.dentista}\n` : "") +
        `\nEstamos te esperando! 😊`;

      const sent = await sendWhatsApp(
        instance.apiUrl,
        instance.token,
        ag.telefone,
        msg
      );

      if (sent) {
        const { error: updateError } = await supabase
          .from("agendamento")
          .update({ reminder_1h_sent: true })
          .eq("id", ag.id);

        if (updateError) {
          console.error(
            `[REMINDER] Failed to update reminder_1h_sent for ${ag.id}:`,
            updateError.message
          );
          results.errors++;
        } else {
          results.reminders_1h++;
        }
      } else {
        results.errors++;
      }
    }

    console.log("[REMINDER] Results:", results);

    return jsonResponse({ success: true, results });
  } catch (error) {
    console.error("[REMINDER] Error:", (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
