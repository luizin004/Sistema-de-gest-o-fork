import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constants & shared helpers (mirrors disparos-manual-worker pattern)
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Brazilian phone normalisation (with/without 55, with/without 9th digit)
// ---------------------------------------------------------------------------

function normalizePhone(rawPhone: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variants: string[] = [normalized];

  // Without country code
  if (normalized.startsWith("55")) {
    variants.push(normalized.substring(2));
  }

  // With / without 9th digit (Brazilian mobile)
  const withoutCountry = normalized.startsWith("55")
    ? normalized.substring(2)
    : normalized;

  if (withoutCountry.length === 11) {
    // Has 9th digit → add variant without
    variants.push("55" + withoutCountry.substring(0, 2) + withoutCountry.substring(3));
    variants.push(withoutCountry.substring(0, 2) + withoutCountry.substring(3));
  } else if (withoutCountry.length === 10) {
    // Missing 9th digit → add variant with
    variants.push("55" + withoutCountry.substring(0, 2) + "9" + withoutCountry.substring(2));
    variants.push(withoutCountry.substring(0, 2) + "9" + withoutCountry.substring(2));
  }

  return [...new Set(variants)];
}

// ---------------------------------------------------------------------------
// UAZAPI payload extraction
// ---------------------------------------------------------------------------

interface UazapiWebhookPayload {
  // Message envelope fields (vary by UAZAPI version)
  instanceId?: string;
  instance_id?: string;
  instanceName?: string;
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    audioMessage?: { url?: string; seconds?: number; mimetype?: string };
    imageMessage?: { url?: string; caption?: string; mimetype?: string };
    videoMessage?: { url?: string; caption?: string; mimetype?: string };
    documentMessage?: { url?: string; title?: string; mimetype?: string };
    stickerMessage?: { url?: string };
  };
  messageType?: string;
  pushName?: string;
  // Flat-format fields
  phone?: string;
  body?: string;
  isGroup?: boolean;
  fromGroup?: boolean;
  type?: string;
  // Media
  mediaUrl?: string;
  duration?: number;
  // Flat event wrapper
  data?: UazapiWebhookPayload;
}

interface ExtractedMessage {
  phone: string;
  messageText: string;
  instanceId: string;
  senderName: string;
  mediaUrl: string | null;
  messageType: string;
  isGroup: boolean;
  audioDuration: number | null;
}

function extractMessage(raw: UazapiWebhookPayload): ExtractedMessage | null {
  // UAZAPI sometimes wraps the actual payload in a `data` field
  const payload: UazapiWebhookPayload = raw.data ?? raw;

  // ---------- isGroup check ----------
  const isGroup =
    payload.isGroup === true ||
    payload.fromGroup === true ||
    (payload.key?.remoteJid ?? "").includes("@g.us");

  // ---------- instanceId ----------
  const instanceId =
    payload.instanceId ||
    payload.instance_id ||
    payload.instanceName ||
    "";

  // ---------- phone ----------
  let phone =
    payload.phone ||
    payload.key?.remoteJid?.replace(/@[a-z.]+$/, "") ||
    "";

  // Ignore status broadcasts and groups
  if (!phone || phone === "status@broadcast") return null;
  if (isGroup) return null;

  phone = normalizePhone(phone);

  // ---------- senderName ----------
  const senderName = payload.pushName || "";

  // ---------- messageType ----------
  const msgObj = payload.message;
  let messageType =
    payload.messageType ||
    payload.type ||
    "text";

  // Normalise type aliases
  if (msgObj?.audioMessage) messageType = "audio";
  else if (msgObj?.imageMessage) messageType = "image";
  else if (msgObj?.videoMessage) messageType = "video";
  else if (msgObj?.documentMessage) messageType = "document";
  else if (msgObj?.stickerMessage) messageType = "sticker";
  else if (
    msgObj?.conversation ||
    msgObj?.extendedTextMessage
  ) messageType = "text";

  // ---------- messageText ----------
  const messageText =
    payload.body ||
    msgObj?.conversation ||
    msgObj?.extendedTextMessage?.text ||
    msgObj?.imageMessage?.caption ||
    msgObj?.videoMessage?.caption ||
    msgObj?.documentMessage?.title ||
    "";

  // ---------- mediaUrl ----------
  const mediaUrl =
    payload.mediaUrl ||
    msgObj?.audioMessage?.url ||
    msgObj?.imageMessage?.url ||
    msgObj?.videoMessage?.url ||
    msgObj?.documentMessage?.url ||
    msgObj?.stickerMessage?.url ||
    null;

  // ---------- audioDuration ----------
  const audioDuration =
    payload.duration ??
    msgObj?.audioMessage?.seconds ??
    null;

  return {
    phone,
    messageText,
    instanceId,
    senderName,
    mediaUrl,
    messageType,
    isGroup,
    audioDuration,
  };
}

