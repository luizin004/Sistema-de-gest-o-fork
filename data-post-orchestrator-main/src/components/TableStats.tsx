import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Target, Calendar } from "lucide-react";

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

interface TableStatsProps {
  data: Post[];
  filteredData: Post[];
}

export const TableStats = ({ data, filteredData }: TableStatsProps) => {
  const stats = useMemo(() => {
    // Estatísticas gerais
    const totalLeads = data.length;
    const filteredLeads = filteredData.length;
    
    // Leads com campanha
    const withCampaign = data.filter(post => post.campanha_nome).length;
    const withCampaignPercent = totalLeads > 0 ? (withCampaign / totalLeads * 100).toFixed(1) : '0';
    
    // Leads agendados
    const scheduled = data.filter(post => post.data || post.data_marcada).length;
    const scheduledPercent = totalLeads > 0 ? (scheduled / totalLeads * 100).toFixed(1) : '0';
    
    // Status mais comuns
    const statusCounts = data.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topStatuses = Object.entries(statusCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    // Campanhas mais comuns
    const campaignCounts = data.reduce((acc, post) => {
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
    const recentLeads = data.filter(post => new Date(post.created_at) >= sevenDaysAgo).length;
    
    return {
      totalLeads,
      filteredLeads,
      withCampaign,
      withCampaignPercent,
      scheduled,
      scheduledPercent,
      topStatuses,
      topCampaigns,
      recentLeads
    };
  }, [data, filteredData]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {/* Total de Leads */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Total de Leads</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{stats.totalLeads}</div>
        {stats.filteredLeads !== stats.totalLeads && (
          <div className="text-xs text-muted-foreground">
            {stats.filteredLeads} filtrados
          </div>
        )}
      </div>

      {/* Com Campanha */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Com Campanha</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{stats.withCampaign}</div>
        <div className="text-xs text-muted-foreground">
          {stats.withCampaignPercent}% do total
        </div>
      </div>

      {/* Agendados */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Agendados</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{stats.scheduled}</div>
        <div className="text-xs text-muted-foreground">
          {stats.scheduledPercent}% do total
        </div>
      </div>

      {/* Status Mais Comuns */}
      <div className="bg-card border border-border rounded-lg p-4 md:col-span-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Status Mais Comuns</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.topStatuses.map(([status, count]) => (
            <Badge key={status} variant="secondary" className="text-xs">
              {status} ({count})
            </Badge>
          ))}
        </div>
      </div>

      {/* Campanhas Mais Comuns */}
      <div className="bg-card border border-border rounded-lg p-4 md:col-span-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Campanhas Ativas</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.topCampaigns.length > 0 ? (
            stats.topCampaigns.map(([campaign, count]) => (
              <Badge key={campaign} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {campaign} ({count})
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma campanha ativa</span>
          )}
        </div>
      </div>
    </div>
  );
};
