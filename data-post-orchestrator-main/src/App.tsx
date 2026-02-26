import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import Login from "./pages/Login";
import Logout from "./pages/Logout";
import Usuarios from "./pages/Usuarios";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import { CRMLayout } from "./components/CRMLayout";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/index" element={<Navigate to="/login" replace />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          
          <Route path="/crm" element={
            <AuthGuard>
              <CRMLayout />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/crm/dashboard" replace />} />
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
          <Route path="/usuarios" element={
            <AuthGuard>
              <Usuarios />
            </AuthGuard>
          } />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
