import { useNavigate } from "react-router-dom";
import { MessageSquare, Calendar, Building2, LayoutDashboard, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

const modules = [
  {
    id: "disparos",
    title: "Disparos WhatsApp",
    href: "/disparos",
    badge: "Comunicação",
    description: "Engaje pacientes com mensagens inteligentes e personalizadas.",
    icon: MessageSquare,
    accentGradient: "from-sky-400/30 via-blue-500/10 to-transparent",
    iconGradient: "from-sky-400 to-blue-600",
    dotClass: "bg-sky-400",
    features: ["Formatação inteligente de listas", "Templates dinâmicos e delays seguros"]
  },
  {
    id: "agendamentos",
    title: "Agendamentos",
    href: "/agendamentos",
    badge: "Gestão",
    description: "Controle completo de cadeiras, confirmações e relatórios.",
    icon: Calendar,
    accentGradient: "from-rose-400/25 via-rose-500/10 to-transparent",
    iconGradient: "from-rose-400 to-rose-600",
    dotClass: "bg-rose-400",
    features: ["Controle completo de consultas", "Relatórios com presença"]
  },
  {
    id: "consultorios",
    title: "Consultórios",
    href: "/consultorios",
    badge: "Administração",
    description: "Gestão visual de salas, disponibilidade e equipes.",
    icon: Building2,
    accentGradient: "from-violet-400/25 via-purple-500/10 to-transparent",
    iconGradient: "from-violet-400 to-purple-600",
    dotClass: "bg-violet-400",
    features: ["Salas sincronizadas", "Disponibilidade integrada ao agendamento"]
  },
  {
    id: "crm",
    title: "CRM Completo",
    href: "/crm",
    badge: "Relacionamento",
    description: "Dashboard 360º com funil, Kanban e insights financeiros.",
    icon: LayoutDashboard,
    accentGradient: "from-amber-400/25 via-orange-500/15 to-transparent",
    iconGradient: "from-amber-400 to-orange-500",
    dotClass: "bg-amber-400",
    features: ["Dashboard unificado", "Kanban + Tabela"]
  }
];

const meshBackground = {
  backgroundImage: `
    radial-gradient(circle at 20% 25%, rgba(56,189,248,0.35), transparent 45%),
    radial-gradient(circle at 75% 15%, rgba(59,130,246,0.32), transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(14,165,233,0.25), transparent 55%),
    linear-gradient(120deg, #f5f9ff, #eef3ff, #f7fbff)
  `
};

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="font-['Myriad_Pro','Plus_Jakarta_Sans','Inter',sans-serif] relative min-h-screen overflow-hidden bg-[#0b172f] text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-[0.15]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white/70 backdrop-blur-[3px]" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
        <div className="text-center pb-6">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Sistema de Gestão</h1>
          <p className="text-lg text-slate-600">Plataforma completa para gestão de consultórios</p>
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {modules.map(({ id, title, href, badge, description, icon: Icon, accentGradient, iconGradient, dotClass, features }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(href)}
              className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-[30px] border border-white/35 bg-white/22 p-7 text-left text-slate-700 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.9)] backdrop-blur-[28px] transition-all duration-300 hover:-translate-y-3 hover:border-white/80 hover:shadow-[0_55px_110px_-50px_rgba(15,23,42,0.95)] animate-in fade-in slide-in-from-bottom-2"
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
            </button>
          ))}
        </section>

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

        <footer className="border-t border-white/40 pt-4 pb-4 text-center text-sm text-slate-600">
          2026 OralDents Brumadinho
        </footer>
      </div>
    </div>
  );
};

export default Home;
