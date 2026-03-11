import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Timeout safety margin (50s of 60s max)
const MAX_EXECUTION_MS = 50_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Check if current time is within business hours (America/Sao_Paulo)
 * Mon-Fri 08:00-18:00, Sat 09:00-12:00
 */
function isBusinessHours(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";

  // Sunday
  if (weekday === "dom") return false;

  // Saturday: 09:00-12:00
  if (weekday === "sáb" || weekday === "sab") {
    return hour >= 9 && hour < 12;
  }

  // Mon-Fri: 08:00-18:00
  return hour >= 8 && hour < 18;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Self-invoke this function to continue processing
 */
async function selfInvoke(campanhaId: string, tenantId: string, userId: string) {
  const selfUrl = `${SUPABASE_URL}/functions/v1/disparos-manual-worker`;
  try {
    await fetch(selfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "X-Tenant-Id": tenantId,
        "X-User-Id": userId,
      },
      body: JSON.stringify({ campanha_id: campanhaId }),
    });
    console.log(`[WORKER] Self-invoked for campaign ${campanhaId}`);
  } catch (err) {
    console.error(`[WORKER] Self-invoke failed:`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const tenantId = req.headers.get("X-Tenant-Id");
    const userId = req.headers.get("X-User-Id");

    if (!tenantId || !userId) {
      return jsonResponse({ error: "Missing tenant or user ID" }, 400);
    }

    const body = await req.json();
    const campanhaId = body.campanha_id;

    if (!campanhaId) {
      return jsonResponse({ error: "Missing campanha_id" }, 400);
    }

    console.log(`[WORKER] Starting for campaign ${campanhaId}, tenant ${tenantId}`);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch campaign
    const { data: campanha, error: campanhaError } = await supabase
      .from("disparos_manual_campanhas")
      .select("*")
      .eq("id", campanhaId)
      .eq("tenant_id", tenantId)
      .single();

    if (campanhaError || !campanha) {
      console.error(`[WORKER] Campaign not found:`, campanhaError);
      return jsonResponse({ error: "Campaign not found" }, 404);
    }

    // Check if campaign should be processing
    if (campanha.status !== "processando") {
      console.log(`[WORKER] Campaign status is '${campanha.status}', stopping.`);
      return jsonResponse({ status: "stopped", reason: `Campaign is ${campanha.status}` });
    }

    // Fetch UAZAPI instance
    const { data: instance, error: instanceError } = await supabase
      .from("uazapi_instances")
      .select("instance_id, token, api_url")
      .eq("id", campanha.uazapi_instance_id)
      .eq("tenant_id", tenantId)
      .single();

    if (instanceError || !instance) {
      console.error(`[WORKER] UAZAPI instance not found:`, instanceError);
      await supabase
        .from("disparos_manual_campanhas")
        .update({ status: "erro", updated_at: new Date().toISOString() })
        .eq("id", campanhaId);
      return jsonResponse({ error: "UAZAPI instance not found" }, 400);
    }

    const { token: uazapiToken, api_url: uazapiApiUrl } = instance;
    const uazapiSendUrl = `${uazapiApiUrl || "https://oralaligner.uazapi.com"}/send/text`;

    const startTime = Date.now();
    let processed = campanha.processed || 0;
    let success = campanha.success || 0;
    let errorCount = campanha.error || 0;
    let batchSentCount = campanha.batch_sent_count || 0;

    // Main processing loop
    while (true) {
      // Check time limit - self-invoke if approaching timeout
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log(`[WORKER] Approaching timeout, self-invoking...`);
        // Save current counters before self-invoking
        await supabase
          .from("disparos_manual_campanhas")
          .update({
            processed,
            success,
            error: errorCount,
            batch_sent_count: batchSentCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campanhaId);

        await selfInvoke(campanhaId, tenantId, userId);
        return jsonResponse({ status: "continuing", processed, success, error: errorCount });
      }

      // Re-check campaign status (pause/cancel detection)
      const { data: statusCheck } = await supabase
        .from("disparos_manual_campanhas")
        .select("status")
        .eq("id", campanhaId)
        .single();

      if (!statusCheck || statusCheck.status !== "processando") {
        console.log(`[WORKER] Campaign status changed to '${statusCheck?.status}', stopping.`);
        break;
      }

      // Check business hours
      if (campanha.only_business_hours && !isBusinessHours()) {
        console.log(`[WORKER] Outside business hours, will re-invoke in 5 minutes.`);
        await supabase
          .from("disparos_manual_campanhas")
          .update({
            processed,
            success,
            error: errorCount,
            batch_sent_count: batchSentCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campanhaId);

        // Wait 5 minutes then re-invoke
        await sleep(5000);
        await selfInvoke(campanhaId, tenantId, userId);
        return jsonResponse({ status: "waiting_business_hours" });
      }

      // Check batch limits
      if (campanha.batch_size > 0 && batchSentCount >= campanha.batch_size) {
        const pauseMs = (campanha.batch_pause_hours || 0) * 3600 * 1000;
        const lastSentTime = campanha.last_sent_at
          ? new Date(campanha.last_sent_at).getTime()
          : 0;
        const elapsed = Date.now() - lastSentTime;

        if (elapsed < pauseMs) {
          console.log(
            `[WORKER] Batch limit reached, waiting. Elapsed: ${elapsed}ms, Need: ${pauseMs}ms`
          );
          // Save and re-invoke after a short wait
          await supabase
            .from("disparos_manual_campanhas")
            .update({
              processed,
              success,
              error: errorCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campanhaId);

          await sleep(5000);
          await selfInvoke(campanhaId, tenantId, userId);
          return jsonResponse({ status: "batch_pause" });
        }
        // Batch pause elapsed, reset counter
        batchSentCount = 0;
      }

      // Get next pending lead
      const { data: lead, error: leadError } = await supabase
        .from("disparos_manual_leads")
        .select("*")
        .eq("campanha_id", campanhaId)
        .eq("status", "pendente")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (leadError || !lead) {
        // No more leads - campaign completed
        console.log(`[WORKER] No more pending leads. Campaign completed.`);
        await supabase
          .from("disparos_manual_campanhas")
          .update({
            status: "concluido",
            processed,
            success,
            error: errorCount,
            batch_sent_count: batchSentCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campanhaId);
        break;
      }

      // Send message via UAZAPI
      let sendSuccess = false;
      let sendError = "";
      let uazapiResponse: any = null;

      try {
        const payload = {
          number: lead.telefone,
          text: lead.mensagem_final,
        };

        console.log(`[WORKER] Sending to ${lead.telefone} via ${uazapiSendUrl}`);

        const response = await fetch(uazapiSendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${uazapiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        if (response.ok) {
          try {
            uazapiResponse = JSON.parse(responseText);
          } catch {
            uazapiResponse = { raw: responseText };
          }
          sendSuccess = true;
          console.log(`[WORKER] ✅ Sent to ${lead.telefone}:`, responseText.slice(0, 200));
        } else {
          sendError = `HTTP ${response.status} | URL: ${uazapiSendUrl} | Resposta: ${responseText}`;
          console.error(`[WORKER] ❌ Failed ${lead.telefone}: ${sendError}`);
        }
      } catch (err: any) {
        sendError = `Erro de rede: ${err.message} | URL: ${uazapiSendUrl}`;
        console.error(`[WORKER] ❌ Network error for ${lead.telefone}:`, err.message);
      }

      const now = new Date().toISOString();

      // Update lead status
      await supabase
        .from("disparos_manual_leads")
        .update({
          status: sendSuccess ? "enviado" : "erro",
          error_message: sendSuccess ? null : sendError,
          sent_at: now,
        })
        .eq("id", lead.id);

      // Save to uazapi_chat_messages for CRM integration
      await supabase.from("uazapi_chat_messages").insert({
        tenant_id: tenantId,
        lead_id: null,
        phone_number: lead.telefone,
        direction: "outbound",
        content: lead.mensagem_final,
        media_url: null,
        media_type: null,
        status: sendSuccess ? "sent" : "failed",
        provider_id: uazapiResponse?.id || null,
        message_type: "text",
        metadata: {
          wasSentByApi: true,
          source: "disparos_manual",
          campanha_id: campanhaId,
          uazapi_response: uazapiResponse,
          error: sendSuccess ? undefined : sendError,
          sent_at: now,
        },
      });

      // Update counters
      processed++;
      if (sendSuccess) {
        success++;
      } else {
        errorCount++;
      }
      batchSentCount++;

      // Update campaign counters
      await supabase
        .from("disparos_manual_campanhas")
        .update({
          processed,
          success,
          error: errorCount,
          batch_sent_count: batchSentCount,
          last_sent_at: now,
          updated_at: now,
        })
        .eq("id", campanhaId);

      console.log(
        `[WORKER] Lead ${lead.id}: ${sendSuccess ? "OK" : "FAIL"} | Progress: ${processed}/${campanha.total}`
      );

      // Delay between messages
      const delayMs = (campanha.delay_seconds || 60) * 1000;
      // Only sleep if there's more time available
      if (Date.now() - startTime + delayMs < MAX_EXECUTION_MS) {
        await sleep(delayMs);
      } else {
        // Not enough time for full delay, save and self-invoke
        await selfInvoke(campanhaId, tenantId, userId);
        return jsonResponse({ status: "continuing", processed, success, error: errorCount });
      }
    }

    return jsonResponse({
      status: "done",
      processed,
      success,
      error: errorCount,
    });
  } catch (error: any) {
    console.error("[WORKER] Fatal error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
