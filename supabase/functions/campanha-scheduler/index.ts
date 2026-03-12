import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campanha {
  id: string
  tenant_id: string
  nome: string
  mensagem_template: string
  status: string
  enviar_audio_vazio: boolean
  uazapi_instance_id: string | null
  total_enviados: number
  total_falharam: number
  scheduler_locked: boolean
  last_scheduler_run_at: string | null
}

interface Lead {
  id: number
  tenant_id: string
  ID_campanha: string
  nome: string | null
  telefone: string
  disparo_feito: boolean
  extras: Record<string, unknown>
}

interface UazapiInstance {
  token: string
  api_url: string
}

interface SendResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const MAX_RETRIES = 3
const DISPATCH_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes between dispatches per campaign
const AUDIO_FALLBACK_BASE =
  "https://res.cloudinary.com/dgph1ztlr/video/upload/v1770817331/audio_vazio_5s_2_mkwq7w.mp3"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(level: "INFO" | "WARN" | "ERROR", tag: string, msg: string) {
  console[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log"](
    `[${new Date().toISOString()}] [${level}] [${tag}] ${msg}`
  )
}

function formatarTelefone(telefone: string): string {
  const digits = (telefone || "").replace(/\D/g, "").replace(/^0+/, "")
  if (!digits) return ""
  return digits.startsWith("55") ? digits : `55${digits}`
}

function personalizarMensagem(
  template: string,
  lead: Lead
): string {
  let mensagem = template
  mensagem = mensagem.replace(/{nome}/gi, lead.nome || "Cliente")
  mensagem = mensagem.replace(/{telefone}/gi, lead.telefone || "")

  if (lead.extras && typeof lead.extras === "object") {
    for (const [key, value] of Object.entries(lead.extras)) {
      const regex = new RegExp(`\\{${key}\\}`, "gi")
      mensagem = mensagem.replace(regex, value != null ? String(value) : "")
    }
  }

  return mensagem
}

function isHorarioComercialBrasilia(): boolean {
  const agora = new Date()
  // UTC-3: subtract 3 hours
  const horaBrasilia = ((agora.getUTCHours() - 3) % 24 + 24) % 24
  return horaBrasilia >= 9 && horaBrasilia < 19
}

// ---------------------------------------------------------------------------
// UAZAPI senders
// ---------------------------------------------------------------------------

