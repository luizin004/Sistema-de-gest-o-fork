/**
 * Script de teste para validar as estatísticas de campanha
 * Execute este arquivo para testar as funções antes de integrar
 */

import { getCompleteCampaignStats, getCurrentCampaignStats, testCampaignStats } from './getCampaignStats';

// Função para formatar números
const formatNumber = (num: number): string => {
  return num.toLocaleString('pt-BR');
};

// Função para formatar porcentagem
const formatPercent = (value: number, total: number): string => {
  if (total === 0) return '0.0%';
  return ((value / total) * 100).toFixed(1) + '%';
};

// Teste principal
export const runCampaignStatsTest = async () => {
  console.log('🧪 Iniciando teste de estatísticas de campanha...\n');

  try {
    // Teste 1: Estatísticas atuais
    console.log('📊 Teste 1: Estatísticas Atuais (apenas posts)');
    const current = await getCurrentCampaignStats();
    
    if (current) {
      console.log(`Total Leads: ${formatNumber(current.total_posts)}`);
      console.log(`Com Campanha: ${formatNumber(current.posts_with_campaign)} (${formatPercent(current.posts_with_campaign, current.total_posts)})`);
      console.log(`Responderam: ${formatNumber(current.responded_posts)} (${formatPercent(current.responded_posts, current.total_posts)})`);
      console.log(`Agendados: ${formatNumber(current.scheduled_posts)} (${formatPercent(current.scheduled_posts, current.total_posts)})`);
      console.log(`Concluídos: ${formatNumber(current.completed_posts)} (${formatPercent(current.completed_posts, current.total_posts)})`);
    } else {
      console.log('❌ Falha ao buscar estatísticas atuais');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 2: Estatísticas completas
    console.log('📊 Teste 2: Estatísticas Completas (posts + arquivados)');
    const complete = await getCompleteCampaignStats();
    
    if (complete) {
      console.log(`Total Leads: ${formatNumber(complete.total_posts)}`);
      console.log(`Com Campanha: ${formatNumber(complete.posts_with_campaign)} (${formatPercent(complete.posts_with_campaign, complete.total_posts)})`);
      console.log(`Responderam: ${formatNumber(complete.responded_posts)} (${formatPercent(complete.responded_posts, complete.total_posts)})`);
      console.log(`Agendados: ${formatNumber(complete.scheduled_posts)} (${formatPercent(complete.scheduled_posts, complete.total_posts)})`);
      console.log(`Concluídos: ${formatNumber(complete.completed_posts)} (${formatPercent(complete.completed_posts, complete.total_posts)})`);
    } else {
      console.log('❌ Falha ao buscar estatísticas completas');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 3: Comparação
    console.log('📊 Teste 3: Comparação de Resultados');
    const comparison = await testCampaignStats();
    
    if (comparison) {
      console.log(`📈 Diferenças (Completos - Atuais):`);
      console.log(`Total Leads: +${formatNumber(comparison.comparison.totalDifference)} (${((comparison.comparison.totalDifference / comparison.current!.total_posts) * 100).toFixed(1)}% de aumento)`);
      console.log(`Com Campanha: +${formatNumber(comparison.comparison.campaignDifference)}`);
      console.log(`Responderam: +${formatNumber(comparison.comparison.respondedDifference)}`);
      
      console.log('\n🎯 Impacto no Negócio:');
      console.log(`• Taxa de campanha real: ${formatPercent(comparison.complete.posts_with_campaign, comparison.complete.total_posts)} vs ${formatPercent(comparison.current.posts_with_campaign, comparison.current.total_posts)} aparente`);
      console.log(`• Taxa de resposta real: ${formatPercent(comparison.complete.responded_posts, comparison.complete.total_posts)} vs ${formatPercent(comparison.current.responded_posts, comparison.current.total_posts)} aparente`);
      console.log(`• Visão completa: ${formatNumber(comparison.complete.total_posts)} leads vs ${formatNumber(comparison.current.total_posts)} atuais`);
    } else {
      console.log('❌ Falha na comparação');
    }

    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
};

// Exportar para uso em console
if (typeof window !== 'undefined') {
  // Disponibilizar no console para testes manuais
  (window as any).testCampaignStats = runCampaignStatsTest;
  console.log('💡 Para testar, execute: testCampaignStats() no console');
}
