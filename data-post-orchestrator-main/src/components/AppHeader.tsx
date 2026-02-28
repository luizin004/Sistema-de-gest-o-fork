import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/AccountMenu";
import { Home } from "lucide-react";

const hiddenRoutes = new Set(["/login", "/logout", "/auth", "/", ""]);

const ROUTE_LABELS: Record<string, string> = {
  "/home": "Dashboard Geral",
  "/crm": "CRM",
  "/crm/dashboard": "CRM · Dashboard",
  "/crm/kanban": "CRM · Kanban",
  "/crm/kanban-acao": "CRM · Kanban de Ação",
  "/crm/tabela": "CRM · Tabela",
  "/crm/agendar": "CRM · Agendar",
  "/crm/chat-ao-vivo": "CRM · Chat ao Vivo",
  "/agendamentos": "Agendamentos",
  "/disparos": "Disparos WhatsApp",
  "/usuarios": "Usuários",
  "/dentistas": "Dentistas & Tratamentos",
  "/consultorios": "Consultórios",
  "/monitoramento": "Monitoramento",
  "/minha-conta": "Minha Conta",
};

export const AppHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname?.toLowerCase() ?? "";
  const shouldHide = hiddenRoutes.has(pathname);

  const pageLabel = useMemo(() => {
    if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
    if (pathname.startsWith("/crm/")) return "CRM";
    if (pathname.startsWith("/disparos")) return "Disparos";
    return "Painel";
  }, [pathname]);

  if (shouldHide) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="rounded-2xl border border-white/70 bg-white/90 p-2 shadow-sm transition hover:-translate-y-[1px] hover:bg-white"
            aria-label="Ir para página inicial"
          >
            <Home className="h-4 w-4 text-slate-700" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Painel Odontomanager</span>
            <span className="text-base font-semibold text-slate-800">{pageLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
};
