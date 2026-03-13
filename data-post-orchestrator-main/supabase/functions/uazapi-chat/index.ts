import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract tenant from auth token
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Get tenant_id from user profile
    const { data: profile } = await supabase
      .from("usuarios")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return jsonResponse({ error: "Tenant not found" }, 400);
    }

    const body = await req.json();
    const { action, leadId, message, tempId } = body;

    if (action !== "send") {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    if (!leadId || !message) {
      return jsonResponse({ error: "leadId and message are required" }, 400);
    }

    // Get lead phone from posts table
    const { data: lead, error: leadError } = await supabase
      .from("posts")
      .select("id, telefone, nome")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }

    if (!lead.telefone) {
      return jsonResponse({ error: "Lead has no phone number" }, 400);
    }

    // Get UAZAPI instance for this tenant
    const { data: instance, error: instanceError } = await supabase
      .from("uazapi_instances")
      .select("instance_id, token, api_url")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    if (instanceError || !instance) {
      return jsonResponse({ error: "UAZAPI instance not configured" }, 400);
    }

    const uazapiToken = instance.token;
    const uazapiApiUrl = instance.api_url || "https://oralaligner.uazapi.com";
    const uazapiSendUrl = `${uazapiApiUrl}/send/text`;

    // Send message via UAZAPI
    let uazapiResponse: any = null;
    let sendSuccess = false;
    let sendError = "";

    try {
      const response = await fetch(uazapiSendUrl, {
        method: "POST",
        headers: {
          token: uazapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: lead.telefone,
          text: message,
        }),
      });

      const responseText = await response.text();

      if (response.ok) {
        try {
          uazapiResponse = JSON.parse(responseText);
        } catch {
          uazapiResponse = { raw: responseText };
        }
        sendSuccess = true;
      } else {
        sendError = `HTTP ${response.status}: ${responseText}`;
      }
    } catch (err: any) {
      sendError = `Network error: ${err.message}`;
    }

    const now = new Date().toISOString();

    // Save to uazapi_chat_messages
    const { data: savedMsg } = await supabase
      .from("uazapi_chat_messages")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        phone_number: lead.telefone,
        direction: "outbound",
        content: message,
        media_url: null,
        media_type: null,
        status: sendSuccess ? "sent" : "failed",
        provider_id: uazapiResponse?.messageid || uazapiResponse?.id || null,
        message_type: "text",
        metadata: {
          wasSentByApi: true,
          source: "chat_ao_vivo",
          tempId,
          uazapi_response: uazapiResponse,
          error: sendSuccess ? undefined : sendError,
          sent_at: now,
        },
      })
      .select("id, created_at")
      .single();

    if (!sendSuccess) {
      return jsonResponse({ error: sendError, tempId }, 502);
    }

    return jsonResponse({
      id: savedMsg?.id || tempId,
      created_at: savedMsg?.created_at || now,
      providerId: uazapiResponse?.messageid || uazapiResponse?.id || null,
      status: "sent",
    });
  } catch (err: any) {
    console.error("[uazapi-chat] Unhandled error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
