import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import Login from "./pages/Login";
import Logout from "./pages/Logout";
import Usuarios from "./pages/Usuarios";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import { CRMLayout } from "./components/CRMLayout";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import CRMDashboard from "./pages/CRMDashboard";
import CRMKanban from "./pages/CRMKanban";
import CRMKanbanAcao from "./pages/CRMKanbanAcao";
import CRMChatInterface from "./pages/CRMChatInterface";
import CRMTabela from "./pages/CRMTabela";
import Agendar from "./pages/Agendar";
import Agendamentos from "./pages/Agendamentos";
import DisparosWhatsapp from "./pages/DisparosWhatsapp";
import DisparosManual from "./pages/DisparosManual";
import DisparosAniversario from "./pages/DisparosAniversario";
import DisparosLimpeza from "./pages/DisparosLimpeza";
import DisparosClareamento from "./pages/DisparosClareamento";
import DisparosConfirmacao from "./pages/DisparosConfirmacao";
import DisparosConfig from "./pages/DisparosConfig";
import DisparosLimpezaConfig from "./pages/DisparosLimpezaConfig";
import DisparosAniversarioConfig from "./pages/DisparosAniversarioConfig";
import DisparosClareamentoConfig from "./pages/DisparosClareamentoConfig";
import DisparosConfirmacaoConfig from "./pages/DisparosConfirmacaoConfig";
import DisparosCampanha from "./pages/DisparosCampanha";
import DisparosCampanhaLeads from "./pages/DisparosCampanhaLeads";
import Monitoramento from "./pages/Monitoramento";
import FormataListas from "./pages/FormataListas";
import Consultorios from "./pages/ConsultoriosSupabase";
import Dados from "./pages/Dados";
import NotFound from "./pages/NotFound";
import MinhaConta from "./pages/MinhaConta";

const queryClient = new QueryClient();

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
  "/admin": "Administração",
};

const getPageLabel = (pathname: string) => {
  const lower = pathname?.toLowerCase() ?? "";
  if (ROUTE_LABELS[lower]) return ROUTE_LABELS[lower];
  if (lower.startsWith("/crm/")) return "CRM";
  if (lower.startsWith("/disparos")) return "Disparos";
  return "Painel";
};

const AppContent = () => {
  const location = useLocation();
  const pageLabel = getPageLabel(location.pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-slate-50/80">
        <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-slate-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Painel Odontomanager LamorIA</p>
                <p className="text-lg font-semibold text-slate-900">{pageLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-2 py-4 md:px-4">
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/logout" element={<Logout />} />
            
            {/* Rota Principal - Redireciona para Login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Rotas Protegidas */}
            <Route path="/home" element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            } />
            <Route path="/admin" element={
              <AuthGuard>
                <AdminDashboard />
              </AuthGuard>
            } />
            <Route path="/index" element={<Navigate to="/login" replace />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />
            
            <Route path="/crm" element={<CRMLayout />}>
              <Route index element={<Navigate to="/crm/dashboard" replace />} />
              <Route path="" element={<Navigate to="/crm/dashboard" replace />} />
              <Route path="dashboard" element={<CRMDashboard />} />
              <Route path="kanban" element={<CRMKanban />} />
              <Route path="kanban-acao" element={<CRMKanbanAcao />} />
              <Route path="tabela" element={<CRMTabela />} />
              <Route path="agendar" element={<Agendar />} />
              <Route path="chat-ao-vivo" element={<CRMChatInterface />} />
            </Route>
            
            <Route path="/agendamentos" element={
              <AuthGuard>
                <Agendamentos />
              </AuthGuard>
            } />
            <Route path="/disparos" element={
              <AuthGuard>
                <DisparosWhatsapp />
              </AuthGuard>
            } />
            <Route path="/disparos/aniversario" element={
              <AuthGuard>
                <DisparosAniversario />
              </AuthGuard>
            } />
            <Route path="/disparos/aniversario/config" element={
              <AuthGuard>
                <DisparosAniversarioConfig />
              </AuthGuard>
            } />
            <Route path="/disparos/limpeza" element={
              <AuthGuard>
                <DisparosLimpeza />
              </AuthGuard>
            } />
            <Route path="/disparos/limpeza/config" element={
              <AuthGuard>
                <DisparosLimpezaConfig />
              </AuthGuard>
            } />
            <Route path="/disparos/clareamento" element={
              <AuthGuard>
                <DisparosClareamento />
              </AuthGuard>
            } />
            <Route path="/disparos/clareamento/config" element={
              <AuthGuard>
                <DisparosClareamentoConfig />
              </AuthGuard>
            } />
            <Route path="/disparos/manual" element={
              <AuthGuard>
                <DisparosManual />
              </AuthGuard>
            } />
            <Route path="/disparos/confirmacao" element={
              <AuthGuard>
                <DisparosConfirmacao />
              </AuthGuard>
            } />
            <Route path="/disparos/confirmacao/config" element={
              <AuthGuard>
                <DisparosConfirmacaoConfig />
              </AuthGuard>
            } />
            <Route path="/disparos/campanha" element={
              <AuthGuard>
                <DisparosCampanha />
              </AuthGuard>
            } />
            <Route path="/disparos/campanha/leads" element={
              <AuthGuard>
                <DisparosCampanhaLeads />
              </AuthGuard>
            } />
            <Route path="/disparos/config" element={
              <AuthGuard>
                <DisparosConfig />
              </AuthGuard>
            } />
            <Route path="/formata-listas" element={
              <AuthGuard>
                <FormataListas />
              </AuthGuard>
            } />
            <Route path="/consultorios" element={
              <AuthGuard>
                <Consultorios />
              </AuthGuard>
            } />
            <Route path="/dentistas" element={
              <AuthGuard>
                <Dados />
              </AuthGuard>
            } />
            <Route path="/monitoramento" element={
              <AuthGuard>
                <Monitoramento />
              </AuthGuard>
            } />
            <Route path="/minha-conta" element={
              <AuthGuard>
                <MinhaConta />
              </AuthGuard>
            } />
            <Route path="/usuarios" element={
              <AuthGuard>
                <Usuarios />
              </AuthGuard>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
