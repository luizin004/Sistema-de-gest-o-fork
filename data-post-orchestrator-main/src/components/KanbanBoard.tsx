import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Clock, Phone, User, Move, ChevronDown, ChevronUp, TrendingUp, Archive, Download, Target, MessageCircle, Clock4, CalendarCheck2, Smile, CheckCircle2, AlertTriangle, Search, Plus, Bot, Wifi } from "lucide-react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, rectIntersection, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useCallback, useEffect, useMemo, memo, ComponentType } from "react";
import { ArchiveAllButton } from "@/components/ArchiveAllButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadFilters, useLeadFilters } from "./LeadFilters";
import { LeadProfileDialog } from "./LeadProfileDialog";
import { DateTimeBadgePicker } from "./DateTimePicker";
import { EngagementFunnelDialog } from "./EngagementFunnelDialog";
import { normalizePhoneForAgendamento } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Post } from "@/types/Post";
import { useCRMData } from "@/hooks/useCRMData";
import { getTenantId } from "@/utils/tenantUtils";

interface KanbanBoardProps {
  posts: Post[];
  onRefresh?: () => void;
}

// Status config - memoized outside component
const statusConfig = [
  { 
    name: "Em Negociação", 
    headerBgClass: "bg-emerald-600",
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-emerald-50/70",
    description: "Leads engajados e negociando",
    icon: MessageCircle
  },
  { 
    name: "Em Cadência", 
    headerBgClass: "bg-orange-500",
    counterClass: "bg-white/25 text-white",
    columnBgClass: "bg-amber-50/70",
    description: "Em processo de cadência",
    icon: Clock4
  },
  { 
    name: "Interessados em agendar", 
    headerBgClass: "bg-rose-500",
    counterClass: "bg-white/25 text-white",
    columnBgClass: "bg-rose-50/70",
    description: "Leads prontos para agendar",
    icon: CalendarCheck2
  },
  { 
    name: "Agendados", 
    headerBgClass: "bg-sky-600",
    counterClass: "bg-white/25 text-white",
    columnBgClass: "bg-blue-50/70",
    description: "Consultas agendadas",
    icon: Smile
  },
  {
    name: "Em Atenção",
    headerBgClass: "bg-yellow-600",
    counterClass: "bg-white/25 text-white",
    columnBgClass: "bg-yellow-50/70",
    description: "Leads que precisam de atenção humana",
    icon: AlertTriangle
  },
  {
    name: "Problemas/Perdidos",
    headerBgClass: "bg-red-600",
    counterClass: "bg-white/25 text-white",
    columnBgClass: "bg-red-50/70",
    description: "Leads com problemas ou perdidos",
    icon: AlertTriangle
  }
];

const getTreatmentBadgeClass = (treatment?: string | null) => {
  const baseClass = "text-[10px] h-5 font-semibold px-2 rounded-full border-0";
  if (!treatment) return `${baseClass} bg-slate-100 text-slate-700`;
  
  const normalized = treatment.toLowerCase();
  const palette = [
    { keywords: ["limpeza", "profilaxia"], className: "bg-sky-100 text-sky-800" },
    { keywords: ["clareamento"], className: "bg-amber-100 text-amber-800" },
    { keywords: ["cirurgia", "implante"], className: "bg-rose-100 text-rose-800" },
    { keywords: ["aparelho", "ortodontia"], className: "bg-purple-100 text-purple-800" },
    { keywords: ["canal", "endodontia"], className: "bg-emerald-100 text-emerald-800" },
    { keywords: ["avali", "check-up", "revis"], className: "bg-green-100 text-green-800" },
    { keywords: ["bruxismo", "bruxism", "dor", "tens", "relax"], className: "bg-indigo-100 text-indigo-800" },
  ];
  
  const match = palette.find(({ keywords }) => 
    keywords.some((keyword) => normalized.includes(keyword))
  );
  
  return `${baseClass} ${match ? match.className : "bg-slate-100 text-slate-700"}`;
};

const statusOrder = statusConfig.map(s => s.name);

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

