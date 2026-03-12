import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowRight, Target, Smartphone, Zap, BookOpen, X, CheckCircle2, AlertTriangle, Lightbulb, Crosshair, Clock } from "lucide-react";

type Module = {
  title: string;
  description: string;
  useCases: string[];
  to: string;
  icon: typeof Send;
  gradient: string;
  glow: string;
  ring: string;
  accent: string;
  accentBg: string;
  comingSoon?: boolean;
  manual: {
    resumo: string;
    passos: string[];
    dicas: string[];
    atencao: string[];
  };
};

const modules: Module[] = [
  {
    title: "Manual",
    description: "Envios curtos e objetivos para pequenas listas. Controle total sobre mensagem e delay.",
    useCases: [
      "Avisar pacientes sobre mudança de horário ou endereço",
      "Enviar lembretes pontuais para um grupo pequeno",
      "Comunicar promoções rápidas ou vagas de última hora",
      "Recontatar pacientes que não responderam individualmente",
    ],
    to: "/disparos/manual",
    icon: Send,
    gradient: "from-indigo-500 to-blue-600",
    glow: "shadow-indigo-500/20",
    ring: "ring-indigo-500/20",
    accent: "text-indigo-600",
    accentBg: "bg-indigo-50",
    manual: {
      resumo: "O disparo manual é o modo mais direto: você monta uma lista pequena, escreve a mensagem e dispara. Ideal para comunicações pontuais que não justificam criar uma campanha inteira — avisos rápidos, lembretes e recontatos.",
      passos: [
        "Importe contatos via CSV ou adicione manualmente",
        "Escreva a mensagem usando variáveis como {nome}",
        "Configure o delay entre envios (recomendado: 15-30s)",
        "Revise a pré-visualização e inicie o disparo",
        "Acompanhe o progresso em tempo real na tela",
      ],
      dicas: [
        "Use delays maiores (30s+) para listas acima de 50 contatos",
        "Personalize com {nome} para aumentar a taxa de resposta",
        "Teste com 3-5 contatos antes de enviar para toda a lista",
      ],
      atencao: [
        "Não indicado para listas grandes (500+) — use Emulador para isso",
        "Respeite o horário comercial para não incomodar contatos",
        "Números inválidos contam como falha e podem afetar a instância",
      ],
    },
  },
  {
    title: "Campanha",
    description: "Campanhas estruturadas e de longa duração com funil de acompanhamento e controle de leads.",
    useCases: [
      "Divulgar eventos como Dia do Sorriso, semanas temáticas",
      "Campanha de recall para pacientes inativos há 6+ meses",
      "Lançamento de novos tratamentos ou serviços da clínica",
      "Ações sazonais: Natal, Dia das Mães, Black Friday",
    ],
    to: "/disparos/campanha",
    icon: Target,
    gradient: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/20",
    ring: "ring-violet-500/20",
    accent: "text-violet-600",
    accentBg: "bg-violet-50",
    manual: {
      resumo: "O modo Campanha é para ações de marketing planejadas e com duração mais longa. Você cria a campanha, importa os leads e acompanha o funil de respostas. Ideal para eventos, promoções sazonais e estratégias de reativação de pacientes.",
      passos: [
        "Crie uma campanha com nome e descrição do objetivo",
        "Importe os leads (CSV ou integração CRM)",
        "Configure a mensagem template e a porta de envio",
        "Inicie — os leads entram na fila automaticamente",
        "Acompanhe o funil: aguardando → enviado → respondeu",
      ],
      dicas: [
        "Segmente os leads por perfil antes de importar para melhor conversão",
        "Use o funil para priorizar follow-up nos leads quentes",
        "Pause e retome a campanha se a taxa de bloqueio subir",
      ],
      atencao: [
        "Ao deletar uma campanha, todos os leads associados são removidos",
        "Leads duplicados são ignorados automaticamente na importação",
        "O cliente_id precisa corresponder ao worker configurado",
      ],
    },
  },
  {
    title: "Por Emulador",
    description: "Disparos em massa via múltiplos emuladores ADB. Protege sua instância principal contra quedas e bloqueios.",
    useCases: [
      "Envios em massa para listas com 500+ contatos",
      "Disparos que não podem derrubar a instância principal do WhatsApp",
      "Distribuir carga entre vários dispositivos para velocidade",
      "Reprocessamento em lote de envios que falharam",
    ],
    to: "/disparos/emulador",
    icon: Smartphone,
    gradient: "from-sky-500 to-cyan-600",
    glow: "shadow-sky-500/20",
    ring: "ring-sky-500/20",
    accent: "text-sky-600",
    accentBg: "bg-sky-50",
    comingSoon: true,
    manual: {
      resumo: "O disparo por emulador usa dispositivos ADB para enviar em grande escala sem arriscar a instância principal. Cada emulador age como um aparelho independente, distribuindo a carga e evitando bloqueios por volume excessivo.",
      passos: [
        "Prepare o CSV com colunas: nome, telefone, mensagem",
        "Faça upload do arquivo na tela de emuladores",
        "Selecione os emuladores ADB disponíveis",
        "Configure como os leads serão distribuídos entre eles",
        "Inicie e monitore cada emulador individualmente",
      ],
      dicas: [
        "Distribua os leads igualmente entre os emuladores",
        "Monitore o status — reinicie emuladores desconectados",
        "Use porta_adb_override para redirecionar envios em caso de falha",
      ],
      atencao: [
        "Emuladores desconectados não processam a fila — verifique antes de iniciar",
        "O CSV deve estar em UTF-8 para evitar problemas com acentos",
        "Cada emulador tem limite de envios por hora — não sobrecarregue",
      ],
    },
  },
];

