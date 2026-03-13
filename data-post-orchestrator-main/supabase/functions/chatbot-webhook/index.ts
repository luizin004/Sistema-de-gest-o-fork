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
    // UAZAPI flat message format
    text?: string;
    content?: string;
    chatid?: string;
    sender_pn?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    senderName?: string;
    mediaType?: string;
    type?: string;
    messageType?: string;
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
  // UAZAPI v2 flat format
  chat?: {
    wa_chatid?: string;
    wa_name?: string;
    phone?: string;
    wa_isGroup?: boolean;
  };
  EventType?: string;
  owner?: string;
  token?: string;
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
  const msgObj = payload.message;

  // ---------- isGroup check ----------
  const isGroup =
    payload.isGroup === true ||
    payload.fromGroup === true ||
    payload.chat?.wa_isGroup === true ||
    msgObj?.isGroup === true ||
    (payload.key?.remoteJid ?? "").includes("@g.us") ||
    (msgObj?.chatid ?? "").includes("@g.us");

  // ---------- fromMe check ----------
  const fromMe =
    payload.key?.fromMe === true ||
    msgObj?.fromMe === true;

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
    msgObj?.chatid?.replace(/@[a-z.]+$/, "") ||
    msgObj?.sender_pn?.replace(/@[a-z.]+$/, "") ||
    payload.chat?.wa_chatid?.replace(/@[a-z.]+$/, "") ||
    "";

  // Ignore status broadcasts, groups, and our own outbound messages
  if (!phone || phone === "status@broadcast") return null;
  if (isGroup) return null;
  if (fromMe) return null;

  phone = normalizePhone(phone);

  // ---------- senderName ----------
  const senderName =
    payload.pushName ||
    msgObj?.senderName ||
    payload.chat?.wa_name ||
    "";

  // ---------- messageType ----------
  let messageType =
    payload.messageType ||
    msgObj?.messageType ||
    msgObj?.type ||
    payload.type ||
    "text";

  // Normalise type aliases
  if (msgObj?.audioMessage) messageType = "audio";
  else if (msgObj?.imageMessage) messageType = "image";
  else if (msgObj?.videoMessage) messageType = "video";
  else if (msgObj?.documentMessage) messageType = "document";
  else if (msgObj?.stickerMessage) messageType = "sticker";
  else if (msgObj?.mediaType && msgObj.mediaType !== "") messageType = msgObj.mediaType;
  else if (
    msgObj?.conversation ||
    msgObj?.extendedTextMessage ||
    msgObj?.text ||
    msgObj?.content
  ) messageType = "text";

  // ---------- messageText ----------
  const messageText =
    payload.body ||
    msgObj?.conversation ||
    msgObj?.extendedTextMessage?.text ||
    msgObj?.text ||
    msgObj?.content ||
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

async function transcribeAudio(audioUrl: string, openaiApiKey: string): Promise<string | null> {
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
        Authorization: `Bearer ${openaiApiKey}`,
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
  system_prompt?: string;
  bot_persona?: string;
  bot_context?: string;
  bot_services_info?: string;
  bot_restrictions?: string;
  [key: string]: unknown;
}

interface Tratamento {
  id: string;
  nome: string;
  duracao_minutos?: number;
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

  // Tenant-configured sections
  const persona = config.bot_persona?.trim() || "";
  const context = config.bot_context?.trim() || "";
  const servicesInfo = config.bot_services_info?.trim() || "";
  const restrictions = config.bot_restrictions?.trim() || "";
  const advancedPrompt = config.system_prompt?.trim() || "";

  // Build optional sections
  let customSections = "";

  if (persona) {
    customSections += `\n\n## Sua persona e papel:\n${persona}`;
  }

  if (context) {
    customSections += `\n\n## Contexto da clínica:\n${context}`;
  }

  if (servicesInfo) {
    customSections += `\n\n## Informações sobre produtos e serviços:\n${servicesInfo}`;
  }

  if (restrictions) {
    customSections += `\n\n## RESTRIÇÕES (prioridade máxima - NUNCA viole estas regras):\n${restrictions}`;
  }

  if (advancedPrompt) {
    customSections += `\n\n## Instruções adicionais:\n${advancedPrompt}`;
  }