export const KanbanBoard = ({ posts, onRefresh }: KanbanBoardProps) => {
  const [localPosts, setLocalPosts] = useState(posts);
  const [selectedLead, setSelectedLead] = useState<Post | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>(() =>
    statusOrder.reduce((acc, status) => {
      acc[status] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [showArchivedDialog, setShowArchivedDialog] = useState(false);
  const [showFunnelDialog, setShowFunnelDialog] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  
  // Delete confirmation state
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add lead dialog state
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState({
    nome: "",
    telefone: "",
    status: "interagiu",
    tratamento: "",
    dentista: ""
  });
  const [isAddingLead, setIsAddingLead] = useState(false);
  
  // Pan/drag state for canvas navigation
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  // Sensor para melhor controle do drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Handle delete
  const handleDeleteLead = useCallback(async () => {
    if (!deleteConfirmLead) return;
    
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada');
      }

      console.log('[DELETE-LEAD] Iniciando deleção do lead:', deleteConfirmLead.id);
      console.log('[DELETE-LEAD] Token disponível:', !!session.access_token);

      const { error, data } = await supabase.functions.invoke('delete-post', {
        body: { id: deleteConfirmLead.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('[DELETE-LEAD] Resposta da Edge Function:', { error, data });

      if (error) {
        console.error('[DELETE-LEAD] Error response:', error);
        throw new Error(error.message || 'Erro ao excluir lead');
      }

      console.log('[DELETE-LEAD] Lead excluído com sucesso:', data);
      toast.success("Lead excluído com sucesso!");
      setDeleteConfirmLead(null);
    } catch (error) {
      console.error("[DELETE-LEAD] Erro ao excluir lead:", error);
      const errorMessage = error?.message || error?.error?.message || 'Erro ao excluir lead';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmLead]);
  
  // Handle add new lead
  const handleAddLead = useCallback(async () => {
    if (!newLead.nome.trim() || !newLead.telefone.trim() || !newLead.status.trim()) {
      toast.error("Todos os campos são obrigatórios");
      return;
    }

    // Validar formato do telefone: 55 + DDD + 8/9 dígitos
    const phoneRegex = /^55\d{10,11}$/;
    const cleanPhone = newLead.telefone.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      toast.error("Telefone deve estar no formato: 55 + DDD + 8/9 dígitos (ex: 5511987654321)");
      return;
    }

    setIsAddingLead(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data, error } = await (supabase as any)
        .from('posts')
        .insert({
          nome: newLead.nome.trim(),
          telefone: cleanPhone,
          status: newLead.status.trim(),
          tratamento: newLead.tratamento.trim() || null,
          dentista: newLead.dentista.trim() || null,
          created_at: new Date().toISOString(),
          tenant_id: getTenantId()
        })
        .select()
        .single();

      if (error) {
        console.error('[ADD-LEAD] Erro ao inserir lead:', error);
        throw error;
      }

      console.log('[ADD-LEAD] Lead inserido com sucesso:', data);
      toast.success("Lead inserido com sucesso!");
      
      // Reset form and close dialog
      setNewLead({ nome: "", telefone: "", status: "interagiu", tratamento: "", dentista: "" });
      setShowAddLeadDialog(false);
      
      // Refresh posts
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("[ADD-LEAD] Erro ao inserir lead:", error);
      const errorMessage = error?.message || 'Erro ao inserir lead';
      toast.error(errorMessage);
    } finally {
      setIsAddingLead(false);
    }
  }, [newLead, onRefresh]);
  
  // Ref para o container de conteúdo para panning
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Handle pan start - qualquer clique que não seja em um card
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Verifica se o clique foi em um card (kanban-card) ou em elementos interativos
    const target = e.target as HTMLElement;
    const isOnCard = target.closest('.kanban-card');
    const isOnInteractive = target.closest('button, input, [role="button"]');
    
    // Permite panning apenas se não clicou em um card ou elemento interativo
    if (e.button === 0 && !isOnCard && !isOnInteractive) {
      e.preventDefault();
      setIsPanning(true);
      setStartPan({ x: e.clientX, y: e.clientY });
      if (contentRef.current) {
        setScrollPos({ 
          x: contentRef.current.scrollLeft, 
          y: contentRef.current.scrollTop 
        });
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !contentRef.current) return;
    
    const dx = e.clientX - startPan.x;
    
    // Apenas movimento horizontal
    contentRef.current.scrollLeft = scrollPos.x - dx;
  }, [isPanning, startPan, scrollPos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Global mouse up to handle when mouse leaves container
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Filtros
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  const { filters, setFilters, filteredPosts } = useLeadFilters(localPosts);

  // Memoized grouped posts
  const groupedPosts = useMemo(() => {
    console.log('[KanbanBoard] Processando posts:', filteredPosts.length, 'posts totais');
    
    const engagementStatuses = ['respondeu', 'interagiu', 'engajou', 'impecilho', 'cadencia', 'cadência'];
    const negotiationStatuses = ['interagiu', 'respondeu', 'engajou'];
    const problemStatuses = ['impecilho', 'não compareceu', 'perdido', 'não qualificado', 'paciente perdido', 'lead perdido'];
    const attentionStatuses = ['atencao', 'atenção'];
    const followUpStatuses = ['cadencia', 'cadência', 'follow-up', 'aguardando', 'pendente'];
    const scheduledStatuses = ['agendou consulta', 'agendado por fora', 'reagendando'];
    const completedStatuses = ['compareceu', 'tratamento iniciado', 'tratamento concluído'];
    const interestedStatuses = ['interessado', 'interessado em agendar', 'interessado em agendar consulta', 'agendar'];
    
    const grouped = statusOrder.reduce((acc, status) => {
      if (status === "Em Negociação") {
        // Para "Em Negociação", incluir leads engajados e negociando
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return negotiationStatuses.some(negStatus => postStatus.includes(negStatus));
        });
      } else if (status === "Interessados em agendar") {
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return interestedStatuses.some(interest => postStatus.includes(interest));
        });
      } else if (status === "Em Cadência") {
        // Para "Em Cadência", incluir leads em processo de follow-up
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return followUpStatuses.some(followStatus => postStatus.includes(followStatus));
        });
      } else if (status === "Agendados") {
        // Para "Agendados", incluir leads com consultas agendadas
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return scheduledStatuses.some(schedStatus => postStatus.includes(schedStatus));
        });
      } else if (status === "Em Atenção") {
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return attentionStatuses.some(attStatus => postStatus.includes(attStatus));
        });
      } else if (status === "Problemas/Perdidos") {
        // Para "Problemas/Perdidos", incluir leads com problemas
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          return problemStatuses.some(probStatus => postStatus.includes(probStatus));
        });
      } else {
        // Para outras colunas, apenas leads com o status correspondente
        // E que NÃO sejam status especiais
        acc[status] = filteredPosts.filter(post => {
          const postStatus = post.status?.toLowerCase().trim();
          const hasNegotiationStatus = negotiationStatuses.some(negStatus => postStatus.includes(negStatus));
          const hasProblemStatus = problemStatuses.some(probStatus => postStatus.includes(probStatus));
          const hasFollowUpStatus = followUpStatuses.some(followStatus => postStatus.includes(followStatus));
          const hasScheduledStatus = scheduledStatuses.some(schedStatus => postStatus.includes(schedStatus));
          const hasInterestedStatus = interestedStatuses.some(intStatus => postStatus.includes(intStatus));
          const hasAttentionStatus = attentionStatuses.some(attStatus => postStatus.includes(attStatus));
          const matchesStatus = postStatus === status.toLowerCase();

          // Só inclui se o status bate E não é status especial
          return matchesStatus && !hasNegotiationStatus && !hasProblemStatus &&
                 !hasFollowUpStatus && !hasScheduledStatus && !hasInterestedStatus && !hasAttentionStatus;
        });
      }
      return acc;
    }, {} as Record<string, Post[]>);
    
    // Adicionar colunas ocultas manualmente para manter dados
    grouped["Compareceu"] = filteredPosts.filter(post => {
      const postStatus = post.status?.toLowerCase().trim();
      return postStatus === "compareceu";
    });
    
    grouped["Não compareceu"] = filteredPosts.filter(post => {
      const postStatus = post.status?.toLowerCase().trim();
      return postStatus === "não compareceu";
    });
    
    // Adicionar "Arquivados" manualmente para o popup
    grouped["Arquivados"] = filteredPosts.filter(post => {
      const postStatus = post.status?.toLowerCase().trim();
      const isArchived = postStatus === "paciente perdido" || 
                        postStatus === "perdido" || 
                        postStatus === "arquivado" ||
                        postStatus.includes("perdido") ||
                        postStatus.includes("arquivado");
      
      // Debug: mostrar quais leads estão sendo filtrados
      if (isArchived) {
        console.log('[KanbanBoard] Lead arquivado encontrado:', post.nome, 'status:', post.status);
      }
      
      return isArchived;
    });
    
    console.log('[KanbanBoard] Total de arquivados encontrados:', grouped["Arquivados"].length);
    
    return grouped;
  }, [filteredPosts]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over) return;
    
    const postId = active.id as string;
    const newStatus = over.id as string;
    
    if (!statusOrder.includes(newStatus)) {
      console.error("Status inválido:", newStatus);
      toast.error("Status inválido");
      return;
    }
    
    try {
      const post = localPosts.find(p => p.id === postId);
      const currentStatus = post?.status;
      
      // Verifica se o lead tem status de engajamento
      const engagementStatuses = ['respondeu', 'interagiu', 'engajou', 'impecilho', 'cadencia', 'cadência'];
      const postStatus = currentStatus?.toLowerCase().trim();
      const hasEngagementStatus = postStatus && engagementStatuses.includes(postStatus);
      
      // Se tem status de engajamento, não pode ser movido
      if (hasEngagementStatus && newStatus !== "interagiu") {
        toast.error("Este lead está em processo de engajamento e deve permanecer na coluna 'interagiu'");
        return;
      }
      
      // Impede mover de "Agendou consulta" ou "Agendado por fora" para colunas anteriores
      if ((postStatus === "agendou consulta" || postStatus === "agendado por fora") && (newStatus === "interagiu" || newStatus === "interessado em agendar consulta")) {
        toast.error("Não é possível mover um paciente já agendado para colunas anteriores.");
        return;
      }
      
      // Normaliza o telefone para o formato padrão (DDD + 8 dígitos)
      const normalizedPhone = post?.telefone ? normalizePhoneForAgendamento(post.telefone) : null;
      
      // Atualiza o status e normaliza o telefone se necessário
      const updateData: Record<string, unknown> = { status: newStatus };
      
      // Se o telefone atual é diferente do normalizado, também atualiza
      if (post?.telefone && normalizedPhone && post.telefone !== normalizedPhone) {
        updateData.telefone = normalizedPhone;
      }
      
      const { error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', postId);
      
      if (error) throw error;
      
      // Sincroniza com tabela agendamento quando muda para status de presença ou confirmado
      if (newStatus === "Compareceu" || newStatus === "Não compareceu" || newStatus === "Confirmado") {
        if (normalizedPhone) {
          if (newStatus === "Confirmado") {
            await supabase
              .from('agendamento')
              .update({ confirmado: true })
              .eq('telefone', normalizedPhone);
          } else {
            await supabase
              .from('agendamento')
              .update({ presenca: newStatus })
              .eq('telefone', normalizedPhone);
          }
        }
      }
      
      if (newStatus === "agendado por fora") {
        if (post) {
          // Validações obrigatórias para "agendado por fora"
          if (!post.data_marcada) {
            toast.error("Data e horário são obrigatórios para 'Agendado por Fora'.");
            return;
          }
          if (!post.dentista) {
            toast.error("Selecione um dentista para 'Agendado por Fora'.");
            return;
          }
          if (!post.tratamento) {
            toast.error("Selecione um tratamento para 'Agendado por Fora'.");
            return;
          }
          
          // Apenas atualiza o post, NÃO cria agendamento na tabela
          const { error } = await supabase
            .from('posts')
            .update({
              status: "agendado por fora",
              data_marcada: post.data_marcada,
              horario: post.horario,
              data: post.data,
              dentista: post.dentista,
              tratamento: post.tratamento,
              updated_at: new Date().toISOString()
            })
            .eq('id', post.id);
            
          if (error) throw error;

          // Auto-pause bot when scheduled externally (filter by instance too)
          if (normalizedPhone) {
            let convQuery = supabase
              .from('chatbot_conversations')
              .update({
                bot_active: false,
                pause_reason: 'agendado por fora',
                current_funnel_status: 'agendado por fora'
              })
              .eq('phone_number', normalizedPhone);
            if (post.instance_id) {
              convQuery = convQuery.eq('instance_id', post.instance_id);
            }
            await convQuery;
          }

          toast.success("Lead atualizado como 'Agendado por Fora'!");
          onRefresh?.();
          setActiveId(null);
          return;
        }
      }
      
      if (newStatus === "agendou consulta") {
        if (post) {
          // Validações obrigatórias para "agendou consulta"
          if (!post.data_marcada) {
            toast.error("Data e horário são obrigatórios para agendar consulta.");
            return;
          }
          if (!post.dentista) {
            toast.error("Selecione um dentista para agendar consulta.");
            return;
          }
          if (!post.tratamento) {
            toast.error("Selecione um tratamento para agendar consulta.");
            return;
          }
          if (!post.marcado_codefy) {
            toast.error("Marque a opção 'Marcado no Codefy' para agendar consulta.");
            return;
          }
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            try {
              // 1. Criar/atualizar agendamento (fonte da verdade)
              const { data: agendamentoData, error: agendamentoError } = await supabase
                .from('agendamento')
                .upsert({
                  nome: post.nome,
                  horario: post.horario,
                  telefone: normalizedPhone,
                  dentista: post.dentista,
                  data: post.data,
                  data_marcada: post.data_marcada, // Agendamento é a fonte
                  author_id: user.id
                }, {
                  onConflict: 'nome,telefone'
                })
                .select('id, data_marcada, horario')
                .single();

              if (agendamentoError) throw agendamentoError;

              // 2. Atualizar post com dados do agendamento (espelho)
              const { error: postError } = await supabase
                .from('posts')
                .update({
                  status: "agendou consulta",
                  agendamento_id: agendamentoData.id,
                  data_marcada: agendamentoData.data_marcada, // Sincronizar do agendamento
                  horario: agendamentoData.horario // Sincronizar do agendamento
                })
                .eq('id', post.id);

              if (postError) throw postError;

              // Auto-pause bot when appointment is scheduled via CRM (filter by instance)
              if (normalizedPhone) {
                let convQuery2 = supabase
                  .from('chatbot_conversations')
                  .update({
                    bot_active: false,
                    pause_reason: 'agendou consulta',
                    current_funnel_status: 'agendou consulta'
                  })
                  .eq('phone_number', normalizedPhone);
                if (post.instance_id) {
                  convQuery2 = convQuery2.eq('instance_id', post.instance_id);
                }
                await convQuery2;
              }

              toast.success("Status atualizado e datas sincronizadas com agendamento!");
              return;
            } catch (error) {
              console.error("Erro ao criar relacionamento:", error);
              toast.error("Erro ao relacionar agendamento");
            }
          }
        }
      }
      
      setLocalPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                status: newStatus,
                telefone:
                  updateData.telefone && typeof updateData.telefone === "string"
                    ? (updateData.telefone as string)
                    : p.telefone,
              }
            : p
        )
      );

      toast.success("Status atualizado com sucesso!");
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  }, [posts]);

  const handleDateTimeUpdate = useCallback(async (postId: string, dateTime: Date | null) => {
    try {
      const isoString = dateTime ? dateTime.toISOString() : null;
      const horario = dateTime ? format(dateTime, "HH:mm") : null;
      const post = localPosts.find(p => p.id === postId);
      
      if (!post) {
        toast.error("Lead não encontrado");
        return;
      }

      console.log('=== DEBUG ATUALIZAÇÃO DATA BIDIRECIONAL ===');
      console.log('Post ID:', postId);
      console.log('Post:', post);
      console.log('Nova data:', isoString);

      // 1. Atualizar posts (fonte primária)
      const { error: postsError } = await supabase
        .from('posts')
        .update({ 
          data_marcada: isoString,
          horario: horario
        })
        .eq('id', postId);

      if (postsError) {
        console.error('Erro ao atualizar posts:', postsError);
        throw postsError;
      }

      console.log('✅ Posts atualizado com sucesso');

      // 2. Trigger automático sincronizará agendamento
      if (post.agendamento_id) {
        console.log('🔄 Trigger sincronizará automaticamente o agendamento ID:', post.agendamento_id);
        toast.success("Data atualizada em posts e agendamento!");
      } else {
        console.log('⚠️ Post não tem agendamento_id para sincronizar');
        toast.success("Data atualizada em posts (sem agendamento relacionado)");
      }
      
      // 3. Atualizar estado local
      setLocalPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                data_marcada: isoString,
                horario,
              }
            : p
        )
      );

    } catch (error) {
      console.error("Erro ao atualizar data marcada:", error);
      toast.error("Erro ao atualizar data marcada");
    }
  }, [localPosts]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleOpenProfile = useCallback((post: Post) => {
    setSelectedLead(post);
  }, []);

  const handleToggleColumn = useCallback((status: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  }, []);

  const handleCloseProfile = useCallback(() => {
    setSelectedLead(null);
  }, []);

  const activePost = useMemo(() => 
    activeId ? filteredPosts.find(p => p.id === activeId) : null,
    [activeId, filteredPosts]
  );

  // Scroll sync handlers
  const handleTopScrollbarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (contentRef.current) contentRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // Carregar posts arquivados da tabela arquivados
  const loadArchivedPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('arquivados' as any)
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) throw error;
      
      // Converter dados da tabela arquivados para formato Post
      const posts: Post[] = (data as any[] || []).map((archived: any) => ({
        id: archived.original_id,
        nome: archived.nome,
        status: archived.status,
        data: archived.data,
        horario: archived.horario,
        tratamento: archived.tratamento,
        telefone: archived.telefone,
        dentista: archived.dentista,
        data_marcada: archived.data_marcada,
        created_at: archived.created_at,
        feedback: archived.feedback,
        campanha_id: archived.campanha_id,
        campanha_nome: archived.campanha_nome,
        agendamento_id: archived.agendamento_id,
      }));
      
      setArchivedPosts(posts);
    } catch (error) {
      console.error('Error loading archived posts:', error);
      toast.error('Erro ao carregar pacientes arquivados');
    }
  }, []);

  // Carregar posts arquivados quando abrir o dialog
  useEffect(() => {
    if (showArchivedDialog) {
      loadArchivedPosts();
    }
  }, [showArchivedDialog, loadArchivedPosts]);

  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) containerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  const handleRestoreSingle = useCallback(async (post: Post) => {
    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Mostrar toast de progresso
      const toastId = toast.loading(`Restaurando ${post.nome}...`);

      // Mover post individual da tabela arquivados para posts
      const { error: insertError } = await supabase
        .from('posts')
        .upsert({
          id: post.id,
          nome: post.nome,
          status: post.status,
          data: post.data,
          horario: post.horario,
          tratamento: post.tratamento,
          telefone: post.telefone,
          dentista: post.dentista,
          data_marcada: post.data_marcada,
          created_at: post.created_at,
          feedback: post.feedback,
          campanha_id: post.campanha_id,
          campanha_nome: post.campanha_nome,
          agendamento_id: post.agendamento_id,
        }, { onConflict: 'id' });

      if (insertError) {
        throw insertError;
      }

      // Remover da tabela arquivados
      const { error: deleteError } = await supabase
        .from('arquivados' as any)
        .delete()
        .eq('original_id', post.id);

      if (deleteError) {
        throw deleteError;
      }

      // Atualizar estado local
      setArchivedPosts(prev => prev.filter(p => p.id !== post.id));
      
      // Sucesso
      toast.success(`✅ ${post.nome} restaurado com sucesso!`, {
        id: toastId,
      });
      
      // Atualizar dados principais
      onRefresh?.();

    } catch (error) {
      console.error('Error restoring single post:', error);
      toast.error("Erro ao restaurar paciente. Tente novamente.");
    }
  }, [onRefresh]);

  const handleRestoreAllArchived = useCallback(async () => {
    if (archivedPosts.length === 0) {
      toast.info("Não há pacientes arquivados para restaurar.");
      return;
    }

    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Mostrar toast de progresso
      const toastId = toast.loading(`Restaurando ${archivedPosts.length} pacientes...`);

      // Mover todos os posts da tabela arquivados para posts
      const { error: insertError } = await supabase
        .from('posts')
        .upsert(
          archivedPosts.map(post => ({
            id: post.id,
            nome: post.nome,
            status: post.status,
            data: post.data,
            horario: post.horario,
            tratamento: post.tratamento,
            telefone: post.telefone,
            dentista: post.dentista,
            data_marcada: post.data_marcada,
            created_at: post.created_at,
            feedback: post.feedback,
            campanha_id: post.campanha_id,
            campanha_nome: post.campanha_nome,
            agendamento_id: post.agendamento_id,
          })),
          { onConflict: 'id' }
        );

      if (insertError) {
        throw insertError;
      }

      // Limpar tabela arquivados
      const { error: deleteError } = await supabase
        .from('arquivados' as any)
        .delete()
        .in('original_id', archivedPosts.map(post => post.id));

      if (deleteError) {
        throw deleteError;
      }

      // Atualizar estado
      setArchivedPosts([]);
      
      // Sucesso
      toast.success(`✅ ${archivedPosts.length} pacientes restaurados com sucesso!`, {
        id: toastId,
      });

      // Fechar dialog
      setShowArchivedDialog(false);
      
      // Atualizar dados principais
      onRefresh?.();

    } catch (error) {
      console.error('Error restoring archived posts:', error);
      toast.error("Erro ao restaurar pacientes. Tente novamente.");
    }
  }, [archivedPosts, onRefresh]);

  // Componente para card individual com botão de restauração
  const ArchivedCard = ({ post }: { post: Post }) => {
    return (
      <div className="group relative bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base text-gray-900 truncate">{post.nome}</h4>
            
            {/* Telefone com ícone */}
            {post.telefone && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Phone className="h-4 w-4 flex-shrink-0 opacity-60" />
                <span className="truncate">{post.telefone}</span>
              </div>
            )}
            
            {/* Pílulas de informação */}
            <div className="flex flex-wrap gap-2 mt-2">
              {post.tratamento && (
                <Badge variant="secondary" className={`${getTreatmentBadgeClass(post.tratamento)} text-xs px-3 py-1 rounded-full font-medium`}>
                  {post.tratamento}
                </Badge>
              )}
              {post.status && (
                <Badge className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium border border-gray-200">
                  {post.status}
                </Badge>
              )}
            </div>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-9 px-3 text-sm bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
            onClick={() => handleRestoreSingle(post)}
          >
            <Archive className="h-3 w-3" />
            Restaurar
          </Button>
        </div>
      </div>
    );
  };

  const handleDownloadArchived = useCallback(() => {
    const archived = archivedPosts || [];
    if (!archived.length) {
      toast.info("Não há pacientes arquivados para exportar.");
      return;
    }

    const headers = ["Nome", "Telefone", "Tratamento", "Status", "Dentista", "Data sugerida", "Horário sugerido"];
    const escapeCsv = (value: string | null | undefined) =>
      `"${(value ?? "").replace(/"/g, '""')}"`;

    const rows = archived.map((post) => [
      escapeCsv(post.nome),
      escapeCsv(post.telefone),
      escapeCsv(post.tratamento),
      escapeCsv(post.status),
      escapeCsv(post.dentista),
      escapeCsv(post.data ? format(new Date(post.data), "dd/MM/yyyy") : ""),
      escapeCsv(post.horario),
    ]);

    const csvContent = [headers.join(","), ...rows.map((cells) => cells.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pacientes-arquivados-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [groupedPosts]);

  return (
    <>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/30 p-3 backdrop-blur-2xl shadow-[0_20px_60px_-45px_rgba(15,23,42,0.6)]">
          <div className="flex-1 min-w-[280px]">
            <LeadFilters 
              posts={posts} 
              filters={filters} 
              onFiltersChange={setFilters}
              compact
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end text-right">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar em todas as colunas..."
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                className="pl-10 h-9 w-52 text-sm bg-white/90 border-gray-200 focus:border-blue-300 shadow-sm"
              />
              {globalSearchTerm && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {Object.values(groupedPosts).flat().filter(post =>
                    post.nome.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                    post.telefone?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                    post.tratamento?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                    post.dentista?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                    post.status?.toLowerCase().includes(globalSearchTerm.toLowerCase())
                  ).length} resultados
                </div>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAddLeadDialog(true)}
              className="gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Inserir Lead
            </Button>
            <ArchiveAllButton onArchiveComplete={() => {
              // Recarregar dados após arquivamento
              window.location.reload();
            }} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowArchivedDialog(true)}
              className="gap-2 h-10 rounded-xl border border-slate-200 bg-slate-50/90 text-slate-700 hover:bg-slate-100 shadow-sm"
            >
              <Archive className="h-4 w-4 text-slate-500" />
              Pacientes Arquivados
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Move className="h-3.5 w-3.5" />
              <span>Arraste em área vazia para mover o quadro</span>
            </div>
          </div>
        </div>
      </div>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={rectIntersection} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col rounded-[28px] border border-white/35 bg-white/20 backdrop-blur-[22px] shadow-[0_40px_120px_-70px_rgba(5,15,36,0.85)] h-[calc(100vh-310px)]">
          {/* Scrollbar horizontal no topo */}
          <div 
            ref={containerRef}
            className="kanban-scrollbar-top overflow-x-auto overflow-y-hidden flex-shrink-0"
            onScroll={handleTopScrollbarScroll}
          >
            <div className="w-full h-2" />
          </div>
          
          {/* Conteúdo do Kanban com scroll vertical */}
          <div 
            ref={contentRef}
            className={`kanban-content flex-1 overflow-x-auto overflow-y-hidden smooth-scroll select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onScroll={handleContentScroll}
          >
            <style>{`
              .kanban-scrollbar-top::-webkit-scrollbar {
                height: 8px;
              }
              .kanban-scrollbar-top::-webkit-scrollbar-track {
                background: hsl(var(--muted) / 0.65);
                border-radius: 999px;
              }
              .kanban-scrollbar-top::-webkit-scrollbar-thumb {
                background: linear-gradient(90deg, rgba(148,163,184,0.35), rgba(148,163,184,0.55));
                border-radius: 999px;
              }
              .kanban-scrollbar-top::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(90deg, rgba(100,116,139,0.6), rgba(148,163,184,0.8));
              }
              .kanban-column-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(148,163,184,0.5) transparent;
              }
              .kanban-column-scroll::-webkit-scrollbar {
                width: 4px;
              }
              .kanban-column-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .kanban-column-scroll::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.45);
                border-radius: 999px;
              }
              .kanban-column-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(71, 85, 105, 0.7);
              }
            `}</style>
            
            <div className="grid grid-cols-6 gap-2 p-4 pt-2 w-full items-start">
              {statusConfig.map(({ name: status, headerBgClass, counterClass, columnBgClass, description, icon }) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  headerBgClass={headerBgClass}
                  counterClass={counterClass}
                  columnBgClass={columnBgClass}
                  posts={groupedPosts[status]}
                  onDateTimeUpdate={handleDateTimeUpdate}
                  onOpenProfile={handleOpenProfile}
                  onShowFunnel={status === "interagiu" ? () => setShowFunnelDialog(true) : undefined}
                  description={description}
                  icon={icon as ComponentType<{ className?: string }>}
                  globalSearchTerm={globalSearchTerm}
                  setGlobalSearchTerm={setGlobalSearchTerm}
                />
              ))}
            </div>
          </div>
        </div>
        
        <DragOverlay dropAnimation={null}>
          {activePost ? (
            <Card className="bg-card border-border shadow-xl w-[220px] rotate-2 gpu-accelerated">
              <CardContent className="p-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[11px]">
                    {getInitials(activePost.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[13px] leading-tight break-words line-clamp-2">{activePost.nome}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Phone className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">{activePost.telefone || "Sem telefone"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
      
      <LeadProfileDialog
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={handleCloseProfile}
        onUpdate={() => {}}
      />
      
      <EngagementFunnelDialog
        isOpen={showFunnelDialog}
        onClose={() => setShowFunnelDialog(false)}
      />
      
      {/* Alert Dialog para confirmação de exclusão via drag */}
      <AlertDialog open={!!deleteConfirmLead} onOpenChange={(open) => !open && setDeleteConfirmLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{deleteConfirmLead?.nome}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLead}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para inserir lead */}
      <Dialog open={showAddLeadDialog} onOpenChange={setShowAddLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Inserir Novo Lead
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do novo lead para adicioná-lo ao CRM.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name" className="text-sm font-medium text-gray-700">
                Nome *
              </Label>
              <Input
                id="lead-name"
                value={newLead.nome}
                onChange={(e) => setNewLead(prev => ({...prev, nome: e.target.value}))}
                placeholder="Ex: João Silva"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead-phone" className="text-sm font-medium text-gray-700">
                Número de Telefone *
              </Label>
              <Input
                id="lead-phone"
                value={newLead.telefone}
                onChange={(e) => setNewLead(prev => ({...prev, telefone: e.target.value}))}
                placeholder="Ex: 5511987654321"
                className="w-full"
              />
              <div className="text-xs text-gray-500">
                <p>Formato: 55 + DDD + 8/9 dígitos</p>
                <p>Exemplo: 5511987654321 (Rio de Janeiro) ou 5534998765432 (interior)</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead-status" className="text-sm font-medium text-gray-700">
                Status *
              </Label>
              <select
                id="lead-status"
                value={newLead.status}
                onChange={(e) => setNewLead(prev => ({...prev, status: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="respondeu">Respondeu</option>
                <option value="interagiu">Interagiu</option>
                <option value="engajou">Engajou</option>
                <option value="atencao">Atenção</option>
                <option value="interessado em agendar">Interessado em Agendar</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead-treatment" className="text-sm font-medium text-gray-700">
                Tratamento (Opcional)
              </Label>
              <Input
                id="lead-treatment"
                value={newLead.tratamento}
                onChange={(e) => setNewLead(prev => ({...prev, tratamento: e.target.value}))}
                placeholder="Ex: Clareamento, Ortodontia, Implante"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead-dentist" className="text-sm font-medium text-gray-700">
                Dentista (Opcional)
              </Label>
              <Input
                id="lead-dentist"
                value={newLead.dentista}
                onChange={(e) => setNewLead(prev => ({...prev, dentista: e.target.value}))}
                placeholder="Ex: Dr. Silva, Dra. Santos"
                className="w-full"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddLeadDialog(false)}
              disabled={isAddingLead}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddLead}
              disabled={isAddingLead || !newLead.nome.trim() || !newLead.telefone.trim() || !newLead.status.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isAddingLead ? "Inserindo..." : "Inserir Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para arquivados */}
      <Dialog open={showArchivedDialog} onOpenChange={setShowArchivedDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Pacientes Arquivados
              </DialogTitle>
              <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadArchived}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleRestoreAllArchived}
                disabled={archivedPosts.length === 0}
              >
                <Archive className="h-4 w-4" />
                Restaurar Todos
              </Button>
            </div>
            </div>
            <DialogDescription>
              Pacientes arquivados que foram movidos da tabela posts para a tabela de arquivados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="bg-gradient-to-r from-slate-500 via-slate-500/85 to-slate-400 text-white/95 px-3 py-2 rounded-t-xl flex items-center justify-between shadow-lg">
              <h3 className="font-medium text-sm">Arquivados</h3>
              <Badge variant="secondary" className="bg-white/25 text-white border-0 font-semibold h-5 min-w-[20px] text-[10px] flex items-center justify-center shadow-sm">
                {archivedPosts.length || 0}
              </Badge>
            </div>
            
            <div className="space-y-2.5 p-3 bg-white/75 rounded-b-xl border border-t-0 border-white/40 backdrop-blur-xl max-h-[500px] overflow-y-auto">
              {archivedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Archive className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum paciente arquivado</p>
                </div>
              ) : (
                archivedPosts.map((post) => (
                  <ArchivedCard key={`${post.id}-${post.created_at}`} post={post} />
                ))
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchivedDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface KanbanColumnProps {
  status: string;
  posts: Post[];
  onDateTimeUpdate: (postId: string, date: Date | null) => Promise<void>;
  onOpenProfile: (post: Post) => void;
  onShowFunnel?: () => void;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  headerBgClass?: string;
  counterClass?: string;
  columnBgClass?: string;
  globalSearchTerm?: string;
  setGlobalSearchTerm?: (term: string) => void;
}

const KanbanColumn = memo(({
  status,
  headerBgClass,
  counterClass,
  columnBgClass,
  posts,
  onDateTimeUpdate,
  onOpenProfile,
  onShowFunnel,
  description,
  icon: Icon,
  globalSearchTerm,
  setGlobalSearchTerm
}: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  // Filtrar posts baseado no termo de busca global
  const filteredPosts = useMemo(() => {
    if (!globalSearchTerm.trim()) return posts;
    
    const searchLower = globalSearchTerm.toLowerCase();
    return posts.filter(post => 
      post.nome.toLowerCase().includes(searchLower) ||
      post.telefone?.toLowerCase().includes(searchLower) ||
      post.tratamento?.toLowerCase().includes(searchLower) ||
      post.dentista?.toLowerCase().includes(searchLower) ||
      post.status?.toLowerCase().includes(searchLower)
    );
  }, [posts, globalSearchTerm]);

  return (
    <div className="min-w-0 kanban-column flex flex-col">
      <div className={`${headerBgClass} text-white px-4 py-2.5 rounded-t-2xl flex items-center justify-between gap-2 shadow-sm`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && (
            <div className="bg-white/15 rounded-full p-1.5 flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="font-semibold text-[13px] leading-tight truncate" title={status}>{status}</h3>
            {description && (
              <p className="text-[10px] text-white/80 truncate" title={description}>{description}</p>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${counterClass} flex-shrink-0 min-w-[32px] text-center`}>
          {filteredPosts.length}{globalSearchTerm && `/${posts.length}`}
        </span>
      </div>
      
      <div ref={setNodeRef} className={`kanban-column-scroll space-y-2.5 p-2.5 rounded-b-2xl border border-t-0 border-slate-200 ${columnBgClass} backdrop-blur-[2px] overflow-y-auto overflow-x-hidden scroll-smooth min-h-[120px] max-h-[calc(100vh-390px)]`}>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <User className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">Nenhum lead</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">Nenhum resultado para "{globalSearchTerm}"</p>
            <button 
              onClick={() => setGlobalSearchTerm("")}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <DraggableCard 
              key={post.id} 
              post={post}
              onDateTimeUpdate={onDateTimeUpdate}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </div>
    </div>
  );
});

