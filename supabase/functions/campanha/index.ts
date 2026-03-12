import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
}

function formatarTelefone(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '')
  limpo = limpo.replace(/^0+/, '')
  if (!limpo.startsWith('55')) limpo = `55${limpo}`
  return limpo
}

function personalizarMensagem(template: string, lead: any): string {
  let msg = template
  msg = msg.replace(/{nome}/gi, lead.nome || 'Cliente')
  msg = msg.replace(/{telefone}/gi, lead.telefone || '')

  if (lead.extras && typeof lead.extras === 'object') {
    Object.keys(lead.extras).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi')
      msg = msg.replace(regex, lead.extras[key]?.toString() || '')
    })
  }
  return msg
}

async function resolverInstancia(supabase: any, instanceId: string) {
  if (!instanceId) return null
  const { data, error } = await supabase
    .from('uazapi_instances')
    .select('token, api_url, name')
    .eq('id', instanceId)
    .single()
  if (error || !data) return null
  return { token: data.token, apiUrl: data.api_url || 'https://oralaligner.uazapi.com', name: data.name }
}

async function enviarMensagem(telefone: string, mensagem: string, apiUrl: string, token: string) {
  try {
    const numero = formatarTelefone(telefone)
    const response = await fetch(`${apiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'token': token },
      body: JSON.stringify({ number: numero, text: mensagem })
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`UAZAPI ${response.status}: ${err}`)
    }
    await response.json()
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)

    // POST /webhook - Recebe webhook de INSERT na tabela_campanha
    if (req.method === 'POST' && url.pathname.includes('/webhook')) {
      let body: any
      try {
        body = await req.json()
      } catch {
        return new Response(JSON.stringify({ error: 'Body invalido' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        })
      }

      if (body?.type === 'INSERT' && body?.table === 'tabela_campanha') {
        const record = body.record
        console.log(`[WEBHOOK] Novo lead: ${record.nome} (campanha: ${record.ID_campanha})`)

        if (!record.ID_campanha || !record.telefone || record.disparo_feito) {
          return new Response(JSON.stringify({ success: true, message: 'Lead ignorado (sem campanha/telefone ou ja disparado)' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
          })
        }

        // Buscar campanha (com filtro de tenant)
        const { data: campanha } = await supabase
          .from('campanhas')
          .select('id, nome, mensagem_template, status, uazapi_instance_id, enviar_audio_vazio, tenant_id')
          .eq('id', record.ID_campanha)
          .eq('status', 'ativa')
          .single()

        if (!campanha) {
          console.log(`[WEBHOOK] Campanha ${record.ID_campanha} nao encontrada ou inativa`)
          return new Response(JSON.stringify({ success: true, message: 'Campanha inativa' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
          })
        }

        // Resolver instancia UAZAPI
        const instancia = await resolverInstancia(supabase, campanha.uazapi_instance_id)
        if (!instancia) {
          console.log(`[WEBHOOK] Instancia UAZAPI nao encontrada para campanha ${campanha.id}`)
          return new Response(JSON.stringify({ success: false, error: 'Instancia UAZAPI nao configurada' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
          })
        }

        // Personalizar e enviar
        const msg = personalizarMensagem(campanha.mensagem_template, record)
        const resultado = await enviarMensagem(record.telefone, msg, instancia.apiUrl, instancia.token)

        // Atualizar status do lead
        if (resultado.success) {
          await supabase.from('tabela_campanha').update({ disparo_feito: true }).eq('id', record.id)
          const { error: rpcError } = await supabase.rpc('atualizar_contadores_campanha', { p_campanha_id: campanha.id })
          if (rpcError) console.error('[WEBHOOK] Erro ao atualizar contadores:', rpcError)

          // Se audio vazio habilitado, enviar audio aleatorio
          if (campanha.enviar_audio_vazio) {
            const { data: audioData } = await supabase.from('silent_audio_pool').select('url').order('id', { ascending: false }).limit(20)
            const audioUrl = audioData?.length
              ? audioData[Math.floor(Math.random() * audioData.length)].url
              : `https://res.cloudinary.com/dgph1ztlr/video/upload/v1770817331/audio_vazio_5s_2_mkwq7w.mp3?t=${Date.now()}`

            try {
              const numero = formatarTelefone(record.telefone)
              await fetch(`${instancia.apiUrl}/send/media`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'token': instancia.token },
                body: JSON.stringify({ number: numero, mediatype: 'audio', media: audioUrl })
              })
              await supabase.from('tabela_campanha').update({ audio_enviado: true, audio_enviado_em: new Date().toISOString() }).eq('id', record.id)
            } catch (audioErr) {
              await supabase.from('tabela_campanha').update({ audio_enviado: false, audio_erro: (audioErr as Error).message }).eq('id', record.id)
            }
          }
        } else {
          const extras = record.extras || {}
          await supabase.from('tabela_campanha').update({
            disparo_feito: false,
            extras: { ...extras, tentativas: (extras.tentativas || 0) + 1, ultimo_erro: resultado.error, data_ultimo_erro: new Date().toISOString(), disparo_falhou: true }
          }).eq('id', record.id)
        }

        return new Response(JSON.stringify({ success: true, message: 'Webhook processado', disparo: resultado.success }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
      }

      return new Response(JSON.stringify({ success: true, message: 'Evento ignorado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // GET /test - Endpoint de teste
    if (req.method === 'GET' && url.pathname.includes('/test')) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook de campanha multi-tenant ativo',
        endpoints: {
          webhook: 'POST /webhook - Processa inserts na tabela_campanha',
          test: 'GET /test - Status do servico'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Default
    return new Response(JSON.stringify({ message: 'Webhook campanha multi-tenant ativo' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (error) {
    console.error(`[CAMPANHA] Erro:`, (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