const DisparosWhatsapp = () => {
  const navigate = useNavigate();
  const [manualAberto, setManualAberto] = useState<string | null>(null);

  const moduleAberto = modules.find((m) => m.title === manualAberto);

  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Mesh background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.12), transparent 45%)",
            "radial-gradient(circle at 80% 10%, rgba(139,92,246,0.10), transparent 50%)",
            "radial-gradient(circle at 50% 85%, rgba(14,165,233,0.10), transparent 55%)",
            "linear-gradient(135deg, #f8fafc, #eef2ff, #f0f9ff, #f8fafc)",
          ].join(","),
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-14">
        {/* Header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25">
            <Zap className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Disparos WhatsApp
          </h1>
          <p className="mt-2 max-w-lg text-base text-slate-500">
            Escolha o modo de envio mais adequado para sua necessidade. Cada modo oferece recursos diferentes para otimizar seus resultados.
          </p>
        </div>

        {/* Cards */}
        <div className="flex w-full flex-col gap-5">
          {modules.map(({ title, description, useCases, to, icon: Icon, gradient, glow, ring, accent, accentBg, comingSoon }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-2xl border border-white/80 shadow-sm ring-1 ${ring} backdrop-blur-sm transition-all duration-300 ${comingSoon ? "bg-slate-50/70 opacity-75" : "bg-white/70 hover:bg-white hover:shadow-lg"}`}
            >
              {/* Coming soon overlay badge */}
              {comingSoon && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <Clock className="h-3 w-3" />
                  Em breve
                </div>
              )}

              {/* Main area */}
              <button
                onClick={() => !comingSoon && navigate(to)}
                disabled={comingSoon}
                className={`flex w-full items-start gap-5 px-6 pt-6 pb-4 text-left ${comingSoon ? "cursor-default" : ""}`}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${glow} ${comingSoon ? "grayscale opacity-50" : ""}`}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className={`flex-1 min-w-0 ${comingSoon ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <span className={`rounded-full ${accentBg} px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${accent}`}>
                      Disparo
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>

                  {/* Sugestões de uso */}
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quando usar</p>
                    <ul className="space-y-1">
                      {useCases.map((useCase) => (
                        <li key={useCase} className="flex items-start gap-2 text-xs text-slate-500">
                          <Crosshair className={`mt-0.5 h-3 w-3 shrink-0 ${accent} opacity-60`} />
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {!comingSoon && (
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ${accent} transition-all duration-300 group-hover:scale-110`}>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </div>
                )}
              </button>

              {/* Footer with manual button */}
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <span className="text-xs text-slate-400">
                  {comingSoon ? "Este módulo está em desenvolvimento" : "Clique no card para acessar"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setManualAberto(title);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${accent} ${accentBg} transition-colors hover:opacity-80`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Manual de uso
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual modal */}
      {moduleAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setManualAberto(null)}>
          <div
            className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className={`sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4 rounded-t-2xl`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${moduleAberto.gradient} text-white`}>
                  <moduleAberto.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Manual — {moduleAberto.title}</h3>
                  <p className="text-xs text-slate-400">Guia de utilização</p>
                </div>
              </div>
              <button onClick={() => setManualAberto(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-6 px-6 py-5">
              {/* Resumo */}
              <div>
                <p className="text-sm leading-relaxed text-slate-600">{moduleAberto.manual.resumo}</p>
              </div>

              {/* Passo a passo */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Passo a passo
                </h4>
                <ol className="space-y-2.5">
                  {moduleAberto.manual.passos.map((passo, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${moduleAberto.gradient} text-[11px] font-bold text-white`}>
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{passo}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Dicas */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Lightbulb className="h-4 w-4" />
                  Dicas
                </h4>
                <ul className="space-y-2">
                  {moduleAberto.manual.dicas.map((dica, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span>{dica}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Atenção */}
              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção
                </h4>
                <ul className="space-y-2">
                  {moduleAberto.manual.atencao.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisparosWhatsapp;
