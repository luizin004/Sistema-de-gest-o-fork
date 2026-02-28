import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Database,
  Gauge,
  LineChart,
  Lock,
  LogOut,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { useCRMData, type UazapiInstance } from "@/hooks/useCRMData";
import { Progress } from "@/components/ui/progress";

type AgendamentoResumo = {
  id: string;
  nome: string;
  data_marcada: string | null;
  dentista: string | null;
  tratamento?: string | null;
  presenca?: string | null;
};

const STATUS_LEVEL: Record<string, number> = {
  respondeu: 2,
  cadencia: 3,
  atencao: 3,
  interagiu: 3,
  engajou: 4,
  "interessado em agendar consulta": 4,
  "agendou consulta": 5,
  "agendado por fora": 5,
  confirmado: 5,
  compareceu: 6,
};

const meshBackground = {
  backgroundImage:
    "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.18), transparent 45%)," +
    "radial-gradient(circle at 75% 15%, rgba(99,102,241,0.15), transparent 50%)," +
    "radial-gradient(circle at 40% 80%, rgba(16,185,129,0.18), transparent 55%)," +
    "linear-gradient(120deg, #f8fafc, #eef2ff, #f8fafc)",
};

const quickModules = [
  {
    id: "agendamentos",
    title: "Agendamentos",
    description: "Calendário, confirmações e ausências",
    href: "/agendamentos",
    permissionKey: "allowCrmAgendamentos" as const,
    accent: "from-emerald-500 to-emerald-600",
    icon: CalendarClock,
  },
  {
    id: "consultorios",
    title: "Consultórios",
    description: "Escalas e lotação dos boxes",
    href: "/consultorios",
    permissionKey: "allowConsultorios" as const,
    accent: "from-indigo-500 to-indigo-600",
    icon: Gauge,
  },
  {
    id: "crm",
    title: "CRM",
    description: "Funil e relacionamento com leads",
    href: "/crm",
    permissionKey: "allowCrmAgendamentos" as const,
    accent: "from-amber-500 to-amber-600",
    icon: LineChart,
  },
  {
    id: "disparos",
    title: "Disparos WhatsApp",
    description: "Campanhas e cadências automáticas",
    href: "/disparos",
    permissionKey: "allowDisparosWhatsapp" as const,
    accent: "from-sky-500 to-sky-600",
    icon: Sparkles,
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { usuario, permissions } = useTenant();
  const { getInstances } = useCRMData();
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [agendamentosHojeList, setAgendamentosHojeList] = useState<AgendamentoResumo[]>([]);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [metrics, setMetrics] = useState({
    agendamentosHoje: 0,
    leadsHoje: 0,
    consultoriosAtivos: 0,
    lotacaoPercent: 0,
    taxaConversao: 0,
    dentistasAtivos: 0,
    instanciasOnline: 0,
    instanciasOffline: 0,
    conversasConduzidas: 0,
  });
  const [funnelCounts, setFunnelCounts] = useState({
    respondeu: 0,
    interagiu: 0,
    engajou: 0,
    agendou: 0,
    compareceu: 0,
    totalLeads: 0,
  });

  const tenantId = usuario?.tenant_id || null;

  const formatTime = (value: string | null) => {
    if (!value) return "--";
    return format(new Date(value), "HH:mm", { locale: ptBR });
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      let agendamentoQuery = supabaseUntyped
        .from("agendamento")
        .select("id,nome,data_marcada,dentista,tratamento,presenca")
        .gte("data_marcada", startOfDay.toISOString())
        .lt("data_marcada", endOfDay.toISOString())
        .order("data_marcada", { ascending: true });

      let postsQuery = supabaseUntyped
        .from("posts")
        .select("id,status,created_at,data_marcada")
        .order("created_at", { ascending: false });

      let dentistasQuery = supabaseUntyped.from("dentistas").select("id");
      let consultoriosQuery = supabaseUntyped.from("consultorios").select("id");

      if (tenantId) {
        agendamentoQuery = agendamentoQuery.eq("tenant_id", tenantId);
        postsQuery = postsQuery.eq("tenant_id", tenantId);
        dentistasQuery = dentistasQuery.eq("tenant_id", tenantId);
        consultoriosQuery = consultoriosQuery.eq("tenant_id", tenantId);
      }

      const [agendamentosRes, postsRes, dentistasRes, consultoriosRes, instancesRes] = await Promise.all([
        agendamentoQuery,
        postsQuery,
        dentistasQuery,
        consultoriosQuery,
        getInstances(),
      ]);

      const agendamentosData = agendamentosRes.data || [];
      const postsData = postsRes.data || [];
      const dentistasData = dentistasRes.data || [];
      const consultoriosData = consultoriosRes.data || [];
      
      // Removido filtro manual já que a Edge Function já retorna apenas do tenant correto
      const instancesData = instancesRes || [];
      
      console.log(`[Home] Carregando dashboard para tenant: ${tenantId}`);
      console.log(`[Home] Instâncias recebidas:`, instancesData);

      const leadsHoje = postsData.filter((post: any) => {
        if (!post?.data_marcada) return false;
        const data = new Date(post.data_marcada);
        return data >= startOfDay && data < endOfDay;
      }).length;

      const totalLeads = postsData.length;
      const leadsAgendados = postsData.filter((post: any) => {
        const status = (post?.status || "").toLowerCase();
        return status.includes("agendou") || status.includes("confirm") || status.includes("compareceu");
      }).length;
      const leadsInteressados = postsData.filter((post: any) => {
        const status = (post?.status || "").toLowerCase();
        return status.includes("interessado");
      }).length;
      const conversasConduzidas = leadsInteressados + leadsAgendados;
      const taxaConversao = totalLeads > 0 ? (leadsAgendados / totalLeads) * 100 : 0;

      const lotacaoCapacidade = Math.max(consultoriosData.length * 8, 1);
      const lotacaoPercent = Math.min(100, (agendamentosData.length / lotacaoCapacidade) * 100);

      const funnelRespondeu = postsData.filter((post: any) => (STATUS_LEVEL[(post?.status || "").toLowerCase()] ?? 1) >= 2).length;
      const funnelInteragiu = postsData.filter((post: any) => (STATUS_LEVEL[(post?.status || "").toLowerCase()] ?? 1) >= 3).length;
      const funnelEngajou = postsData.filter((post: any) => (STATUS_LEVEL[(post?.status || "").toLowerCase()] ?? 1) >= 4).length;
      const funnelAgendou = postsData.filter((post: any) => (STATUS_LEVEL[(post?.status || "").toLowerCase()] ?? 1) >= 5).length;
      const funnelCompareceu = postsData.filter((post: any) => (STATUS_LEVEL[(post?.status || "").toLowerCase()] ?? 1) >= 6).length;

      const instanciasOnline = instancesData.filter((instance) => instance.connected).length;
      const instanciasOffline = instancesData.length - instanciasOnline;

      setMetrics({
        agendamentosHoje: agendamentosData.length,
        leadsHoje,
        consultoriosAtivos: consultoriosData.length,
        lotacaoPercent: Number(lotacaoPercent.toFixed(1)),
        taxaConversao: Number(taxaConversao.toFixed(1)),
        dentistasAtivos: dentistasData.length,
        instanciasOnline,
        instanciasOffline,
        conversasConduzidas,
      });
      setFunnelCounts({
        respondeu: funnelRespondeu,
        interagiu: funnelInteragiu,
        engajou: funnelEngajou,
        agendou: funnelAgendou,
        compareceu: funnelCompareceu,
        totalLeads,
      });
      setAgendamentosHojeList(agendamentosData.slice(0, 6));
      setInstances(instancesData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Erro ao carregar métricas da Home:", error);
      toast({
        title: "Não foi possível carregar o dashboard",
        description: "Tente atualizar novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, getInstances, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleModuleClick = (href: string, allowed: boolean) => {
    if (!allowed) {
      toast({
        title: "Acesso restrito",
        description: "Você não tem acesso a essa funcionalidade, fale conosco para liberar o módulo.",
        variant: "destructive",
      });
      return;
    }
    navigate(href);
  };

  const handleLogout = () => {
    localStorage.removeItem("usuario");
    toast({
      title: "Sessão encerrada",
      description: "Você saiu do sistema com sucesso.",
    });
    navigate("/login");
  };

  const managementCards = [
    {
      label: "Agendamentos de hoje",
      value: metrics.agendamentosHoje,
      detail: `${metrics.leadsHoje} leads com consulta hoje`,
      accent: "from-emerald-400 to-emerald-600",
      icon: CalendarClock,
    },
    {
      label: "Consultórios ativos",
      value: metrics.consultoriosAtivos,
      detail: `Lotação ${metrics.lotacaoPercent.toFixed(1)}% hoje`,
      accent: "from-indigo-400 to-indigo-600",
      icon: Gauge,
    },
    {
      label: "Dentistas",
      value: metrics.dentistasAtivos,
      detail: "Profissionais cadastrados",
      accent: "from-sky-400 to-sky-600",
      icon: Users,
    },
    {
      label: "Instâncias UAZAPI",
      value: metrics.instanciasOnline,
      detail: `${metrics.instanciasOffline} desconectada(s)`,
      accent: "from-cyan-400 to-cyan-600",
      icon: Wifi,
    },
  ];

  const performanceCards = [
    {
      label: "Taxa de conversão",
      value: `${metrics.taxaConversao.toFixed(1)}%`,
      detail: `${funnelCounts.totalLeads} leads no funil`,
      accent: "from-amber-400 to-amber-600",
      icon: TrendingUp,
    },
    {
      label: "Conversas conduzidas",
      value: metrics.conversasConduzidas,
      detail: "Leads prontos para agendar",
      accent: "from-violet-400 to-violet-600",
      icon: Activity,
    },
    {
      label: "Leads do dia",
      value: metrics.leadsHoje,
      detail: "Criados com data marcada",
      accent: "from-rose-400 to-rose-600",
      icon: CalendarCheck,
    },
  ];

  const funnelBars = useMemo(
    () => [
      { label: "Respondeu", value: funnelCounts.respondeu, color: "from-orange-500 to-amber-400" },
      { label: "Interagiu", value: funnelCounts.interagiu, color: "from-amber-500 to-yellow-400" },
      { label: "Engajou", value: funnelCounts.engajou, color: "from-lime-500 to-lime-400" },
      { label: "Agendou", value: funnelCounts.agendou, color: "from-emerald-500 to-green-400" },
      { label: "Compareceu", value: funnelCounts.compareceu, color: "from-teal-500 to-cyan-400" },
    ],
    [funnelCounts]
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/80 to-white" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Operação em tempo real</p>
            <h1 className="text-3xl font-semibold text-slate-900">Olá, {usuario?.nome || "equipe"}</h1>
            <p className="text-slate-500">Acompanhe a saúde do funil, agenda e comunicação em um único lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {lastRefresh && (
              <span>Atualizado às {format(lastRefresh, "HH:mm", { locale: ptBR })}</span>
            )}
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Acesso rápido</h2>
            <p className="text-xs text-slate-500">Módulos respeitando as permissões do plano</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickModules.map(({ id, title, description, href, permissionKey, accent, icon: Icon }) => {
              const allowed = permissions[permissionKey];
              return (
                <button
                  key={id}
                  onClick={() => handleModuleClick(href, allowed)}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                    allowed ? "" : "opacity-50"
                  }`}
                >
                  <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${accent} p-3 text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">{title}</p>
                  <p className="text-sm text-slate-500">{description}</p>
                  {!allowed && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/80 text-center text-xs text-slate-500">
                      <Lock className="mb-1 h-4 w-4" />
                      Solicite upgrade para acessar
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Operações do dia</h2>
            <span className="text-xs text-slate-400">Agenda, lotação e infraestrutura</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="border border-slate-200 shadow-xl shadow-slate-200/80">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-slate-900">
                    Agenda do dia
                    <span className="text-xs font-normal text-slate-500">{agendamentosHojeList.length} próximos compromissos</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 h-[600px] overflow-y-auto pr-1">
                    {agendamentosHojeList.length === 0 && (
                      <p className="text-sm text-slate-500">Nenhum agendamento para hoje até o momento.</p>
                    )}
                    {agendamentosHojeList.map((agendamento) => (
                      <div
                        key={agendamento.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{agendamento.nome}</p>
                          <p className="text-xs text-slate-500">
                            {agendamento.tratamento || "Sem tratamento"} · {agendamento.dentista || "Dentista não definido"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900">{formatTime(agendamento.data_marcada)}</p>
                          <p className="text-xs text-slate-500">{agendamento.presenca ? agendamento.presenca : "pendente"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border border-slate-200 shadow-lg shadow-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-slate-900">Lotação de consultórios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-24">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="rgba(15,23,42,0.08)" strokeWidth="10" fill="transparent" />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="url(#consultorioGradient)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${metrics.lotacaoPercent * 2.83} 999`}
                          fill="transparent"
                        />
                        <defs>
                          <linearGradient id="consultorioGradient" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-900">
                        <span className="text-2xl font-semibold">{metrics.lotacaoPercent.toFixed(0)}%</span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">ocupação</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">{metrics.consultoriosAtivos}</p>
                      <p className="text-xs text-slate-500">Consultórios disponíveis</p>
                      <p className="mt-3 text-xs text-slate-500">
                        Capacidade estimada de {metrics.consultoriosAtivos * 8} sessões/dia
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-lg shadow-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-slate-900">Dentistas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <p>Dentistas cadastrados</p>
                    <span className="text-xl font-semibold text-slate-900">{metrics.dentistasAtivos}</span>
                  </div>
                  <Progress value={Math.min(100, metrics.dentistasAtivos * 10)} className="mt-3 h-2" />
                  <p className="mt-2 text-xs text-slate-500">Meta sugerida: 10 profissionais</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-lg shadow-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-slate-900">Instâncias UAZAPI</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {instances.length === 0 && <p className="text-sm text-slate-500">Nenhuma instância configurada.</p>}
                  {instances.slice(0, 3).map((instance) => (
                    <div key={instance.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{instance.name || instance.profile_name || instance.instance_id}</p>
                        <p className="text-xs text-slate-500">{instance.owner_phone || "Telefone não informado"}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        instance.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      }`}>
                        {instance.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {instance.connected ? "Online" : "Offline"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Gestão</h2>
            <span className="text-xs text-slate-400">Agenda e operação diária</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {managementCards.map(({ label, value, detail, accent, icon: Icon }) => (
              <Card key={label} className="border border-slate-200 shadow-lg shadow-slate-200/70">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                  <div className={`rounded-xl bg-gradient-to-br ${accent} p-2 text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">{value}</div>
                  <p className="text-xs text-slate-500">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Performance</h2>
            <span className="text-xs text-slate-400">Funil e tecnologia</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {performanceCards.map(({ label, value, detail, accent, icon: Icon }) => (
              <Card key={label} className="border border-slate-200 shadow-lg shadow-slate-200/70">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                  <div className={`rounded-xl bg-gradient-to-br ${accent} p-2 text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">{value}</div>
                  <p className="text-xs text-slate-500">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border border-white shadow-xl shadow-slate-200/80">
            <CardHeader>
              <CardTitle className="text-slate-900">Funil de conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelBars.map((bar) => (
                <div key={bar.label} className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{bar.label}</span>
                    <span>{bar.value} leads</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                      style={{
                        width: funnelCounts.totalLeads ? `${(bar.value / funnelCounts.totalLeads) * 100}%` : "0%",
                        minWidth: bar.value ? "6%" : "0",
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          Odontomanager LamorIA · Dashboard Operacional 2026
        </footer>
      </div>
    </div>
  );
}

export default Home;
