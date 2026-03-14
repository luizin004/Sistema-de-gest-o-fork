import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Clock, TrendingUp, Target, Award, TrendingDown, Send, MessageCircle, Zap, Flame, CalendarCheck, CheckCircle2 } from "lucide-react";
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
  const totalLeads = posts.length;

  const statusCount = posts.reduce((acc, post) => {
    const normalizedStatus = post.status.toLowerCase();
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const leadsComData = posts.filter(p => p.data).length;

  const today = new Date().toDateString();
  const leadsHoje = posts.filter(p =>
    new Date(p.created_at).toDateString() === today
  ).length;

  const leadsComTratamento = posts.filter(p => p.tratamento).length;

  const statusMaisFrequente = Object.entries(statusCount).sort((a, b) => b[1] - a[1])[0];

  const leadsAgendados = posts.filter(p =>
    p.status.toLowerCase().includes("agendou")
  ).length;
  const taxaConversao = totalLeads > 0 ? (leadsAgendados / totalLeads) * 100 : 0;

  const leadsCompareceram = posts.filter(p =>
    p.status.toLowerCase().includes("compareceu")
  ).length;

  const funnelRespondeu = posts.filter(p => getStatusLevel(p.status) >= 2).length;
  const funnelInteragiu = posts.filter(p => getStatusLevel(p.status) >= 3).length;
  const funnelEngajou = posts.filter(p => getStatusLevel(p.status) >= 4).length;
  const funnelAgendou = posts.filter(p => getStatusLevel(p.status) >= 5).length;
  const funnelCompareceu = posts.filter(p => getStatusLevel(p.status) >= 6).length;

  const funnelSteps = [
    { label: 'Disparos', sublabel: 'campanha', value: lastDisparosTotal, widthPct: 100, color: 'bg-gray-400', Icon: Send },
    { label: 'Respondeu', sublabel: 'primeiro contato', value: funnelRespondeu, widthPct: 84, color: 'bg-stone-500', Icon: MessageCircle },
    { label: 'Interagiu', sublabel: 'continuou conversa', value: funnelInteragiu, widthPct: 68, color: 'bg-teal-600/80', Icon: Zap },
    { label: 'Engajou', sublabel: 'demonstrou interesse', value: funnelEngajou, widthPct: 52, color: 'bg-teal-600', Icon: Flame },
    { label: 'Agendou', sublabel: 'marcou consulta', value: funnelAgendou, widthPct: 36, color: 'bg-emerald-600', Icon: CalendarCheck },
    { label: 'Compareceu', sublabel: 'presenca confirmada', value: funnelCompareceu, widthPct: 20, color: 'bg-emerald-500', Icon: CheckCircle2 },
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

  if (maxDrop === Number.NEGATIVE_INFINITY) maxDrop = 0;
  if (maxRetention === Number.NEGATIVE_INFINITY) maxRetention = 0;

  // Status distribution sorted by count
  const sortedStatuses = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedStatuses.length > 0 ? sortedStatuses[0][1] : 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total de Leads</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{totalLeads}</p>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-semibold">
                    +{leadsHoje}
                  </span>
                  novos hoje
                </p>
              </div>
              <div className="p-2.5 bg-slate-100 rounded-xl">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Com Agendamento</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{leadsComData}</p>
                <p className="text-xs text-slate-500 mt-1.5">
                  {totalLeads > 0 ? Math.round((leadsComData / totalLeads) * 100) : 0}% do total
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Taxa de Conversao</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {taxaConversao.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1.5">
                  {leadsAgendados} agendamentos
                </p>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Compareceram</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{leadsCompareceram}</p>
                <p className="text-xs text-slate-500 mt-1.5">
                  {leadsAgendados > 0 ? Math.round((leadsCompareceram / leadsAgendados) * 100) : 0}% dos agendados
                </p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution */}
        <Card className="border border-slate-200/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Distribuicao por Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {sortedStatuses.map(([status, count]) => {
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={status} className="group flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 capitalize w-[140px] truncate" title={status}>{status}</span>
                    <div className="flex-1 h-7 bg-slate-50 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-slate-200 rounded-lg transition-all duration-500 group-hover:bg-slate-300"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2.5">
                        <span className="text-[10px] font-semibold text-slate-600">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Insights Column */}
        <div className="space-y-4">
          <Card className="border border-slate-200/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Status Predominante</p>
              <p className="text-lg font-bold text-slate-900 capitalize mt-1">
                {statusMaisFrequente ? statusMaisFrequente[0] : '-'}
              </p>
              <p className="text-xs text-slate-500">
                {statusMaisFrequente ? `${statusMaisFrequente[1]} leads` : 'Sem dados'}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Com Tratamento</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{leadsComTratamento}</p>
              <p className="text-xs text-slate-500">
                {totalLeads > 0 ? Math.round((leadsComTratamento / totalLeads) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Maior Queda</p>
                  <p className="text-lg font-bold text-red-600 mt-1">-{maxDrop.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">{maxDropLabel || 'Sem dados'}</p>
                </div>
                <TrendingDown className="h-4 w-4 text-red-400 mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Maior Retencao</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{maxRetention.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">{maxRetentionLabel || 'Sem dados'}</p>
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-400 mt-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Funnel */}
      <Card className="border border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <div>
                <CardTitle className="text-sm font-semibold text-slate-800">Funil de Marketing</CardTitle>
                <p className="text-[11px] text-slate-400 mt-0.5">Jornada do lead ate a consulta</p>
              </div>
            </div>
            <Select value={funnelPeriod} onValueChange={onFunnelPeriodChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-slate-200">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Ultimos 7 dias</SelectItem>
                <SelectItem value="15">Ultimos 15 dias</SelectItem>
                <SelectItem value="30">Ultimos 30 dias</SelectItem>
                <SelectItem value="90">Ultimos 90 dias</SelectItem>
                <SelectItem value="all">Todo periodo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-6 px-6">
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
                  {/* Conversion badge between steps */}
                  {index > 0 && convRate !== null && (
                    <div className="flex items-center gap-2 my-1.5">
                      <div className="h-3 w-px bg-slate-200" />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        convRate >= 60
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : convRate >= 30
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        ↓ {convRate}%
                      </span>
                      <div className="h-3 w-px bg-slate-200" />
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={`${step.color} relative group rounded-lg transition-all duration-200 hover:shadow-md`}
                    style={{
                      width: `${step.widthPct}%`,
                      minWidth: 220,
                      maxWidth: '100%',
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-white/80 shrink-0" />
                        <div>
                          <p className="text-white font-semibold text-[13px] leading-tight">{step.label}</p>
                          <p className="text-white/50 text-[10px] leading-tight">{step.sublabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-white/50 text-[10px] font-medium">{ofTotal}%</span>
                        <span className="text-white font-bold text-xl tabular-nums">
                          {step.value.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-200 rounded-lg" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall conversion footer */}
          {funnelSteps[0].value > 0 && funnelCompareceu > 0 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="text-[10px] font-semibold text-emerald-700">
                  Taxa geral: {((funnelCompareceu / funnelSteps[0].value) * 100).toFixed(1)}% chegaram ao fim
                </span>
              </div>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
