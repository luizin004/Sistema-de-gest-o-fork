import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
}

interface CampanhaRequest {
  id?: string
  nome?: string
  mensagem_template?: string
  status?: string
  enviar_audio_vazio?: boolean
  arquivo_audio_personalizado?: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const method = req.method

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    if (method === 'GET') {
      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] Listando campanhas cadastradas`)
      
      const { data, error } = await supabaseClient
        .from('campanhas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(`[${new Date().toISOString()}] [cadastro-campanhas] Erro ao buscar campanhas:`, error)
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] ✅ ${data?.length || 0} campanhas encontradas`)
      
      return new Response(
        JSON.stringify({ success: true, data: data || [], count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (method === 'POST') {
      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] Criando nova campanha`)
      
      const body: CampanhaRequest = await req.json()
      
      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] 📋 Dados recebidos para criação:`, {
        id: body.id,
        nome: body.nome,
        mensagem_template: body.mensagem_template
      })

      if (!body.id || !body.nome) {
        console.error(`[${new Date().toISOString()}] [cadastro-campanhas] ❌ Campos obrigatórios faltando`)
        return new Response(JSON.stringify({ error: 'ID e nome são obrigatórios' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const { data: existingCampaign } = await supabaseClient
        .from('campanhas')
        .select('id')
        .eq('id', body.id)
        .single()

      if (existingCampaign) {
        console.error(`[${new Date().toISOString()}] [cadastro-campanhas] ❌ ID ${body.id} já existe`)
        return new Response(JSON.stringify({ error: `ID ${body.id} já está em uso` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        })
      }

      const insertData: Record<string, any> = {
        id: body.id,
        nome: body.nome,
        status: body.status || 'pausada',
        enviar_audio_vazio: body.enviar_audio_vazio ?? false,
        arquivo_audio_personalizado: body.arquivo_audio_personalizado || null,
        created_at: new Date().toISOString(),
      }

      // Usar mensagem_template se fornecido, senão usa padrão
      if (body.mensagem_template !== undefined) {
        insertData.mensagem_template = body.mensagem_template
      } else {
        insertData.mensagem_template = '🎯 Olá {nome}! Temos uma oferta especial para você! 🦷✨'
      }

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] 📝 InsertData final:`, insertData)

      const { data, error } = await supabaseClient
        .from('campanhas')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error(`[${new Date().toISOString()}] [cadastro-campanhas] ❌ Erro ao criar campanha:`, error)
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] ✅ Campanha criada com sucesso:`, {
        id: data.id,
        nome: data.nome,
        mensagem_template: data.mensagem_template
      })

      return new Response(
        JSON.stringify({ success: true, data, message: 'Campanha criada com sucesso!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      )
    }

    if (method === 'PUT' || method === 'PATCH') {
      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] Atualizando campanha via ${method}`)
      
      const body: CampanhaRequest = await req.json()
      const campaignId = url.searchParams.get('id')

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] 📋 Dados recebidos para atualização:`, {
        campaignId,
        body: body
      })

      if (!campaignId) {
        return new Response(JSON.stringify({ error: 'ID da campanha é obrigatório' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const updateData: Record<string, any> = {}
      if (body.nome !== undefined) updateData.nome = body.nome
      if (body.mensagem_template !== undefined) updateData.mensagem_template = body.mensagem_template
      if (body.status !== undefined) updateData.status = body.status
      if (body.enviar_audio_vazio !== undefined) updateData.enviar_audio_vazio = body.enviar_audio_vazio
      if (body.arquivo_audio_personalizado !== undefined) updateData.arquivo_audio_personalizado = body.arquivo_audio_personalizado

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] 📝 UpdateData final:`, updateData)

      const { data, error } = await supabaseClient
        .from('campanhas')
        .update(updateData)
        .eq('id', campaignId)
        .select()
        .single()

      if (error) {
        console.error(`[${new Date().toISOString()}] [cadastro-campanhas] ❌ Erro ao atualizar campanha:`, error)
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      console.log(`[${new Date().toISOString()}] [cadastro-campanhas] ✅ Campanha atualizada via ${method}:`, {
        id: data.id,
        nome: data.nome,
        mensagem_template: data.mensagem_template
      })

      return new Response(
        JSON.stringify({ success: true, data, message: 'Campanha atualizada com sucesso!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (method === 'DELETE') {
      const campaignId = url.searchParams.get('id')

      if (!campaignId) {
        return new Response(JSON.stringify({ error: 'ID da campanha é obrigatório' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const { error } = await supabaseClient.from('campanhas').delete().eq('id', campaignId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Campanha excluída com sucesso!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
