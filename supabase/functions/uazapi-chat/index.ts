import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UAZAPI_CONFIG = {
  url: "https://oralaligner.uazapi.com/send/text",
  token: "fcd2612d-6b25-4c8f-aace-29df197301ff",
  agentNumber: "553181036689",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
  });
}

function normalizePhone(rawPhone: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function buildPhoneVariants(rawPhone: string): string[] {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return [];
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(`+${normalized}`);
  if (normalized.startsWith("55")) {
    variants.add(normalized.substring(2));
    variants.add(`0${normalized.substring(2)}`);
  }
  return Array.from(variants).filter(Boolean);
}

async function findLeadByPhone(supabase: ReturnType<typeof createServiceClient>, phone: string) {
  const variants = buildPhoneVariants(phone);
  if (variants.length === 0) return null;

  const filter = variants.map((variant) => `telefone.eq.${variant}`).join(",");
  const { data, error } = await supabase
    .from("posts")
    .select("id, telefone, nome")
    .or(filter)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[UAZAPI-CHAT] Error finding lead by phone:", error);
    return null;
  }

  return data;
}

async function sendViaUazapi(number: string, text: string) {
  const payload = { number: normalizePhone(number), text };
  console.log(`[UAZAPI-CHAT] Sending message to ${payload.number}`);

  const response = await fetch(UAZAPI_CONFIG.url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      token: UAZAPI_CONFIG.token,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`UAZAPI error ${response.status}: ${bodyText}`);
  }

  try {
    return JSON.parse(bodyText);
  } catch (_) {
    return { raw: bodyText };
  }
}