KanbanColumn.displayName = 'KanbanColumn';

// Componente TimeCounter igual ao do KanbanBoardAcao
const TimeCounter = ({ post }: { post: Post }) => {
  const [timeElapsed, setTimeElapsed] = useState('');
  const [timeColor, setTimeColor] = useState('bg-green-100 text-green-700 border-green-200');

  const referenceTime = post.ultima_mensagem_at || post.created_at;

  useEffect(() => {
    const updateCounter = () => {
      const agora = new Date();

      if (!referenceTime) {
        setTimeElapsed('');
        return;
      }

      // ultima_mensagem_at é salvo como timestamp WITHOUT timezone em UTC pelo Supabase.
      // Ao parsear sem sufixo, o JS interpreta como local time (UTC-3), gerando erro de +3h.
      // Adicionando 'Z' forçamos interpretação como UTC, que é o correto.
      const rawStr = String(referenceTime);
      const utcStr = rawStr.endsWith('Z') || rawStr.includes('+') ? rawStr : rawStr + 'Z';
      const ultimaMsg = new Date(utcStr);

      if (isNaN(ultimaMsg.getTime())) {
        setTimeElapsed('');
        return;
      }

      const diffMs = agora.getTime() - ultimaMsg.getTime();

      // Validação: se data for futura (clock skew), mostrar "Agora"
      if (diffMs < 0) {
        setTimeElapsed('Agora');
        setTimeColor('bg-green-100 text-green-700 border-green-200');
        return;
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      let display = '';
      if (diffDays > 0) {
        display = `${diffDays}d`;
      } else if (diffHours > 0) {
        display = `${diffHours}h`;
      } else {
        display = `${diffMins}min`;
      }

      if (diffDays >= 1) {
        setTimeColor('bg-red-100 text-red-700 border-red-200');
      } else if (diffHours >= 2) {
        setTimeColor('bg-orange-100 text-orange-700 border-orange-200');
      } else if (diffHours >= 1) {
        setTimeColor('bg-yellow-100 text-yellow-700 border-yellow-200');
      } else {
        setTimeColor('bg-green-100 text-green-700 border-green-200');
      }

      setTimeElapsed(display);
    };

    updateCounter();
    const interval = setInterval(updateCounter, 60000);
    return () => clearInterval(interval);
  }, [referenceTime]);

  if (!timeElapsed) return null;

  return (
    <div className={`inline-flex items-center px-1.5 py-px rounded-full text-[9px] font-medium border ${timeColor}`}>
      ⏱ {timeElapsed}
    </div>
  );
};

interface DraggableCardProps {
  post: Post;
  onDateTimeUpdate: (postId: string, dateTime: Date | null) => Promise<void>;
  onOpenProfile: (post: Post) => void;
}

const DraggableCard = memo(({ 
  post, 
  onDateTimeUpdate,
  onOpenProfile
}: DraggableCardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ 
    id: post.id 
  });

  const currentDateTime = useMemo(() => 
    post.data_marcada ? new Date(post.data_marcada) : null,
    [post.data_marcada]
  );
  const requestedDateTime = useMemo(() => 
    post.data ? new Date(post.data) : null,
    [post.data]
  );
  const requestedDateDisplay = useMemo(() => 
    requestedDateTime ? format(requestedDateTime, "dd MMM", { locale: ptBR }) : null,
    [requestedDateTime]
  );
  const requestedTimeDisplay = useMemo(() => {
    if (!post.horario) return null;
    const parsed = new Date(`1970-01-01T${post.horario}`);
    return isNaN(parsed.getTime()) ? post.horario : format(parsed, "HH:mm");
  }, [post.horario]);
  
  // Verifica se tem status de engajamento
  const engagementStatuses = ['respondeu', 'interagiu', 'engajou', 'impecilho', 'cadencia', 'cadência'];
  const postStatus = post.status?.toLowerCase().trim();
  const hasEngagementStatus = postStatus && engagementStatuses.includes(postStatus);

  // Verifica se é lead interessado em agendar (para borda especial)
  const isInterestedInSchedulingForBorder =
    postStatus === 'interessado_agendar' ||
    postStatus === 'interessado em agendar' ||
    post.bot_pause_reason === 'interessado_agendar';
  
  // Verifica se é da coluna "Interessado em agendar consulta"
  const isInterestedInScheduling = postStatus === "interessado em agendar consulta";
  
  // Verifica se é lead agendado (pode alterar data)
  const isScheduled = postStatus === "agendou consulta" || 
                     postStatus === "confirmado" || 
                     postStatus === "reagendando";
  
  // Verifica se pode editar data (interessado ou agendado)
  const canEditDateTime = isInterestedInScheduling || isScheduled;
  
  // Verifica se é lead perdido ou com problema
  const isLost = postStatus === "perdido" || postStatus === "paciente perdido";
  const hasProblem = postStatus === "impecilho" || postStatus === "não compareceu" || postStatus === "não qualificado";
  
  // Verifica se está em follow-up
  const isFollowUp = postStatus === "cadencia" || postStatus === "cadência" || postStatus === "follow-up";
  
  // Verifica se está agendado (remover duplicata)
  // const isScheduled = postStatus === "agendou consulta" || postStatus === "reagendando";
  
  const engagementStatusLabel = useMemo(() => {
    if (!hasEngagementStatus) return null;
    const status = post.status?.toLowerCase().trim();
    if (status === 'respondeu') return 'Respondeu';
    if (status === 'interagiu') return 'Interagiu';
    if (status === 'engajou') return 'Engajou';
    if (status === 'impecilho') return 'Impedimento';
    if (status === 'cadencia' || status === 'cadência') return 'Cadência';
    return null;
  }, [post.status, hasEngagementStatus]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onOpenProfile(post);
  }, [isDragging, onOpenProfile, post]);

  const handleDateChange = useCallback((date: Date | null) => {
    onDateTimeUpdate(post.id, date);
  }, [onDateTimeUpdate, post.id]);

  return (
    <div className="relative">
      <div
        ref={setNodeRef}
        className={`kanban-card bg-white shadow-sm cursor-pointer transition-all duration-300 min-h-[70px] rounded-2xl ${isInterestedInSchedulingForBorder ? 'border-2 border-rose-300' : 'border border-gray-100'} ${isDragging ? 'opacity-40 scale-95' : 'hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/50'}`}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) onOpenProfile(post);
        }}
      >
        <div className="p-2.5 h-full flex flex-col gap-1.5 relative">

          {/* Linha 1: Avatar + Nome completo */}
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-[11px] shadow-sm">
              {getInitials(post.nome)}
            </div>
            <h4 className="font-semibold text-[13px] text-gray-900 leading-tight flex-1 min-w-0 break-words line-clamp-2">{post.nome}</h4>
            {post.bot_paused === true ? (
              <User className="h-3 w-3 flex-shrink-0 text-blue-500 opacity-70" title="Atendimento humano ativo" />
            ) : (
              <Bot className="h-3 w-3 flex-shrink-0 text-emerald-500 opacity-70" title="Bot ativo" />
            )}
          </div>

          {/* Linha 2: Telefone + TimeCounter */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 min-w-0">
              <Phone className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
              <span className="truncate">{post.telefone || "Sem telefone"}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <TimeCounter post={post} />
              {isInterestedInScheduling && (
                <div className="w-2 h-2 bg-rose-400 rounded-full animate-pulse" title="Interessado em agendar" />
              )}
              {isLost && (
                <div className="w-2 h-2 bg-gray-400 rounded-full" title="Arquivado" />
              )}
              {hasProblem && (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" title="Problema detectado" />
              )}
              {isFollowUp && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Em cadência" />
              )}
              {isScheduled && (
                <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Consulta agendada" />
              )}
            </div>
          </div>

          {/* Linha 3: Info contextual — tratamento, data/hora agendada */}
          {(post.tratamento || post.dentista || (isScheduled && currentDateTime) || (isInterestedInScheduling && (requestedDateDisplay || requestedTimeDisplay))) && (
            <div className="flex flex-wrap items-center gap-1">
              {post.tratamento && (
                <span className={`inline-flex items-center text-[9px] px-1.5 py-px rounded-full font-medium border ${getTreatmentBadgeClass(post.tratamento)}`}>
                  {post.tratamento}
                </span>
              )}
              {isScheduled && currentDateTime && (
                <>
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CalendarCheck2 className="h-2.5 w-2.5 flex-shrink-0" />
                    {format(currentDateTime, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span className="inline-flex items-center text-[9px] px-1.5 py-px rounded-full font-bold bg-emerald-500 text-white shadow-sm">
                    {format(currentDateTime, "HH:mm", { locale: ptBR })}
                  </span>
                </>
              )}
              {isInterestedInScheduling && !isScheduled && (requestedDateDisplay || requestedTimeDisplay) && (
                <>
                  {requestedDateDisplay && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium bg-rose-50 text-rose-600 border border-rose-200">
                      <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                      {requestedDateDisplay}
                    </span>
                  )}
                  {requestedTimeDisplay && (
                    <span className="inline-flex items-center text-[9px] px-1.5 py-px rounded-full font-bold bg-rose-500 text-white shadow-sm">
                      {requestedTimeDisplay}
                    </span>
                  )}
                </>
              )}
              {post.dentista && (
                <span className="inline-flex items-center text-[9px] px-1.5 py-px rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {post.dentista}
                </span>
              )}
            </div>
          )}

          {/* Linha 4: Badges de campanha e engajamento */}
          {(post.campanha_nome || (hasEngagementStatus && engagementStatusLabel)) && (
            <div className="flex flex-wrap gap-1 pt-0.5 border-t border-gray-100">
              {post.campanha_nome && (
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium bg-purple-50 text-purple-600 border border-purple-100 max-w-full">
                  <Target className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{post.campanha_nome}</span>
                </span>
              )}
              {hasEngagementStatus && engagementStatusLabel && (
                <span className="inline-flex items-center text-[9px] px-1.5 py-px rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
                  {engagementStatusLabel}
                </span>
              )}
            </div>
          )}

          {/* Linha 5: Bot e Instância */}
          {(post.bot_name || post.instance_name) && (
            <div className="flex flex-wrap gap-1 pt-0.5 border-t border-gray-100">
              {post.bot_name && (
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium bg-cyan-50 text-cyan-700 border border-cyan-200" title="Bot atendendo">
                  <Bot className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{post.bot_name}</span>
                </span>
              )}
              {post.instance_name && (
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200" title="Instância conectada">
                  <Wifi className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{post.instance_name}</span>
                </span>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
});

DraggableCard.displayName = 'DraggableCard';
