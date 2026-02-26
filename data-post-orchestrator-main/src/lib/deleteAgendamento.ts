// Função para deletar agendamento e posts relacionados
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const deleteAgendamentoWithPosts = async (agendamentoId: string) => {
  try {
    console.log(`[DELETE] Iniciando deleção do agendamento ${agendamentoId}`);
    
    // 1. Primeiro, buscar todos os posts relacionados ao agendamento
    const { data: postsRelacionados, error: errorPosts } = await supabase
      .from('posts')
      .select('id, nome')
      .eq('agendamento_id', agendamentoId);
    
    if (errorPosts) {
      console.error('[DELETE] Erro ao buscar posts relacionados:', errorPosts);
      throw errorPosts;
    }
    
    console.log(`[DELETE] Encontrados ${postsRelacionados?.length || 0} posts relacionados:`, postsRelacionados);
    
    // 2. Deletar todos os posts relacionados primeiro
    if (postsRelacionados && postsRelacionados.length > 0) {
      console.log(`[DELETE] Iniciando deleção de ${postsRelacionados.length} posts...`);
      
      const { data: deletedPosts, error: errorDeletePosts } = await supabase
        .from('posts')
        .delete()
        .eq('agendamento_id', agendamentoId)
        .select('id'); // Retorna os IDs deletados
      
      if (errorDeletePosts) {
        console.error('[DELETE] Erro ao deletar posts:', errorDeletePosts);
        throw errorDeletePosts;
      }
      
      console.log(`[DELETE] Posts deletados com sucesso:`, deletedPosts);
      
      // Verificar se todos os posts foram deletados
      const { count: remainingPosts, error: errorCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('agendamento_id', agendamentoId);
      
      if (errorCount) {
        console.error('[DELETE] Erro ao verificar posts restantes:', errorCount);
      } else {
        console.log(`[DELETE] Posts restantes após deleção: ${remainingPosts}`);
        
        if (remainingPosts && remainingPosts > 0) {
          throw new Error(`Ainda existem ${remainingPosts} posts relacionados. Deleção falhou.`);
        }
      }
    }
    
    // 3. Agora pode deletar o agendamento sem violar a foreign key
    console.log(`[DELETE] Deletando agendamento ${agendamentoId}...`);
    
    const { data: deletedAgendamento, error: errorDeleteAgendamento } = await supabase
      .from('agendamento')
      .delete()
      .eq('id', agendamentoId)
      .select('id, nome'); // Retorna os dados deletados
    
    if (errorDeleteAgendamento) {
      console.error('[DELETE] Erro ao deletar agendamento:', errorDeleteAgendamento);
      throw errorDeleteAgendamento;
    }
    
    console.log(`[DELETE] Agendamento deletado com sucesso:`, deletedAgendamento);
    
    toast.success('Agendamento e posts relacionados deletados com sucesso!');
    return true;
    
  } catch (error) {
    console.error('[DELETE] Erro completo na deleção:', error);
    toast.error('Erro ao deletar agendamento. Tente novamente.');
    return false;
  }
};

// Função para confirmar deleção
export const confirmDeleteAgendamento = (agendamento: any, onConfirm: () => void) => {
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
