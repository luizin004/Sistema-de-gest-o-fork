import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPABASE_PUBLISHABLE_KEY, supabase, supabaseUntyped } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/DateTimePicker";
import { EmbeddedWhatsAppChat } from "@/components/EmbeddedWhatsAppChat";
import { normalizePhoneForAgendamento } from "@/lib/utils";
import { getTenantId, getCurrentUser } from "@/utils/tenantUtils";
import {
  User,
  Phone,
  Calendar as CalendarIcon,
  Stethoscope,
  UserCheck,
  Save,
  X,
  Clock,
  MessageSquare,
  Trash2,
  History,
  Loader2,
  BookOpen,
  Archive,
  Bot,
  Power
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

import { Post } from "@/types/Post";
import { archiveSinglePost } from "@/lib/archiveAllPosts";

interface LeadProfileDialogProps {
  lead: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface LeadHistorySnapshot {
  status_final: string;
  campanha_nome?: string | null;
  agendamento_dentista?: string | null;
  agendamento_data_marcada?: string | null;
  agendamento_presenca?: string | null;
  ultima_atualizacao?: string | null;
}

interface LeadHistoryEvent {
  evento: string;
  dados: Record<string, any> | null;
  criado_em: string;
}

interface LeadHistoryPassagem {
  passagem_id: string;
  inicio: string;
  fim: string;
  status_final: string | null;
  eventos: LeadHistoryEvent[];
}

interface LeadHistoryResponse {
  snapshot: LeadHistorySnapshot | null;
  passagens: LeadHistoryPassagem[];
}

const STATUS_LABELS: Record<string, string> = {
  compareceu: "Compareceu",
  nao_compareceu: "Não compareceu",
  agendou: "Agendado",
  "agendou consulta": "Agendou consulta",
  "agendado por fora": "Agendado por fora",
  perdido: "Lead perdido",
  "lead perdido": "Lead perdido",
  sem_resposta: "Sem resposta",
  respondeu: "Respondeu",
  interagiu: "Interagiu",
  engajou: "Engajou",
  cadencia: "Cadência",
  "sem status": "Sem status",
};

const formatStatusLabel = (value?: string | null) => {
  if (!value) return "—";
  return STATUS_LABELS[value.toLowerCase()] ?? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

// Eventos que carregam dados de agendamento
const EVENTOS_AGENDAMENTO = new Set(["agendamento", "compareceu", "nao_compareceu", "nao compareceu"]);

// Eventos que NÃO devem aparecer como status final da passagem
const EVENTOS_NAO_STATUS = new Set(["arquivado", "agendamento"]);

const summarizePassagem = (passagem: LeadHistoryPassagem) => {
  const eventos = passagem.eventos ?? [];

  // Status final: usar passagem.status_final se disponível;
  // senão, pegar o último evento que seja um status real (não arquivado/agendamento)
  let statusFinal: string | null = passagem.status_final ?? null;
  if (!statusFinal) {
    const eventosStatus = eventos.filter(e => !EVENTOS_NAO_STATUS.has(e.evento));
    statusFinal = eventosStatus[eventosStatus.length - 1]?.evento ?? null;
  }

  // Dados de agendamento: consolidar de todos os eventos relacionados
  let dataMarcada: string | null = null;
  let tratamento: string | null = null;
  let dentista: string | null = null;
  let presenca: string | null = null;
  let temAgendamento = false;

  eventos.forEach((evento) => {
    const dados = evento.dados || {};
    if (EVENTOS_AGENDAMENTO.has(evento.evento)) {
      temAgendamento = true;
      dataMarcada = (dados.data_marcada as string) || dataMarcada;
      // Só sobrescreve se o valor não for null/undefined
      if (dados.tratamento) tratamento = dados.tratamento as string;
      if (dados.dentista) dentista = dados.dentista as string;
      // Presença: priorizar evento explícito, depois campo presenca no JSON
      if (evento.evento === "compareceu") presenca = "Compareceu";
      else if (evento.evento === "nao_compareceu" || evento.evento === "nao compareceu") presenca = "Não compareceu";
      else if (presenca === null && dados.presenca) {
        if ((dados.presenca as string) === "compareceu") presenca = "Compareceu";
        else if ((dados.presenca as string) === "nao_compareceu" || (dados.presenca as string) === "Não compareceu") presenca = "Não compareceu";
      }
    }
  });

  return {
    statusFinal,
    statusLabel: formatStatusLabel(statusFinal),
    temAgendamento,
    dataMarcada,
    tratamento,
    dentista,
    presenca: presenca ?? (temAgendamento ? "Pendente" : null),
  };
};

const statusOptions = [
  { value: "respondeu", color: "bg-blue-500" },
  { value: "interagiu", color: "bg-purple-500" },
  { value: "engajou", color: "bg-green-500" },
  { value: "atencao", color: "bg-rose-500" },
  { value: "interessado em agendar consulta", color: "bg-sky-500" },
  { value: "agendou consulta", color: "bg-emerald-500" },
  { value: "agendado por fora", color: "bg-teal-500" },
  { value: "cadencia", color: "bg-indigo-500" },
  { value: "lead perdido", color: "bg-red-600" },
];

// Formata telefone para exibição no input (mostra com +55 para o usuário ver)
const formatPhoneForDisplay = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  
  // Se já começa com 55, remove para exibição limpa
  let cleanDigits = digits;
  if (digits.startsWith('55') && digits.length > 2) {
    cleanDigits = digits.slice(2);
  }
  
  // Limita a 11 dígitos (DDD + número com 9)
  return cleanDigits.slice(0, 11);
};

const formatTimeLabel = (value: string): string => {
  if (!value) return "";
  const parts = value.split(":");
  const hours = parts[0]?.padStart(2, "0") ?? "00";
  const minutes = parts[1]?.padEnd(2, "0").slice(0, 2) ?? "00";
  return `${hours}:${minutes}`;
};

const getLocalDateFromIso = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const [datePart] = value.split("T");
  if (!datePart) return null;
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const LeadProfileDialog = ({ lead, isOpen, onClose, onUpdate }: LeadProfileDialogProps) => {
  const tenantId = useMemo(() => getTenantId(), []);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    status: "",
    dentista: "",
    data_marcada: undefined as Date | undefined,
    tratamento: "",
    feedback: "",
  });
  const [marcadoCodefy, setMarcadoCodefy] = useState(false); // Estado local apenas para validação
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dentistaOptions, setDentistaOptions] = useState<string[]>([]);
  const [tratamentoOptions, setTratamentoOptions] = useState<string[]>([]);
  const [suggestedTreatment, setSuggestedTreatment] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<LeadHistoryResponse | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isBotToggling, setIsBotToggling] = useState(false);
  const [botPaused, setBotPaused] = useState<boolean>(lead?.bot_paused ?? false);
  const [botPauseReason, setBotPauseReason] = useState<string | null>(lead?.bot_pause_reason ?? null);
  const isInterestedInScheduling = formData.status?.toLowerCase() === "interessado em agendar consulta";
  const isSchedulingAppointment = formData.status?.toLowerCase() === "agendou consulta";
  const isScheduledOutside = formData.status?.toLowerCase() === "agendado por fora";

  const deleteFunctionUrl = useMemo(
    () => "https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/delete-post",
    []
  );

  const handleDelete = async () => {
    if (!lead) return;
    if (!tenantId) {
      toast.error("Tenant não identificado. Recarregue e tente novamente.");
      return;
    }

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada');
      }

      console.log('[DELETE-PROFILE] Iniciando deleção do lead:', lead.id);
      console.log('[DELETE-PROFILE] Token disponível:', !!session.access_token);

      const response = await fetch(deleteFunctionUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: lead.id }),
      });

      console.log('[DELETE-PROFILE] Status da resposta:', response.status);
      console.log('[DELETE-PROFILE] Headers da resposta:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DELETE-PROFILE] Erro na resposta:', errorText);
        throw new Error(errorText || 'Erro ao excluir lead');
      }

      const responseData = await response.json();
      console.log('[DELETE-PROFILE] Resposta da API:', responseData);

      if (!responseData.success) {
        throw new Error(responseData.error || 'Erro ao excluir lead');
      }

      console.log('[DELETE-PROFILE] Lead excluído com sucesso');
      toast.success("Lead excluído com sucesso!");
      setShowDeleteConfirm(false);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("[DELETE-PROFILE] Erro ao excluir lead:", error);
      const errorMessage = error?.message || error?.error?.message || 'Erro ao excluir lead';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!lead) {
      toast.error("Lead não encontrado");
      return;
    }

    setIsArchiving(true);
    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[ARCHIVE] Usuário obtido:', user);
      console.log('[ARCHIVE] User ID:', user?.id);
      console.log('[ARCHIVE] User email:', user?.email);
      
      if (!user?.id) {
        console.error('[ARCHIVE] ID do usuário é nulo/undefined');
        throw new Error('Usuário não autenticado ou ID inválido');
      }

      // Mostrar toast de progresso
      const toastId = toast.loading(`Arquivando ${lead.nome}...`);

      // Usar a mesma lógica do archiveAllPosts mas para um único lead
      console.log('[ARCHIVE] Chamando archiveSinglePost com:', { postId: lead.id, userId: user.id });
      
      const result = await archiveSinglePost(lead.id, user.id);
      console.log('[ARCHIVE] Resultado da RPC:', result);

      if (result.success) {
        toast.success(`✅ ${lead.nome} arquivado com sucesso!`, {
          id: toastId,
        });
        onUpdate();
        onClose();
      } else {
        toast.error(`Erro ao arquivar: ${result.message}`, {
          id: toastId,
        });
      }

    } catch (error) {
      console.error('Error archiving lead:', error);
      console.error('[ARCHIVE] Detalhes do erro:', JSON.stringify(error, null, 2));
      toast.error("Erro ao arquivar lead. Tente novamente.");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleBotToggle = async (pause: boolean) => {
    if (!lead) return;
    setIsBotToggling(true);

    // Optimistic update
    const prevPaused = botPaused;
    const prevReason = botPauseReason;
    const newPauseReason = pause ? "manual" : null;
    setBotPaused(pause);
    setBotPauseReason(newPauseReason);

    try {
      const { error: postError } = await (supabaseUntyped as any)
        .from("posts")
        .update({
          bot_paused: pause,
          bot_pause_reason: newPauseReason,
        })
        .eq("id", lead.id)
        .eq("tenant_id", tenantId);

      if (postError) throw postError;

      // Update chatbot_conversations by post_id (lead ID) — most reliable
      const { error: convError } = await (supabaseUntyped as any)
        .from("chatbot_conversations")
        .update({
          bot_active: !pause,
          pause_reason: newPauseReason,
        })
        .eq("post_id", lead.id);

      if (convError) {
        console.warn("[BOT-TOGGLE] Erro ao atualizar chatbot_conversations:", convError);
      }

      toast.success(pause ? "Bot pausado com sucesso." : "Automação reativada com sucesso.");
      onUpdate();
    } catch (error) {
      // Rollback optimistic update
      setBotPaused(prevPaused);
      setBotPauseReason(prevReason);
      console.error("[BOT-TOGGLE] Erro ao alterar estado do bot:", error);
      toast.error("Erro ao alterar estado do bot. Tente novamente.");
    } finally {
      setIsBotToggling(false);
    }
  };

  useEffect(() => {
    if (lead) {
      setFormData({
        nome: lead.nome || "",
        telefone: lead.telefone || "",
        status: lead.status || "",
        dentista: lead.dentista || "",
        data_marcada: lead.data_marcada ? new Date(lead.data_marcada) : undefined,
        tratamento: lead.tratamento || "",
        feedback: lead.feedback || "",
      });
      setBotPaused(lead.bot_paused ?? false);
      setBotPauseReason(lead.bot_pause_reason ?? null);
      setMarcadoCodefy(false); // Resetar checkbox ao abrir
    }
  }, [lead]);

  // Realtime: listen to posts changes for this lead (bot_paused, status, etc.)
  useEffect(() => {
    if (!isOpen || !lead?.id) return;

    const channel = (supabase as any)
      .channel(`lead-profile-${lead.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${lead.id}`,
        },
        (payload: any) => {
          const updated = payload.new as any;
          if (updated) {
            if (updated.bot_paused !== undefined) setBotPaused(updated.bot_paused);
            if (updated.bot_pause_reason !== undefined) setBotPauseReason(updated.bot_pause_reason);
            if (updated.status) setFormData(prev => ({ ...prev, status: updated.status }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, lead?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const carregarOpcoes = async () => {
      try {
        setLoadingOptions(true);
        const tenantId = getTenantId();
        const [dentistasRes, tratamentosRes] = await Promise.all([
          supabaseUntyped
            .from("dentistas")
            .select("nome")
            .eq("tenant_id", tenantId)
            .order("nome")
            .returns<{ nome: string | null }[]>(),
          supabaseUntyped
            .from("tratamentos" as any)
            .select("nome")
            .eq("tenant_id", tenantId)
            .order("nome")
            .returns<{ nome: string | null }[]>(),
        ]);

        if (dentistasRes.error) throw dentistasRes.error;
        const dentistasData = dentistasRes.data ?? [];
        setDentistaOptions(dentistasData.map((d) => d.nome).filter((nome): nome is string => Boolean(nome)));

        if (tratamentosRes.error) {
          console.warn("Não foi possível carregar tratamentos:", tratamentosRes.error);
          setTratamentoOptions([]);
          setSuggestedTreatment(null);
        } else {
          const tratamentosData = tratamentosRes.data ?? [];
          const options = tratamentosData.map((t) => t.nome).filter((nome): nome is string => Boolean(nome));
          setTratamentoOptions(options);
          setSuggestedTreatment(options[0] || null);
        }
      } catch (error) {
        console.error("Erro ao carregar opções de dentistas/tratamentos:", error);
        toast.error("Não foi possível carregar as opções cadastradas");
      } finally {
        setLoadingOptions(false);
      }
    };

    carregarOpcoes();
  }, [isOpen]);

  const handleSave = async () => {
    if (!lead) return;

    setIsLoading(true);
    try {
      // Normaliza o telefone para o formato padrão (DDD + 8 dígitos)
      const normalizedPhone = normalizePhoneForAgendamento(formData.telefone);
      
      toast.success("Lead atualizado com sucesso!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterestedInScheduling = async () => {
    if (!lead) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabaseUntyped
        .from("posts")
        .update({
          nome: formData.nome,
          telefone: formData.telefone,
          status: formData.status,
          dentista: formData.dentista || null,
          tratamento: formData.tratamento || null,
          feedback: formData.feedback || null,
          data_marcada: formData.data_marcada?.toISOString() || null,
        })
        .eq("id", lead.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      toast.success("Lead atualizado com sucesso!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduledOutside = async () => {
    if (!lead) return;

    // Validações obrigatórias para "Agendado por fora"
    if (!formData.data_marcada) {
      toast.error("Defina a data e horário da consulta.");
      return;
    }

    if (!formData.dentista || formData.dentista.trim() === "") {
      toast.error("Selecione o dentista responsável.");
      return;
    }

    if (!formData.tratamento || formData.tratamento.trim() === "") {
      toast.error("Selecione o tratamento.");
      return;
    }

    setIsLoading(true);
    try {
      // Apenas atualizar o post, NÃO criar agendamento na tabela agendamento
      const { error } = await supabaseUntyped
        .from("posts")
        .update({
          nome: formData.nome,
          telefone: normalizePhoneForAgendamento(formData.telefone),
          status: "agendado por fora",
          dentista: formData.dentista || null,
          tratamento: formData.tratamento || null,
          data_marcada: formData.data_marcada.toISOString(),
          horario: formData.data_marcada.toTimeString().slice(0, 5),
          data: formData.data_marcada.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success("Lead atualizado como 'Agendado por fora'!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      toast.error("Erro ao salvar lead. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleAppointment = async () => {
    if (!lead) return;

    // Validações obrigatórias apenas para "Agendou consulta"
    if (!formData.data_marcada) {
      toast.error("Defina a data e horário da consulta antes de agendar.");
      return;
    }

    if (!formData.dentista || formData.dentista.trim() === "") {
      toast.error("Selecione o dentista responsável antes de agendar.");
      return;
    }

    if (!formData.tratamento || formData.tratamento.trim() === "") {
      toast.error("Selecione o tratamento antes de agendar.");
      return;
    }

    if (!marcadoCodefy) {
      toast.error("Marque a opção 'Marcado no Codefy' antes de agendar.");
      return;
    }

    const normalizedPhone = normalizePhoneForAgendamento(formData.telefone);
    if (!normalizedPhone) {
      toast.error("Informe um telefone válido para criar o agendamento.");
      return;
    }

    setIsLoading(true);
    try {
      // Obter usuário autenticado
      const currentUser = getCurrentUser();
      if (!currentUser?.id) throw new Error("Usuário não autenticado");

      const { data: agendamentoData, error: agendamentoError } = await supabaseUntyped
        .from("agendamento")
        .upsert(
          {
            nome: formData.nome,
            telefone: normalizedPhone,
            horario: lead.horario,
            dentista: formData.dentista || null,
            data: lead.data,
            data_marcada: formData.data_marcada.toISOString(),
            source: "campanha",
            author_id: currentUser.id,
            tenant_id: tenantId,
          },
          {
            onConflict: 'telefone'
          }
        )
        .select('id, data_marcada, horario')
        .single();

      if (agendamentoError) throw agendamentoError;

      const { error } = await supabaseUntyped
        .from("posts")
        .update({
          nome: formData.nome,
          telefone: normalizedPhone,
          status: "agendou consulta",
          dentista: formData.dentista || null,
          data_marcada: agendamentoData.data_marcada,
          horario: agendamentoData.horario,
          tratamento: formData.tratamento || null,
          feedback: formData.feedback || null,
          agendamento_id: agendamentoData.id,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Consulta agendada com sucesso!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao agendar consulta:", error);
      toast.error("Erro ao agendar consulta");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const found = statusOptions.find(s => s.value === status);
    return found?.color || "bg-muted";
  };

  const suggestedDateLabel = useMemo(() => {
    if (!lead?.data) return null;
    const parsed = getLocalDateFromIso(lead.data);
    if (!parsed) return lead.data;
    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [lead?.data]);

  const suggestedTimeLabel = useMemo(() => {
    if (!lead?.horario) return null;
    return formatTimeLabel(lead.horario);
  }, [lead?.horario]);

  const suggestedDateShortLabel = useMemo(() => {
    if (!lead?.data) return null;
    const parsed = getLocalDateFromIso(lead.data);
    if (!parsed) return lead.data;
    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  }, [lead?.data]);
  const patientTreatmentSuggestion = lead?.tratamento?.trim() || null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const fetchLeadHistory = useCallback(async () => {
    if (!lead) return;
    const rawPhone = formData.telefone || lead.telefone;
    const normalizedPhone = rawPhone ? normalizePhoneForAgendamento(rawPhone) : null;
    if (!normalizedPhone) {
      setHistoryError("Lead sem telefone válido para histórico");
      setHistoryData(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data, error } = await (supabase.rpc as any)('obter_historico_lead', { p_telefone: normalizedPhone });
      if (error) throw error;
      setHistoryData({
        snapshot: (data as any)?.snapshot ?? null,
        passagens: (data as any)?.passagens ?? [],
      });
    } catch (err) {
      console.error('Erro ao buscar histórico do lead:', err);
      setHistoryError('Não foi possível carregar o histórico. Tente novamente.');
    } finally {
      setHistoryLoading(false);
    }
  }, [lead, formData.telefone]);

  useEffect(() => {
    if (historyOpen) {
      fetchLeadHistory();
    }
  }, [historyOpen, fetchLeadHistory]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const snapshotInfo = historyData?.snapshot;

  if (!lead) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden max-h-[90vh] [&>button:last-child]:hidden">
        <div className="flex h-[600px]">
          {/* Left side - Profile */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header com avatar */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6 pb-8 flex-shrink-0">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shadow-lg">
                  {getInitials(formData.nome || "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl font-semibold text-foreground mb-1">
                    {formData.nome || "Sem nome"}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Perfil detalhado do paciente {formData.nome}
                  </DialogDescription>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`${getStatusColor(formData.status)} text-white border-0`}>
                      {formData.status}
                    </Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1 h-8 text-xs"
                      onClick={() => setHistoryOpen(true)}
                      disabled={!lead.telefone}
                    >
                      <History className="h-3.5 w-3.5" />
                      Histórico
                    </Button>
                  </div>
                  {lead.created_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Criado em {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Formulário com scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Controle do Bot */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Automação</span>
                  {botPaused ? (
                    <Badge className="bg-yellow-500 text-white border-0 text-xs">Bot Pausado</Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white border-0 text-xs">Bot Ativo</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {botPaused && botPauseReason && (
                    <span className="text-xs text-muted-foreground italic">
                      Motivo: {botPauseReason}
                    </span>
                  )}
                  {botPaused ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-green-600 text-green-700 hover:bg-green-50"
                      onClick={() => handleBotToggle(false)}
                      disabled={isBotToggling}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isBotToggling ? "Aguarde..." : "Reativar Automação"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                      onClick={() => handleBotToggle(true)}
                      disabled={isBotToggling}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isBotToggling ? "Aguarde..." : "Pausar Bot"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nome
                </Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do lead"
                  className="h-10"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Telefone
                </Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: formatPhoneForDisplay(e.target.value) })}
                  placeholder="31912345678"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Formato: DDD + número (ex: 31912345678). Será salvo como: {normalizePhoneForAgendamento(formData.telefone) || '—'}</p>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.color}`} />
                          {status.value}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data e Horário */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  Data e Horário
                </Label>
                <DateTimePicker
                  value={formData.data_marcada}
                  onChange={(date) => setFormData({ ...formData, data_marcada: date || undefined })}
                  placeholder="Selecionar data e horário"
                />
                {(suggestedDateShortLabel || suggestedTimeLabel) && (
                  <p className="text-xs text-muted-foreground">
                    Data sugerida:{" "}
                    <span className="font-medium text-foreground">
                      {suggestedDateShortLabel || suggestedDateLabel || "—"}
                      {suggestedTimeLabel ? ` às ${suggestedTimeLabel}` : ""}
                    </span>
                  </p>
                )}
              </div>

              {/* Tratamento */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  Tratamento
                </Label>
                <Select
                  value={formData.tratamento || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tratamento: value === "__none__" ? "" : value })
                  }
                  disabled={loadingOptions || tratamentoOptions.length === 0}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        loadingOptions
                          ? "Carregando opções..."
                          : (!formData.tratamento && (patientTreatmentSuggestion || suggestedTreatment)
                              ? `Sugestão do paciente: ${patientTreatmentSuggestion || suggestedTreatment}`
                              : "Selecione um tratamento cadastrado")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Nenhum</span>
                    </SelectItem>
                    {tratamentoOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingOptions && tratamentoOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum tratamento cadastrado. Cadastre em Dados &gt; Tratamentos.
                  </p>
                )}
              </div>

              {/* Dentista - obrigatório apenas para "Agendou consulta" */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Dentista {(isSchedulingAppointment || isScheduledOutside) && <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={formData.dentista || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dentista: value === "__none__" ? "" : value })
                  }
                  disabled={loadingOptions || dentistaOptions.length === 0}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        loadingOptions
                          ? "Carregando opções..."
                          : (isSchedulingAppointment || isScheduledOutside)
                            ? "Selecione o dentista responsável (obrigatório)"
                            : "Selecione o dentista (opcional)"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">
                        {(isSchedulingAppointment || isScheduledOutside) ? "Selecione um dentista" : "Nenhum"}
                      </span>
                    </SelectItem>
                    {dentistaOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingOptions && dentistaOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum dentista cadastrado. Cadastre em Dados &gt; Dentistas.
                  </p>
                )}
              </div>

              {/* Checkbox Marcado no Codefy - apenas para "Agendou consulta" */}
              {isSchedulingAppointment && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-blue-50/50">
                    <input
                      type="checkbox"
                      id="marcado_codefy"
                      checked={marcadoCodefy}
                      onChange={(e) => setMarcadoCodefy(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="marcado_codefy" className="text-sm font-medium cursor-pointer">
                      Marcado no Codefy
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-5">
                    Confirme que este agendamento foi registrado no sistema Codefy
                  </p>
                </div>
              )}

              {/* Status de Engajamento - exibido apenas para status "interagiu" */}
              {formData.status === "interagiu" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Status de Engajamento
                  </Label>
                  <Select
                    value={formData.feedback || "__none__"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, feedback: value === "__none__" ? "" : value })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione o status de engajamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">Nenhum</span>
                      </SelectItem>
                      <SelectItem value="respondeu">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          Respondeu
                        </div>
                      </SelectItem>
                      <SelectItem value="interagiu">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          Interagiu
                        </div>
                      </SelectItem>
                      <SelectItem value="engajou">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Engajou
                        </div>
                      </SelectItem>
                      <SelectItem value="impecilho">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Impecilho
                        </div>
                      </SelectItem>
                      <SelectItem value="cadencia">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          Cadência
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define em qual etapa do funil de engajamento o lead está. Leads com status de engajamento não podem ser movidos para outras colunas.
                  </p>
                </div>
              )}
              
              {/* Feedback do Paciente - exibido apenas para status "Compareceu" */}
              {formData.status?.toLowerCase() === "compareceu" && lead.feedback && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Feedback do Paciente
                  </Label>
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/30 text-sm text-foreground">
                    {lead.feedback}
                  </div>
                  <p className="text-xs text-muted-foreground">Feedback preenchido após a consulta</p>
                </div>
              )}
            </div>

            {/* Botões fixos */}
            <div className="flex gap-3 p-4 border-t bg-background flex-shrink-0">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-auto"
                disabled={isLoading || isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleArchive}
                className="w-auto"
                disabled={isLoading || isArchiving}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading || isDeleting || isArchiving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={isSchedulingAppointment ? handleScheduleAppointment : (isScheduledOutside ? handleScheduledOutside : (isInterestedInScheduling ? handleInterestedInScheduling : handleSave))}
                className="flex-1"
                disabled={isLoading || isDeleting || isArchiving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading
                  ? isSchedulingAppointment
                    ? "Agendando..."
                    : "Salvando..."
                  : isSchedulingAppointment
                    ? "Agendar consulta"
                    : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Right side - Chat */}
          <div className="w-[340px] border-l border-border flex flex-col bg-muted/30">
            <EmbeddedWhatsAppChat
              contactName={formData.nome || "Contato"}
              contactPhone={formData.telefone || null}
              instanceId={lead?.instance_id || null}
            />
          </div>
        </div>

        {/* Alert Dialog para confirmação de exclusão */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o lead <strong>{formData.nome}</strong>? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>

    <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Histórico do Lead
          </SheetTitle>
          <SheetDescription>
            Visualize todas as passagens e agendamentos vinculados a este telefone.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {historyLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
            </div>
          )}
          {!historyLoading && historyError && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-md p-3">
              {historyError}
            </div>
          )}
          {!historyLoading && !historyError && historyData && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Passagens
                </h4>
                {historyData.passagens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma passagem registrada para este lead.</p>
                ) : (
                  historyData.passagens.map((passagem) => {
                    const resumo = summarizePassagem(passagem);
                    return (
                      <div key={passagem.passagem_id} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                        {/* Cabeçalho: período e status final */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Passagem</p>
                            <p className="text-sm font-semibold text-slate-900">{resumo.statusLabel}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>
                              <span className="text-slate-400">Início:</span> {formatDateTime(passagem.inicio)}
                            </p>
                            {passagem.fim !== passagem.inicio && (
                              <p>
                                <span className="text-slate-400">Fim:</span> {formatDateTime(passagem.fim)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Detalhes de agendamento (só se houver) */}
                        {resumo.temAgendamento && (
                          <div className="border-t border-slate-100 pt-3 grid gap-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Comparecimento</span>
                              <span className="font-medium text-slate-800">{resumo.presenca}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Data marcada</span>
                              <span className="font-medium text-slate-800">{formatDateTime(resumo.dataMarcada)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Tratamento</span>
                              <span className="font-medium text-slate-800">{resumo.tratamento ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Dentista</span>
                              <span className="font-medium text-slate-800">{resumo.dentista ?? '—'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
};

export default LeadProfileDialog;
