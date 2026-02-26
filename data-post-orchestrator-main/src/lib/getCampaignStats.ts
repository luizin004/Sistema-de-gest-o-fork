import { supabase } from '@/integrations/supabase/client';

export interface CampaignStats {
  total_posts: number;
  posts_with_campaign: number;
  responded_posts: number;
  campaign_responses: number;
  scheduled_posts: number;
  completed_posts: number;
}

/**
 * Busca estatísticas completas de campanha incluindo posts e arquivados
 * Usa a RPC get_complete_campaign_stats() que consulta a view all_posts_view
 */
export const getCompleteCampaignStats = async (): Promise<CampaignStats | null> => {
  try {
    const { data, error } = await supabase.rpc('get_complete_campaign_stats');

    if (error) {
      console.error('Error fetching complete campaign stats:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const stats = data[0];
      return {
        total_posts: Number(stats.total_posts),
        posts_with_campaign: Number(stats.posts_with_campaign),
        responded_posts: Number(stats.responded_posts),
        campaign_responses: Number(stats.campaign_responses),
        scheduled_posts: Number(stats.scheduled_posts),
        completed_posts: Number(stats.completed_posts),
      };
    }

    return null;
  } catch (error) {
    console.error('Error in getCompleteCampaignStats:', error);
    throw error;
  }
};

/**
 * Busca estatísticas atuais (apenas posts não arquivados)
 * Mantida para compatibilidade e comparação
 */
export const getCurrentCampaignStats = async (): Promise<CampaignStats | null> => {
  try {
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('campanha_id, status, data, data_marcada');

    if (postsError) {
      console.error('Error fetching current posts:', postsError);
      throw postsError;
    }

    if (!posts) return null;

    const total_posts = posts.length;
    const posts_with_campaign = posts.filter(post => post.campanha_id !== null).length;
    const responded_posts = posts.length; // Se existe, respondeu
    const campaign_responses = posts.filter(post => post.campanha_id !== null).length; // Se existe com campanha, respondeu
    const scheduled_posts = posts.filter(post => post.data !== null || post.data_marcada !== null).length;
    const completed_posts = posts.filter(post => 
      post.status && (
        post.status.toLowerCase().includes('compareceu') ||
        post.status.toLowerCase().includes('tratamento iniciado') ||
        post.status.toLowerCase().includes('tratamento concluído')
      )
    ).length;

    return {
      total_posts,
      posts_with_campaign,
      responded_posts,
      campaign_responses,
      scheduled_posts,
      completed_posts,
    };
  } catch (error) {
    console.error('Error in getCurrentCampaignStats:', error);
    throw error;
  }
};

/**
 * Função de teste para validar as estatísticas
 * Compara resultados atuais vs completos
 */
export const testCampaignStats = async (): Promise<{
  current: CampaignStats | null;
  complete: CampaignStats | null;
  comparison: {
    totalDifference: number;
    campaignDifference: number;
    respondedDifference: number;
  }
} | null> => {
  try {
    const [current, complete] = await Promise.all([
      getCurrentCampaignStats(),
      getCompleteCampaignStats()
    ]);

    if (!current || !complete) return null;

    return {
      current,
      complete,
      comparison: {
        totalDifference: complete.total_posts - current.total_posts,
        campaignDifference: complete.posts_with_campaign - current.posts_with_campaign,
        respondedDifference: complete.responded_posts - current.responded_posts,
      }
    };
  } catch (error) {
    console.error('Error in testCampaignStats:', error);
    throw error;
  }
};
