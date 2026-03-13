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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve tenant from JWT or header
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let tenantId: string | null = null;

    if (token && token.startsWith("ey")) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user && !authError) {
        const { data: profile } = await supabase
          .from("usuarios")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        tenantId = profile?.tenant_id;
      }
    }

    if (!tenantId) {
      tenantId = req.headers.get("x-tenant-id");
    }

    const body = await req.json();
    const { instance_id, tenant_id: bodyTenantId } = body;

    if (!tenantId && bodyTenantId) {
      tenantId = bodyTenantId;
    }

    if (!tenantId) {
      return jsonResponse({ error: "Could not resolve tenant" }, 401);
    }

    if (!instance_id) {
      return jsonResponse({ error: "instance_id is required" }, 400);
    }

    // Get instance data from DB
    const { data: instance, error: instanceError } = await supabase
      .from("uazapi_instances")
      .select("id, instance_id, token, api_url")
      .eq("id", instance_id)
      .eq("tenant_id", tenantId)
      .single();

    if (instanceError || !instance) {
      return jsonResponse({ error: "Instance not found" }, 404);
    }

    const uazapiToken = instance.token;
    const uazapiApiUrl = instance.api_url || "https://oralaligner.uazapi.com";
    const webhookUrl = "https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/chatbot-webhook";

    console.log(`[uazapi-set-webhook] Setting webhook for instance ${instance.instance_id}`);
    console.log(`[uazapi-set-webhook] API URL: ${uazapiApiUrl}`);
    console.log(`[uazapi-set-webhook] Webhook URL: ${webhookUrl}`);

    // Call UAZAPI API to set the webhook
    const setWebhookUrl = `${uazapiApiUrl}/setWebhook`;

    const response = await fetch(setWebhookUrl, {
      method: "POST",
      headers: {
        "token": uazapiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`[uazapi-set-webhook] Response status: ${response.status}`);
    console.log(`[uazapi-set-webhook] Response:`, responseData);

    if (!response.ok) {
      return jsonResponse({
        error: "Failed to set webhook on UAZAPI",
        details: responseData,
        status: response.status,
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: "Webhook configured successfully",
      webhookUrl,
      uazapiResponse: responseData,
    });
  } catch (err: any) {
    console.error("[uazapi-set-webhook] Unhandled error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