// ---------------------------------------------------------------------------
// OpenAI Whisper transcription
// ---------------------------------------------------------------------------

async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    console.log(`[CHATBOT] Downloading audio for transcription: ${audioUrl}`);

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.error(`[CHATBOT] Failed to download audio: ${audioRes.status}`);
      return null;
    }

    const audioBlob = await audioRes.blob();
    const contentType = audioRes.headers.get("content-type") || "audio/ogg";

    // Determine file extension from content-type
    let ext = "ogg";
    if (contentType.includes("mp4") || contentType.includes("m4a")) ext = "mp4";
    else if (contentType.includes("webm")) ext = "webm";
    else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
    else if (contentType.includes("wav")) ext = "wav";

    const formData = new FormData();
    formData.append("file", new File([audioBlob], `audio.${ext}`, { type: contentType }));
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error(`[CHATBOT] Whisper error: ${whisperRes.status} | ${errText}`);
      return null;
    }

    const whisperData = await whisperRes.json();
    const transcription = whisperData.text?.trim() || null;
    console.log(`[CHATBOT] Transcription: ${transcription}`);
    return transcription;
  } catch (err: any) {
    console.error(`[CHATBOT] transcribeAudio error:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build system prompt
// ---------------------------------------------------------------------------

interface ChatbotConfig {
  clinic_name?: string;
  clinic_tone?: string;
  custom_instructions?: string;
  [key: string]: unknown;
}

interface Tratamento {
  id: string;
  nome: string;
}

function buildSystemPrompt(
  config: ChatbotConfig,
  tratamentos: Tratamento[],
  currentStatus: string | null
): string {
  const clinicName = config.clinic_name || "Clínica";
  const clinicTone = config.clinic_tone || "profissional e acolhedor";
  const tratamentosList =
    tratamentos.length > 0
      ? tratamentos.map((t) => `- ${t.nome}`).join("\n")
      : "- (não cadastrados)";

  const customInstructions = config.custom_instructions
    ? `\n## Instruções adicionais:\n${config.custom_instructions}`
    : "";

  return `Você é a assistente virtual da clínica ${clinicName}.
Tom: ${clinicTone}

## Regras:
1. NUNCA sugira horários - pergunte ao paciente quais horários ele tem disponíveis
2. Pergunte qual tratamento deseja (lista abaixo)
3. Quando o paciente informar horários + tratamento → informe que a equipe confirmará em breve
4. Se não souber responder ou a pergunta estiver fora do escopo → classifique como "atencao"
5. Não invente preços ou informações não fornecidas
6. Respostas curtas, estilo WhatsApp (máximo 3 linhas por mensagem)
7. Use linguagem natural, sem formalidades excessivas
8. Nunca revele que é uma IA, apresente-se como assistente da clínica${
    currentStatus === "agendou consulta"
      ? "\n9. O paciente JÁ TEM uma consulta agendada. Se ele quiser remarcar, classifique como 'reagendando' e informe que a equipe entrará em contato."
      : ""
  }

## Tratamentos disponíveis:
${tratamentosList}

## Classificação de status (retorne no JSON):
- respondeu: primeiro contato do paciente
- interagiu: conversando ativamente (3+ mensagens trocadas)
- engajou: interesse real demonstrado em tratamento específico
- interessado_agendar: paciente informou horários disponíveis E tratamento desejado → DEVE pausar bot
- atencao: não consegue lidar com a pergunta ou situação especial → DEVE pausar bot
- reagendando: paciente com consulta agendada quer remarcar${customInstructions}

## FORMATO OBRIGATÓRIO DE RESPOSTA (JSON puro, sem markdown):
{
  "reply": "texto da resposta para o paciente",
  "status": "um dos status acima",
  "detected_treatment": "nome do tratamento mencionado ou null",
  "detected_times": "horários informados pelo paciente ou null",
  "should_pause": true ou false
}

Regra de should_pause: defina como true APENAS para status "interessado_agendar" ou "atencao".`;
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completion
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  reply: string;
  status: string;
  detected_treatment: string | null;
  detected_times: string | null;
  should_pause: boolean;
}

async function callOpenAI(messages: ChatMessage[]): Promise<AIResponse | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[CHATBOT] OpenAI error: ${res.status} | ${errText}`);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AIResponse;

    // Validate required fields with safe fallbacks
    return {
      reply: parsed.reply || "Obrigado pelo contato! Como posso ajudar?",
      status: parsed.status || "respondeu",
      detected_treatment: parsed.detected_treatment || null,
      detected_times: parsed.detected_times || null,
      should_pause: parsed.should_pause === true,
    };
  } catch (err: any) {
    console.error(`[CHATBOT] callOpenAI error:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Parse body early so we can return 200 quickly to UAZAPI (avoid retries)
  let rawBody: UazapiWebhookPayload;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Create Supabase client (service role – no user JWT needed for webhooks)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("[CHATBOT] Received webhook:", JSON.stringify(rawBody).slice(0, 500));

    // ------------------------------------------------------------------
    // 1. Extract message fields from UAZAPI payload
    // ------------------------------------------------------------------
    const extracted = extractMessage(rawBody);

    if (!extracted) {
      console.log("[CHATBOT] Ignored: could not extract message or group message.");
      return jsonResponse({ ok: true, ignored: true });
    }

    const { phone, instanceId, senderName, mediaUrl, audioDuration } = extracted;
    let { messageText, messageType } = extracted;

    if (!instanceId) {
      console.warn("[CHATBOT] No instanceId in webhook payload, ignoring.");
      return jsonResponse({ ok: true, ignored: true, reason: "no_instance_id" });
    }

    // ------------------------------------------------------------------
    // 2. Look up tenant via uazapi_instances
    // ------------------------------------------------------------------
    const { data: instance, error: instanceError } = await supabase
      .from("uazapi_instances")
      .select("id, tenant_id, token, api_url, name")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instance) {
      console.warn(`[CHATBOT] Instance '${instanceId}' not found:`, instanceError?.message);
      return jsonResponse({ ok: true, ignored: true, reason: "instance_not_found" });
    }

    const { tenant_id: tenantId, token: uazapiToken, api_url: uazapiApiUrl } = instance;
    const uazapiSendUrl = `${uazapiApiUrl || "https://oralaligner.uazapi.com"}/send/text`;

    console.log(`[CHATBOT] Tenant: ${tenantId} | Phone: ${phone} | Type: ${messageType}`);

    // ------------------------------------------------------------------
    // 3. Store incoming message in uazapi_chat_messages
    // ------------------------------------------------------------------
    const inboundInsert = await supabase.from("uazapi_chat_messages").insert({
      tenant_id: tenantId,
      phone_number: phone,
      direction: "inbound",
      sender: "patient",
      content: messageText || null,
      media_url: mediaUrl || null,
      media_type: messageType !== "text" ? messageType : null,
      message_type: messageType,
      status: "received",
      metadata: {
        pushName: senderName,
        instance_id: instanceId,
        raw_type: messageType,
        audio_duration: audioDuration,
      },
    });

    if (inboundInsert.error) {
      console.warn("[CHATBOT] Failed to store inbound message:", inboundInsert.error.message);
    }

    // ------------------------------------------------------------------
    // 4. Find or create lead in `posts` table
    // ------------------------------------------------------------------
    const phoneVariants = getPhoneVariants(phone);
    console.log(`[CHATBOT] Phone variants:`, phoneVariants);

    const { data: existingLead } = await supabase
      .from("posts")
      .select("id, status, nome")
      .eq("tenant_id", tenantId)
      .in("telefone", phoneVariants)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let leadId: string;
    let currentLeadStatus: string;

    if (existingLead) {
      leadId = existingLead.id;
      currentLeadStatus = existingLead.status || "respondeu";
      console.log(`[CHATBOT] Found lead: ${leadId} | status: ${currentLeadStatus}`);
    } else {
      // Create new lead
      const newLeadId = crypto.randomUUID();
      const { error: leadInsertError } = await supabase.from("posts").insert({
        id: newLeadId,
        tenant_id: tenantId,
        telefone: phone,
        nome: senderName || phone,
        status: "respondeu",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (leadInsertError) {
        console.error("[CHATBOT] Failed to create lead:", leadInsertError.message);
        return jsonResponse({ ok: true, error: "lead_create_failed" });
      }

      leadId = newLeadId;
      currentLeadStatus = "respondeu";
      console.log(`[CHATBOT] Created new lead: ${leadId}`);
    }

    // ------------------------------------------------------------------
    // 5. Find or create chatbot_conversations record
    // ------------------------------------------------------------------
    const { data: existingConv } = await supabase
      .from("chatbot_conversations")
      .select("id, bot_active, message_count, current_funnel_status, pause_reason")
      .eq("tenant_id", tenantId)
      .eq("phone_number", phone)
      .maybeSingle();

    let convId: string;
    let botActive: boolean;
    let messageCount: number;

    if (existingConv) {
      convId = existingConv.id;
      botActive = existingConv.bot_active !== false; // default true
      messageCount = existingConv.message_count || 0;
      console.log(`[CHATBOT] Found conversation: ${convId} | bot_active: ${botActive}`);
    } else {
      const { data: newConv, error: convInsertError } = await supabase
        .from("chatbot_conversations")
        .insert({
          tenant_id: tenantId,
          post_id: leadId,
          phone_number: phone,
          bot_active: true,
          message_count: 0,
          current_funnel_status: "respondeu",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convInsertError || !newConv) {
        console.error("[CHATBOT] Failed to create conversation:", convInsertError?.message);
        return jsonResponse({ ok: true, error: "conv_create_failed" });
      }

      convId = newConv.id;
      botActive = true;
      messageCount = 0;
      console.log(`[CHATBOT] Created new conversation: ${convId}`);
    }

    // ------------------------------------------------------------------
    // 6. If bot_active=false → human is handling, skip AI
    // ------------------------------------------------------------------
    if (!botActive) {
      console.log(`[CHATBOT] Bot paused for conv ${convId}, human handling.`);
      return jsonResponse({ ok: true, ignored: true, reason: "bot_paused" });
    }

    // ------------------------------------------------------------------
    // 7. Handle audio messages
    // ------------------------------------------------------------------
    if (messageType === "audio") {
      if (!mediaUrl) {
        console.warn("[CHATBOT] Audio message without URL, ignoring.");
        return jsonResponse({ ok: true, ignored: true, reason: "audio_no_url" });
      }

      // Long audio → ask patient to summarize in text
      if (audioDuration !== null && audioDuration > 60) {
        console.log(`[CHATBOT] Audio too long (${audioDuration}s), asking patient to summarize.`);

        const longAudioReply =
          "Olá! Recebi seu áudio, mas ele está um pouquinho longo. Poderia resumir em texto? Fico feliz em ajudar! 😊";

        await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, longAudioReply, tenantId, supabase);

        return jsonResponse({ ok: true, action: "audio_too_long" });
      }

      // Transcribe audio (≤60s)
      const transcription = await transcribeAudio(mediaUrl);
      if (!transcription) {
        console.warn("[CHATBOT] Transcription failed, sending fallback reply.");
        const transcribeFallback =
          "Não consegui ouvir seu áudio. Poderia enviar sua mensagem em texto? 😊";
        await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, transcribeFallback, tenantId, supabase);
        return jsonResponse({ ok: true, action: "transcription_failed" });
      }

      messageText = transcription;
      messageType = "text";
      console.log(`[CHATBOT] Audio transcribed: "${messageText}"`);
    }

    // ------------------------------------------------------------------
    // 8. If status='agendou consulta' and patient wants to reschedule
    //    detect intent and update status to 'reagendando'
    // ------------------------------------------------------------------
    if (currentLeadStatus === "agendou consulta" && messageText) {
      const rescheduleKeywords = [
        "remarcar",
        "reagendar",
        "trocar",
        "mudar",
        "alterar",
        "cancelar",
        "outro dia",
        "outra data",
        "outra hora",
        "não posso",
        "nao posso",
        "impossível",
        "impossivel",
      ];
      const lowerMsg = messageText.toLowerCase();
      const wantsReschedule = rescheduleKeywords.some((kw) => lowerMsg.includes(kw));
      if (wantsReschedule) {
        currentLeadStatus = "reagendando";
        await supabase
          .from("posts")
          .update({ status: "reagendando", updated_at: new Date().toISOString() })
          .eq("id", leadId);
        console.log(`[CHATBOT] Lead ${leadId} status updated to 'reagendando'`);
      }
    }

    // ------------------------------------------------------------------
    // 9. Load chatbot_config, last 15 messages, and tratamentos
    // ------------------------------------------------------------------
    const [configResult, historyResult, tratamentosResult] = await Promise.all([
      supabase
        .from("chatbot_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("uazapi_chat_messages")
        .select("direction, sender, content, message_type, created_at")
        .eq("tenant_id", tenantId)
        .eq("phone_number", phone)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("tratamentos")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome", { ascending: true }),
    ]);

    const chatbotConfig: ChatbotConfig = configResult.data || {};
    const historyRows = (historyResult.data || []).reverse(); // oldest first
    const tratamentos: Tratamento[] = tratamentosResult.data || [];

    console.log(
      `[CHATBOT] Config loaded | History: ${historyRows.length} msgs | Tratamentos: ${tratamentos.length}`
    );

    // ------------------------------------------------------------------
    // 10. Build OpenAI messages array
    // ------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(chatbotConfig, tratamentos, currentLeadStatus);

    const chatMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    for (const row of historyRows) {
      // Skip the message we just stored (it's added below as current user turn)
      const isCurrentMessage =
        row.direction === "inbound" &&
        row.content === (messageText || null) &&
        historyRows.indexOf(row) === historyRows.length - 1;

      if (!isCurrentMessage) {
        const role: "user" | "assistant" =
          row.direction === "inbound" ? "user" : "assistant";

        const content =
          row.content ||
          (row.message_type !== "text" ? `[${row.message_type}]` : "[mensagem vazia]");

        chatMessages.push({ role, content });
      }
    }

    // Add current user message
    if (messageText) {
      chatMessages.push({ role: "user", content: messageText });
    } else if (messageType !== "text") {
      // Non-transcribable media (image, video, sticker, document)
      chatMessages.push({ role: "user", content: `[${messageType}]` });
    }

    // ------------------------------------------------------------------
    // 11. Call OpenAI GPT-4o
    // ------------------------------------------------------------------
    const aiResponse = await callOpenAI(chatMessages);

    if (!aiResponse) {
      console.error("[CHATBOT] OpenAI returned null response, sending fallback.");
      const fallbackReply =
        "Olá! No momento estou com dificuldades técnicas. Nossa equipe entrará em contato em breve!";
      await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, fallbackReply, tenantId, supabase);
      return jsonResponse({ ok: true, action: "ai_fallback" });
    }

    console.log(`[CHATBOT] AI response: status=${aiResponse.status} | pause=${aiResponse.should_pause}`);

    // ------------------------------------------------------------------
    // 12. Random delay 3-8 seconds (simulates typing)
    // ------------------------------------------------------------------
    const delayMs = Math.floor(Math.random() * 5_000) + 3_000;
    console.log(`[CHATBOT] Typing delay: ${delayMs}ms`);
    await sleep(delayMs);

    // ------------------------------------------------------------------
    // 13. Send reply via UAZAPI
    // ------------------------------------------------------------------
    const sendResult = await sendWhatsApp(
      uazapiSendUrl,
      uazapiToken,
      phone,
      aiResponse.reply,
      tenantId,
      supabase,
      leadId
    );

    console.log(`[CHATBOT] Message sent: ${sendResult.success}`);

    // ------------------------------------------------------------------
    // 14. Update chatbot_conversations
    // ------------------------------------------------------------------
    const newMessageCount = messageCount + 2; // inbound + outbound
    const now = new Date().toISOString();

    await supabase
      .from("chatbot_conversations")
      .update({
        message_count: newMessageCount,
        last_patient_message_at: now,
        last_bot_response_at: now,
        current_funnel_status: aiResponse.status || "respondeu",
        bot_active: aiResponse.should_pause ? false : true,
        pause_reason: aiResponse.should_pause ? aiResponse.status : null,
        detected_treatment: aiResponse.detected_treatment,
        detected_available_times: aiResponse.detected_times,
        updated_at: now,
      })
      .eq("id", convId);

    // ------------------------------------------------------------------
    // 15. Update posts.status
    // ------------------------------------------------------------------
    const newLeadStatus = aiResponse.status || currentLeadStatus;
    const postUpdate: Record<string, unknown> = { updated_at: now };
    if (newLeadStatus !== currentLeadStatus) {
      postUpdate.status = newLeadStatus;
    }
    if (aiResponse.should_pause) {
      postUpdate.bot_paused = true;
      postUpdate.bot_pause_reason = aiResponse.status;
    }
    if (Object.keys(postUpdate).length > 1) {
      await supabase.from("posts").update(postUpdate).eq("id", leadId);
      console.log(`[CHATBOT] Lead ${leadId} status: ${currentLeadStatus} → ${newLeadStatus} | paused: ${aiResponse.should_pause}`);
    }

    // ------------------------------------------------------------------
    // 16. Realtime broadcast for frontend toast (interessado_agendar | atencao)
    // ------------------------------------------------------------------
    if (aiResponse.status === "interessado_agendar" || aiResponse.status === "atencao") {
      const channelName = `chatbot-notifications-${tenantId}`;
      try {
        const realtimeChannel = supabase.channel(channelName);
        await realtimeChannel.send({
          type: "broadcast",
          event: "bot_paused",
          payload: {
            lead_id: leadId,
            phone,
            lead_name: senderName || phone,
            pause_reason: aiResponse.status,
            detected_treatment: aiResponse.detected_treatment,
            detected_times: aiResponse.detected_times,
            conversation_id: convId,
            timestamp: now,
          },
        });
        console.log(`[CHATBOT] Realtime broadcast sent to channel: ${channelName}`);
      } catch (rtErr: any) {
        // Non-fatal – frontend polling can still pick this up
        console.warn(`[CHATBOT] Realtime broadcast failed: ${rtErr.message}`);
      }
    }

    return jsonResponse({
      ok: true,
      lead_id: leadId,
      conversation_id: convId,
      ai_status: aiResponse.status,
      should_pause: aiResponse.should_pause,
    });
  } catch (error: any) {
    console.error("[CHATBOT] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helper: send WhatsApp message and log to uazapi_chat_messages
// ---------------------------------------------------------------------------

async function sendWhatsApp(
  sendUrl: string,
  token: string,
  phone: string,
  text: string,
  tenantId: string,
  supabase: ReturnType<typeof createClient>,
  leadId?: string
): Promise<{ success: boolean; messageId: string | null }> {
  let success = false;
  let messageId: string | null = null;
  let uazapiResponse: unknown = null;
  let sendError = "";

  try {
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: phone, text }),
    });

    const responseText = await res.text();

    if (res.ok) {
      try {
        uazapiResponse = JSON.parse(responseText);
      } catch {
        uazapiResponse = { raw: responseText };
      }
      messageId =
        (uazapiResponse as any)?.messageid ||
        (uazapiResponse as any)?.id ||
        null;
      success = true;
      console.log(`[CHATBOT] Sent to ${phone}: ${responseText.slice(0, 200)}`);
    } else {
      sendError = `HTTP ${res.status} | ${responseText}`;
      console.error(`[CHATBOT] Failed to send to ${phone}: ${sendError}`);
    }
  } catch (err: any) {
    sendError = `Network error: ${err.message}`;
    console.error(`[CHATBOT] Network error sending to ${phone}:`, err.message);
  }

  // Store outbound message in uazapi_chat_messages
  const { error: outboundError } = await supabase.from("uazapi_chat_messages").insert({
    tenant_id: tenantId,
    lead_id: leadId || null,
    phone_number: phone,
    direction: "outbound",
    sender: "bot",
    content: text,
    media_url: null,
    media_type: null,
    message_type: "text",
    status: success ? "sent" : "failed",
    provider_id: messageId,
    metadata: {
      wasSentByBot: true,
      source: "chatbot_webhook",
      uazapi_response: uazapiResponse,
      error: success ? undefined : sendError,
    },
  });

  if (outboundError) {
    console.warn("[CHATBOT] Failed to store outbound message:", outboundError.message);
  }

  return { success, messageId };
}