async function enviarTexto(
  apiUrl: string,
  token: string,
  telefone: string,
  mensagem: string
): Promise<SendResult> {
  const numero = formatarTelefone(telefone)
  if (!numero) {
    return { success: false, error: "Telefone inválido após formatação" }
  }

  try {
    log("INFO", "UAZAPI", `Enviando texto para ${numero}`)
    const response = await fetch(`${apiUrl}/send/text`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number: numero, text: mensagem }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorBody}`,
      }
    }

    await response.json().catch(() => null)
    log("INFO", "UAZAPI", `Texto enviado com sucesso para ${numero}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

async function enviarAudio(
  apiUrl: string,
  token: string,
  telefone: string,
  audioUrl: string
): Promise<SendResult> {
  const numero = formatarTelefone(telefone)
  if (!numero) {
    return { success: false, error: "Telefone inválido após formatação" }
  }

  try {
    log("INFO", "UAZAPI", `Enviando áudio para ${numero}`)
    const response = await fetch(`${apiUrl}/send/media`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number: numero, mediatype: "audio", media: audioUrl }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorBody}`,
      }
    }

    await response.json().catch(() => null)
    log("INFO", "UAZAPI", `Áudio enviado com sucesso para ${numero}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

async function resolverUazapiInstance(
  supabase: SupabaseClient,
  instanceId: string
): Promise<UazapiInstance | null> {
  const { data, error } = await supabase
    .from("uazapi_instances")
    .select("token, api_url")
    .eq("id", instanceId)
    .maybeSingle()

  if (error || !data) {
    log(
      "ERROR",
      "DB",
      `uazapi_instance não encontrada: ${instanceId} – ${error?.message ?? "nenhum registro"}`
    )
    return null
  }

  return {
    token: data.token as string,
    api_url: (data.api_url as string) || "https://oralaligner.uazapi.com",
  }
}

async function buscarProximaCampanha(
  supabase: SupabaseClient
): Promise<Campanha | null> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("*")
    .eq("status", "ativa")
    .eq("scheduler_locked", false)
    .or(
      "last_scheduler_run_at.is.null,last_scheduler_run_at.lt." +
        new Date(Date.now() - DISPATCH_INTERVAL_MS).toISOString()
    )
    .order("last_scheduler_run_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    log("ERROR", "DB", `Erro ao buscar campanha ativa: ${error.message}`)
    return null
  }

  return data as Campanha | null
}

async function bloquearCampanha(
  supabase: SupabaseClient,
  campanhaId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("campanhas")
    .update({ scheduler_locked: true })
    .eq("id", campanhaId)
    .eq("scheduler_locked", false) // optimistic lock

  if (error) {
    log("ERROR", "DB", `Falha ao bloquear campanha ${campanhaId}: ${error.message}`)
    return false
  }
  return true
}

async function desbloquearCampanha(
  supabase: SupabaseClient,
  campanhaId: string
): Promise<void> {
  const { error } = await supabase
    .from("campanhas")
    .update({
      scheduler_locked: false,
      last_scheduler_run_at: new Date().toISOString(),
    })
    .eq("id", campanhaId)

  if (error) {
    log("ERROR", "DB", `Falha ao desbloquear campanha ${campanhaId}: ${error.message}`)
  }
}

async function buscarProximoLead(
  supabase: SupabaseClient,
  campanhaId: string
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("tabela_campanha")
    .select("*")
    .eq("ID_campanha", campanhaId)
    .eq("disparo_feito", false)
    .is("extras->>pulado_disparo", null)
    .is("extras->>disparo_falhou", null)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    log("ERROR", "DB", `Erro ao buscar lead pendente: ${error.message}`)
    return null
  }

  return data as Lead | null
}

async function registrarAudio(
  supabase: SupabaseClient,
  leadId: number,
  success: boolean,
  errorMsg?: string
): Promise<void> {
  const { error } = await supabase
    .from("tabela_campanha")
    .update({
      audio_enviado: success,
      audio_erro: errorMsg || null,
      audio_enviado_em: new Date().toISOString(),
    })
    .eq("id", leadId)

  if (error) {
    log("ERROR", "DB", `Erro ao registrar áudio do lead ${leadId}: ${error.message}`)
  }
}

async function marcarLeadEnviado(
  supabase: SupabaseClient,
  leadId: number
): Promise<void> {
  const { error } = await supabase
    .from("tabela_campanha")
    .update({ disparo_feito: true })
    .eq("id", leadId)

  if (error) {
    log("ERROR", "DB", `Erro ao marcar lead ${leadId} como enviado: ${error.message}`)
  }
}

async function marcarLeadFalhou(
  supabase: SupabaseClient,
  lead: Lead,
  errorMsg: string
): Promise<void> {
  const extras = lead.extras || {}
  const tentativas = ((extras.tentativas as number) || 0) + 1
  const pulado = tentativas >= MAX_RETRIES

  const novosExtras: Record<string, unknown> = {
    ...extras,
    tentativas,
    ultimo_erro: errorMsg,
    data_ultimo_erro: new Date().toISOString(),
  }

  if (pulado) {
    novosExtras.pulado_disparo = true
    novosExtras.motivo_pulado = "muitas_falhas"
    novosExtras.disparo_falhou = true
    log(
      "WARN",
      "SCHEDULER",
      `Lead ${lead.id} atingiu ${MAX_RETRIES} tentativas – marcando como pulado`
    )
  }

  const { error } = await supabase
    .from("tabela_campanha")
    .update({ extras: novosExtras })
    .eq("id", lead.id)

  if (error) {
    log("ERROR", "DB", `Erro ao atualizar lead ${lead.id} após falha: ${error.message}`)
  }
}

