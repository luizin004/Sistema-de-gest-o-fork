import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/crm" element={<CRMLayout />}>
            <Route index element={<Navigate to="/crm/dashboard" replace />} />
            <Route path="dashboard" element={<CRMDashboard />} />
            <Route path="kanban" element={<CRMKanban />} />
            <Route path="kanban-acao" element={<CRMKanbanAcao />} />
            <Route path="tabela" element={<CRMTabela />} />
            <Route path="agendar" element={<Agendar />} />
            <Route path="chat-ao-vivo" element={<CRMChatInterface />} />
          </Route>
          <Route path="/agendamentos" element={<Agendamentos />} />
          <Route path="/disparos" element={<DisparosWhatsapp />} />
          <Route path="/disparos/aniversario" element={<DisparosAniversario />} />
          <Route path="/disparos/aniversario/config" element={<DisparosAniversarioConfig />} />
          <Route path="/disparos/limpeza" element={<DisparosLimpeza />} />
          <Route path="/disparos/limpeza/config" element={<DisparosLimpezaConfig />} />
          <Route path="/disparos/clareamento" element={<DisparosClareamento />} />
          <Route path="/disparos/clareamento/config" element={<DisparosClareamentoConfig />} />
          <Route path="/disparos/manual" element={<DisparosManual />} />
          <Route path="/disparos/confirmacao" element={<DisparosConfirmacao />} />
          <Route path="/disparos/confirmacao/config" element={<DisparosConfirmacaoConfig />} />
          <Route path="/disparos/campanha" element={<DisparosCampanha />} />
          <Route path="/disparos/campanha/leads" element={<DisparosCampanhaLeads />} />
          <Route path="/disparos/config" element={<DisparosConfig />} />
          <Route path="/formata-listas" element={<FormataListas />} />
          <Route path="/consultorios" element={<Consultorios />} />
          <Route path="/dentistas" element={<Dados />} />
          <Route path="/monitoramento" element={<Monitoramento />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
