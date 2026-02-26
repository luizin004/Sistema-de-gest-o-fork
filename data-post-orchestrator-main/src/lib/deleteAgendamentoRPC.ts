// Função alternativa usando RPC do Supabase para deleção atômica
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const deleteAgendamentoWithPostsRPC = async (agendamentoId: string) => {
  try {
    console.log(`[DELETE-RPC] Iniciando deleção do agendamento ${agendamentoId}`);
    
    // Usar RPC para executar deleção em ordem correta
    const { data, error } = await supabase.rpc('delete_agendamento_with_posts', {
      p_agendamento_id: agendamentoId
    });
    
    if (error) {
      console.error('[DELETE-RPC] Erro na RPC:', error);
      throw error;
    }
    
    console.log('[DELETE-RPC] Deleção realizada com sucesso:', data);
    
    toast.success('Agendamento e posts relacionados deletados com sucesso!');
    return true;
    
  } catch (error) {
    console.error('[DELETE-RPC] Erro completo na deleção:', error);
    toast.error('Erro ao deletar agendamento. Tente novamente.');
    return false;
  }
};

// Função de fallback usando deleção sequencial com mais validações
export const deleteAgendamentoWithPostsFallback = async (agendamentoId: string) => {
  try {
    console.log(`[DELETE-FALLBACK] Iniciando deleção do agendamento ${agendamentoId}`);
    
    // 1. Buscar posts relacionados
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, nome')
      .eq('agendamento_id', agendamentoId);
    
    if (fetchError) {
      console.error('[DELETE-FALLBACK] Erro ao buscar posts:', fetchError);
      throw fetchError;
    }
    
    console.log(`[DELETE-FALLBACK] Posts encontrados:`, posts);
    
    // 2. Deletar posts um por um (mais seguro)
    if (posts && posts.length > 0) {
      for (const post of posts) {
        console.log(`[DELETE-FALLBACK] Deletando post ${post.id}...`);
        
        const { error: deleteError } = await supabase
          .from('posts')
          .delete()
          .eq('id', post.id);
        
        if (deleteError) {
          console.error(`[DELETE-FALLBACK] Erro ao deletar post ${post.id}:`, deleteError);
          throw deleteError;
        }
        
        console.log(`[DELETE-FALLBACK] Post ${post.id} deletado com sucesso`);
      }
    }
    
    // 3. Verificar se não há mais posts
    const { count, error: countError } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('agendamento_id', agendamentoId);
    
    if (countError) {
      console.error('[DELETE-FALLBACK] Erro ao contar posts:', countError);
    } else if (count && count > 0) {
      throw new Error(`Ainda existem ${count} posts relacionados`);
    }
    
    // 4. Deletar agendamento
    console.log(`[DELETE-FALLBACK] Deletando agendamento ${agendamentoId}...`);
    
    const { error: deleteAgendamentoError } = await supabase
      .from('agendamento')
      .delete()
      .eq('id', agendamentoId);
    
    if (deleteAgendamentoError) {
      console.error('[DELETE-FALLBACK] Erro ao deletar agendamento:', deleteAgendamentoError);
      throw deleteAgendamentoError;
    }
    
    console.log('[DELETE-FALLBACK] Agendamento deletado com sucesso');
    
    toast.success('Agendamento e posts relacionados deletados com sucesso!');
    return true;
    
  } catch (error) {
    console.error('[DELETE-FALLBACK] Erro completo na deleção:', error);
    toast.error('Erro ao deletar agendamento. Tente novamente.');
    return false;
  }
};

// Função principal que tenta RPC primeiro, depois fallback
export const deleteAgendamentoWithPosts = async (agendamentoId: string) => {
  // Tentar RPC primeiro
  const rpcResult = await deleteAgendamentoWithPostsRPC(agendamentoId);
  if (rpcResult) {
    return true;
  }
  
  // Se RPC falhar, tentar fallback
  console.log('[DELETE] RPC falhou, tentando fallback...');
  return await deleteAgendamentoWithPostsFallback(agendamentoId);
};

// Função de confirmação (mantida igual)
export const confirmDeleteAgendamento = (agendamento: any) => {
  const nome = agendamento.nome;
  const data = agendamento.data_marcada ? 
    new Date(agendamento.data_marcada).toLocaleDateString('pt-BR') : 
    'sem data';
  
  return window.confirm(
    `Tem certeza que deseja deletar o agendamento de ${nome} (${data})?\n\n` +
    `Esta ação irá:\n` +
    `• Deletar o agendamento\n` +
    `• Deletar todos os posts relacionados\n` +
    `• Esta ação não pode ser desfeita`
  );
};