  return `Você é a assistente virtual da clínica ${clinicName}.
Tom: ${clinicTone}

## Regras do fluxo de atendimento (NÃO ALTERAR):
1. NUNCA sugira horários - pergunte ao paciente quais horários ele tem disponíveis
2. Pergunte qual tratamento deseja (lista abaixo)
3. Quando o paciente informar horários + tratamento → informe que a equipe confirmará em breve
4. Se não souber responder ou a pergunta estiver fora do escopo → classifique como "atencao"
5. Não invente informações não fornecidas
6. Respostas curtas, estilo WhatsApp (máximo 3 linhas por mensagem)
7. Use linguagem natural, sem formalidades excessivas
8. Nunca revele que é uma IA, apresente-se como assistente da clínica${
    currentStatus === "agendou consulta"
      ? "\n9. O paciente JÁ TEM uma consulta agendada. Se ele quiser remarcar, classifique como 'reagendando' e informe que a equipe entrará em contato."
      : ""
  }

## Tratamentos disponíveis:
${tratamentosList}${customSections}

## Classificação de status (retorne EXATAMENTE um destes valores no JSON):
- respondeu: primeiro contato do paciente
- interagiu: conversando ativamente (3+ mensagens trocadas)
- engajou: interesse real demonstrado em tratamento específico
- interessado em agendar consulta: paciente informou horários disponíveis E tratamento desejado → DEVE pausar bot
- atencao: não consegue lidar com a pergunta ou situação especial → DEVE pausar bot
- reagendando: paciente com consulta agendada quer remarcar
- impecilho: paciente relatou problema ou obstáculo para comparecer

IMPORTANTE: Use os status EXATAMENTE como escritos acima. Não use variantes como "interagindo", "interessado_agendar", etc.

## FORMATO OBRIGATÓRIO DE RESPOSTA (JSON puro, sem markdown):
{
  "reply": "texto da resposta para o paciente",
  "status": "um dos status acima (exatamente como escrito)",
  "detected_treatment": "nome do tratamento mencionado ou null",
  "detected_times": "horários informados pelo paciente ou null",
  "should_pause": true ou false
}

Regra de should_pause: defina como true APENAS para status "interessado em agendar consulta" ou "atencao".`;
}

// ---------------------------------------------------------------------------
// Build system prompt for AGENDAMENTO FIXO mode
// ---------------------------------------------------------------------------

interface ScheduleDay {
  day: number;
  start: string;
  end: string;
}

interface ScheduleConfig {
  weekly_schedule: ScheduleDay[];
  lookahead_days: number;
  allow_bot_cancel: boolean;
  slot_buffer_minutes: number;
  allowed_dates: string[];       // ["2026-03-15", ...] — se preenchido, só agenda nessas datas
  allow_double_booking: boolean; // se true, permite >1 paciente no mesmo horário
}

interface BlockedPeriod {
  blocked_date: string;
  start_time: string;
  end_time: string;
}

interface Agendamento {
  data_marcada: string;
  horario: string;
}

interface AvailableSlot {
  date: string;        // "2026-03-15"
  dayLabel: string;    // "Sábado 15/03"
  start: string;       // "10:00"
  end: string;         // "11:00"
}

