import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaign_id')
    
    console.log(`[${new Date().toISOString()}] [leads-campanha] Buscando leads para campanha: ${campaignId}`)

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    if (!campaignId) {
      // Se não tiver campaign_id, buscar todas as estatísticas de todas as campanhas
      console.log(`[${new Date().toISOString()}] [leads-campanha] Buscando estatísticas de todas as campanhas`)
      
      // Buscar todos os leads
      const { data: allLeads, error: leadsError } = await supabaseClient
        .from('tabela_campanha')
        .select('*')

      if (leadsError) {
        console.error(`[${new Date().toISOString()}] [leads-campanha] Erro ao buscar leads:`, leadsError)
        return new Response(
          JSON.stringify({ error: leadsError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Agrupar leads por ID_campanha
      const statsByCampaign: Record<string, any> = {}
      
      allLeads?.forEach(lead => {
        const campaignId = lead.ID_campanha || lead.extras?.ID_campanha || 'unknown'
        
        if (!statsByCampaign[campaignId]) {
          statsByCampaign[campaignId] = {
            campaign_id: campaignId,
            total_leads: 0,
            total_envios: 0,
            entregues: 0,
            disparo_feito: 0,
            taxa_entrega: 0,
            taxa_disparo: 0
          }
        }
        
        const stats = statsByCampaign[campaignId]
        stats.total_leads++
        
        if (lead.disparo_feito === true) {
          stats.disparo_feito++
          stats.total_envios++
        }
        
        // Aqui você pode adicionar lógica para contar entregues baseado em outros campos
        // Por enquanto, vamos considerar que todos os disparos foram entregues
        if (lead.disparo_feito === true) {
          stats.entregues++
        }
      })

      // Calcular taxas
      Object.keys(statsByCampaign).forEach(campaignId => {
        const stats = statsByCampaign[campaignId]
        stats.taxa_disparo = stats.total_leads > 0 ? (stats.disparo_feito / stats.total_leads * 100) : 0
        stats.taxa_entrega = stats.total_envios > 0 ? (stats.entregues / stats.total_envios * 100) : 0
      })

      console.log(`[${new Date().toISOString()}] [leads-campanha] ✅ Estatísticas calculadas para ${Object.keys(statsByCampaign).length} campanhas`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: Object.values(statsByCampaign),
          total_campaigns: Object.keys(statsByCampaign).length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Buscar leads de uma campanha específica
    const { data: leads, error } = await supabaseClient
      .from('tabela_campanha')
      .select('*')
      .or(`ID_campanha.eq.${campaignId},extras->>ID_campanha.eq.${campaignId}`)

    if (error) {
      console.error(`[${new Date().toISOString()}] [leads-campanha] ❌ Erro ao buscar leads da campanha ${campaignId}:`, error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Calcular estatísticas
    const totalLeads = leads?.length || 0
    const disparosFeitos = leads?.filter(lead => lead.disparo_feito === true).length || 0
    const entregues = disparosFeitos // Por enquanto, consideramos todos os disparos como entregues
    const taxaDisparo = totalLeads > 0 ? (disparosFeitos / totalLeads * 100) : 0
    const taxaEntrega = disparosFeitos > 0 ? (entregues / disparosFeitos * 100) : 0

    const stats = {
      campaign_id: campaignId,
      total_leads: totalLeads,
      total_envios: disparosFeitos,
      entregues: entregues,
      disparo_feito: disparosFeitos,
      taxa_disparo: Math.round(taxaDisparo * 10) / 10,
      taxa_entrega: Math.round(taxaEntrega * 10) / 10,
      leads: leads || []
    }

    console.log(`[${new Date().toISOString()}] [leads-campanha] ✅ Estatísticas da campanha ${campaignId}:`, {
      total_leads: stats.total_leads,
      total_envios: stats.total_envios,
      taxa_disparo: stats.taxa_disparo
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: stats,
        message: 'Estatísticas calculadas com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [leads-campanha] ❌ Erro geral:`, error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: (error as Error).message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