async function incrementarContadorCampanha(
  supabase: SupabaseClient,
  campanhaId: string,
  campo: "total_enviados" | "total_falharam"
): Promise<void> {
  // Use rpc para incremento atômico; fallback manual se rpc não existir
  const { error } = await supabase.rpc("increment_campanha_counter", {
    p_campanha_id: campanhaId,
    p_campo: campo,
  })

  if (error) {
    // Fallback: lê o valor atual e incrementa
    const { data } = await supabase
      .from("campanhas")
      .select(campo)
      .eq("id", campanhaId)
      .single()

    const atual = (data?.[campo] as number) || 0
    await supabase
      .from("campanhas")
      .update({ [campo]: atual + 1 })
      .eq("id", campanhaId)
  }
}

async function verificarAutoFinalizar(
  supabase: SupabaseClient,
  campanhaId: string
): Promise<void> {
  const { count, error } = await supabase
    .from("tabela_campanha")
    .select("id", { count: "exact", head: true })
    .eq("ID_campanha", campanhaId)
    .eq("disparo_feito", false)
    .is("extras->>pulado_disparo", null)
    .is("extras->>disparo_falhou", null)

  if (error) {
    log("ERROR", "DB", `Erro ao verificar leads pendentes da campanha ${campanhaId}: ${error.message}`)
    return
  }

  if (count === 0) {
    log("INFO", "SCHEDULER", `Campanha ${campanhaId} sem leads pendentes – finalizando`)
    await supabase
      .from("campanhas")
      .update({ status: "finalizada" })
      .eq("id", campanhaId)
  }
}

