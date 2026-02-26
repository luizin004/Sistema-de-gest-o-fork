import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const UAZAPI_CONFIG = {
  url: 'https://oralaligner.uazapi.com/send/text',
  token: 'fcd2612d-6b25-4c8f-aace-29df197301ff',
}

function normalizePhoneForUazapi(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

async function sendViaUazapi(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedPhone = normalizePhoneForUazapi(phone)
    if (!normalizedPhone) {
      return { success: false, error: 'Telefone inválido para UAZAPI' }
    }

    const response = await fetch(UAZAPI_CONFIG.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: UAZAPI_CONFIG.token,
      },
      body: JSON.stringify({ number: normalizedPhone, text: message }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      return { success: false, error: `Erro UAZAPI: ${response.status} - ${errorData}` }
    }

    await response.json().catch(() => null)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    let body: { test?: boolean; tipo?: string } = {}
    try {
      body = await req.json()
    } catch (_e) {
      const url = new URL(req.url)
      const tipoFromUrl = url.searchParams.get('tipo')
      body = {
        test: false,
        tipo: tipoFromUrl || 'limpeza',
      }
    }

    const test = body.test ?? false
    const tipo = body.tipo ?? 'limpeza'

    if (test) {
      return new Response(
        JSON.stringify({
          message: `Teste executado com sucesso para ${tipo}`,
          success: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const { data: config, error: configError } = await supabase
      .from('disparos_config')
      .select('*')
      .eq('tipo', tipo)
      .eq('ativo', true)
      .single()

    if (configError || !config) {
      return new Response(
        JSON.stringify({
          error: 'Configuração não encontrada ou inativa',
          details: configError?.message,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    const today = new Date()
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + config.dias_antes)

    let dateField = ''
    switch (tipo) {
      case 'aniversario':
        dateField = 'data_nascimento'
        break
      case 'limpeza':
        dateField = 'data_limpeza'
        break
      case 'clareamento':
        dateField = 'data_clareamento'
        break
      case 'consulta':
        dateField = 'data_consulta'
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Tipo de disparo inválido' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
    }

    const { data: clients, error: clientsError } = await supabase
      .from('disparos')
      .select('*')
      .not(dateField, 'is', null)
      .eq('ativo', true)

    if (clientsError) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao buscar clientes',
          details: clientsError.message,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const targetClients = clients?.filter(client => {
      if (!client[dateField]) return false

      const clientDate = new Date(client[dateField])
      const clientDateString = clientDate.toISOString().split('T')[0]
      const targetDateString = targetDate.toISOString().split('T')[0]

      if (tipo === 'aniversario') {
        return clientDate.getMonth() === targetDate.getMonth() &&
               clientDate.getDate() === targetDate.getDate()
      }

      return clientDateString === targetDateString
    }) || []

    let sentCount = 0
    let errorCount = 0

    if (targetClients.length > 0) {
      for (const client of targetClients) {
        try {
          const personalizedMessage = config.mensagem_template
            .replace('{nome}', client.nome || 'Cliente')
            .replace(`{${dateField}}`, client[dateField] || '')

          // MIGRAÇÃO: aniversario, limpeza e clareamento usam UAZAPI
          let sendResult = { success: false, error: '', response: null as any }

          if (tipo === 'aniversario' || tipo === 'limpeza' || tipo === 'clareamento') {
            const result = await sendViaUazapi(client.telefone, personalizedMessage)
            sendResult = { success: result.success, error: result.error || '', response: result }
          } else if (config.zapi_instance_id && config.zapi_token && config.zapi_client_token) {
            // apenas consulta continua com Z-API temporariamente
            const zApiResponse = await fetch(`https://api.z-api.io/instances/${config.zapi_instance_id}/token/${config.zapi_token}/send-text`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'client-token': config.zapi_client_token,
              },
              body: JSON.stringify({
                phone: client.telefone,
                message: personalizedMessage,
              }),
            })

            if (zApiResponse.ok) {
              const respBody = await zApiResponse.json().catch(() => null)
              sendResult = { success: true, error: '', response: respBody }
            } else {
              const errText = await zApiResponse.text()
              sendResult = { success: false, error: errText, response: null }
            }
          }

          if (sendResult.success) {
            sentCount++
          } else {
            errorCount++
            console.error(`Failed to send ${tipo} message to ${client.nome}: ${sendResult.error}`)
          }

          // Registrar log individual por cliente
          await supabase
            .from('disparos_automaticos_log')
            .insert({
              tipo,
              cliente_id: client.id,
              telefone: client.telefone,
              mensagem: personalizedMessage,
              data_disparo: new Date().toISOString(),
              status: sendResult.success ? 'enviado' : 'erro',
              resposta_zapi: sendResult.response || { error: sendResult.error },
            })

          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          errorCount++
          console.error(`Error sending to ${client.nome}:`, error)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Scheduler executado para ${tipo}`,
        provider: (tipo === 'aniversario' || tipo === 'limpeza' || tipo === 'clareamento') ? 'uazapi' : 'zapi',
        clients_found: targetClients.length,
        messages_sent: sentCount,
        errors: errorCount,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
