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
import { FeatureGuard } from "./components/FeatureGuard";
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
import logoLamor from "@/assets/lamoria.png";
import { TenantProvider } from "@/hooks/useTenant";

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
  "/usuarios": "Administração",
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
  const isAuthPage = location.pathname === "/login";
  const standaloneRoutes = ["/admin", "/usuarios"];
  const isStandaloneLayout = standaloneRoutes.includes(location.pathname);

  const renderTopBar = (showSidebarTrigger: boolean) => (
    <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showSidebarTrigger && <SidebarTrigger className="text-slate-600" />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Painel Odontomanager LamorIA</p>
            <p className="text-lg font-semibold text-slate-900">{pageLabel}</p>
          </div>
        </div>
        <img src={logoLamor} alt="LamorIA" className="h-12 w-auto" />
      </div>
    </div>
  );

  const routes = (
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
            
            <Route
              path="/crm"
              element={
                <AuthGuard>
                  <FeatureGuard feature="crm">
                    <CRMLayout />
                  </FeatureGuard>
                </AuthGuard>
              }
            >
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
                <FeatureGuard feature="agendamentos">
                  <Agendamentos />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_whatsapp">
                  <DisparosWhatsapp />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/aniversario" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_aniversario">
                  <DisparosAniversario />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/aniversario/config" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_aniversario">
                  <DisparosAniversarioConfig />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/limpeza" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_limpeza">
                  <DisparosLimpeza />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/limpeza/config" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_limpeza">
                  <DisparosLimpezaConfig />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/clareamento" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_clareamento">
                  <DisparosClareamento />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/clareamento/config" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_clareamento">
                  <DisparosClareamentoConfig />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/manual" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_manual">
                  <DisparosManual />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/confirmacao" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_confirmacao">
                  <DisparosConfirmacao />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/confirmacao/config" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_confirmacao">
                  <DisparosConfirmacaoConfig />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/campanha" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_campanha">
                  <DisparosCampanha />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/campanha/leads" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_campanha">
                  <DisparosCampanhaLeads />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/disparos/config" element={
              <AuthGuard>
                <FeatureGuard feature="disparos_whatsapp">
                  <DisparosConfig />
                </FeatureGuard>
              </AuthGuard>
            } />
            <Route path="/formata-listas" element={
              <AuthGuard>
                <FormataListas />
              </AuthGuard>
            } />
            <Route path="/consultorios" element={
              <AuthGuard>
                <FeatureGuard feature="consultorios">
                  <Consultorios />
                </FeatureGuard>
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
  );
  
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50/80">
        {routes}
      </div>
    );
  }

  if (isStandaloneLayout) {
    return (
      <div className="min-h-screen bg-slate-50/80">
        {renderTopBar(false)}
        <div className="flex-1 px-2 py-4 md:px-4">{routes}</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-slate-50/80">
        {renderTopBar(true)}
        <div className="flex-1 px-2 py-4 md:px-4">{routes}</div>
      </SidebarInset>
    </SidebarProvider>
  );
};

const App = () => (
  <TenantProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </TenantProvider>
);

export default App;
