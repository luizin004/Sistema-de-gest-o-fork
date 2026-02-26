import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Clock, Phone, User, Target, MessageCircle, Clock4, AlertTriangle, CalendarCheck2, Repeat, Search, Plus } from "lucide-react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, rectIntersection, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase, supabaseUntyped } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadProfileDialog } from "./LeadProfileDialog";
import { DateTimeBadgePicker } from "./DateTimePicker";

interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  created_at: string;
  updated_at: string | null;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
  nao_respondeu: boolean;
  ultima_mensagem_at: string | null;
}

interface KanbanBoardAcaoProps {
  posts: Post[];
  onRefresh?: () => void;
}

// Status config do kanban de ação com cores solicitadas
const acaoStatusConfig = [
  { 
    name: "Interagindo", 
    headerBgClass: "bg-emerald-600", 
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-green-50/70",
    icon: MessageCircle
  },
  { 
    name: "Não Respondeu", 
    headerBgClass: "bg-orange-500", 
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-amber-50/70",
    icon: Clock4
  },
  { 
    name: "Em Atenção", 
    headerBgClass: "bg-rose-600", 
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-rose-50/70",
    icon: AlertTriangle
  },
  { 
    name: "Interessados em Agendar", 
    headerBgClass: "bg-sky-600", 
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-blue-50/70",
    icon: CalendarCheck2
  },
  { 
    name: "Em Cadência", 
    headerBgClass: "bg-purple-600", 
    counterClass: "bg-white/20 text-white",
    columnBgClass: "bg-purple-50/70",
    icon: Repeat
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

const statusOrder = acaoStatusConfig.map(s => s.name);

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

// Componente TimeCounter para mostrar tempo desde última mensagem
const TimeCounter = ({ post }: { post: Post }) => {
  const [timeElapsed, setTimeElapsed] = useState('');
  const [timeColor, setTimeColor] = useState('text-green-600');
  
  // Referência de tempo: ultima_mensagem_at com fallback para created_at
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
  
  // Mostrar para status de interação que tenham alguma referência de tempo
  const engagementStatuses = ['respondeu', 'interagiu', 'engajou'];
  const showCounter = engagementStatuses.includes(post.status?.toLowerCase() || '') && 
                     referenceTime !== null;
  
  if (!showCounter) return null;
  
  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${timeColor}`}>
      ⏱️ {timeElapsed}
    </div>
  );
};

// Componente DraggableCard
const DraggableCard = ({ post, onClick }: { post: Post; onClick: () => void }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggableDragging,
  } = useDraggable({
    id: post.id,
    disabled: false,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  
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
    const [hours, minutes] = post.horario.split(':');
    return `${hours}:${minutes}`;
  }, [post.horario]);

  const isInterestedInScheduling = ['interessado em agendar consulta', 'interessado em agendar', 'agendou consulta', 'agendado por fora'].includes(post.status?.toLowerCase() || '');
  const hasEngagementStatus = ['respondeu', 'interagiu', 'engajou', 'impecilho', 'cadencia', 'cadência'].includes(post.status?.toLowerCase() || '');
  const engagementStatusLabel = useMemo(() => {
    if (!hasEngagementStatus) return null;
    const status = post.status?.toLowerCase().trim();
    if (status === 'respondeu') return '🔵 Respondeu';
    if (status === 'interagiu') return '🟣 Interagiu';
    if (status === 'engajou') return '🟢 Engajou';
    if (status === 'impecilho') return '🔴 Impecilho';
    // Removido badge de cadência amarelo
    return null;
  }, [post.status, hasEngagementStatus]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card bg-white border border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.08)] cursor-pointer transition-all duration-200 min-h-[90px] lg:min-h-[100px] rounded-2xl ${isDraggableDragging ? 'opacity-40' : 'hover:-translate-y-[3px] hover:shadow-[0_14px_35px_rgba(15,23,42,0.18)]'}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDraggableDragging) onClick();
      }}
    >
        <div className="p-3 h-full flex flex-col gap-2 relative">

          {/* Linha 1: Avatar + Nome + Telefone + bolinhas de status */}
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-sm shadow-sm">
              {getInitials(post.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-slate-900 truncate leading-tight">{post.nome}</h4>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                <Phone className="h-3 w-3 flex-shrink-0 opacity-60" />
                <span className="truncate">{post.telefone || "Sem telefone"}</span>
              </div>
            </div>
            {/* Indicadores de status + TimeCounter */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <TimeCounter post={post} />
              {isInterestedInScheduling && (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Interessado em agendar" />
              )}
            </div>
          </div>

          {/* Linha 2: Info contextual — tratamento, dentista, data/hora */}
          {(post.tratamento || post.dentista || requestedDateDisplay || requestedTimeDisplay) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {post.tratamento && (
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${getTreatmentBadgeClass(post.tratamento)}`}>
                  {post.tratamento}
                </span>
              )}
              {requestedDateDisplay && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-50 text-rose-600 border border-rose-200">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  {requestedDateDisplay}
                </span>
              )}
              {requestedTimeDisplay && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-rose-500 text-white shadow-sm">
                  {requestedTimeDisplay}
                </span>
              )}
              {post.dentista && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {post.dentista}
                </span>
              )}
            </div>
          )}

          {/* Linha 3: Badges de campanha e engajamento */}
          {(post.campanha_nome || (hasEngagementStatus && engagementStatusLabel)) && (
            <div className="flex flex-wrap gap-1.5 pt-0.5 border-t border-gray-100">
              {post.campanha_nome && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600 border border-purple-100">
                  <Target className="h-3 w-3" />
                  {post.campanha_nome}
                </span>
              )}
              {hasEngagementStatus && engagementStatusLabel && (
                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200"
                  title="Lead em processo de engajamento - não pode ser movido">
                  {engagementStatusLabel}
                </span>
              )}
            </div>
          )}

        </div>
    </div>
  );
};

