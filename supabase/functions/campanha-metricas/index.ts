import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[campanha-metricas]"
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

// ---------------------------------------------------------------------------
// In-memory cache (per-tenant)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function cacheKey(tenantId: string): string {
  return `campanha-metricas-${tenantId}`
}

function getCached(tenantId: string): unknown | null {
  const entry = cache.get(cacheKey(tenantId))
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(cacheKey(tenantId))
    return null
  }
  return entry.data
}

function setCached(tenantId: string, data: unknown): void {
  cache.set(cacheKey(tenantId), { data, timestamp: Date.now() })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string, data?: unknown): void {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[${ts}] ${LOG_PREFIX} ${message}`, data)
  } else {
    console.log(`[${ts}] ${LOG_PREFIX} ${message}`)
  }
}

function logError(message: string, error?: unknown): void {
  const ts = new Date().toISOString()
  console.error(`[${ts}] ${LOG_PREFIX} ${message}`, error)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Extracts and validates the X-Tenant-Id header.
 * Throws an Error with a `.response` property when the header is absent.
 */
function extractTenantId(req: Request): string {
  const tenantId = req.headers.get("X-Tenant-Id")?.trim()
  if (!tenantId) {
    throw Object.assign(new Error("X-Tenant-Id header is required"), {
      response: jsonResponse({ error: "Header X-Tenant-Id é obrigatório" }, 400),
    })
  }
  return tenantId
}

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a Brazilian phone number to DDD (2 digits) + last 8 digits.
 * This is the canonical form used for cross-referencing leads with the posts table.
 *
 * Examples:
 *   "5531987654321" → "3154321"  (wait — DDD=31, last 8=87654321)
 *   "+55 (31) 9 8765-4321" → "3187654321" (actually 10 chars: DDD+8)
 */
function extrairTelefoneBase(telefone: string | null | undefined): string | null {
  if (!telefone) return null

  // Strip everything except digits
  let clean = telefone.replace(/\D/g, "")

  // Remove country code 55 when present
  if (clean.length >= 12 && clean.startsWith("55")) {
    clean = clean.slice(2)
  }

  // Minimum viable: DDD (2) + number (8) = 10 digits
  if (clean.length < 10) return null

  // DDD = first 2 digits, base = last 8 digits (handles 8- and 9-digit local numbers)
  return clean.slice(0, 2) + clean.slice(-8)
}

// ---------------------------------------------------------------------------
// Core metrics computation
// ---------------------------------------------------------------------------

interface Lead {
  id: number
  tenant_id: string
  ID_campanha: string | null
  nome: string | null
  telefone: string | null
  disparo_feito: boolean | null
  respondeu: boolean | null
  extras: Record<string, unknown>
}

interface CampanhaRow {
  id: string
  tenant_id: string
  nome: string
  status: string
  total_leads: number
  total_enviados: number
  total_falharam: number
  total_responderam: number
}

interface LeadComStatus extends Lead {
  respondeu: boolean
}

interface CampanhaMetrica {
  id: string
  nome: string
  status: string
  total_leads: number
  enviados: number
  pendentes: number
  falharam: number
  responderam: number
  taxa_resposta: string
}

interface GlobalMetrica {
  total_leads: number
  total_enviados: number
  total_pendentes: number
  total_falharam: number
  total_responderam: number
  taxa_resposta: string
}

async function computeMetrics(tenantId: string): Promise<Response> {
  const supabase = createServiceClient()

  // ------------------------------------------------------------------
  // 1. Fetch all leads for this tenant
  // ------------------------------------------------------------------
  log(`Buscando leads da tabela_campanha para tenant ${tenantId}`)

  const { data: rawLeads, error: leadsError } = await supabase
    .from("tabela_campanha")
    .select("*")
    .eq("tenant_id", tenantId)

  if (leadsError) {
    logError("Erro ao buscar tabela_campanha:", leadsError)
    return jsonResponse({ error: leadsError.message }, 500)
  }

  const leads: Lead[] = rawLeads ?? []
  log(`${leads.length} lead(s) encontrado(s) para tenant ${tenantId}`)

  // ------------------------------------------------------------------
  // 2. Fetch all campanhas for this tenant
  // ------------------------------------------------------------------
  log(`Buscando campanhas para tenant ${tenantId}`)

  const { data: rawCampanhas, error: campanhasError } = await supabase
    .from("campanhas")
    .select("id, tenant_id, nome, status, total_leads, total_enviados, total_falharam, total_responderam")
    .eq("tenant_id", tenantId)

  if (campanhasError) {
    logError("Erro ao buscar campanhas:", campanhasError)
    return jsonResponse({ error: campanhasError.message }, 500)
  }

  const campanhas: CampanhaRow[] = rawCampanhas ?? []
  log(`${campanhas.length} campanha(s) encontrada(s) para tenant ${tenantId}`)

  // ------------------------------------------------------------------
  // 3. Fetch unique phone numbers from posts (tenant-scoped)
  // ------------------------------------------------------------------
  log(`Buscando telefones da tabela posts para tenant ${tenantId}`)

  const { data: rawPosts, error: postsError } = await supabase
    .from("posts")
    .select("telefone")
    .eq("tenant_id", tenantId)

  if (postsError) {
    logError("Erro ao buscar posts:", postsError)
    return jsonResponse({ error: postsError.message }, 500)
  }

  // ------------------------------------------------------------------
  // 4. Build a normalised phone lookup set from posts
  // ------------------------------------------------------------------
  const postsPhoneSet = new Set<string>()
  let phonesNormalised = 0

  for (const post of rawPosts ?? []) {
    const base = extrairTelefoneBase(post.telefone)
    if (base) {
      postsPhoneSet.add(base)
      phonesNormalised++
    }
  }

  log(`${phonesNormalised} telefone(s) normalizado(s) no mapa de posts`)

  // ------------------------------------------------------------------
  // 5. Cross-reference each lead with posts and detect new responses
  // ------------------------------------------------------------------
  const leadsParaAtualizar: number[] = []

  const leadsComStatus: LeadComStatus[] = leads.map((lead) => {
    const base = extrairTelefoneBase(lead.telefone)
    const respondeuAgora = base ? postsPhoneSet.has(base) : false

    // Schedule a DB update only when the lead was NOT already marked
    if (respondeuAgora && lead.respondeu !== true) {
      leadsParaAtualizar.push(lead.id)
    }

    return { ...lead, respondeu: respondeuAgora }
  })

  // ------------------------------------------------------------------
  // 6. Persist respondeu = true for newly detected responses (fire-and-forget)
  // ------------------------------------------------------------------
  if (leadsParaAtualizar.length > 0) {
    log(`Atualizando respondeu=true para ${leadsParaAtualizar.length} lead(s)`)

    const { error: updateError } = await supabase
      .from("tabela_campanha")
      .update({ respondeu: true })
      .in("id", leadsParaAtualizar)
      .eq("tenant_id", tenantId) // safety guard

    if (updateError) {
      // Non-fatal: log and continue — metrics are still accurate
      logError("Erro ao atualizar campo respondeu nos leads:", updateError)
    } else {
      log(`respondeu atualizado para ${leadsParaAtualizar.length} lead(s)`)
    }
  }

  // ------------------------------------------------------------------
  // 7. Per-campaign aggregation
  // ------------------------------------------------------------------
  // Index leads by ID_campanha for O(n) grouping
  const leadsByCampanha = new Map<string, LeadComStatus[]>()

  for (const lead of leadsComStatus) {
    const key = lead.ID_campanha ?? "__sem_campanha__"
    if (!leadsByCampanha.has(key)) leadsByCampanha.set(key, [])
    leadsByCampanha.get(key)!.push(lead)
  }

  const porCampanha: CampanhaMetrica[] = campanhas.map((camp) => {
    const campLeads = leadsByCampanha.get(camp.id) ?? []

    const totalLeads = campLeads.length
    const enviados = campLeads.filter((l) => l.disparo_feito === true).length
    const pendentes = campLeads.filter((l) => !l.disparo_feito).length
    const responderam = campLeads.filter((l) => l.respondeu === true).length

    // falharam = leads where disparo_feito is explicitly false (attempted but failed)
    const falharam = campLeads.filter((l) => l.disparo_feito === false).length

    const taxaResposta =
      enviados > 0 ? ((responderam / enviados) * 100).toFixed(1) : "0.0"

    return {
      id: camp.id,
      nome: camp.nome,
      status: camp.status,
      total_leads: totalLeads,
      enviados,
      pendentes,
      falharam,
      responderam,
      taxa_resposta: taxaResposta,
    }
  })

  // ------------------------------------------------------------------
  // 8. Global aggregation across all leads for this tenant
  // ------------------------------------------------------------------
  const totalLeads = leadsComStatus.length
  const totalEnviados = leadsComStatus.filter((l) => l.disparo_feito === true).length
  const totalPendentes = leadsComStatus.filter((l) => !l.disparo_feito).length
  const totalFalharam = leadsComStatus.filter((l) => l.disparo_feito === false).length
  const totalResponderam = leadsComStatus.filter((l) => l.respondeu === true).length

  const taxaRespostaGlobal =
    totalEnviados > 0
      ? ((totalResponderam / totalEnviados) * 100).toFixed(1)
      : "0.0"

  const global: GlobalMetrica = {
    total_leads: totalLeads,
    total_enviados: totalEnviados,
    total_pendentes: totalPendentes,
    total_falharam: totalFalharam,
    total_responderam: totalResponderam,
    taxa_resposta: taxaRespostaGlobal,
  }

  log("Metricas globais calculadas:", global)

  // ------------------------------------------------------------------
  // 9. Assemble response payload
  // ------------------------------------------------------------------
  const responsePayload = {
    success: true,
    global,
    por_campanha: porCampanha,
    data: leadsComStatus,
    timestamp: new Date().toISOString(),
  }

  return jsonResponse(responsePayload)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // POST /clear-cache — clears all tenant cache entries, no auth required beyond
  // the fact that this edge function is only invocable by authenticated callers.
  if (req.method === "POST" && req.url.includes("/clear-cache")) {
    const sizeBefore = cache.size
    cache.clear()
    log(`Cache limpo (${sizeBefore} entrada(s) removida(s))`)
    return jsonResponse({ success: true, message: "Cache limpo", entries_cleared: sizeBefore })
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Método não permitido" }, 405)
  }

  // Extract tenant — propagates a ready-made 400 Response on missing header
  let tenantId: string
  try {
    tenantId = extractTenantId(req)
  } catch (err: unknown) {
    if (err instanceof Error && "response" in err) {
      return (err as Error & { response: Response }).response
    }
    logError("Erro inesperado na extração do tenant:", err)
    return jsonResponse({ error: "Erro interno do servidor" }, 500)
  }

  log(`GET métricas — tenant: ${tenantId}`)

  // Serve from cache when available
  const cached = getCached(tenantId)
  if (cached !== null) {
    log(`Servindo do cache para tenant ${tenantId}`)
    return jsonResponse(cached)
  }

  try {
    const response = await computeMetrics(tenantId)

    // Only cache successful 200 responses
    if (response.status === 200) {
      const cloned = response.clone()
      const body = await cloned.json()
      setCached(tenantId, body)
    }

    return response
  } catch (err: unknown) {
    logError("Erro interno inesperado:", err)
    return jsonResponse(
      {
        error: "Erro interno do servidor",
        details: err instanceof Error ? err.message : String(err),
      },
      500
    )
  }
})
