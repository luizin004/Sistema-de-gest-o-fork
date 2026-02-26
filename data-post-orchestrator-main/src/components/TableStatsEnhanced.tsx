import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Target, Calendar, BarChart3, RefreshCw } from "lucide-react";
import { getCompleteCampaignStats, getCurrentCampaignStats, CampaignStats } from "@/lib/getCampaignStats";

interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  created_at: string;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

interface TableStatsEnhancedProps {
  data: Post[];
  filteredData: Post[];
  useCompleteStats?: boolean;
}

export const TableStatsEnhanced = ({ 
  data, 
  filteredData, 
  useCompleteStats = false 
}: TableStatsEnhancedProps) => {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar estatísticas baseadas no modo selecionado
  useMemo(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);

      try {
        let result: CampaignStats | null = null;

        if (useCompleteStats) {
          // Usar RPC para estatísticas completas
          result = await getCompleteCampaignStats();
        } else {
          // Calcular estatísticas atuais localmente
          result = await getCurrentCampaignStats();
        }

        setStats(result);
      } catch (err) {
        console.error('Error loading stats:', err);
        setError('Falha ao carregar estatísticas');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [useCompleteStats]);

  // Estatísticas calculadas localmente (fallback apenas quando não usar stats completos)
  const localStats = useMemo(() => {
    // Se estiver usando estatísticas completas, não calcular localmente
    if (useCompleteStats && stats) {
      return {
        totalLeads: stats.total_posts,
        filteredLeads: stats.total_posts, // TODO: Implementar filtro completo
        withCampaign: stats.posts_with_campaign,
        withCampaignPercent: stats.total_posts > 0 ? (stats.posts_with_campaign / stats.total_posts * 100).toFixed(1) : '0',
        scheduled: stats.scheduled_posts,
        scheduledPercent: stats.total_posts > 0 ? (stats.scheduled_posts / stats.total_posts * 100).toFixed(1) : '0',
        responded: stats.responded_posts,
        respondedPercent: stats.total_posts > 0 ? (stats.responded_posts / stats.total_posts * 100).toFixed(1) : '0',
        completed: stats.completed_posts,
        completedPercent: stats.total_posts > 0 ? (stats.completed_posts / stats.total_posts * 100).toFixed(1) : '0',
        topStatuses: [], // Status calculados localmente apenas quando necessário
        topCampaigns: [], // Campanhas calculadas localmente apenas quando necessário
        recentLeads: 0, // Recentes calculados localmente apenas quando necessário
      };
    }

    // Cálculo local apenas para modo atual ou quando stats não disponível
    const allData = data;
    const allFilteredData = filteredData;

    // Estatísticas gerais
    const totalLeads = allData.length;
    const filteredLeads = allFilteredData.length;
    
    // Leads com campanha
    const withCampaign = allData.filter(post => post.campanha_nome).length;
    const withCampaignPercent = totalLeads > 0 ? (withCampaign / totalLeads * 100).toFixed(1) : '0';
    
    // Leads agendados
    const scheduled = allData.filter(post => post.data || post.data_marcada).length;
    const scheduledPercent = totalLeads > 0 ? (scheduled / totalLeads * 100).toFixed(1) : '0';
    
    // Leads que responderam (se existe, respondeu)
    const responded = allData.length;
    const respondedPercent = totalLeads > 0 ? (responded / totalLeads * 100).toFixed(1) : '0';
    
    // Leads concluídos
    const completed = allData.filter(post => 
      post.status && (
        post.status.toLowerCase().includes('compareceu') ||
        post.status.toLowerCase().includes('tratamento iniciado') ||
        post.status.toLowerCase().includes('tratamento concluído')
      )
    ).length;
    const completedPercent = totalLeads > 0 ? (completed / totalLeads * 100).toFixed(1) : '0';
    
    // Status mais comuns
    const statusCounts = allData.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topStatuses = Object.entries(statusCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    // Campanhas mais comuns
    const campaignCounts = allData.reduce((acc, post) => {
      if (post.campanha_nome) {
        acc[post.campanha_nome] = (acc[post.campanha_nome] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topCampaigns = Object.entries(campaignCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    // Leads dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLeads = allData.filter(post => new Date(post.created_at) >= sevenDaysAgo).length;
    
    return {
      totalLeads,
      filteredLeads,
      withCampaign,
      withCampaignPercent,
      scheduled,
      scheduledPercent,
      responded,
      respondedPercent,
      completed,
      completedPercent,
      topStatuses,
      topCampaigns,
      recentLeads
    };
  }, [data, filteredData, useCompleteStats, stats]);

  // Usar estatísticas da RPC ou calcular localmente
  const displayStats = stats && useCompleteStats ? {
    totalLeads: stats.total_posts,
    filteredLeads: stats.total_posts, // TODO: Implementar filtro completo
    withCampaign: stats.posts_with_campaign,
    withCampaignPercent: stats.total_posts > 0 ? (stats.posts_with_campaign / stats.total_posts * 100).toFixed(1) : '0',
    scheduled: stats.scheduled_posts,
    scheduledPercent: stats.total_posts > 0 ? (stats.scheduled_posts / stats.total_posts * 100).toFixed(1) : '0',
    responded: stats.responded_posts,
    respondedPercent: stats.total_posts > 0 ? (stats.responded_posts / stats.total_posts * 100).toFixed(1) : '0',
    completed: stats.completed_posts,
    completedPercent: stats.total_posts > 0 ? (stats.completed_posts / stats.total_posts * 100).toFixed(1) : '0',
    topStatuses: localStats.topStatuses, // Manter cálculo local para status
    topCampaigns: localStats.topCampaigns, // Manter cálculo local para campanhas
    recentLeads: localStats.recentLeads, // Manter cálculo local para recentes
  } : localStats;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Erro ao carregar estatísticas</span>
          </div>
          <Badge variant="destructive" className="text-xs">
            {error}
          </Badge>
        </div>
        {/* Fallback para estatísticas locais */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            title="Total de Leads"
            value={localStats.totalLeads}
            subtitle={localStats.filteredLeads !== localStats.totalLeads ? `${localStats.filteredLeads} filtrados` : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicador de modo */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {useCompleteStats ? 'Estatísticas Completas' : 'Estatísticas Atuais'}
          </span>
          {useCompleteStats && (
            <Badge variant="secondary" className="text-xs">
              Incluindo arquivados
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {useCompleteStats 
            ? `Visão completa: ${displayStats.totalLeads} leads` 
            : `Apenas ativos: ${displayStats.totalLeads} leads`
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total de Leads */}
        <StatCard
          icon={<Users className="h-4 w-4" />}
          title="Total de Leads"
          value={displayStats.totalLeads}
          subtitle={displayStats.filteredLeads !== displayStats.totalLeads ? `${displayStats.filteredLeads} filtrados` : undefined}
        />

        {/* Com Campanha */}
        <StatCard
          icon={<Target className="h-4 w-4" />}
          title="Com Campanha"
          value={displayStats.withCampaign}
          subtitle={`${displayStats.withCampaignPercent}% do total`}
        />

        {/* Agendados */}
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          title="Agendados"
          value={displayStats.scheduled}
          subtitle={`${displayStats.scheduledPercent}% do total`}
        />

        {/* Responderam */}
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Responderam"
          value={displayStats.responded}
          subtitle={`${displayStats.respondedPercent}% do total`}
        />

        {/* Concluídos */}
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          title="Concluídos"
          value={displayStats.completed}
          subtitle={`${displayStats.completedPercent}% do total`}
        />
      </div>

      {/* Status mais comuns */}
      {displayStats.topStatuses.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Status Mais Comuns</h4>
          <div className="flex flex-wrap gap-2">
            {displayStats.topStatuses.map(([status, count]) => (
              <Badge key={status} variant="outline" className="text-xs">
                {status} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Campanhas mais ativas */}
      {displayStats.topCampaigns.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Campanhas Mais Ativas</h4>
          <div className="flex flex-wrap gap-2">
            {displayStats.topCampaigns.map(([campaign, count]) => (
              <Badge key={campaign} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {campaign} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente auxiliar para cards de estatísticas
interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle?: string;
}

const StatCard = ({ icon, title, value, subtitle }: StatCardProps) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
    </div>
    <div className="text-2xl font-bold text-foreground">{value}</div>
    {subtitle && (
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    )}
  </div>
);
