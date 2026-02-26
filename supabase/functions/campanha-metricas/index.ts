import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache simples em memória
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 🚀 Iniciando processamento...`)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Endpoint para limpar cache
    if (req.method === 'POST' && req.url.includes('/clear-cache')) {
      cache.clear()
      console.log(`[${new Date().toISOString()}] [campanha-metricas] 🧹 Cache limpo`)
      return new Response(JSON.stringify({ success: true, message: 'Cache limpo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar cache
    const cacheKey = 'campanha-metricas'
    const now = Date.now()
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!
      if (now - cached.timestamp < CACHE_DURATION) {
        console.log(`[${new Date().toISOString()}] [campanha-metricas] 📦 Usando cache...`)
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 1. Buscar todos registros da tabela_campanha
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 📋 Buscando leads da tabela_campanha...`)
    const { data: campanhaLeads, error: errorCampanha } = await supabase
      .from('tabela_campanha')
      .select('*')

    if (errorCampanha) {
      console.error(`[${new Date().toISOString()}] [campanha-metricas] ❌ Erro ao buscar tabela_campanha:`, errorCampanha)
      throw errorCampanha
    }
    console.log(`[${new Date().toISOString()}] [campanha-metricas] ✅ Encontrados ${campanhaLeads?.length || 0} leads na tabela_campanha`)

    // 2. Buscar todos registros da posts (apenas telefones para otimizar)
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 📋 Buscando telefones da posts...`)
    const { data: posts, error: errorPosts } = await supabase
      .from('posts')
      .select('telefone')

    if (errorPosts) {
      console.error(`[${new Date().toISOString()}] [campanha-metricas] ❌ Erro ao buscar posts:`, errorPosts)
      throw errorPosts
    }
    console.log(`[${new Date().toISOString()}] [campanha-metricas] ✅ Encontrados ${posts?.length || 0} telefones na posts`)

    // 3. Criar mapa de telefones normalizados da posts
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 🔄 Normalizando telefones da posts...`)
    const telefoneMap = new Map<string, boolean>()
    let telefonesNormalizados = 0
    
    posts?.forEach(post => {
      if (post.telefone) {
        const normalized = extrairTelefoneBase(post.telefone)
        if (normalized) {
          telefoneMap.set(normalized, true)
          telefonesNormalizados++
        }
      }
    })
    
    console.log(`[${new Date().toISOString()}] [campanha-metricas] ✅ ${telefonesNormalizados} telefones normalizados no mapa`)

    // 4. Para cada lead da campanha, verificar se respondeu
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 🔍 Verificando status de resposta...`)
    const leadsComStatus = campanhaLeads?.map(lead => {
      const normalized = extrairTelefoneBase(lead.telefone)
      const respondeu = normalized ? telefoneMap.has(normalized) : false
      
      return {
        ...lead,
        respondeu
      }
    }) || []

    // 5. Estatísticas
    const responderam = leadsComStatus.filter(lead => lead.respondeu === true).length
    const naoResponderam = leadsComStatus.filter(lead => lead.respondeu === false).length
    
    console.log(`[${new Date().toISOString()}] [campanha-metricas] 📊 Estatísticas finais:`)
    console.log(`  - Total leads: ${leadsComStatus.length}`)
    console.log(`  - Responderam: ${responderam}`)
    console.log(`  - Não responderam: ${naoResponderam}`)
    console.log(`  - Taxa de resposta: ${leadsComStatus.length > 0 ? ((responderam / leadsComStatus.length) * 100).toFixed(1) : 0}%`)

    const responseData = {
      success: true,
      data: leadsComStatus,
      stats: {
        total: leadsComStatus.length,
        responderam,
        naoResponderam,
        taxa_resposta: leadsComStatus.length > 0 ? ((responderam / leadsComStatus.length) * 100).toFixed(1) : 0
      },
      timestamp: new Date().toISOString()
    }

    // Salvar no cache
    cache.set(cacheKey, { data: responseData, timestamp: now })

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [campanha-metricas] ❌ Erro no processamento:`, error)
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      details: 'Erro ao processar métricas de campanha'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})

// Função de normalização de telefone (copiada do banco)
function extrairTelefoneBase(telefone: string): string | null {
  if (!telefone) return null
  
  let numeroLimpo = telefone.replace(/\D/g, '')
  
  // Remover DDI 55 se houver
  if (numeroLimpo.length >= 12 && numeroLimpo.startsWith('55')) {
    numeroLimpo = numeroLimpo.slice(2)
  }
  
  // Validar tamanho mínimo
  if (numeroLimpo.length < 10) return null
  
  // Pegar DDD + 8 dígitos base
  return numeroLimpo.slice(0, 2) + numeroLimpo.slice(-8)
}
