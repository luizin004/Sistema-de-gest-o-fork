import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache em memória para performance (5 minutos TTL)
const phoneTenantCache = new Map<string, {
  tenantId: string;
  leadId: string;
  cachedAt: number;
}>();

// Cache para configurações UAZAPI (1 hora TTL)
const uazapiConfigCache = new Map<string, {
  token: string;
  instanceId: string;
  phoneNumber: string;
  cachedAt: number;
}>();

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

// Extração otimizada de telefone do metadata
function extractPhoneFromMetadata(metadata: any): string | null {
  if (!metadata) return null;
  
  // Múltiplas fontes em ordem de prioridade
  const phoneSources = [
    metadata?.chat?.phone,
    metadata?.phone,
    metadata?.chat?.wa_chatid?.split('@')[0],
    metadata?.chat?.wa_fastid?.split(':').pop()
  ];
  
  for (const phone of phoneSources) {
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized) return normalized;
    }
  }
  
  return null;
}

// Extração eficiente de dados do webhook
function extractMessageDataFromWebhook(payload: any) {
  const phone = extractPhoneFromMetadata(payload);
  const direction = payload.fromMe ? "outbound" : "inbound";
  const content = payload.text || payload.content || "";
  
  return {
    phone,
    direction,
    content,
    messageType: payload.messageType || payload.type || "text",
    providerId: payload.messageid || payload.id,
    metadata: {
      ...payload,
      extractedPhone: phone,
      contactName: payload.chat?.name || payload.senderName,
      processedAt: new Date().toISOString()
    }
  };
}

// Cache de tenant por telefone
async function findTenantByPhoneCached(phone: string): Promise<string | null> {
  // 1. Cache em memória (5 minutos)
  const memCache = phoneTenantCache.get(phone);
  if (memCache && (Date.now() - memCache.cachedAt) < 5 * 60 * 1000) {
    return memCache.tenantId;
  }
  
  return null; // Fallback para database
}

// Salvar no cache
async function cachePhoneTenant(phone: string, tenantId: string, leadId: string) {
  phoneTenantCache.set(phone, {
    tenantId,
    leadId,
    cachedAt: Date.now()
  });
}

async function findLeadByPhone(supabase: ReturnType<typeof createServiceClient>, phone: string) {
  // 1. Tentar cache primeiro
  const cachedTenant = await findTenantByPhoneCached(phone);
  if (cachedTenant) {
    // Buscar lead do tenant cacheado
    const { data, error } = await supabase
      .from("posts")
      .select("id, telefone, nome, tenant_id")
      .eq("telefone", phone)
      .eq("tenant_id", cachedTenant)
      .limit(1)
      .maybeSingle();
    
    if (!error && data) {
      return data;
    }
  }
  
  // 2. Busca no banco com variants
  const variants = buildPhoneVariants(phone);
  if (variants.length === 0) return null;

  const filter = variants.map((variant) => `telefone.eq.${variant}`).join(",");
  const { data, error } = await supabase
    .from("posts")
    .select("id, telefone, nome, tenant_id")
    .or(filter)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[UAZAPI-CHAT] Error finding lead by phone:", error);
    return null;
  }

  // 3. Salvar no cache se encontrado
  if (data && data.tenant_id) {
    await cachePhoneTenant(phone, data.tenant_id, data.id);
  }

  return data;
}

// Função para obter configuração UAZAPI do tenant
async function getUazapiConfig(supabase: ReturnType<typeof createServiceClient>, tenantId: string) {
  // Verificar cache primeiro
  const cached = uazapiConfigCache.get(tenantId);
  if (cached && (Date.now() - cached.cachedAt) < 60 * 60 * 1000) {
    return cached;
  }
  
  // Buscar do banco
  const { data, error } = await supabase
    .from("usuarios")
    .select("uazapi_token, uazapi_instance_id, uazapi_phone_number")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .limit(1)
    .single();
  
  if (error || !data || !data.uazapi_token) {
    console.error("[UAZAPI-CHAT] Error getting UAZAPI config:", error);
    return null;
  }
  
  // Salvar no cache
  const config = {
    token: data.uazapi_token,
    instanceId: data.uazapi_instance_id,
    phoneNumber: data.uazapi_phone_number,
    cachedAt: Date.now()
  };
  
  uazapiConfigCache.set(tenantId, config);
  return config;
}

