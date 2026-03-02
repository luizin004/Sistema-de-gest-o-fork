import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Send, CheckCircle2, Gift, Sparkles, SunMedium, ArrowRight, Target } from "lucide-react";

const DisparosWhatsapp = () => {
  const navigate = useNavigate();
  const modules = [
    {
      title: "Manual",
      description: "Disparos personalizados com controle fino de mensagem e delay.",
      to: "/disparos/manual",
      icon: Send,
      accent: "from-indigo-500/20 via-indigo-500/5 to-transparent",
      badge: "bg-indigo-500/15 text-indigo-600",
      iconBg: "from-indigo-500 to-indigo-600",
    },
    {
      title: "Confirmação",
      description: "Automatize confirmações de consultas e reduza faltas na agenda.",
      to: "/disparos/confirmacao",
      icon: CheckCircle2,
      accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      badge: "bg-emerald-500/15 text-emerald-600",
      iconBg: "from-emerald-500 to-teal-500",
    },
    {
      title: "Aniversário",
      description: "Envie mensagens carinhosas e fortaleça o relacionamento.",
      to: "/disparos/aniversario",
      icon: Gift,
      accent: "from-pink-500/25 via-pink-500/10 to-transparent",
      badge: "bg-pink-500/15 text-pink-600",
      iconBg: "from-pink-500 to-rose-500",
    },
    {
      title: "Limpeza",
      description: "Lembretes inteligentes para retornos de profilaxia dos pacientes.",
      to: "/disparos/limpeza",
      icon: Sparkles,
      accent: "from-cyan-500/20 via-cyan-500/5 to-transparent",
      badge: "bg-cyan-500/15 text-cyan-600",
      iconBg: "from-cyan-500 to-sky-500",
    },
    {
      title: "Clareamento",
      description: "Campanhas segmentadas para tratamentos estéticos e upsell.",
      to: "/disparos/clareamento",
      icon: SunMedium,
      accent: "from-amber-500/25 via-amber-500/10 to-transparent",
      badge: "bg-amber-500/15 text-amber-600",
      iconBg: "from-amber-500 to-orange-500",
    },
    {
      title: "Campanha",
      description: "Gerencie campanhas de marketing e leads automatizados.",
      to: "/disparos/campanha",
      icon: Target,
      accent: "from-purple-500/20 via-purple-500/5 to-transparent",
      badge: "bg-purple-500/15 text-purple-600",
      iconBg: "from-purple-500 to-violet-600",
    },
  ];

  const meshBackground = {
    backgroundImage: `
      radial-gradient(circle at 15% 20%, rgba(56,189,248,0.35), transparent 45%),
      radial-gradient(circle at 80% 0%, rgba(59,130,246,0.3), transparent 50%),
      radial-gradient(circle at 50% 90%, rgba(14,165,233,0.25), transparent 55%),
      linear-gradient(120deg, #f5f9ff, #eef3ff, #f7fbff)
    `,
  };

  return (
    <div className="font-['Myriad_Pro','Plus_Jakarta_Sans','Inter',sans-serif] relative min-h-screen overflow-hidden bg-[#06122b] text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/35 to-white/65 backdrop-blur-[4px]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border border-white/35 bg-white/22 p-6 shadow-[0_40px_100px_-50px_rgba(7,12,28,0.9)] backdrop-blur-3xl animate-in fade-in duration-700">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/home")}
              className="rounded-2xl border-white/60 bg-white/70 text-slate-700 hover:bg-white"
            >
              <Home className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 md:text-2xl">Disparos WhatsApp</h1>
              <p className="text-sm text-slate-500">Selecione o fluxo que deseja automatizar</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Fluxos inteligentes
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          {modules.map(({ title, description, to, icon: Icon, accent, badge, iconBg }, index) => (
            <button
              key={title}
              onClick={() => navigate(to)}
              className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-[28px] border border-white/30 bg-white/20 p-6 text-left text-slate-700 shadow-[0_35px_80px_-50px_rgba(15,23,42,0.9)] backdrop-blur-[26px] transition-all duration-300 hover:-translate-y-2 hover:border-white/80 hover:shadow-[0_55px_110px_-55px_rgba(15,23,42,1)] animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 0.08 + 0.2}s` }}
            >
              <div className={`absolute inset-px rounded-[24px] bg-gradient-to-br ${accent} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
              <div className="relative flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} text-white shadow-lg shadow-black/20`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className={`rounded-full border border-white/60 bg-white/50 px-3 py-1 text-xs font-semibold text-slate-700 ${badge}`}>
                  {title}
                </span>
              </div>
              <div className="relative space-y-3">
                <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
              <div className="relative mt-auto flex items-center gap-2 text-sm font-semibold text-sky-600">
                Iniciar fluxo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};

export default DisparosWhatsapp;