async function handleCrmSend(payload: any) {
  const { leadId, message, tempId } = payload;
  if (!leadId || !message) {
    return new Response(
      JSON.stringify({ error: "leadId and message are required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data: lead, error: leadError } = await supabase
    .from("posts")
    .select("id, telefone, nome")
    .eq("id", leadId)
    .single();

  if (leadError || !lead?.telefone) {
    return new Response(
      JSON.stringify({ error: "Lead not found or missing phone" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
    );
  }

  const formattedPhone = normalizePhone(lead.telefone);

  const { data: storedMessage, error: insertError } = await supabase
    .from("uazapi_chat_messages")
    .insert({
      lead_id: lead.id,
      phone_number: formattedPhone,
      direction: "outbound",
      content: message,
      status: "sent",
      metadata: { source: "crm", tempId, leadName: lead.nome },
    })
    .select()
    .single();

  if (insertError || !storedMessage) {
    console.error("[UAZAPI-CHAT] Failed to store outbound message", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to store message" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }

  // Send webhook notification to iautomatize
  try {
    const webhookPayload = {
      phone: formattedPhone,
      message: message,
      timestamp: new Date().toISOString(),
      source: "lovable_crm"
    };
    
    console.log("[UAZAPI-CHAT] Sending webhook to iautomatize:", webhookPayload);
    
    const webhookResponse = await fetch("https://app.iautomatize.me/api/iwh/17ee761e6042e41098898fb4cdf16e70", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });
    
    if (!webhookResponse.ok) {
      console.error("[UAZAPI-CHAT] Webhook failed:", webhookResponse.status, webhookResponse.statusText);
      await supabase
        .from("uazapi_chat_messages")
        .update({
          status: "error",
          metadata: { ...storedMessage.metadata, webhookError: `Failed to send webhook: ${webhookResponse.status}` },
        })
        .eq("id", storedMessage.id);
      
      return new Response(
        JSON.stringify({ error: "Failed to send webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 },
      );
    } else {
      console.log("[UAZAPI-CHAT] Webhook sent successfully");
    }
  } catch (webhookError) {
    console.error("[UAZAPI-CHAT] Error sending webhook:", webhookError);
    await supabase
      .from("uazapi_chat_messages")
      .update({
        status: "error",
        metadata: { ...storedMessage.metadata, webhookError: (webhookError as Error).message },
      })
      .eq("id", storedMessage.id);
    
    return new Response(
      JSON.stringify({ error: "Webhook error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 },
    );
  }

  return new Response(
    JSON.stringify({
      id: storedMessage.id,
      leadId: lead.id,
      phone: formattedPhone,
      status: "sent",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

type UazapiWebhookMessage = {
  from?: string;
  to?: string;
  text?: string;
  message?: string;
  messageId?: string;
  id?: string;
  type?: string;
  timestamp?: string;
  wasSentByApi?: boolean;
};

function extractMessagesFromWebhook(payload: any): UazapiWebhookMessage[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as UazapiWebhookMessage[];
  if (Array.isArray(payload.messages)) return payload.messages as UazapiWebhookMessage[];
  return [payload as UazapiWebhookMessage];
}

async function handleWebhook(payload: any) {
  const supabase = createServiceClient();
  console.log("[UAZAPI-CHAT] Webhook received:", JSON.stringify(payload, null, 2));
  
  // Handle UAZAPI specific payload structure
  let messages: any[] = [];
  
  if (payload?.message && payload?.chat) {
    // UAZAPI format: single message with chat info
    messages = [{
      ...payload.message,
      chat: payload.chat,
      phone: payload.chat.phone,
      senderName: payload.message.senderName || payload.chat.name
    }];
  } else {
    // Fallback to original extraction logic
    messages = extractMessagesFromWebhook(payload);
  }
  
  console.log("[UAZAPI-CHAT] Extracted messages:", messages.length);
  
  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ message: "No messages to process" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const results: { providerId?: string | null; saved: boolean; reason?: string }[] = [];

  for (const msg of messages) {
    console.log("[UAZAPI-CHAT] Processing message:", JSON.stringify(msg, null, 2));
    
    const providerId = msg.messageid ?? msg.id ?? msg.provider_id ?? null;

    if (providerId) {
      const { data: existingMessage, error: existingError } = await supabase
        .from("uazapi_chat_messages")
        .select("id")
        .eq("provider_id", providerId)
        .maybeSingle();

      if (existingError) {
        console.error("[UAZAPI-CHAT] Error checking existing message:", existingError);
      } else if (existingMessage) {
        console.log("[UAZAPI-CHAT] Message already stored, skipping provider_id:", providerId);
        results.push({ providerId, saved: false, reason: "duplicate_provider_id" });
        continue;
      }
    }

    // Extract phone from multiple possible fields
    const phone = msg.phone || msg.sender_pn?.split('@')[0] || msg.from || msg.to;
    if (!phone) {
      console.log("[UAZAPI-CHAT] Missing phone in message");
      results.push({ providerId, saved: false, reason: "missing_phone" });
      continue;
    }

    const formattedPhone = normalizePhone(phone);
    const lead = await findLeadByPhone(supabase, formattedPhone);
    console.log("[UAZAPI-CHAT] Lead found:", lead?.id || "null");

    const direction = msg.fromMe ? "outbound" : "inbound";
    const insertData = {
      lead_id: lead?.id ?? null,
      phone_number: formattedPhone,
      direction,
      content: msg.text ?? msg.content ?? msg.message ?? "",
      status: direction === "inbound" ? "delivered" : "sent",
      provider_id: providerId,
      message_type: msg.type ?? msg.messageType ?? "text",
      metadata: { ...msg, directionSource: msg.fromMe ? "provider_outbound" : "provider_inbound" },
    };
    
    console.log("[UAZAPI-CHAT] Inserting message:", JSON.stringify(insertData, null, 2));

    const { error, data } = await supabase.from("uazapi_chat_messages").insert(insertData).select();
    
    if (error) {
      console.error("[UAZAPI-CHAT] Insert error:", error);
    } else {
      console.log("[UAZAPI-CHAT] Message inserted successfully:", data);
      
      // Atualizar ultima_mensagem_at no lead para rastreamento de tempo de resposta
      if (lead?.id) {
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("posts")
          .update({ 
            ultima_mensagem_at: now,
            updated_at: now
          })
          .eq("id", lead.id);
        
        if (updateError) {
          console.error("[UAZAPI-CHAT] Error updating ultima_mensagem_at:", updateError);
        } else {
          console.log("[UAZAPI-CHAT] ultima_mensagem_at updated for lead:", lead.id);
        }
      }
    }

    results.push({ providerId, saved: !error, reason: error?.message });
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const userAgent = req.headers.get("user-agent") || "";
    const url = new URL(req.url);
    
    console.log("[UAZAPI-CHAT] Request received - User-Agent:", userAgent);
    console.log("[UAZAPI-CHAT] Request URL:", req.url);
    
    // Check if this is UAZAPI webhook traffic
    if (userAgent === "uazapiGO-Webhook/1.0") {
      console.log("[UAZAPI-CHAT] UAZAPI webhook detected - authenticating...");
      
      // Option 1: Validate via query string token (if configured in UAZAPI)
      const queryToken = url.searchParams.get("token");
      if (queryToken && queryToken !== UAZAPI_CONFIG.token) {
        console.log("[UAZAPI-CHAT] Invalid query token:", queryToken);
        return new Response(
          JSON.stringify({ error: "Invalid query token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
        );
      }
      
      // Option 2: Validate via header token (if UAZAPI adds it later)
      const headerToken = req.headers.get("token");
      if (headerToken && headerToken !== UAZAPI_CONFIG.token) {
        console.log("[UAZAPI-CHAT] Invalid header token:", headerToken);
        return new Response(
          JSON.stringify({ error: "Invalid header token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
        );
      }
      
      // If no token provided, accept based on User-Agent only
      if (!queryToken && !headerToken) {
        console.log("[UAZAPI-CHAT] No token provided - accepting based on User-Agent");
      }
      
      console.log("[UAZAPI-CHAT] UAZAPI webhook authenticated successfully");
      return await handleWebhook(payload);
    }
    
    // This is CRM traffic - require Bearer token
    console.log("[UAZAPI-CHAT] CRM traffic detected - validating Bearer token");
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[UAZAPI-CHAT] Missing or invalid Bearer token");
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    // Handle CRM send action
    if (payload?.action === "send") {
      console.log("[UAZAPI-CHAT] Processing CRM send action");
      return await handleCrmSend(payload);
    }

    console.log("[UAZAPI-CHAT] Invalid CRM request - no action specified");
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  } catch (error) {
    console.error("[UAZAPI-CHAT] Unexpected error", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