export const KanbanBoardAcao = ({ posts, onRefresh }: { posts: Post[]; onRefresh?: () => void }) => {
  const [localPosts, setLocalPosts] = useState(posts);
  const [selectedLead, setSelectedLead] = useState<Post | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  
  // Add lead dialog state
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState({
    nome: "",
    telefone: "",
    status: "interagiu",
    tratamento: "",
    dentista: "",
    campanha_id: "",
    campanha_nome: ""
  });
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    supabaseUntyped.from('campanhas').select('id, nome').order('nome').then(({ data }) => {
      if (data) setCampanhas(data as { id: string; nome: string }[]);
    });
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Função para verificar se status é de arquivado
  const isArchivedStatus = (status: string): boolean => {
    return status === 'paciente perdido' || 
           status === 'perdido' || 
           status === 'arquivado' ||
           status === 'lead perdido' ||
           status.includes('perdido') ||
           status.includes('arquivado');
  };
  
  const handleOpenProfile = (lead: Post) => {
    setSelectedLead(lead);
  };
  
  const handleCloseProfile = () => {
    setSelectedLead(null);
  };
  
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

      // Se campanha selecionada, inserir em tabela_campanha primeiro para obter o id numérico
      let campanha_id_numerico: number | null = null;
      if (newLead.campanha_id) {
        const { data: campData, error: campError } = await supabaseUntyped
          .from('tabela_campanha')
          .insert({
            nome: newLead.nome.trim(),
            telefone: cleanPhone,
            disparo_feito: true,
            "ID_campanha": newLead.campanha_id
          })
          .select('id')
          .single();
        if (campError) {
          console.error('[ADD-LEAD] Erro ao inserir em tabela_campanha:', campError);
        } else {
          campanha_id_numerico = campData?.id ?? null;
        }
      }

      // Inserir em posts com campanha_id (id numérico) e campanha_nome (ID_campanha texto)
      const { data, error } = await supabase
        .from('posts')
        .insert({
          nome: newLead.nome.trim(),
          telefone: cleanPhone,
          status: newLead.status.trim(),
          tratamento: newLead.tratamento.trim() || null,
          dentista: newLead.dentista.trim() || null,
          campanha_id: campanha_id_numerico,
          campanha_nome: newLead.campanha_id || null,
          created_at: new Date().toISOString()
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
      setNewLead({ nome: "", telefone: "", status: "interagiu", tratamento: "", dentista: "", campanha_id: "", campanha_nome: "" });
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Mapeamento dos nomes das colunas para os status reais no banco
  const columnToStatusMap: Record<string, string> = {
    "Interagindo": "interagiu",
    "Não Respondeu": "nao_respondeu",
    "Em Atenção": "atencao",
    "Interessados em Agendar": "interessado em agendar consulta",
    "Em Cadência": "cadencia"
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const postId = active.id as string;
    const columnName = over.id as string;
    
    // Converter nome da coluna para status do banco
    const newStatus = columnToStatusMap[columnName];
    
    if (!newStatus) {
      console.error("Coluna não mapeada:", columnName);
      setActiveId(null);
      return;
    }

    // Find the post to update
    const post = posts.find(p => p.id === postId);
    if (!post) {
      setActiveId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', postId);

      if (error) throw error;

      toast.success(`Status atualizado para "${newStatus}"!`);
      
      // Forçar refresh imediatamente
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }

    setActiveId(null);
  }, [posts, onRefresh]);

  const activePost = useMemo(() => 
    activeId ? posts.find(p => p.id === activeId) : null,
    [activeId, posts]
  );

  // Lógica de distribuição específica para kanban de ação
  const kanbanColumns = useMemo(() => {
    const agora = new Date();
    const quinzeMinAtras = new Date(agora.getTime() - 20 * 60 * 1000);
    
    // Status de interação (leads que podem ir para "Não Respondeu" se sem resposta há 20min)
    const statusInteracao = ['respondeu', 'interagiu', 'engajou'];
    
    // Inicializar colunas vazias
    const columns = acaoStatusConfig.map(config => ({
      ...config,
      posts: [] as Post[]
    }));

    posts.forEach(post => {
      const normalizedStatus = post.status.toLowerCase().trim();
      
      // 1. PRIMEIRO: verificar status explícitos (prioridade máxima)
      if (normalizedStatus === 'atencao') {
        columns[2].posts.push(post); // Em Atenção
      } else if (normalizedStatus === 'interessado em agendar consulta' || normalizedStatus === 'interessado em agendar' || normalizedStatus === 'agendado por fora') {
        columns[3].posts.push(post); // Interessados em Agendar
      } else if (normalizedStatus === 'cadencia' || normalizedStatus === 'cadência') {
        columns[4].posts.push(post); // Em Cadência
      } else if (normalizedStatus === 'nao_respondeu') {
        // 2. Status explícito nao_respondeu vai para coluna Não Respondeu
        columns[1].posts.push(post); // Não Respondeu
      } else if (statusInteracao.includes(normalizedStatus)) {
        // 3. Status de interação: verificar flag do banco OU inatividade > 20min
        if (post.nao_respondeu) {
          columns[1].posts.push(post); // Flag do banco já marcada
          return;
        }
        const ultimaMensagem = post.ultima_mensagem_at || post.updated_at;
        if (ultimaMensagem) {
          // Parsear como UTC (ultima_mensagem_at é timestamp WITHOUT timezone salvo em UTC)
          const rawStr = String(ultimaMensagem);
          const utcStr = rawStr.endsWith('Z') || rawStr.includes('+') ? rawStr : rawStr + 'Z';
          const dataUltimaMensagem = new Date(utcStr);
          if (dataUltimaMensagem < quinzeMinAtras) {
            columns[1].posts.push(post); // Não Respondeu (sem resposta há 20min+)
          } else {
            columns[0].posts.push(post); // Interagindo (respondeu recentemente)
          }
        } else {
          columns[0].posts.push(post); // Interagindo (sem data de referência)
        }
      }
      // Ignorar arquivados, perdidos e outros status não mapeados
    });

    return columns;
  }, [posts]);

  // Componente DroppableColumn
  const DroppableColumn = ({ column, children }: { 
    column: typeof acaoStatusConfig[0] & { posts: Post[] }; 
    children: React.ReactNode;
  }) => {
    // "Não Respondeu" não pode receber drops, mas cards podem sair dela
    const isDroppable = column.name !== "Não Respondeu";
    const { setNodeRef, isOver } = useDroppable({
      id: column.name,
      disabled: !isDroppable,
    });

    return (
      <div key={column.name} className="space-y-3">
        {/* Column Header - novo estilo CRM */}
        <div className={`${column.headerBgClass} text-white px-4 py-2.5 rounded-t-2xl flex items-center justify-between gap-2 shadow-sm`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {column.icon && (
              <div className="bg-white/15 rounded-full p-1.5 flex items-center justify-center">
                <column.icon className="h-4 w-4" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="font-semibold text-[13px] leading-tight truncate" title={column.name}>
                {column.name}
                {!isDroppable && <span className="text-xs opacity-75 ml-1">(bloqueado para receber)</span>}
              </h3>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${column.counterClass} flex-shrink-0 min-w-[32px] text-center`}>
            {column.posts.length}
          </span>
        </div>

        {/* Column Content - mesmo estilo com scroll */}
        <div 
          ref={isDroppable ? setNodeRef : undefined}
          className={`h-full max-h-[calc(100vh-420px)] ${column.columnBgClass} rounded-b-lg p-3 space-y-3 overflow-y-auto overflow-x-hidden scroll-smooth transition-colors ${isOver && isDroppable ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        >
          {children}
        </div>
      </div>
    );
  };

  // Componente SearchableColumn para busca local
  const SearchableColumn = ({ column }: { column: typeof acaoStatusConfig[0] & { posts: Post[] } }) => {
    // "Não Respondeu" não pode receber drops, mas cards podem sair dela
    const isDroppable = column.name !== "Não Respondeu";
    const { setNodeRef, isOver } = useDroppable({
      id: column.name,
      disabled: !isDroppable,
    });

    // Filtrar posts baseado no termo de busca global
    const filteredPosts = useMemo(() => {
      if (!globalSearchTerm.trim()) return column.posts;
      
      const searchLower = globalSearchTerm.toLowerCase();
      return column.posts.filter(post => 
        post.nome.toLowerCase().includes(searchLower) ||
        post.telefone?.toLowerCase().includes(searchLower) ||
        post.tratamento?.toLowerCase().includes(searchLower) ||
        post.dentista?.toLowerCase().includes(searchLower) ||
        post.status?.toLowerCase().includes(searchLower)
      );
    }, [column.posts, globalSearchTerm]);

    return (
      <div className="min-w-0 kanban-column flex flex-col">
        <div className={`${column.headerBgClass} text-white px-4 py-2.5 rounded-t-2xl flex items-center justify-between gap-2 shadow-sm`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {column.icon && (
              <div className="bg-white/15 rounded-full p-1.5 flex items-center justify-center">
                <column.icon className="h-4 w-4" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="font-semibold text-[13px] leading-tight truncate" title={column.name}>
                {column.name}
                {!isDroppable && <span className="text-xs opacity-75 ml-1">(bloqueado para receber)</span>}
              </h3>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${column.counterClass} flex-shrink-0 min-w-[32px] text-center`}>
            {filteredPosts.length}{globalSearchTerm && `/${column.posts.length}`}
          </span>
        </div>
        
        <div 
          ref={isDroppable ? setNodeRef : undefined}
          className={`kanban-column-scroll space-y-2.5 p-2.5 rounded-b-2xl border border-t-0 border-slate-200 ${column.columnBgClass} backdrop-blur-[2px] overflow-y-auto overflow-x-hidden scroll-smooth transition-colors min-h-[120px] max-h-[calc(100vh-420px)] ${isOver && isDroppable ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        >
          {column.posts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="w-8 h-8 mx-auto mb-2 opacity-50 rounded-full bg-slate-200"></div>
              <p className="text-xs">Nenhum lead nesta coluna</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
              <DraggableCard key={post.id} post={post} onClick={() => handleOpenProfile(post)} />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={rectIntersection} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Barra de busca e ações */}
        <div className="px-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/30 p-3 backdrop-blur-2xl shadow-[0_20px_60px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex-1 min-w-[280px]">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar em todas as colunas..."
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  className="pl-10 h-10 text-sm bg-white/90 border-gray-200 focus:border-blue-300 shadow-sm"
                />
                {globalSearchTerm && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                    {kanbanColumns.flatMap(col => col.posts).filter(post => 
                      post.nome.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                      post.telefone?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                      post.tratamento?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                      post.dentista?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                      post.status?.toLowerCase().includes(globalSearchTerm.toLowerCase())
                    ).length} resultados
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAddLeadDialog(true)}
                className="gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Inserir Lead
              </Button>
            </div>
          </div>
        </div>
        
        {/* Kanban Columns - mesma estrutura do KanbanBoard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full items-start">
          {kanbanColumns.map((column) => (
            <SearchableColumn key={column.name} column={column} />
          ))}
        </div>
        
        <DragOverlay>
          {activePost ? (
            <div className="bg-white border-2 border-blue-400 rounded-xl shadow-2xl p-3 opacity-90">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-xs">
                  {getInitials(activePost.nome)}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{activePost.nome}</h4>
                  <p className="text-xs text-gray-500">{activePost.telefone}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
        
        <LeadProfileDialog
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={handleCloseProfile}
          onUpdate={() => {
            handleCloseProfile();
            if (onRefresh) onRefresh();
          }}
        />
        
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

              <div className="space-y-2">
                <Label htmlFor="lead-campanha" className="text-sm font-medium text-gray-700">
                  Campanha (Opcional)
                </Label>
                <select
                  id="lead-campanha"
                  value={newLead.campanha_id}
                  onChange={(e) => {
                    const selected = campanhas.find(c => c.id === e.target.value);
                    setNewLead(prev => ({
                      ...prev,
                      campanha_id: e.target.value,
                      campanha_nome: selected?.nome || ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Nenhuma campanha</option>
                  {campanhas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
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
      </div>
    </DndContext>
  );
};
