import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  try {
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000);
    
    console.log(`[${new Date().toISOString()}] Iniciando verificação de leads inativos...`);
    
    // Buscar APENAS leads com status de interação que estão inativos
    const { data: leadsParaMover, error: fetchError } = await supabase
      .from('posts')
      .select('id, nome, status, ultima_mensagem_at, updated_at, nao_respondeu')
      .in('status', ['respondeu', 'interagiu', 'engajou']) // APENAS estes status
      .eq('nao_respondeu', false) // Apenas os ainda não marcados
      .or(`ultima_mensagem_at.lt.${quinzeMinAtras.toISOString()},updated_at.lt.${quinzeMinAtras.toISOString()}`);
    
    if (fetchError) throw fetchError;
    
    if (!leadsParaMover || leadsParaMover.length === 0) {
      console.log(`[${new Date().toISOString()}] Nenhum lead para mover`);
      return new Response(JSON.stringify({ 
        message: 'Nenhum lead para mover',
        moved: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Atualizar para coluna "Não Respondeu" - MANTER status, apenas marcar flag
    const { error: updateError } = await supabase
      .from('posts')
      .update({ 
        nao_respondeu: true, // Apenas marcar flag, mantém status original
        updated_at: new Date().toISOString()
      })
      .in('id', leadsParaMover.map(lead => lead.id));
    
    if (updateError) throw updateError;
    
    console.log(`[${new Date().toISOString()}] Movidos ${leadsParaMover.length} leads para Não Respondeu`);
    
    const detalhesLeads = leadsParaMover.map(l => ({ 
      id: l.id, 
      nome: l.nome, 
      status_original: l.status,
      status_mantido: l.status, // Status mantido
      marcado_como: 'nao_respondeu'
    }));
    
    return new Response(JSON.stringify({ 
      message: 'Leads movidos com sucesso',
      moved: leadsParaMover.length,
      leads: detalhesLeads,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao mover leads:`, error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