function computeAvailableSlots(
  scheduleConfig: ScheduleConfig,
  blockedPeriods: BlockedPeriod[],
  existingAgendamentos: Agendamento[],
  treatmentDurationMinutes: number,
  maxSlots: number = 3
): AvailableSlot[] {
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Use São Paulo timezone
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const todayParts = spFormatter.formatToParts(now);
  const todayYear = parseInt(todayParts.find(p => p.type === "year")!.value);
  const todayMonth = parseInt(todayParts.find(p => p.type === "month")!.value) - 1;
  const todayDay = parseInt(todayParts.find(p => p.type === "day")!.value);
  const today = new Date(todayYear, todayMonth, todayDay);

  const buffer = scheduleConfig.slot_buffer_minutes || 0;
  const totalSlotMinutes = treatmentDurationMinutes + buffer;

  const slots: AvailableSlot[] = [];
  const usedDays = new Set<string>();

  const hasAllowedDates = scheduleConfig.allowed_dates && scheduleConfig.allowed_dates.length > 0;
  const allowDoubleBooking = scheduleConfig.allow_double_booking || false;

  for (let d = 1; d <= scheduleConfig.lookahead_days && slots.length < maxSlots; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);

    const dayOfWeek = date.getDay();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // Se allowed_dates está configurado, só aceitar datas nessa lista
    if (hasAllowedDates && !scheduleConfig.allowed_dates.includes(dateStr)) continue;

    // Precisa ter horário definido na grade semanal para esse dia da semana
    const scheduleDef = scheduleConfig.weekly_schedule.find(s => s.day === dayOfWeek);
    if (!scheduleDef) continue;

    // Get blocked periods for this date (handle both date and timestamp formats)
    const dayBlocked = blockedPeriods.filter(bp => {
      if (!bp.blocked_date) return false;
      const bpDate = bp.blocked_date.substring(0, 10);
      return bpDate === dateStr;
    });

    // Get existing agendamentos for this date (data_marcada is a timestamp, extract date part)
    const dayAgendamentos = existingAgendamentos.filter(a => {
      if (!a.data_marcada) return false;
      const agDate = a.data_marcada.substring(0, 10); // "2026-03-15T00:00:00+00:00" → "2026-03-15"
      return agDate === dateStr;
    });

    // Generate candidate slots
    const [startH, startM] = scheduleDef.start.split(":").map(Number);
    const [endH, endM] = scheduleDef.end.split(":").map(Number);
    const dayStartMinutes = startH * 60 + startM;
    const dayEndMinutes = endH * 60 + endM;

    for (let slotStart = dayStartMinutes; slotStart + treatmentDurationMinutes <= dayEndMinutes; slotStart += totalSlotMinutes) {
      const slotEnd = slotStart + treatmentDurationMinutes;
      const slotStartStr = `${String(Math.floor(slotStart / 60)).padStart(2, "0")}:${String(slotStart % 60).padStart(2, "0")}`;
      const slotEndStr = `${String(Math.floor(slotEnd / 60)).padStart(2, "0")}:${String(slotEnd % 60).padStart(2, "0")}`;

      // Check overlap with blocked periods
      const blockedConflict = dayBlocked.some(bp => {
        return slotStartStr < bp.end_time && bp.start_time < slotEndStr;
      });
      if (blockedConflict) continue;

      // Check overlap with existing agendamentos (skip if double booking allowed)
      if (!allowDoubleBooking) {
        const agendamentoConflict = dayAgendamentos.some(ag => {
          if (!ag.horario) return false;
          const [agH, agM] = ag.horario.split(":").map(Number);
          const agStart = agH * 60 + agM;
          const agEnd = agStart + treatmentDurationMinutes; // use requested treatment duration
          return slotStart < agEnd && agStart < slotEnd;
        });
        if (agendamentoConflict) continue;
      }

      // Prefer variety: skip if we already have a slot on this day
      if (usedDays.has(dateStr) && slots.length < maxSlots - 1) continue;

      const dayLabel = `${dayNames[dayOfWeek]} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

      slots.push({ date: dateStr, dayLabel, start: slotStartStr, end: slotEndStr });
      usedDays.add(dateStr);

      if (slots.length >= maxSlots) break;
    }
  }

  return slots;
}

function buildSystemPromptFixo(
  config: ChatbotConfig,
  tratamentos: Tratamento[],
  schedulingState: string | null,
  schedulingData: any,
  allowBotCancel: boolean
): string {
  const clinicName = config.clinic_name || "Clínica";
  const clinicTone = config.clinic_tone || "profissional e acolhedor";
  const tratamentosList =
    tratamentos.length > 0
      ? tratamentos.map(t => `- ${t.nome} (${t.duracao_minutos || 60}min)`).join("\n")
      : "- (não cadastrados)";

  const persona = config.bot_persona?.trim() || "";
  const context = config.bot_context?.trim() || "";
  const servicesInfo = config.bot_services_info?.trim() || "";
  const restrictions = config.bot_restrictions?.trim() || "";
  const advancedPrompt = config.system_prompt?.trim() || "";

  let customSections = "";
  if (persona) customSections += `\n\n## Sua persona e papel:\n${persona}`;
  if (context) customSections += `\n\n## Contexto da clínica:\n${context}`;
  if (servicesInfo) customSections += `\n\n## Informações sobre produtos e serviços:\n${servicesInfo}`;
  if (restrictions) customSections += `\n\n## RESTRIÇÕES (prioridade máxima):\n${restrictions}`;
  if (advancedPrompt) customSections += `\n\n## Instruções adicionais:\n${advancedPrompt}`;

  // State context
  let stateContext = "";
  if (schedulingState === "awaiting_slot_choice" && schedulingData?.offered_slots) {
    stateContext = `\n\n## ESTADO ATUAL: Aguardando escolha de horário
O paciente recebeu as seguintes opções:
${schedulingData.offered_slots.map((s: any, i: number) => `Opção ${i + 1}: ${s.dayLabel} às ${s.start}`).join("\n")}
Tratamento: ${schedulingData.treatment_name || "não definido"}

O paciente vai responder naturalmente (ex: "segunda", "às 10h", "o da terça"). Identifique qual opção corresponde e use action="book_slot" com slot_choice=número da opção (1, 2 ou 3).
Se o paciente pedir outras opções ou outro tratamento, use action="check_slots".`;
  } else if (schedulingState === "confirmed") {
    stateContext = `\n\n## ESTADO ATUAL: Consulta já confirmada
O paciente já tem agendamento confirmado.
Se quiser cancelar/reagendar → ${allowBotCancel ? 'action="cancel_slot"' : 'action="needs_human"'}`;
  }

  const cancelRule = allowBotCancel
    ? `6. Cancelar/reagendar → action="cancel_slot"`
    : `6. Cancelar/reagendar → action="needs_human" (humano cuida)`;

  return `Você é a assistente virtual da clínica ${clinicName}.
Tom: ${clinicTone}
${customSections}

## Seu papel no AGENDAMENTO FIXO:
Você AGENDA consultas automaticamente de forma NATURAL e humanizada. O fluxo:
1. Cumprimente o paciente naturalmente, pergunte qual tratamento deseja
2. Quando disser o tratamento → action="check_slots"
3. O sistema fornece opções → você apresenta ao paciente DE FORMA NATURAL E CONVERSACIONAL (NUNCA use listas numeradas, NUNCA peça "responda com o número")
4. Quando o paciente indicar qual horário prefere (por dia, horário ou qualquer referência) → action="book_slot" com slot_choice=N (o número do slot que corresponde à escolha)
5. Fora do escopo → action="needs_human"
${cancelRule}
${stateContext}

## Tratamentos disponíveis (com duração):
${tratamentosList}

## REGRAS CRÍTICAS:
- NUNCA invente horários — o sistema fornece
- NUNCA use listas numeradas (1, 2, 3) para apresentar horários — apresente como texto corrido conversacional
- NUNCA peça ao paciente para "responder com o número" — deixe ele responder naturalmente
- Respostas curtas, estilo WhatsApp, como se fosse uma pessoa real conversando
- Nunca revele que é IA, apresente-se como assistente da clínica
- Não invente informações não fornecidas
- Ao apresentar horários, seja natural. Exemplo: "Tenho disponível na segunda dia 17 às 10h, terça dia 18 às 14h ou quinta dia 20 às 9h. Qual fica melhor pra você?"
- Quando o paciente responder qual prefere (ex: "segunda", "10h", "o primeiro", "terça às 14h"), identifique qual slot corresponde e use book_slot

## Classificação de status (use EXATAMENTE estes valores):
- respondeu: primeiro contato
- interagiu: conversando ativamente (3+ msgs)
- engajou: interesse real em tratamento
- agendou consulta: consulta marcada com sucesso
- atencao: não consegue lidar → DEVE pausar
- reagendando: quer remarcar consulta existente
- impecilho: paciente relatou problema ou obstáculo

IMPORTANTE: Use os status EXATAMENTE como escritos acima.

## FORMATO JSON OBRIGATÓRIO:
{
  "reply": "texto da resposta",
  "status": "um dos status acima (exatamente como escrito)",
  "action": "none|check_slots|book_slot|cancel_slot|needs_human",
  "detected_treatment": "nome do tratamento ou null",
  "slot_choice": 1 ou 2 ou 3 ou null,
  "should_pause": true ou false
}

Regra de should_pause: true APENAS para "atencao" ou "needs_human".
Regra de action: use "none" para conversa normal, "check_slots" quando detectar tratamento, "book_slot" quando paciente escolher slot (identifique qual slot o paciente escolheu pela referência ao dia/horário), "cancel_slot" para cancelamento, "needs_human" quando não souber lidar.`;
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completion
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Status normalization — maps AI variants to exact kanban column values
// ---------------------------------------------------------------------------
const VALID_STATUSES = [
  "respondeu", "interagiu", "engajou", "interessado em agendar consulta",
  "atencao", "agendou consulta", "reagendando", "impecilho", "cadencia",
];

function normalizeStatus(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  // Exact match
  if (VALID_STATUSES.includes(s)) return s;
  // Common variants
  if (s.includes("interessado") && (s.includes("agendar") || s.includes("consulta"))) return "interessado em agendar consulta";
  if (s === "interessado_agendar") return "interessado em agendar consulta";
  if (s === "interagindo" || s === "conversando") return "interagiu";
  if (s === "respondido" || s === "primeiro_contato") return "respondeu";
  if (s === "engajado") return "engajou";
  if (s === "atenção" || s === "needs_human" || s === "precisa_humano") return "atencao";
  if (s === "agendado" || s === "agendou" || s === "consulta_marcada") return "agendou consulta";
  if (s === "reagendar" || s === "remarcar") return "reagendando";
  if (s === "impedimento" || s === "obstáculo" || s === "obstaculo") return "impecilho";
  if (s === "cadência" || s === "follow-up" || s === "followup") return "cadencia";
  // Fallback
  return "respondeu";
}

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
  // Agendamento fixo fields
  action?: string;
  slot_choice?: number | null;
}

async function callOpenAI(messages: ChatMessage[], openaiApiKey: string, model: string = "gpt-4o"): Promise<AIResponse | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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

    // Normalize status to match exact kanban column values
    const normalizedStatus = normalizeStatus(parsed.status || "respondeu");

    // Validate required fields with safe fallbacks
    return {
      reply: parsed.reply || "Obrigado pelo contato! Como posso ajudar?",
      status: normalizedStatus,
      detected_treatment: parsed.detected_treatment || null,
      detected_times: parsed.detected_times || null,
      should_pause: parsed.should_pause === true,
      action: (parsed as any).action || "none",
      slot_choice: (parsed as any).slot_choice ?? null,
    };
  } catch (err: any) {
    console.error(`[CHATBOT] callOpenAI error:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Treatment name matching
// ---------------------------------------------------------------------------

function findBestTreatmentMatch(tratamentos: Tratamento[], detectedName: string): Tratamento | undefined {
  if (!detectedName) return undefined;
  const needle = detectedName.toLowerCase().trim();

  // 1. Exact match
  const exact = tratamentos.find(t => t.nome.toLowerCase().trim() === needle);
  if (exact) return exact;

  // 2. One contains the other (both directions)
  const containsMatches = tratamentos.filter(t => {
    const tName = t.nome.toLowerCase().trim();
    return tName.includes(needle) || needle.includes(tName);
  });
  if (containsMatches.length === 1) return containsMatches[0];

  // 3. Word-level matching - count matching words
  const needleWords = needle.split(/\s+/).filter(w => w.length > 2);
  if (needleWords.length > 0) {
    let bestMatch: Tratamento | undefined;
    let bestScore = 0;

    for (const t of tratamentos) {
      const tWords = t.nome.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matchCount = needleWords.filter(nw =>
        tWords.some(tw => tw.includes(nw) || nw.includes(tw))
      ).length;
      const score = matchCount / Math.max(needleWords.length, tWords.length);
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = t;
      }
    }
    if (bestMatch) return bestMatch;
  }

  // 4. Fallback: first contains match if multiple
  if (containsMatches.length > 0) return containsMatches[0];

  return undefined;
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

    // DEBUG: Save ALL payloads to webhook_debug_log for troubleshooting
    await supabase.from("webhook_debug_log").insert({ payload: rawBody });

    // ------------------------------------------------------------------
    // 1. Extract message fields from UAZAPI payload
    // ------------------------------------------------------------------
    const extracted = extractMessage(rawBody);

    if (!extracted) {
      console.log("[CHATBOT] Ignored: could not extract message or group message. Raw keys:", Object.keys(rawBody), "fromMe:", rawBody?.key?.fromMe, "data keys:", rawBody?.data ? Object.keys(rawBody.data) : "no data");
      return jsonResponse({ ok: true, ignored: true, debug: { keys: Object.keys(rawBody), fromMe: rawBody?.key?.fromMe ?? rawBody?.data?.key?.fromMe, phone: rawBody?.phone || rawBody?.key?.remoteJid || rawBody?.data?.phone || rawBody?.data?.key?.remoteJid || "none" } });
    }

    const { phone, instanceId, senderName, mediaUrl, audioDuration } = extracted;
    let { messageText, messageType } = extracted;

    if (!instanceId) {
      console.warn("[CHATBOT] No instanceId in webhook payload, ignoring.");
      return jsonResponse({ ok: true, ignored: true, reason: "no_instance_id" });
    }

    // ------------------------------------------------------------------
    // 2. Look up tenant via uazapi_instances (try instance_id first, then name)
    // ------------------------------------------------------------------
    let instance: any = null;
    let instanceError: any = null;

    // Try by instance_id first
    const { data: byId, error: byIdErr } = await supabase
      .from("uazapi_instances")
      .select("id, tenant_id, token, api_url, name, chatbot_config_id")
      .eq("instance_id", instanceId)
      .single();

    if (byId) {
      instance = byId;
    } else {
      // Fallback: try by name (UAZAPI sends instanceName which maps to name)
      const { data: byName, error: byNameErr } = await supabase
        .from("uazapi_instances")
        .select("id, tenant_id, token, api_url, name, chatbot_config_id")
        .eq("name", instanceId)
        .single();

      instance = byName;
      instanceError = byNameErr;
    }

    if (!instance) {
      console.warn(`[CHATBOT] Instance '${instanceId}' not found by id or name:`, instanceError?.message);
      return jsonResponse({ ok: true, ignored: true, reason: "instance_not_found" });
    }

    const { tenant_id: tenantId, token: uazapiToken, api_url: uazapiApiUrl } = instance;
    const instanceDbId: string = instance.id;
    const instanceName: string = instance.name || instanceId;
    const chatbotConfigId: string | null = instance.chatbot_config_id || null;
    const uazapiSendUrl = `${uazapiApiUrl || "https://oralaligner.uazapi.com"}/send/text`;

    // If no bot linked to this instance, ignore
    if (!chatbotConfigId) {
      console.log(`[CHATBOT] Instance '${instanceId}' has no bot linked, ignoring.`);
      return jsonResponse({ ok: true, ignored: true, reason: "no_bot_linked" });
    }

    console.log(`[CHATBOT] Tenant: ${tenantId} | Phone: ${phone} | Type: ${messageType}`);

    // ------------------------------------------------------------------
    // 3. Store incoming message in uazapi_chat_messages
    // ------------------------------------------------------------------
    const inboundInsert = await supabase.from("uazapi_chat_messages").insert({
      tenant_id: tenantId,
      phone_number: phone,
      instance_id: instanceDbId,
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

    // Search for existing lead by phone + instance (leads are unique per phone per instance)
    const { data: existingLead } = await supabase
      .from("posts")
      .select("id, status, nome")
      .eq("tenant_id", tenantId)
      .eq("instance_id", instanceDbId)
      .in("telefone", phoneVariants)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let leadId: string;
    let currentLeadStatus: string;

    if (existingLead) {
      leadId = existingLead.id;
      currentLeadStatus = existingLead.status || "respondeu";
      console.log(`[CHATBOT] Found lead: ${leadId} | status: ${currentLeadStatus} | instance: ${instanceDbId}`);
    } else {
      // Create new lead linked to this specific instance
      const newLeadId = crypto.randomUUID();
      const { error: leadInsertError } = await supabase.from("posts").insert({
        id: newLeadId,
        tenant_id: tenantId,
        telefone: phone,
        nome: senderName || phone,
        status: "respondeu",
        instance_name: instanceName,
        instance_id: instanceDbId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (leadInsertError) {
        console.error("[CHATBOT] Failed to create lead:", leadInsertError.message);
        return jsonResponse({ ok: true, error: "lead_create_failed" });
      }

      leadId = newLeadId;
      currentLeadStatus = "respondeu";
      console.log(`[CHATBOT] Created new lead: ${leadId} | instance: ${instanceDbId}`);
    }

    // ------------------------------------------------------------------
    // 5. Find or create chatbot_conversations record
    // ------------------------------------------------------------------
    const { data: existingConv } = await supabase
      .from("chatbot_conversations")
      .select("id, bot_active, message_count, current_funnel_status, pause_reason, scheduling_state, scheduling_data, chatbot_config_id")
      .eq("tenant_id", tenantId)
      .eq("phone_number", phone)
      .eq("instance_id", instanceDbId)
      .maybeSingle();

    let convId: string;
    let botActive: boolean;
    let messageCount: number;

    if (existingConv) {
      convId = existingConv.id;
      messageCount = existingConv.message_count || 0;

      // Se o bot da instância mudou, migra a conversa para o novo bot e reativa
      if (chatbotConfigId && existingConv.chatbot_config_id !== chatbotConfigId) {
        console.log(`[CHATBOT] Bot changed for conv ${convId}: ${existingConv.chatbot_config_id} → ${chatbotConfigId}. Migrating and reactivating.`);
        await supabase
          .from("chatbot_conversations")
          .update({
            chatbot_config_id: chatbotConfigId,
            bot_active: true,
            pause_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", convId);
        botActive = true;
      } else {
        botActive = existingConv.bot_active !== false;
      }

      console.log(`[CHATBOT] Found conversation: ${convId} | bot_active: ${botActive}`);
    } else {
      const { data: newConv, error: convInsertError } = await supabase
        .from("chatbot_conversations")
        .insert({
          tenant_id: tenantId,
          post_id: leadId,
          phone_number: phone,
          instance_id: instanceDbId,
          chatbot_config_id: chatbotConfigId,
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
    // 7. Load chatbot_config, tenant settings, last N messages, and tratamentos
    // ------------------------------------------------------------------
    const [configResult, tenantSettingsResult, tratamentosResult] = await Promise.all([
      supabase
        .from("chatbot_config")
        .select("*")
        .eq("id", chatbotConfigId)
        .maybeSingle(),
      supabase
        .from("chatbot_tenant_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tratamentos")
        .select("id, nome, duracao_minutos")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome", { ascending: true }),
    ]);

    const chatbotConfig: ChatbotConfig = configResult.data || {};
    const tenantSettings = tenantSettingsResult.data || {};
    const tratamentos: Tratamento[] = tratamentosResult.data || [];

    // Check if bot is enabled
    if ((chatbotConfig as any).bot_enabled === false) {
      console.log(`[CHATBOT] Bot ${chatbotConfigId} is disabled, ignoring.`);
      return jsonResponse({ ok: true, ignored: true, reason: "bot_disabled" });
    }

    // Get global OpenAI settings from tenant settings
    const openaiApiKey: string = tenantSettings.openai_api_key || "";
    const openaiModel: string = tenantSettings.openai_model || "gpt-4o";
    const maxHistoryMessages: number = tenantSettings.max_history_messages ?? 15;

    // Fetch history with tenant-level max (filtered by instance)
    const { data: historyData } = await supabase
      .from("uazapi_chat_messages")
      .select("direction, sender, content, message_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("phone_number", phone)
      .eq("instance_id", instanceDbId)
      .order("created_at", { ascending: false })
      .limit(maxHistoryMessages);

    const historyRows = (historyData || []).reverse(); // oldest first

    if (!openaiApiKey) {
      console.error(`[CHATBOT] No OpenAI API key configured for bot ${chatbotConfigId}`);
      const noKeyReply = "Olá! Estamos configurando nosso atendimento. Em breve retornaremos!";
      await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, noKeyReply, tenantId, supabase, undefined, instanceId, instanceDbId);
      return jsonResponse({ ok: true, error: "no_openai_api_key" });
    }

    console.log(
      `[CHATBOT] Config loaded | History: ${historyRows.length} msgs | Tratamentos: ${tratamentos.length} | Model: ${openaiModel}`
    );

    // ------------------------------------------------------------------
    // 8. Handle audio messages
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

        await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, longAudioReply, tenantId, supabase, undefined, instanceId, instanceDbId);

        return jsonResponse({ ok: true, action: "audio_too_long" });
      }

      // Transcribe audio (≤60s)
      const transcription = await transcribeAudio(mediaUrl, openaiApiKey);
      if (!transcription) {
        console.warn("[CHATBOT] Transcription failed, sending fallback reply.");
        const transcribeFallback =
          "Não consegui ouvir seu áudio. Poderia enviar sua mensagem em texto? 😊";
        await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, transcribeFallback, tenantId, supabase, undefined, instanceId, instanceDbId);
        return jsonResponse({ ok: true, action: "transcription_failed" });
      }

      messageText = transcription;
      messageType = "text";
      console.log(`[CHATBOT] Audio transcribed: "${messageText}"`);
    }

    // ------------------------------------------------------------------
    // 9. If status='agendou consulta' and patient wants to reschedule
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
    // 10. Determine bot mode and build system prompt
    // ------------------------------------------------------------------
    const botMode = (chatbotConfig as any).mode || "agendamento_flexivel";
    const isFixoMode = botMode === "agendamento_fixo";
    const schedulingState: string | null = existingConv?.scheduling_state || null;
    const schedulingData: any = existingConv?.scheduling_data || null;

    let systemPrompt: string;

    if (isFixoMode) {
      // Load schedule config for fixo mode
      const { data: schedConfigData } = await supabase
        .from("chatbot_schedule_config")
        .select("*")
        .eq("chatbot_config_id", chatbotConfigId)
        .maybeSingle();

      const schedConfig: ScheduleConfig = {
        weekly_schedule: schedConfigData?.weekly_schedule || [],
        lookahead_days: schedConfigData?.lookahead_days ?? 14,
        allow_bot_cancel: schedConfigData?.allow_bot_cancel ?? false,
        slot_buffer_minutes: schedConfigData?.slot_buffer_minutes ?? 0,
        allowed_dates: schedConfigData?.allowed_dates || [],
        allow_double_booking: schedConfigData?.allow_double_booking ?? false,
      };

      systemPrompt = buildSystemPromptFixo(
        chatbotConfig,
        tratamentos,
        schedulingState,
        schedulingData,
        schedConfig.allow_bot_cancel
      );
    } else {
      systemPrompt = buildSystemPrompt(chatbotConfig, tratamentos, currentLeadStatus);
    }

    // ------------------------------------------------------------------
    // 10b. Build OpenAI messages array (shared for both modes)
    // ------------------------------------------------------------------
    const chatMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    for (const row of historyRows) {
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

    if (messageText) {
      chatMessages.push({ role: "user", content: messageText });
    } else if (messageType !== "text") {
      chatMessages.push({ role: "user", content: `[${messageType}]` });
    }

    // ------------------------------------------------------------------
    // 11. Call OpenAI
    // ------------------------------------------------------------------
    const aiResponse = await callOpenAI(chatMessages, openaiApiKey, openaiModel);

    if (!aiResponse) {
      console.error("[CHATBOT] OpenAI returned null response, sending fallback.");
      const fallbackReply =
        "Olá! No momento estou com dificuldades técnicas. Nossa equipe entrará em contato em breve!";
      await sendWhatsApp(uazapiSendUrl, uazapiToken, phone, fallbackReply, tenantId, supabase, undefined, instanceId, instanceDbId);
      return jsonResponse({ ok: true, action: "ai_fallback" });
    }

    console.log(`[CHATBOT] AI response: status=${aiResponse.status} | pause=${aiResponse.should_pause} | action=${aiResponse.action}`);

    // ------------------------------------------------------------------
    // 11b. Handle agendamento_fixo actions BEFORE sending reply
    // ------------------------------------------------------------------
    let finalReply = aiResponse.reply;
    let convUpdateExtra: Record<string, unknown> = {};

    if (isFixoMode && aiResponse.action && aiResponse.action !== "none") {
      const { data: schedConfigData } = await supabase
        .from("chatbot_schedule_config")
        .select("*")
        .eq("chatbot_config_id", chatbotConfigId)
        .maybeSingle();

      const schedConfig: ScheduleConfig = {
        weekly_schedule: schedConfigData?.weekly_schedule || [],
        lookahead_days: schedConfigData?.lookahead_days ?? 14,
        allow_bot_cancel: schedConfigData?.allow_bot_cancel ?? false,
        slot_buffer_minutes: schedConfigData?.slot_buffer_minutes ?? 0,
        allowed_dates: schedConfigData?.allowed_dates || [],
        allow_double_booking: schedConfigData?.allow_double_booking ?? false,
      };

      if (aiResponse.action === "check_slots") {
        // Find the treatment and its duration
        const matchedTreatment = findBestTreatmentMatch(tratamentos, aiResponse.detected_treatment || "");
        const duration = matchedTreatment?.duracao_minutos || 60;

        // Load blocked periods and existing agendamentos
        const [blockedResult, agendamentosResult] = await Promise.all([
          supabase
            .from("chatbot_blocked_periods")
            .select("blocked_date, start_time, end_time")
            .eq("chatbot_config_id", chatbotConfigId),
          supabase
            .from("agendamento")
            .select("data_marcada, horario")
            .eq("tenant_id", tenantId),
        ]);

        const blockedPeriods: BlockedPeriod[] = blockedResult.data || [];
        const existingAgendamentos: Agendamento[] = agendamentosResult.data || [];

        const slots = computeAvailableSlots(schedConfig, blockedPeriods, existingAgendamentos, duration, 3);

        if (slots.length === 0) {
          finalReply = "No momento não temos horários disponíveis. Nossa equipe entrará em contato para encontrar o melhor horário para você!";
          aiResponse.should_pause = true;
          aiResponse.status = "atencao";
          convUpdateExtra = {
            scheduling_state: null,
            scheduling_data: null,
          };
        } else {
          // Build natural slot message (no numbered lists)
          const slotDescriptions = slots.map(s => `${s.dayLabel} às ${s.start}`);
          const naturalSlotText = slotDescriptions.length === 1
            ? slotDescriptions[0]
            : slotDescriptions.slice(0, -1).join(", ") + " ou " + slotDescriptions[slotDescriptions.length - 1];
          finalReply = `${aiResponse.reply}\n\nTenho disponível ${naturalSlotText}. Qual fica melhor pra você?`;

          convUpdateExtra = {
            scheduling_state: "awaiting_slot_choice",
            scheduling_data: {
              treatment_id: matchedTreatment?.id || null,
              treatment_name: matchedTreatment?.nome || aiResponse.detected_treatment,
              duracao_minutos: duration,
              offered_slots: slots,
            },
          };
        }
      } else if (aiResponse.action === "book_slot") {
        const choiceIdx = (aiResponse.slot_choice || 1) - 1;
        const offeredSlots = schedulingData?.offered_slots || [];
        const chosenSlot = offeredSlots[choiceIdx];

        if (!chosenSlot) {
          finalReply = "Desculpe, não consegui identificar qual opção você escolheu. Poderia repetir o número?";
        } else {
          // Create agendamento record
          const agendamentoId = crypto.randomUUID();
          // Fetch lead name and phone for agendamento record
          let leadNome = senderName || phone;
          if (leadId) {
            const { data: leadData } = await supabase.from("posts").select("nome, telefone").eq("id", leadId).maybeSingle();
            if (leadData?.nome) leadNome = leadData.nome;
          }

          const { error: agError } = await supabase.from("agendamento").insert({
            id: agendamentoId,
            tenant_id: tenantId,
            nome: leadNome,
            telefone: phone,
            data_marcada: chosenSlot.date,
            horario: chosenSlot.start,
            tratamento: schedulingData?.treatment_name || null,
            source: "bot_fixo",
            confirmado: true,
            created_at: new Date().toISOString(),
          });

          if (agError) {
            // Insert failed — DO NOT move lead to "agendou consulta"
            console.error("[CHATBOT] Failed to create agendamento:", agError.message, agError.code);
            finalReply = "Tive um probleminha ao registrar seu agendamento. Vou verificar outras opções para você!";
            // Reset status so lead is NOT moved to "agendou consulta"
            aiResponse.status = "engajou";
            aiResponse.should_pause = false;
            // Trigger a new check_slots on next message
            convUpdateExtra = {
              scheduling_state: "awaiting_treatment",
              scheduling_data: {
                treatment_id: schedulingData?.treatment_id,
                treatment_name: schedulingData?.treatment_name,
                duracao_minutos: schedulingData?.duracao_minutos,
              },
            };
          } else {
            finalReply = `Pronto! Sua consulta de ${schedulingData?.treatment_name || "tratamento"} está confirmada para ${chosenSlot.dayLabel} às ${chosenSlot.start}. Aguardamos você! 😊`;
            aiResponse.status = "agendou consulta";
            aiResponse.should_pause = true;

            convUpdateExtra = {
              scheduling_state: "confirmed",
              pause_reason: "agendou consulta",
              scheduling_data: {
                ...schedulingData,
                booked_agendamento_id: agendamentoId,
                booked_slot: chosenSlot,
              },
            };
          }
        }
      } else if (aiResponse.action === "cancel_slot") {
        if (!schedConfig.allow_bot_cancel) {
          finalReply = "Entendi que você quer cancelar/reagendar. Vou encaminhar para nossa equipe que entrará em contato em breve!";
          aiResponse.should_pause = true;
          aiResponse.status = "atencao";
        } else {
          // Cancel existing agendamento
          const bookedId = schedulingData?.booked_agendamento_id;
          if (bookedId) {
            await supabase.from("agendamento").delete().eq("id", bookedId);
            finalReply = "Sua consulta foi cancelada. Gostaria de agendar um novo horário? Se sim, me diga qual tratamento deseja.";
            aiResponse.status = "reagendando";
            convUpdateExtra = {
              scheduling_state: null,
              scheduling_data: null,
            };
          } else {
            finalReply = "Não encontrei um agendamento ativo para cancelar. Posso ajudar com algo mais?";
          }
        }
      } else if (aiResponse.action === "needs_human") {
        aiResponse.should_pause = true;
        aiResponse.status = "atencao";
      }
    }

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
      finalReply,
      tenantId,
      supabase,
      leadId,
      instanceId,
      instanceDbId
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
        ...convUpdateExtra,
      })
      .eq("id", convId);

    // ------------------------------------------------------------------
    // 15. Update posts.status
    // ------------------------------------------------------------------
    const newLeadStatus = aiResponse.status || currentLeadStatus;
    const botName: string = (chatbotConfig as any).name || "Bot";
    const postUpdate: Record<string, unknown> = {
      updated_at: now,
      bot_name: botName,
      instance_name: instanceName,
      instance_id: instanceDbId,
    };
    if (newLeadStatus !== currentLeadStatus) {
      postUpdate.status = newLeadStatus;
    }
    if (aiResponse.should_pause) {
      postUpdate.bot_paused = true;
      postUpdate.bot_pause_reason = aiResponse.status;
    }
    // Always update (bot_name/instance_name may change)
    {
      await supabase.from("posts").update(postUpdate).eq("id", leadId);
      console.log(`[CHATBOT] Lead ${leadId} status: ${currentLeadStatus} → ${newLeadStatus} | paused: ${aiResponse.should_pause}`);
    }

    // ------------------------------------------------------------------
    // 16. Realtime broadcast for frontend toast (interessado em agendar consulta | atencao)
    // ------------------------------------------------------------------
    if (aiResponse.status === "interessado em agendar consulta" || aiResponse.status === "atencao") {
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
        console.warn(`[CHATBOT] Realtime broadcast failed: ${rtErr.message}`);
      }
    }

    return jsonResponse({
      ok: true,
      lead_id: leadId,
      conversation_id: convId,
      ai_status: aiResponse.status,
      should_pause: aiResponse.should_pause,
      action: aiResponse.action,
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
  leadId?: string,
  instanceId?: string,
  instanceDbId?: string
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
    instance_id: instanceDbId || null,
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
      instance_id: instanceId || null,
      uazapi_response: uazapiResponse,
      error: success ? undefined : sendError,
    },
  });

  if (outboundError) {
    console.warn("[CHATBOT] Failed to store outbound message:", outboundError.message);
  }

  return { success, messageId };
}
