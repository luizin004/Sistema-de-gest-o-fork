import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_CONFIG = {
  url: 'https://oralaligner.uazapi.com/send/text',
  mediaUrl: 'https://oralaligner.uazapi.com/send/media',
  token: '2fe4e18e-3851-44b5-88d8-373da8259044',
  maxRetries: 0,
}

const AUDIO_CONFIG = {
  defaultFile: 'https://res.cloudinary.com/dgph1ztlr/video/upload/v1770817331/audio_vazio_5s_2_mkwq7w.mp3',
}

function formatarTelefoneParaEnvio(telefone: string) {
  let telefoneLimpo = telefone.replace(/\D/g, '')
  telefoneLimpo = telefoneLimpo.replace(/^0+/, '')
  if (!telefoneLimpo.startsWith('55')) {
    telefoneLimpo = `55${telefoneLimpo}`
  }
  return telefoneLimpo
}

async function enviarMensagemWhatsApp(telefone: string, mensagem: string, retryCount = 0) {
  try {
    console.log(`📱 [${new Date().toISOString()}] [UAZAPI] Enviando mensagem para ${telefone} (tentativa ${retryCount + 1})`)
    const telefoneCompleto = formatarTelefoneParaEnvio(telefone)

    const payload = { number: telefoneCompleto, text: mensagem }
    const response = await fetch(UAZAPI_CONFIG.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: UAZAPI_CONFIG.token,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Erro UAZAPI: ${response.status} - ${errorData}`)
    }

    await response.json()
    console.log(`✅ [${new Date().toISOString()}] [UAZAPI] Mensagem enviada com sucesso para ${telefone}`)
    return { success: true }
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] [UAZAPI] Erro ao enviar mensagem para ${telefone}:`, (error as Error).message)
    
    if (retryCount < UAZAPI_CONFIG.maxRetries) {
      console.log(`🔄 [${new Date().toISOString()}] [UAZAPI] Tentando novamente em 5 segundos...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
      return await enviarMensagemWhatsApp(telefone, mensagem, retryCount + 1)
    }
    
    return { success: false, error: (error as Error).message }
  }
}

async function enviarAudioVazio(telefone: string, arquivoAudio: string) {
  try {
    console.log(`🎵 [${new Date().toISOString()}] [UAZAPI] Enviando áudio para ${telefone}`)
    const telefoneCompleto = formatarTelefoneParaEnvio(telefone)

    const payload = {
      number: telefoneCompleto,
      mediatype: 'audio',
      media: arquivoAudio,
    }
    const response = await fetch(UAZAPI_CONFIG.mediaUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: UAZAPI_CONFIG.token,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Erro UAZAPI Audio: ${response.status} - ${errorData}`)
    }

    await response.json()
    console.log(`✅ [${new Date().toISOString()}] [UAZAPI] Áudio enviado com sucesso para ${telefone}`)
    return { success: true }
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] [UAZAPI] Erro ao enviar áudio para ${telefone}:`, (error as Error).message)
    return { success: false, error: (error as Error).message }
  }
}

async function registrarEnvioAudio(supabase: any, leadId: number, success: boolean, error?: string) {
  try {
    await supabase
      .from('tabela_campanha')
      .update({ 
        audio_enviado: success,
        audio_erro: error || null,
        audio_enviado_em: new Date().toISOString()
      })
      .eq('id', leadId)
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] [DATABASE] Erro ao registrar áudio:`, (error as Error).message)
  }
}

