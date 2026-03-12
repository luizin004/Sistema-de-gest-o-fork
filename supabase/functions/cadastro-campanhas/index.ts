import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LOG_PREFIX = '[cadastro-campanhas]'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string, data?: unknown) {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[${ts}] ${LOG_PREFIX} ${message}`, data)
  } else {
    console.log(`[${ts}] ${LOG_PREFIX} ${message}`)
  }
}

function logError(message: string, error?: unknown) {
  const ts = new Date().toISOString()
  console.error(`[${ts}] ${LOG_PREFIX} ${message}`, error)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Extracts and validates the X-Tenant-Id header. Returns the tenant_id string
 * or throws an error with a ready-made 400 Response attached as `.response`.
 */
function extractTenantId(req: Request): string {
  const tenantId = req.headers.get('X-Tenant-Id')?.trim()
  if (!tenantId) {
    throw Object.assign(new Error('X-Tenant-Id header is required'), {
      response: jsonResponse({ error: 'Header X-Tenant-Id is obrigatório' }, 400),
    })
  }
  return tenantId
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleGet(tenantId: string): Promise<Response> {
  log(`Listando campanhas para tenant ${tenantId}`)

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campanhas')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    logError('Erro ao buscar campanhas:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  log(`${data?.length ?? 0} campanha(s) encontrada(s) para tenant ${tenantId}`)
  return jsonResponse({ success: true, data: data ?? [], count: data?.length ?? 0 })
}

async function handlePost(req: Request, tenantId: string, url: URL): Promise<Response> {
  const action = url.searchParams.get('action')

  if (action === 'toggle') {
    return handleToggle(req, tenantId, url)
  }

  // -- Create campaign --
  log(`Criando nova campanha para tenant ${tenantId}`)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body JSON inválido' }, 400)
  }

  const nome = (body.nome as string | undefined)?.trim()
  if (!nome) {
    return jsonResponse({ error: 'Campo obrigatório: nome' }, 400)
  }

  const supabase = createServiceClient()

  const insertData: Record<string, unknown> = {
    tenant_id: tenantId,
    nome,
    status: 'pausada',
    descricao: body.descricao ?? null,
    mensagem_template: body.mensagem_template ?? 'Olá {nome}! Temos uma oferta especial para você!',
    enviar_audio_vazio: body.enviar_audio_vazio ?? false,
    uazapi_instance_id: body.uazapi_instance_id ?? null,
  }

  log('Inserindo campanha:', { nome: insertData.nome, tenant_id: tenantId })

  const { data, error } = await supabase
    .from('campanhas')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    logError('Erro ao criar campanha:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  log(`Campanha criada com sucesso: ${data.id}`)
  return jsonResponse({ success: true, data, message: 'Campanha criada com sucesso!' }, 201)
}

async function handlePatch(req: Request, tenantId: string, url: URL): Promise<Response> {
  const campaignId = url.searchParams.get('id')?.trim()
  if (!campaignId) {
    return jsonResponse({ error: 'Query param ?id= é obrigatório' }, 400)
  }

  log(`Atualizando campanha ${campaignId} para tenant ${tenantId}`)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body JSON inválido' }, 400)
  }

  const supabase = createServiceClient()

  // Validate tenant ownership
  const { data: existing, error: fetchError } = await supabase
    .from('campanhas')
    .select('id, status, uazapi_instance_id')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !existing) {
    logError(`Campanha ${campaignId} não encontrada para tenant ${tenantId}`)
    return jsonResponse({ error: 'Campanha não encontrada' }, 404)
  }

  // Build update payload from allowed fields only
  const updateData: Record<string, unknown> = {}

  if (body.nome !== undefined) updateData.nome = body.nome
  if (body.descricao !== undefined) updateData.descricao = body.descricao
  if (body.mensagem_template !== undefined) updateData.mensagem_template = body.mensagem_template
  if (body.enviar_audio_vazio !== undefined) updateData.enviar_audio_vazio = body.enviar_audio_vazio
  if (body.uazapi_instance_id !== undefined) updateData.uazapi_instance_id = body.uazapi_instance_id

  // Status transition validations
  if (body.status !== undefined) {
    const newStatus = body.status as string

    if (newStatus === 'finalizada') {
      // Allow — finalizada is irreversible, enforced on next edit attempt
      updateData.status = newStatus
    } else if (newStatus === 'ativa') {
      // When activating, uazapi_instance_id must exist (either already set or supplied in this request)
      const effectiveInstanceId =
        (updateData.uazapi_instance_id as string | null | undefined) ?? existing.uazapi_instance_id

      if (!effectiveInstanceId) {
        return jsonResponse(
          { error: 'É necessário configurar um uazapi_instance_id antes de ativar a campanha' },
          422
        )
      }
      updateData.status = newStatus
    } else if (newStatus === 'pausada') {
      updateData.status = newStatus
    } else {
      return jsonResponse(
        { error: `Status inválido: ${newStatus}. Permitidos: ativa, pausada, finalizada` },
        400
      )
    }
  }

  if (Object.keys(updateData).length === 0) {
    return jsonResponse({ error: 'Nenhum campo válido fornecido para atualização' }, 400)
  }

  updateData.updated_at = new Date().toISOString()

  log(`Dados para atualização da campanha ${campaignId}:`, updateData)

  const { data, error } = await supabase
    .from('campanhas')
    .update(updateData)
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    logError('Erro ao atualizar campanha:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  log(`Campanha ${campaignId} atualizada com sucesso`)
  return jsonResponse({ success: true, data, message: 'Campanha atualizada com sucesso!' })
}

async function handleDelete(tenantId: string, url: URL): Promise<Response> {
  const campaignId = url.searchParams.get('id')?.trim()
  if (!campaignId) {
    return jsonResponse({ error: 'Query param ?id= é obrigatório' }, 400)
  }

  log(`Excluindo campanha ${campaignId} para tenant ${tenantId}`)

  const supabase = createServiceClient()

  // Validate tenant ownership before deleting
  const { data: existing, error: fetchError } = await supabase
    .from('campanhas')
    .select('id')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !existing) {
    logError(`Campanha ${campaignId} não encontrada para tenant ${tenantId}`)
    return jsonResponse({ error: 'Campanha não encontrada' }, 404)
  }

  const { error } = await supabase
    .from('campanhas')
    .delete()
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)

  if (error) {
    logError('Erro ao excluir campanha:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  log(`Campanha ${campaignId} excluída com sucesso`)
  return jsonResponse({ success: true, message: 'Campanha excluída com sucesso!' })
}

async function handleToggle(req: Request, tenantId: string, url: URL): Promise<Response> {
  const campaignId = url.searchParams.get('id')?.trim()
  if (!campaignId) {
    return jsonResponse({ error: 'Query param ?id= é obrigatório para toggle' }, 400)
  }

  log(`Toggle de status da campanha ${campaignId} para tenant ${tenantId}`)

  const supabase = createServiceClient()

  const { data: existing, error: fetchError } = await supabase
    .from('campanhas')
    .select('id, status, uazapi_instance_id')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !existing) {
    logError(`Campanha ${campaignId} não encontrada para tenant ${tenantId}`)
    return jsonResponse({ error: 'Campanha não encontrada' }, 404)
  }

  const targetStatus = existing.status === 'ativa' ? 'pausada' : 'ativa'

  if (targetStatus === 'ativa' && !existing.uazapi_instance_id) {
    return jsonResponse(
      { error: 'É necessário configurar um uazapi_instance_id antes de ativar a campanha' },
      422
    )
  }

  const { data, error } = await supabase
    .from('campanhas')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    logError('Erro ao fazer toggle da campanha:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  log(`Campanha ${campaignId} alternada para status "${targetStatus}"`)
  return jsonResponse({
    success: true,
    data,
    message: `Campanha ${targetStatus === 'ativa' ? 'ativada' : 'pausada'} com sucesso!`,
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const tenantId = extractTenantId(req)
    const url = new URL(req.url)
    const method = req.method

    log(`${method} ${url.pathname}${url.search} — tenant: ${tenantId}`)

    if (method === 'GET') return await handleGet(tenantId)
    if (method === 'POST') return await handlePost(req, tenantId, url)
    if (method === 'PATCH') return await handlePatch(req, tenantId, url)
    if (method === 'DELETE') return await handleDelete(tenantId, url)

    return jsonResponse({ error: 'Método não permitido' }, 405)
  } catch (err: unknown) {
    // Structured error thrown by extractTenantId
    if (err instanceof Error && 'response' in err) {
      return (err as Error & { response: Response }).response
    }

    logError('Erro interno inesperado:', err)
    return jsonResponse(
      {
        error: 'Erro interno do servidor',
        details: err instanceof Error ? err.message : String(err),
      },
      500
    )
  }
})
