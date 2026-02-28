import { useNavigate } from "react-router-dom";
import { MessageSquare, Calendar, Building2, LayoutDashboard, Database, LogOut, User, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";

const modules = [
  {
    id: "disparos",
    title: "Disparos WhatsApp",
    href: "/disparos",
    badge: "Comunicação",
    description: "Engaje pacientes com mensagens inteligentes e personalizadas.",
    icon: MessageSquare,
    accentGradient: "from-sky-400/30 via-blue-500/10 to-transparent",
    iconGradient: "from-sky-500 to-blue-600",
    dotClass: "bg-sky-500",
    features: ["Campanhas automatizadas", "Mensagens personalizadas", "Agendamento"]
  },
  {
    id: "agendamentos",
    title: "Agendamentos",
    href: "/agendamentos",
    badge: "Gestão",
    description: "Controle completo da agenda de consultas e compromissos.",
    icon: Calendar,
    accentGradient: "from-emerald-400/30 via-green-500/10 to-transparent",
    iconGradient: "from-emerald-500 to-green-600",
    dotClass: "bg-emerald-500",
    features: ["Agenda inteligente", "Lembretes automáticos", "Histórico"]
  },
  {
    id: "consultorios",
    title: "Consultórios",
    href: "/consultorios",
    badge: "Operação",
    description: "Gerencie a escala e alocação de profissionais nos consultórios.",
    icon: Building2,
    accentGradient: "from-violet-400/30 via-purple-500/10 to-transparent",
    iconGradient: "from-violet-500 to-purple-600",
    dotClass: "bg-violet-500",
    features: ["Escala semanal", "Alocação de dentistas", "Controle de horários"]
  },
  {
    id: "crm",
    title: "CRM",
    href: "/crm",
    badge: "Relacionamento",
    description: "Gestão completa do relacionamento com pacientes e leads.",
    icon: LayoutDashboard,
    accentGradient: "from-amber-400/30 via-orange-500/10 to-transparent",
    iconGradient: "from-amber-500 to-orange-600",
    dotClass: "bg-amber-500",
    features: ["Funil de vendas", "Histórico de pacientes", "Comunicação"]
  }
];

// Módulo de usuários apenas para admin
const getAdminModules = (usuario: any) => {
  if (usuario?.cargo === 'admin') {
    return [
      {
        id: "usuarios",
        title: "Usuários",
        href: "/usuarios",
        badge: "Administração",
        description: "Gerencie usuários e permissões do sistema.",
        icon: Users,
        accentGradient: "from-red-400/30 via-rose-500/10 to-transparent",
        iconGradient: "from-red-500 to-rose-600",
        dotClass: "bg-red-500",
        features: ["Criar usuários", "Gerenciar permissões", "Controle de acesso"]
      }
    ];
  }
  return [];
};

const meshBackground = {
  backgroundImage: `
    radial-gradient(circle at 20% 25%, rgba(56,189,248,0.15), transparent 45%),
    radial-gradient(circle at 75% 15%, rgba(59,130,246,0.12), transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(14,165,233,0.10), transparent 55%),
    linear-gradient(120deg, #f8fafc, #f1f5f9, #f8fafc)
  `
};

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { usuario: usuarioContext, permissions } = useTenant();
  const usuario = usuarioContext || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("usuario") || "{}") : {});

  const moduleAccessMap: Record<string, boolean> = {
    disparos: permissions.allowDisparosWhatsapp,
    agendamentos: permissions.allowCrmAgendamentos,
    consultorios: permissions.allowConsultorios,
    crm: permissions.allowCrmAgendamentos,
  };

  const handleModuleClick = (href: string, isLocked: boolean) => {
    if (isLocked) {
      toast({
        title: "Acesso restrito",
        description: "Você não tem acesso a essa funcionalidade, entre em contato conosco para saber mais sobre os planos.",
        variant: "destructive",
      });
      return;
    }
    navigate(href);
  };

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    toast({
      title: "Logout realizado",
      description: "Você saiu do sistema com sucesso."
    });
    navigate('/login');
  };

  return (
    <div className="font-['Myriad_Pro','Plus_Jakarta_Sans','Inter',sans-serif] relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/30 to-white/60 backdrop-blur-[2px]" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
        {/* Header removed per request */}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {modules.map(({ id, title, href, badge, description, icon: Icon, accentGradient, iconGradient, dotClass, features }, index) => {
            const isLocked = moduleAccessMap[id] === false;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleModuleClick(href, isLocked)}
                className={`group relative flex h-full flex-col gap-5 overflow-hidden rounded-[30px] border border-white/35 bg-white/22 p-7 text-left text-slate-700 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.9)] backdrop-blur-[28px] transition-all duration-300 hover:-translate-y-3 hover:border-white/80 hover:shadow-[0_55px_110px_-50px_rgba(15,23,42,0.95)] animate-in fade-in slide-in-from-bottom-2 ${
                  isLocked ? "cursor-not-allowed opacity-80" : ""
                }`}
                style={{ animationDelay: `${index * 0.08 + 0.2}s` }}
              >
                <div className={`absolute inset-px rounded-[26px] bg-gradient-to-br ${accentGradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="relative flex items-start justify-between">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} text-white shadow-lg shadow-black/25`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    {badge}
                  </span>
                </div>
                <div className="relative space-y-3">
                  <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                  <p className="text-sm text-slate-500">{description}</p>
                  <div className="flex flex-col gap-2 text-sm font-medium">
                    {features.map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-2 text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                {isLocked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85 text-center text-slate-700 backdrop-blur">
                    <Lock className="h-6 w-6" />
                    <p className="text-sm font-semibold">Acesso restrito</p>
                    <p className="px-6 text-xs text-slate-500">
                      Entre em contato conosco para saber mais sobre os planos.
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </section>

        {/* Módulos de Admin */}
        {usuario?.cargo === 'admin' && (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {getAdminModules(usuario).map(({ id, title, href, badge, description, icon: Icon, accentGradient, iconGradient, dotClass, features }, index) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(href)}
                className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-[30px] border border-white/35 bg-white/22 p-7 text-left text-slate-700 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.9)] backdrop-blur-[28px] transition-all duration-300 hover:-translate-y-3 hover:border-white/80 hover:shadow-[0_55px_110px_-50px_rgba(15,23,42,0.95)] animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${(index + 4) * 0.08 + 0.2}s` }}
              >
                <div className={`absolute inset-px rounded-[26px] bg-gradient-to-br ${accentGradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="relative flex items-start justify-between">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} text-white shadow-lg shadow-black/25`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    {badge}
                  </span>
                </div>
                <div className="relative space-y-3">
                  <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                  <p className="text-sm text-slate-500">{description}</p>
                  <div className="flex flex-col gap-2 text-sm font-medium">
                    {features.map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-2 text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Botão Separado de Dados */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/dentistas')}
            className="group relative overflow-hidden rounded-[30px] border border-white/35 bg-white/22 p-6 text-left text-slate-700 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.9)] backdrop-blur-[28px] transition-all duration-300 hover:-translate-y-3 hover:border-white/80 hover:shadow-[0_55px_110px_-50px_rgba(15,23,42,0.95)] hover:bg-white/30 max-w-xs w-full animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="absolute inset-px rounded-[26px] bg-gradient-to-br from-emerald-400/25 via-teal-500/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-black/25">
                <Database className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">Dados</h2>
                <p className="text-sm text-slate-600 font-medium">Gerencie dentistas e tratamentos</p>
              </div>
            </div>
          </button>
        </div>

        <footer className="border-t border-slate-200 pt-4 pb-4 text-center text-sm text-slate-600">
          <div className="flex justify-center items-center gap-4">
            <span>Odontomanager LamorIA - 2026</span>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-700 h-8 px-3"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
