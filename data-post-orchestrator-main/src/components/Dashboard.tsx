import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Clock, TrendingUp, Target, Award, TrendingDown, Send, MessageCircle, Zap, Flame, CalendarCheck, CheckCircle2, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

interface DashboardProps {
  posts: Post[];
  lastDisparosTotal?: number;
  funnelPeriod?: string;
  onFunnelPeriodChange?: (period: string) => void;
}

// Hierarquia do funil — cada nível inclui todos os status daquele nível E acima
const STATUS_LEVEL: Record<string, number> = {
  'respondeu': 2,
  'cadencia': 3,
  'atencao': 3,
  'interagiu': 3,
  'engajou': 4,
  'interessado em agendar consulta': 4,
  'agendou consulta': 5,
  'agendado por fora': 5,
  'confirmado': 5,
  'compareceu': 6,
  'arquivados': 1,
  'paciente perdido': 1,
};

function getStatusLevel(status: string): number {
  return STATUS_LEVEL[status.toLowerCase()] ?? 1;
}

export const Dashboard = ({ posts, lastDisparosTotal = 0, funnelPeriod = 'all', onFunnelPeriodChange }: DashboardProps) => {
  // Métricas gerais
  const totalLeads = posts.length;
  
  // Leads por status
  const statusCount = posts.reduce((acc, post) => {
    const normalizedStatus = post.status.toLowerCase();
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Leads com agendamento
  const leadsComData = posts.filter(p => p.data).length;
  
  // Leads criados hoje
  const today = new Date().toDateString();
  const leadsHoje = posts.filter(p => 
    new Date(p.created_at).toDateString() === today
  ).length;

  // Leads com tratamento
  const leadsComTratamento = posts.filter(p => p.tratamento).length;

  // Status mais frequente
  const statusMaisFrequente = Object.entries(statusCount).sort((a, b) => b[1] - a[1])[0];

  // Taxa de conversão (leads que agendaram)
  const leadsAgendados = posts.filter(p => 
    p.status.toLowerCase().includes("agendou")
  ).length;
  const taxaConversao = totalLeads > 0 ? (leadsAgendados / totalLeads) * 100 : 0;

  // Leads que compareceram
  const leadsCompareceram = posts.filter(p => 
    p.status.toLowerCase().includes("compareceu")
  ).length;

  // Funnel Metrics — cumulativo: conta leads que JÁ PASSARAM por cada etapa
  // Um lead em "compareceu" (nível 6) conta para respondeu (2), interagiu (3), engajou (4), agendou (5) e compareceu (6)
  const funnelRespondeu = posts.filter(p => getStatusLevel(p.status) >= 2).length;
  const funnelInteragiu = posts.filter(p => getStatusLevel(p.status) >= 3).length;
  const funnelEngajou = posts.filter(p => getStatusLevel(p.status) >= 4).length;
  const funnelAgendou = posts.filter(p => getStatusLevel(p.status) >= 5).length;
  const funnelCompareceu = posts.filter(p => getStatusLevel(p.status) >= 6).length;

  // Cálculo da maior queda no funil
  const funnelSteps = [
    { 
      label: 'Disparos',
      sublabel: 'campanha',
      value: lastDisparosTotal,
      widthPct: 100,
      colors: { from: '#dc2626', to: '#ef4444', shadow: 'rgba(220,38,38,0.35)' },
      Icon: Send,
    },
    { 
      label: 'Respondeu',
      sublabel: 'primeiro contato',
      value: funnelRespondeu,
      widthPct: 84,
      colors: { from: '#ea580c', to: '#f97316', shadow: 'rgba(234,88,12,0.30)' },
      Icon: MessageCircle,
    },
    { 
      label: 'Interagiu',
      sublabel: 'continuou conversa',
      value: funnelInteragiu,
      widthPct: 68,
      colors: { from: '#d97706', to: '#f59e0b', shadow: 'rgba(217,119,6,0.30)' },
      Icon: Zap,
    },
    { 
      label: 'Engajou',
      sublabel: 'demonstrou interesse',
      value: funnelEngajou,
      widthPct: 52,
      colors: { from: '#65a30d', to: '#84cc16', shadow: 'rgba(101,163,13,0.30)' },
      Icon: Flame,
    },
    { 
      label: 'Agendou',
      sublabel: 'marcou consulta',
      value: funnelAgendou,
      widthPct: 36,
      colors: { from: '#16a34a', to: '#22c55e', shadow: 'rgba(22,163,74,0.30)' },
      Icon: CalendarCheck,
    },
    { 
      label: 'Compareceu',
      sublabel: 'presença confirmada',
      value: funnelCompareceu,
      widthPct: 20,
      colors: { from: '#0d9488', to: '#14b8a6', shadow: 'rgba(13,148,136,0.30)' },
      Icon: CheckCircle2,
    },
  ];

  let maxDrop = Number.NEGATIVE_INFINITY;
  let maxDropLabel = '';
  let maxDropValue = 0;
  let maxRetention = Number.NEGATIVE_INFINITY;
  let maxRetentionLabel = '';
  let maxRetentionValue = 0;

  for (let i = 0; i < funnelSteps.length - 1; i++) {
    const current = funnelSteps[i];
    const next = funnelSteps[i+1];
    
    if (current.value > 0) {
        // Se o próximo passo for maior que o atual (o que não deveria acontecer num funil perfeito, mas pode nos dados reais), consideramos queda 0
        const dropAmount = Math.max(0, current.value - next.value);
        const dropPercent = (dropAmount / current.value) * 100;
        
        if (dropPercent > maxDrop) {
            maxDrop = dropPercent;
            maxDropLabel = `${current.label} → ${next.label}`;
            maxDropValue = dropAmount;
        }

        const retentionPercent = Math.min(100, (next.value / current.value) * 100);
        if (retentionPercent > maxRetention) {
            maxRetention = retentionPercent;
            maxRetentionLabel = `${current.label} → ${next.label}`;
            maxRetentionValue = next.value;
        }
    }
  }

  if (maxDrop === Number.NEGATIVE_INFINITY) {
    maxDrop = 0;
  }

  if (maxRetention === Number.NEGATIVE_INFINITY) {
    maxRetention = 0;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Leads
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-success/10 text-success rounded-full text-[10px] font-semibold">
                +{leadsHoje}
              </span>
              novos hoje
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-info">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Com Agendamento
            </CardTitle>
            <div className="p-2 bg-info/10 rounded-lg">
              <Calendar className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{leadsComData}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalLeads > 0 ? Math.round((leadsComData / totalLeads) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Conversão
            </CardTitle>
            <div className="p-2 bg-warning/10 rounded-lg">
              <Target className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {taxaConversao.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {leadsAgendados} agendamentos
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compareceram
            </CardTitle>
            <div className="p-2 bg-success/10 rounded-lg">
              <Award className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{leadsCompareceram}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {leadsAgendados > 0 ? Math.round((leadsCompareceram / leadsAgendados) * 100) : 0}% dos agendados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Status */}
      <Card className="shadow-md">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Distribuição por Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Object.entries(statusCount).map(([status, count]) => {
              const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{status}</span>
                    <span className="text-muted-foreground">
                      {count} leads ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resumo adicional */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Status Predominante</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold capitalize">
                  {statusMaisFrequente ? statusMaisFrequente[0] : '-'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusMaisFrequente ? `${statusMaisFrequente[1]} leads neste status` : 'Sem dados'}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Com Tratamento Definido</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{leadsComTratamento}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalLeads > 0 ? Math.round((leadsComTratamento / totalLeads) * 100) : 0}% do total de leads
                </p>
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Clock className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-destructive/50">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Maior Queda</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {maxDropLabel || 'Sem dados suficientes'}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-destructive">
                    -{maxDrop.toFixed(1)}%
                  </p>
                </div>
                {maxDropValue > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Perda de {maxDropValue} leads nesta etapa
                  </p>
                )}
              </div>
              <div className="p-3 bg-destructive/10 rounded-full">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-success/60">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Maior Retenção</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {maxRetentionLabel || 'Sem dados suficientes'}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-success">
                    {maxRetention.toFixed(1)}%
                  </p>
                </div>
                {maxRetentionValue > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Retidos {maxRetentionValue} leads nessa etapa
                  </p>
                )}
              </div>
              <div className="p-3 bg-success/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Marketing */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Funil de Marketing</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Jornada do lead até a consulta</p>
              </div>
            </div>
            <Select value={funnelPeriod} onValueChange={onFunnelPeriodChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-8">
          <div className="flex flex-col items-center w-full gap-0">
            {funnelSteps.map((step, index) => {
              const prevStep = index > 0 ? funnelSteps[index - 1] : null;
              const convRate = prevStep && prevStep.value > 0
                ? Math.round((step.value / prevStep.value) * 100)
                : null;
              const topValue = funnelSteps[0].value > 0 ? funnelSteps[0].value : 1;
              const ofTotal = Math.round((step.value / topValue) * 100);
              const { Icon } = step;

              return (
                <div key={index} className="w-full flex flex-col items-center">
                  {/* Badge de conversão */}
                  {index > 0 && convRate !== null && (
                    <div className="flex items-center gap-1.5 my-2">
                      <div className="h-4 w-px bg-border" />
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        convRate >= 60
                          ? 'bg-emerald-100 text-emerald-700'
                          : convRate >= 30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        ↓ {convRate}%
                      </span>
                      <div className="h-4 w-px bg-border" />
                    </div>
                  )}

                  {/* Barra */}
                  <div
                    className="relative group overflow-hidden rounded-xl transition-all duration-200 hover:scale-[1.01] hover:shadow-xl"
                    style={{
                      width: `${step.widthPct}%`,
                      minWidth: 200,
                      maxWidth: '100%',
                      background: `linear-gradient(90deg, ${step.colors.from}, ${step.colors.to})`,
                      boxShadow: `0 4px 16px ${step.colors.shadow}`,
                    }}
                  >
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm leading-tight">{step.label}</p>
                          <p className="text-white/65 text-[10px] leading-tight">{step.sublabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-white/60 text-xs font-medium">{ofTotal}% do total</span>
                        <span className="text-white font-extrabold text-2xl tabular-nums">
                          {step.value.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    {/* Shimmer no hover */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-200 rounded-xl" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé com taxa geral */}
          {funnelSteps[0].value > 0 && funnelCompareceu > 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-emerald-700">
                  Taxa geral: {((funnelCompareceu / funnelSteps[0].value) * 100).toFixed(1)}% chegaram ao fim
                </span>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};