async function buscarAudioPool(
  supabase: SupabaseClient
): Promise<string> {
  const { data } = await supabase
    .from("silent_audio_pool")
    .select("url")

  if (data && data.length > 0) {
    // Selecionar aleatoriamente no codigo (random() nao funciona via PostgREST order)
    const idx = Math.floor(Math.random() * data.length)
    return (data[idx] as any).url as string
  }

  // Fallback com cache-busting para evitar bloqueio de CDN
  const ts = Date.now()
  const rnd = Math.random().toString(36).slice(2)
  return `${AUDIO_FALLBACK_BASE}?t=${ts}&r=${rnd}`
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function processarCampanha(
  supabase: SupabaseClient,
  campanha: Campanha
): Promise<{ processado: boolean; leadId?: number; motivo?: string }> {
  // Resolve UAZAPI instance
  if (!campanha.uazapi_instance_id) {
    log("WARN", "SCHEDULER", `Campanha ${campanha.id} sem uazapi_instance_id – pulando`)
    return { processado: false, motivo: "sem_uazapi_instance_id" }
  }

  const uazapi = await resolverUazapiInstance(supabase, campanha.uazapi_instance_id)
  if (!uazapi) {
    return { processado: false, motivo: "uazapi_instance_nao_encontrada" }
  }

  // Fetch pending lead
  const lead = await buscarProximoLead(supabase, campanha.id)
  if (!lead) {
    log("INFO", "SCHEDULER", `Nenhum lead pendente na campanha ${campanha.id}`)
    await verificarAutoFinalizar(supabase, campanha.id)
    return { processado: false, motivo: "sem_leads_pendentes" }
  }

  log(
    "INFO",
    "SCHEDULER",
    `Processando lead ${lead.id} (${lead.nome ?? "sem nome"}) da campanha ${campanha.id}`
  )

  // Check max retries already reached (safety net – query above excludes disparo_falhou,
  // but tentativas may be set without the flag if something crashed mid-update previously)
  const tentativasAtuais = ((lead.extras?.tentativas as number) || 0)
  if (tentativasAtuais >= MAX_RETRIES) {
    await marcarLeadFalhou(supabase, lead, "max_retries_atingido_na_verificacao")
    await incrementarContadorCampanha(supabase, campanha.id, "total_falharam")
    return { processado: false, leadId: lead.id, motivo: "max_retries" }
  }

  // Validate phone
  const telefoneFormatado = formatarTelefone(lead.telefone)
  if (!telefoneFormatado) {
    log("WARN", "SCHEDULER", `Lead ${lead.id} com telefone inválido: "${lead.telefone}"`)
    await marcarLeadFalhou(supabase, lead, "telefone_invalido")
    await incrementarContadorCampanha(supabase, campanha.id, "total_falharam")
    return { processado: false, leadId: lead.id, motivo: "telefone_invalido" }
  }

  // Personalize message
  const mensagem = personalizarMensagem(campanha.mensagem_template, lead)

  // Send text
  const resultTexto = await enviarTexto(uazapi.api_url, uazapi.token, lead.telefone, mensagem)

  if (!resultTexto.success) {
    log(
      "ERROR",
      "SCHEDULER",
      `Falha ao enviar texto para lead ${lead.id}: ${resultTexto.error}`
    )
    await marcarLeadFalhou(supabase, lead, resultTexto.error ?? "erro_desconhecido")
    await incrementarContadorCampanha(supabase, campanha.id, "total_falharam")
    return { processado: false, leadId: lead.id, motivo: resultTexto.error }
  }

  // Mark lead as sent
  await marcarLeadEnviado(supabase, lead.id)
  await incrementarContadorCampanha(supabase, campanha.id, "total_enviados")

  // Send silent audio if configured
  if (campanha.enviar_audio_vazio) {
    const audioUrl = await buscarAudioPool(supabase)
    log("INFO", "SCHEDULER", `Enviando áudio para lead ${lead.id}: ${audioUrl}`)
    const resultAudio = await enviarAudio(uazapi.api_url, uazapi.token, lead.telefone, audioUrl)
    await registrarAudio(supabase, lead.id, resultAudio.success, resultAudio.error)

    if (!resultAudio.success) {
      log("WARN", "SCHEDULER", `Falha no áudio para lead ${lead.id}: ${resultAudio.error}`)
    }
  }

  // Check auto-finalize
  await verificarAutoFinalizar(supabase, campanha.id)

  log("INFO", "SCHEDULER", `Lead ${lead.id} processado com sucesso`)
  return { processado: true, leadId: lead.id }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Business hours check (09:00 – 19:00 Brasilia / UTC-3)
    if (!isHorarioComercialBrasilia()) {
      const hora = ((new Date().getUTCHours() - 3) % 24 + 24) % 24
      log("INFO", "SCHEDULER", `Fora do horário permitido (09h–19h Brasília). Hora atual: ${hora}h`)
      return new Response(
        JSON.stringify({
          message: "Fora do horário permitido (09h–19h Brasília)",
          skipped: true,
          hora_brasilia: hora,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 2. Small random delay (5–15s) for humanization
    const delay = Math.floor(Math.random() * 11) + 5
    log("INFO", "SCHEDULER", `Aguardando delay de ${delay}s antes de processar`)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))

    // 3. Create service-role Supabase client (multi-tenant, bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 4. Find next unlocked active campaign
    const campanha = await buscarProximaCampanha(supabase)
    if (!campanha) {
      log("INFO", "SCHEDULER", "Nenhuma campanha ativa disponível para processar")
      return new Response(
        JSON.stringify({ message: "Nenhuma campanha ativa disponível", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 5. Optimistic lock on campaign
    const bloqueado = await bloquearCampanha(supabase, campanha.id)
    if (!bloqueado) {
      log("WARN", "SCHEDULER", `Campanha ${campanha.id} já está bloqueada – corrida de concorrência`)
      return new Response(
        JSON.stringify({ message: "Campanha já em processamento", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    log("INFO", "SCHEDULER", `Campanha ${campanha.id} (${campanha.nome}) bloqueada para processamento`)

    let resultado: Awaited<ReturnType<typeof processarCampanha>>

    try {
      resultado = await processarCampanha(supabase, campanha)
    } finally {
      // Always release lock and update timestamp
      await desbloquearCampanha(supabase, campanha.id)
      log("INFO", "SCHEDULER", `Lock da campanha ${campanha.id} liberado`)
    }

    return new Response(
      JSON.stringify({
        message: resultado.processado ? "Lead processado com sucesso" : "Campanha verificada sem envio",
        campanha_id: campanha.id,
        campanha_nome: campanha.nome,
        processado: resultado.processado,
        lead_id: resultado.leadId ?? null,
        motivo: resultado.motivo ?? null,
        delay_aplicado_s: delay,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (err) {
    const msg = (err as Error).message
    log("ERROR", "SCHEDULER", `Erro fatal na execução: ${msg}`)
    return new Response(
      JSON.stringify({ error: msg, message: "Falha na execução do scheduler" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