async function buscarCampanhaAtiva(supabase: any, campanhaId: number) {
  try {
    const { data, error } = await supabase
      .from('campanhas')
      .select('*')
      .eq('id', campanhaId)
      .eq('status', 'ativa')
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] [DATABASE] Erro ao buscar campanha ${campanhaId}:`, (error as Error).message)
    return null
  }
}

async function processarDisparoAutomatico(supabase: any, lead: any) {
  console.log(`🚀 [${new Date().toISOString()}] [SCHEDULER] Processando lead ID: ${lead.id}, Nome: ${lead.nome}, Telefone: ${lead.telefone}`)
  
  if (!lead.ID_campanha || !lead.telefone) {
    console.log(`⚠️ [${new Date().toISOString()}] [SCHEDULER] Lead ID ${lead.id} sem campanha ou telefone, ignorando...`)
    await supabase
      .from('tabela_campanha')
      .update({ disparo_feito: false })
      .eq('id', lead.id)
    return
  }

  // Verificar se já tem muitas tentativas de falha
  const tentativas = lead.extras?.tentativas || 0
  if (tentativas >= 3) {
    console.log(`🚫 [${new Date().toISOString()}] [SCHEDULER] Lead ID ${lead.id} já falhou ${tentativas} vezes, marcando como pulado...`)
    const extrasAtuais = lead.extras || {}
    await supabase
      .from('tabela_campanha')
      .update({ 
        extras: { 
          ...extrasAtuais, 
          pulado_disparo: true, 
          motivo_pulado: 'muitas_falhas',
          disparo_falhou: true
        } 
      })
      .eq('id', lead.id)
    return
  }

  const campanha = await buscarCampanhaAtiva(supabase, lead.ID_campanha)
  if (!campanha) {
    console.log(`🚫 [${new Date().toISOString()}] [SCHEDULER] Campanha ${lead.ID_campanha} inativa, pulando lead ID ${lead.id}...`)
    const extrasAtuais = lead.extras || {}
    await supabase
      .from('tabela_campanha')
      .update({ extras: { ...extrasAtuais, pulado_disparo: true, motivo_pulado: 'campanha_inativa' } })
      .eq('id', lead.id)
    return
  }

  const mensagemPersonalizada = campanha.mensagem_template
    .replace(/{nome}/gi, lead.nome || 'Cliente')
    .replace(/{telefone}/gi, lead.telefone || '')

  console.log(`📤 [${new Date().toISOString()}] [SCHEDULER] Enviando mensagem para ${lead.nome}...`)
    console.log(`💬 [${new Date().toISOString()}] [SCHEDULER] Mensagem: "${mensagemPersonalizada}"`)
  const resultadoTexto = await enviarMensagemWhatsApp(lead.telefone, mensagemPersonalizada)

  if (resultadoTexto.success) {
    console.log(`✅ [${new Date().toISOString()}] [SCHEDULER] Mensagem enviada com sucesso para lead ID ${lead.id}`)
    await supabase
      .from('tabela_campanha')
      .update({ disparo_feito: true })
      .eq('id', lead.id)

    if (campanha.enviar_audio_vazio) {
      console.log(`🎵 [${new Date().toISOString()}] [SCHEDULER] Enviando áudio para lead ID ${lead.id}...`)
      const arquivoAudio = campanha.arquivo_audio_personalizado || AUDIO_CONFIG.defaultFile
      const resultadoAudio = await enviarAudioVazio(lead.telefone, arquivoAudio)
      await registrarEnvioAudio(supabase, lead.id, resultadoAudio.success, resultadoAudio.error)
    }
  } else {
    console.log(`❌ [${new Date().toISOString()}] [SCHEDULER] Falha ao enviar mensagem para lead ID ${lead.id}: ${resultadoTexto.error}`)
    
    // Incrementar tentativas e marcar falha
    const extrasAtuais = lead.extras || {}
    const novasTentativas = (extrasAtuais.tentativas || 0) + 1
    
    await supabase
      .from('tabela_campanha')
      .update({ 
        disparo_feito: false,
        extras: {
          ...extrasAtuais,
          tentativas: novasTentativas,
          ultimo_erro: resultadoTexto.error,
          data_ultimo_erro: new Date().toISOString(),
          disparo_falhou: true
        }
      })
      .eq('id', lead.id)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar horário: apenas 09h–19h horário de Brasília (UTC-3)
    const agora = new Date();
    const horaUTC = agora.getUTCHours();
    const horaBrasilia = ((horaUTC - 3) % 24 + 24) % 24;
    if (horaBrasilia < 9 || horaBrasilia >= 19) {
      console.log(`🌙 [${new Date().toISOString()}] [SCHEDULER] Fora do horário permitido (09h–19h Brasília). Hora atual: ${horaBrasilia}h`)
      return new Response(
        JSON.stringify({ message: 'Fora do horário permitido (09h–19h Brasília)', skipped: true, hora_brasilia: horaBrasilia }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`🌅 [${new Date().toISOString()}] [SCHEDULER] Iniciando execução...`)
    
    const randomDelay = Math.floor(Math.random() * 31) + 30
    console.log(`⏱️ [${new Date().toISOString()}] [SCHEDULER] Aplicando delay de ${randomDelay} segundos...`)
    await new Promise((resolve) => setTimeout(resolve, randomDelay * 1000))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar lock
    const { data: lockData, error: lockError } = await supabase
      .from('scheduler_lock')
      .select('id, updated_at, ativo')
      .eq('id', 1)
      .single()

    if (lockData && lockData.ativo === true) {
      console.log(`🔒 [${new Date().toISOString()}] [SCHEDULER] Já está em execução desde ${lockData.updated_at}`)
      return new Response(
        JSON.stringify({ message: 'Already running', skipped: true, active_since: lockData.updated_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Ativar lock
    await supabase
      .from('scheduler_lock')
      .upsert({ id: 1, ativo: true, inicio: new Date().toISOString(), source: 'job-10min' })
    console.log(`🔓 [${new Date().toISOString()}] [SCHEDULER] Lock ativado`)

    try {
      // Buscar próximo lead válido (sem falhas e não pulado)
      const { data: lead } = await supabase
        .from('tabela_campanha')
        .select('*')
        .eq('disparo_feito', false)
        .is('extras->>pulado_disparo', null)
        .is('extras->>disparo_falhou', null)
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!lead) {
        console.log(`✅ [${new Date().toISOString()}] [SCHEDULER] Nenhum lead pendente encontrado`)
        return new Response(
          JSON.stringify({ message: 'No pending leads', processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      await processarDisparoAutomatico(supabase, lead)

      console.log(`🎉 [${new Date().toISOString()}] [SCHEDULER] Execução concluída com sucesso!`)
      return new Response(
        JSON.stringify({ message: 'Lead processed successfully', processed: 1, lead_id: lead.id, delay_applied: randomDelay }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } finally {
      // Liberar lock
      await supabase
        .from('scheduler_lock')
        .update({ ativo: false, fim: new Date().toISOString() })
        .eq('id', 1)
      console.log(`🔓 [${new Date().toISOString()}] [SCHEDULER] Lock liberado`)
    }
  } catch (error) {
    console.error(`💥 [${new Date().toISOString()}] [SCHEDULER] Erro na execução:`, (error as Error).message)
    return new Response(
      JSON.stringify({ error: (error as Error).message, message: 'Scheduler execution failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