async function sendViaUazapi(supabase: ReturnType<typeof createServiceClient>, tenantId: string, number: string, text: string) {
  const config = await getUazapiConfig(supabase, tenantId);
  if (!config) {
    throw new Error("UAZAPI configuration not found for tenant");
  }
  
  const payload = { number: normalizePhone(number), text };
  console.log(`[UAZAPI-CHAT] Sending message to ${payload.number} for tenant ${tenantId}`);

  const response = await fetch(`https://api.uazapi.com/v1/${config.instanceId}/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
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
    .select("id, telefone, nome, tenant_id")
    .eq("id", leadId)
    .single();

  if (leadError || !lead?.telefone || !lead?.tenant_id) {
    return new Response(
      JSON.stringify({ error: "Lead not found or missing phone/tenant" }),
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
      tenant_id: lead.tenant_id, // 🎯 Multi-tenant
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

  // Enviar via UAZAPI com configuração do tenant
  try {
    await sendViaUazapi(supabase, lead.tenant_id, formattedPhone, message);
  } catch (sendError) {
    console.error("[UAZAPI-CHAT] Failed to send via UAZAPI:", sendError);
    
    // Atualizar status para failed
    await supabase
      .from("uazapi_chat_messages")
      .update({
        status: "failed",
        metadata: { 
          ...storedMessage.metadata, 
          sendError: (sendError as Error).message 
        }
      })
      .eq("id", storedMessage.id);
      
    return new Response(
      JSON.stringify({ error: "Failed to send message" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 },
    );
  }

  // Send webhook notification to iautomatize
  try {
    const webhookPayload = {
      phone: formattedPhone,
      message: message,
      timestamp: new Date().toISOString(),
      source: "lovable_crm",
      tenantId: lead.tenant_id
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
      tenantId: lead.tenant_id,
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
  console.log("[UAZAPI-CHAT] Webhook received with rich metadata");
  
  // Usar nova função de extração otimizada
  const messageData = extractMessageDataFromWebhook(payload);
  
  if (!messageData.phone) {
    console.log("[UAZAPI-CHAT] No phone found in metadata");
    return new Response(
      JSON.stringify({ error: "No phone found in metadata" }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  console.log(`[UAZAPI-CHAT] Processing message for phone: ${messageData.phone}, direction: ${messageData.direction}`);
  
  // Verificar duplicata por provider_id
  if (messageData.providerId) {
    const { data: existingMessage, error: existingError } = await supabase
      .from("uazapi_chat_messages")
      .select("id")
      .eq("provider_id", messageData.providerId)
      .maybeSingle();

    if (existingError) {
      console.error("[UAZAPI-CHAT] Error checking existing message:", existingError);
    } else if (existingMessage) {
      console.log("[UAZAPI-CHAT] Message already stored, skipping provider_id:", messageData.providerId);
      return new Response(
        JSON.stringify({ message: "Duplicate message skipped", providerId: messageData.providerId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Buscar lead e tenant_id com cache
  const lead = await findLeadByPhone(supabase, messageData.phone);
  console.log("[UAZAPI-CHAT] Lead found:", lead?.id, "Tenant:", lead?.tenant_id);
  
  // Inserir com tenant_id e metadata otimizado
  const insertData = {
    lead_id: lead?.id ?? null,
    phone_number: messageData.phone,
    direction: messageData.direction,
    content: messageData.content,
    status: messageData.direction === "inbound" ? "delivered" : "sent",
    provider_id: messageData.providerId,
    message_type: messageData.messageType,
    tenant_id: lead?.tenant_id ?? null, // 🎯 Isolamento multi-tenant
    metadata: {
      ...messageData.metadata,
      directionSource: payload.fromMe ? "provider_outbound" : "provider_inbound",
      processedAt: new Date().toISOString(),
      tenantDiscovery: lead?.tenant_id ? "found" : "not_found"
    }
  };
  
  console.log("[UAZAPI-CHAT] Inserting message with tenant isolation");
  
  const { error, data } = await supabase.from("uazapi_chat_messages").insert(insertData).select();
  
  if (error) {
    console.error("[UAZAPI-CHAT] Insert error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to insert message", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  console.log("[UAZAPI-CHAT] Message inserted successfully:", data?.[0]?.id);
  
  // Atualizar ultima_mensagem_at no lead (apenas se tiver tenant)
  if (lead?.id && lead?.tenant_id) {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("posts")
      .update({ 
        ultima_mensagem_at: now,
        updated_at: now
      })
      .eq("id", lead.id)
      .eq("tenant_id", lead.tenant_id); // 🎯 Segurança adicional
    
    if (updateError) {
      console.error("[UAZAPI-CHAT] Error updating ultima_mensagem_at:", updateError);
    } else {
      console.log("[UAZAPI-CHAT] ultima_mensagem_at updated for lead:", lead.id);
    }
  }

  return new Response(
    JSON.stringify({ 
      processed: 1, 
      messageId: data?.[0]?.id,
      tenantId: lead?.tenant_id,
      phone: messageData.phone,
      direction: messageData.direction
    }),
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
    
    console.log("[UAZAPI-CHAT] Request received - User-Agent:", userAgent);
    console.log("[UAZAPI-CHAT] Request URL:", req.url);
    
    // Check if this is UAZAPI webhook traffic
    if (userAgent === "uazapiGO-Webhook/1.0") {
      console.log("[UAZAPI-CHAT] UAZAPI webhook detected - processing...");
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
