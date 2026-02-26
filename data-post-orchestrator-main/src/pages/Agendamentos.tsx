import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgendamentos, exportToGoogleSheets, type Agendamento } from "@/lib/agendamentoApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Home,
  Calendar,
  LayoutGrid,
  CalendarDays,
  Phone,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Clock,
  User,
  UserCheck,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Upload,
  AlertCircle,
  Mail,
  FileText,
  Users,
  Columns,
  Target,
  Search,
  Trash,
  Trash2
} from 'lucide-react';
import { toast } from "sonner";
import { startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval } from "date-fns";
import { DateTimePicker } from "@/components/DateTimePicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ManualPatientForm from "@/components/ManualPatientForm";
import LeadProfileDialog from "@/components/LeadProfileDialog";
import { deleteAgendamentoWithPosts, confirmDeleteAgendamento } from "@/lib/deleteAgendamentoRPC";


// Estilos CSS customizados para scrollbar
const customScrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 2px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 2px;
    transition: background 0.2s ease;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
  
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }
`;

const meshBackground = {
  backgroundImage: `
    radial-gradient(circle at 20% 25%, rgba(56,189,248,0.35), transparent 45%),
    radial-gradient(circle at 75% 15%, rgba(59,130,246,0.32), transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(14,165,233,0.25), transparent 55%),
    linear-gradient(120deg, #f5f9ff, #eef3ff, #f7fbff)
  `
};


const Agendamentos = () => {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [posts, setPosts] = useState<any[]>([]); // Adicionado para buscar posts com status 'reagendando'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'kanban'>('calendar');
  const [calendarStyle, setCalendarStyle] = useState<'weekly' | 'monthly'>('monthly');
  const [visibleWeekDays, setVisibleWeekDays] = useState<boolean[]>([false, true, true, true, true, true, false]); // Domingo a Sábado - desativado fim de semana
  const [dentistFilter, setDentistFilter] = useState<string>("all");
  const [treatmentFilter, setTreatmentFilter] = useState<string>("all");
  const [showManualPatientModal, setShowManualPatientModal] = useState(false);
  const [showLeadProfileModal, setShowLeadProfileModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    checkAuth();
    loadAgendamentos();
    setupRealtimeSubscription();
    
    // Injetar estilos CSS customizados para scrollbar
    const styleElement = document.createElement('style');
    styleElement.textContent = customScrollbarStyles;
    document.head.appendChild(styleElement);
    
    // Cleanup function para remover os estilos quando o componente for desmontado
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  
  // Escutar evento customizado para abrir modal do LeadProfileDialog
  useEffect(() => {
    const handleOpenLeadProfile = (event: any) => {
      const { lead, agendamento } = event.detail;
      setSelectedLead(lead);
      setShowLeadProfileModal(true);
    };

    window.addEventListener('openLeadProfile', handleOpenLeadProfile);
    return () => {
      window.removeEventListener('openLeadProfile', handleOpenLeadProfile);
    };
  }, []);

  const uniqueDentistas = useMemo(
    () => Array.from(new Set(agendamentos.map((a) => a.dentista).filter(Boolean))) as string[],
    [agendamentos]
  );

  const uniqueTratamentos = useMemo(
    () => Array.from(new Set(agendamentos.map((a) => a.tratamento).filter(Boolean))) as string[],
    [agendamentos]
  );

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((agendamento) => {
      if (dentistFilter !== "all" && agendamento.dentista !== dentistFilter) return false;
      if (treatmentFilter !== "all" && agendamento.tratamento !== treatmentFilter) return false;
      return true;
    });
  }, [agendamentos, dentistFilter, treatmentFilter]);
  const displayedAgendamentos = filteredAgendamentos;

  const checkAuth = async () => {
    // REMOVIDO: Já verificado pelo AuthGuard
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) {
    //   navigate('/auth');
    // }
    console.log('[Agendamentos] checkAuth - pulando verificação (AuthGuard já cuida disso)');
  };

  const loadAgendamentos = async () => {
    try {
      // Carregar agendamentos e posts em paralelo
      const [agendamentosData, postsData] = await Promise.all([
        fetchAgendamentos(),
        fetchPosts()
      ]);
      
      setAgendamentos(agendamentosData || []);
      setPosts(postsData || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Erro ao buscar posts:", error);
      return [];
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('agendamento-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamento'
        },
        () => {
          loadAgendamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAgendamentos();
  };

  const handleExportCSV = async () => {
    try {
      const data = await fetchAgendamentos();

      // Create CSV content
      const headers = ['Nome', 'Data', 'Horario', 'Telefone', 'Dentista'];
      const csvContent = [
        headers.join(','),
        ...(data || []).map(row => 
          [
            `"${row.nome || ''}"`,
            `"${row.data ? new Date(row.data).toLocaleDateString('pt-BR') : ''}"`,
            `"${row.horario || ''}"`,
            `"${row.telefone || ''}"`,
            `"${row.dentista || ''}"`
          ].join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `agendamentos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Erro ao exportar CSV');
    }
  };

  const handleDeleteAgendamento = async (agendamento: Agendamento) => {
    if (confirmDeleteAgendamento(agendamento)) {
      const success = await deleteAgendamentoWithPosts(agendamento.id);
      if (success) {
        // Recarregar os agendamentos após deleção
        await loadAgendamentos();
      }
    }
  };

  // Componente KanbanView - Kanban de agendamentos
  const KanbanView = () => {
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
    const [presenceLoadingIds, setPresenceLoadingIds] = useState<Set<string>>(new Set());
    const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
    
    const toggleCardExpansion = (cardId: string) => {
      setExpandedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else {
          newSet.add(cardId);
        }
        return newSet;
      });
    };
    
    const openAgendamentoModal = (agendamento: Agendamento) => {
      setSelectedAgendamento(agendamento);
    };
    
    const closeAgendamentoModal = () => {
      setSelectedAgendamento(null);
    };
    
    const handleUpdateConfirmacao = async (agendamentoId: string, confirmado: boolean) => {
      setLoadingStates(prev => new Set(prev).add(agendamentoId));
      try {
        const { error } = await supabase
          .from('agendamento')
          .update({ confirmado })
          .eq('id', agendamentoId);

        if (error) throw error;

        setAgendamentos(prev => prev.map(item => 
          item.id === agendamentoId ? { ...item, confirmado } : item
        ));
        
        toast.success(confirmado ? 'Agendamento confirmado!' : 'Confirmação removida');
      } catch (error) {
        console.error('Error updating confirmation:', error);
        toast.error('Erro ao atualizar confirmação');
      } finally {
        setLoadingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(agendamentoId);
          return newSet;
        });
      }
    };
    
    const handleUpdatePresenca = async (agendamentoId: string, presenca: string) => {
      setPresenceLoadingIds(prev => new Set(prev).add(agendamentoId));
      try {
        const { error } = await supabase
          .from('agendamento')
          .update({ presenca })
          .eq('id', agendamentoId);

        if (error) throw error;

        setAgendamentos(prev => prev.map(item => 
          item.id === agendamentoId ? { ...item, presenca } : item
        ));
        
        const message = presenca === 'compareceu' ? 'Presença confirmada!' : 'Marcado como não compareceu';
        toast.success(message);
      } catch (error) {
        console.error('Error updating presence:', error);
        toast.error('Erro ao atualizar presença');
      } finally {
        setPresenceLoadingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(agendamentoId);
          return newSet;
        });
      }
    };
    
    // Filtrar agendamentos para cada coluna
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Agendados para hoje (azul)
    const agendadosHoje = useMemo(() => {
      return agendamentos.filter(agendamento => {
        if (!agendamento.data_marcada) return false;
        const agendamentoDate = new Date(agendamento.data_marcada);
        // Excluir leads que já compareceram ou não compareceram
        if (agendamento.presenca === 'compareceu' || agendamento.presenca === 'Não compareceu') return false;
        return agendamentoDate >= today && agendamentoDate < tomorrow;
      });
    }, [agendamentos]);
    
    // Compareceram (verde) - apenas de hoje
    const compareceram = useMemo(() => {
      return agendamentos.filter(agendamento => {
        if (!agendamento.data_marcada) return false;
        const agendamentoDate = new Date(agendamento.data_marcada);
        return agendamento.presenca === 'compareceu' && agendamentoDate >= today && agendamentoDate < tomorrow;
      });
    }, [agendamentos]);
    
    // Não compareceram (vermelho) - apenas de hoje
    const naoCompareceram = useMemo(() => {
      return agendamentos.filter(agendamento => {
        if (!agendamento.data_marcada) return false;
        const agendamentoDate = new Date(agendamento.data_marcada);
        return agendamento.presenca === 'Não compareceu' && agendamentoDate >= today && agendamentoDate < tomorrow;
      });
    }, [agendamentos]);
    
    // Reagendamentos (baseado em posts com status 'reagendando')
    const reagendamentos = useMemo(() => {
      // Buscar posts com status 'reagendando' e seus agendamentos correspondentes
      return agendamentos.filter(agendamento => {
        return posts.some(post => 
          post.agendamento_id === agendamento.id && 
          post.status === 'reagendando'
        );
      });
    }, [agendamentos, posts]);

    // Função para filtrar agendamentos por termo de pesquisa
    const filterAgendamentos = (agendamentos: Agendamento[], term: string) => {
      if (!term.trim()) return agendamentos;
      
      const lowerTerm = term.toLowerCase();
      return agendamentos.filter(agendamento => 
        agendamento.nome.toLowerCase().includes(lowerTerm) ||
        (agendamento.telefone && agendamento.telefone.includes(term)) ||
        (agendamento.dentista && agendamento.dentista.toLowerCase().includes(lowerTerm)) ||
        (agendamento.tratamento && agendamento.tratamento.toLowerCase().includes(lowerTerm))
      );
    };
    
    const kanbanV2Columns = [
      {
        id: 'agendados',
        title: 'Agendados',
        subtitle: `Para hoje - ${format(new Date(), "dd/MM/yyyy")}`,
        color: 'bg-blue-500',
        bgColor: 'bg-blue-50',
        icon: Calendar,
        agendamentos: filterAgendamentos(agendadosHoje, searchTerm)
      },
      {
        id: 'compareceram',
        title: 'Compareceram',
        subtitle: `Presentes hoje - ${format(new Date(), "dd/MM/yyyy")}`,
        color: 'bg-green-500',
        bgColor: 'bg-green-50',
        icon: UserCheck,
        agendamentos: filterAgendamentos(compareceram, searchTerm)
      },
      {
        id: 'nao-compareceram',
        title: 'Não Compareceram',
        subtitle: `Ausentes hoje - ${format(new Date(), "dd/MM/yyyy")}`,
        color: 'bg-red-500',
        bgColor: 'bg-red-50',
        icon: XCircle,
        agendamentos: filterAgendamentos(naoCompareceram, searchTerm)
      },
      {
        id: 'reagendamentos',
        title: 'Reagendamentos',
        subtitle: 'Leads em processo de remarcação',
        color: 'bg-purple-500',
        bgColor: 'bg-purple-50',
        icon: CalendarDays,
        agendamentos: filterAgendamentos(reagendamentos, searchTerm)
      }
    ];

    return (
      <>
        <div className="rounded-[32px] border border-white/35 bg-white/25 p-6 shadow-[0_40px_120px_-60px_rgba(7,12,28,0.9)] backdrop-blur-[24px]">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Kanban de agendamentos</h3>
            <p className="text-sm text-slate-500 mb-4">Organização de agendamentos por categorias</p>
            
            {/* Campo de pesquisa */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone, dentista ou tratamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kanbanV2Columns.map((column) => {
              const Icon = column.icon;
              return (
                <div key={column.id} className={`flex flex-col h-full ${
                    column.id === 'reagendamentos' && column.agendamentos.length > 0 
                      ? 'animate-pulse' 
                      : ''
                  }`}>
                  <div className={`${column.color} rounded-t-xl p-4 flex flex-col gap-2`}>
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-white" />
                      <h4 className="font-semibold text-white">{column.title}</h4>
                      <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                        {column.agendamentos.length}
                      </span>
                    </div>
                    <p className="text-white/80 text-xs">{column.subtitle}</p>
                  </div>
                  <div className={`${column.bgColor} rounded-b-xl p-4 flex-1 min-h-[400px] max-h-[500px] border ${
                    column.id === 'reagendamentos' && column.agendamentos.length > 0 
                      ? 'border-purple-400 shadow-lg shadow-purple-200/50' 
                      : 'border-gray-200'
                  }`}>
                    <div className="space-y-2 overflow-y-auto max-h-[420px] custom-scrollbar">
                      {column.agendamentos.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                          <div className="text-sm">
                            Nenhum agendamento nesta coluna
                          </div>
                        </div>
                      ) : (
                        column.agendamentos.map((agendamento) => {
                          const cardId = `kanban-${agendamento.id}`;
                          const isExpanded = expandedCards.has(cardId);
                          
                          // Encontrar o post correspondente para coluna reagendamentos
                          const postCorrespondente = column.id === 'reagendamentos' ? posts.find(post => 
                            post.agendamento_id === agendamento.id && post.status === 'reagendando'
                          ) : null;
                          
                          // Se for coluna reagendamentos e tiver post correspondente, usa estilo CRM
                          if (column.id === 'reagendamentos' && postCorrespondente) {
                            const getInitials = (nome: string) => {
                              return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                            };
                            
                            return (
                              <div
                                key={agendamento.id}
                                onClick={() => {
                                  // Abrir modal do LeadProfileDialog com o post correspondente
                                  if (postCorrespondente) {
                                    // Criar um evento customizado para abrir o modal do CRM
                                    const event = new CustomEvent('openLeadProfile', { 
                                      detail: { 
                                        lead: postCorrespondente,
                                        agendamento: agendamento 
                                      } 
                                    });
                                    window.dispatchEvent(event);
                                  }
                                }}
                                className="kanban-card bg-white border border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.08)] cursor-pointer transition-all duration-200 min-h-[120px] lg:min-h-[140px] rounded-2xl hover:-translate-y-[3px] hover:shadow-[0_14px_35px_rgba(15,23,42,0.18)]"
                              >
                                <div className="p-3.5 h-full flex flex-col gap-1.5 relative">
                                  {/* Indicador de status */}
                                  <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse z-10" title="Reagendando" />
                                  
                                  <div className="flex items-start gap-2.5 flex-1">
                                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 text-white flex items-center justify-center font-semibold text-xs shadow-md">
                                      {getInitials(postCorrespondente.nome)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex flex-col">
                                      <h4 className="font-semibold text-[15px] text-slate-900 truncate leading-tight">{postCorrespondente.nome}</h4>
                                      
                                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                                        <Phone className="h-3 w-3 flex-shrink-0 opacity-70" />
                                        <span className="truncate">{postCorrespondente.telefone || "Sem telefone"}</span>
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {postCorrespondente.tratamento && (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] h-5 font-semibold px-2 rounded-full border-0">
                                            {postCorrespondente.tratamento}
                                          </Badge>
                                        )}
                                        <Badge className="bg-purple-100 text-purple-700 text-[10px] h-5 font-semibold px-2 rounded-full border-0">
                                          <Target className="h-3 w-3 mr-1" />
                                          Reagendando
                                        </Badge>
                                      </div>
                                      
                                      {/* Informações do agendamento */}
                                      {agendamento.data_marcada && (
                                        <div className="mt-1.5 rounded-xl border border-purple-200 bg-purple-50 px-2.5 py-2 text-purple-900 shadow-inner">
                                          <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Clock className="h-4 w-4 flex-shrink-0 text-purple-500" />
                                            Última consulta
                                          </div>
                                          <p className="text-xs text-purple-700 mt-1">
                                            {format(new Date(agendamento.data_marcada), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                          </p>
                                          {agendamento.dentista && (
                                            <p className="text-xs text-purple-800 mt-1">
                                              Dentista: <span className="font-semibold">{agendamento.dentista}</span>
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Feedback do post */}
                                      {postCorrespondente.feedback && (
                                        <div className="mt-1.5 text-xs text-slate-600 italic">
                                          "{postCorrespondente.feedback}"
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Definir cores baseadas no status para a coluna Agendados
                          const getCardColors = () => {
                            if (column.id === 'agendados') {
                              if (agendamento.confirmado === null && agendamento.presenca === null) {
                                return { container: 'bg-amber-50 border-amber-200', heading: 'text-amber-900', status: 'Pendente', statusColor: 'bg-amber-100 text-amber-800' }; // Amarelo para pendente
                              } else if (agendamento.confirmado === true && agendamento.presenca === null) {
                                return { container: 'bg-emerald-50 border-emerald-200', heading: 'text-emerald-900', status: 'Confirmado', statusColor: 'bg-emerald-100 text-emerald-800' }; // Verde para confirmado
                              } else if (agendamento.confirmado === false && agendamento.presenca === null) {
                                return { container: 'bg-red-50 border-red-200', heading: 'text-red-900', status: 'Não Confirmado', statusColor: 'bg-red-100 text-red-800' }; // Vermelho para não confirmado
                              } else if (agendamento.presenca === 'Não compareceu') {
                                return { container: 'bg-red-50 border-red-200', heading: 'text-red-900', status: 'Não Compareceu', statusColor: 'bg-red-100 text-red-800' }; // Vermelho para não compareceu
                              }
                            }
                            return { container: 'bg-white border-gray-200', heading: 'text-gray-900', status: null, statusColor: '' }; // Padrão para outras colunas
                          };
                          
                          const cardColors = getCardColors();
                          
                          return (
                            <div
                              key={agendamento.id}
                              onClick={() => openAgendamentoModal(agendamento)}
                              className={`rounded-lg cursor-pointer transition-all duration-300 ${cardColors.container} border shadow-sm hover:shadow-md`}
                              title={`Clique para ver detalhes de ${agendamento.nome}`}
                            >
                              <div className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className={`font-semibold text-sm ${cardColors.heading} truncate`}>
                                    {agendamento.nome}
                                  </h5>
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(agendamento.data_marcada), "HH:mm", { locale: ptBR })}
                                  </span>
                                </div>
                                
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600 truncate">
                                    📞 {agendamento.telefone || "Sem telefone"}
                                  </p>
                                  {agendamento.dentista && (
                                    <p className="text-xs text-gray-600 truncate">
                                      👨‍⚕️ {agendamento.dentista}
                                    </p>
                                  )}
                                  {agendamento.tratamento && (
                                    <p className="text-xs text-gray-600 truncate">
                                      🔧 {agendamento.tratamento}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Badge de status no canto inferior direito */}
                                {cardColors.status && (
                                  <div className="flex justify-end mt-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cardColors.statusColor}`}>
                                      {cardColors.status}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Modal de detalhes do agendamento */}
        {selectedAgendamento && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <div className="absolute inset-0 bg-black/50" onClick={closeAgendamentoModal} />
            <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedAgendamento.nome}
                    </h2>
                    <p className="text-blue-100 mt-1">
                      {format(new Date(selectedAgendamento.data_marcada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={closeAgendamentoModal}
                    className="p-2 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Telefone:</span>
                      <p className="text-gray-600">{selectedAgendamento.telefone || "Não informado"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Dentista:</span>
                      <p className="text-gray-600">{selectedAgendamento.dentista || "Não definido"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Tratamento:</span>
                      <p className="text-gray-600">{selectedAgendamento.tratamento || "Não informado"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Origem:</span>
                      <p className="text-gray-600">
                        {selectedAgendamento.source === 'codefy' ? 'Codefy' : 
                         selectedAgendamento.source === 'campanha' ? 'Campanha' : 'Urna'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Seletores de status */}
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Status de Confirmação</label>
                      <select
                        value={selectedAgendamento.confirmado === null ? 'pendente' : selectedAgendamento.confirmado ? 'confirmado' : 'nao-confirmado'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'pendente') {
                            handleUpdateConfirmacao(selectedAgendamento.id, null);
                            setSelectedAgendamento(prev => prev ? { ...prev, confirmado: null } : null);
                          } else {
                            handleUpdateConfirmacao(selectedAgendamento.id, value === 'confirmado');
                            setSelectedAgendamento(prev => prev ? { ...prev, confirmado: value === 'confirmado' } : null);
                          }
                        }}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="nao-confirmado">Não Confirmado</option>
                        <option value="confirmado">Confirmado</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Status de Presença</label>
                      <select
                        value={selectedAgendamento.presenca || 'pendente'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'pendente') {
                            handleUpdatePresenca(selectedAgendamento.id, null);
                            setSelectedAgendamento(prev => prev ? { ...prev, presenca: null } : null);
                          } else {
                            handleUpdatePresenca(selectedAgendamento.id, value);
                            setSelectedAgendamento(prev => prev ? { ...prev, presenca: value } : null);
                          }
                        }}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="compareceu">Compareceu</option>
                        <option value="Não compareceu">Não Compareceu</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

  const handleExportToSheets = async () => {
    try {
      setExporting(true);
      await exportToGoogleSheets();
      toast.success("Dados exportados para Google Sheets!");
    } catch (error) {
      console.error("Erro ao exportar para Google Sheets:", error);
      toast.error("Erro ao exportar para Google Sheets");
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateDataMarcada = async (id: string, date: Date | null) => {
    try {
      console.log(`[${new Date().toISOString()}] [AGENDAMENTOS] 📝 Atualizando data marcada do agendamento ${id} para:`, date?.toISOString());
      
      // Fazer o PATCH real no banco
      const { data, error } = await supabase
        .from('agendamento')
        .update({ 
          data_marcada: date?.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`[${new Date().toISOString()}] [AGENDAMENTOS] ❌ Erro no PATCH:`, error);
        throw error;
      }

      console.log(`[${new Date().toISOString()}] [AGENDAMENTOS] ✅ PATCH realizado com sucesso:`, data);
      
      // Atualizar o estado local imediatamente para feedback instantâneo
      setAgendamentos(prev => prev.map(agenda => 
        agenda.id === id 
          ? { ...agenda, data_marcada: date?.toISOString(), updated_at: new Date().toISOString() }
          : agenda
      ));
      
      // Recarregar para garantir consistência
      await loadAgendamentos();
      
      toast.success("Data e horário atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar data marcada:", error);
      toast.error("Erro ao atualizar data marcada");
    }
  };

  const CalendarView = () => {
    const getPersistedCalendarDate = () => {
      if (typeof window === 'undefined') return new Date();
      const stored = localStorage.getItem('agendamentos_calendar_date');
      if (!stored) return new Date();
      const parsed = new Date(stored);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const [currentDate, setCurrentDate] = useState<Date>(() => getPersistedCalendarDate());
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [expandedDay, setExpandedDay] = useState<Date | null>(null);
    const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set()); // Estado para loading individual
    const [presenceLoadingIds, setPresenceLoadingIds] = useState<Set<string>>(new Set());
    
    const weekNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    useEffect(() => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('agendamentos_calendar_date', currentDate.toISOString());
    }, [currentDate]);
    
    useEffect(() => {
      if (typeof document === 'undefined') return;
      if (!expandedDay) return;
      
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [expandedDay]);
    
    const getAgendamentoDateTime = (agendamento: Agendamento): Date | null => {
      if (!agendamento.data_marcada) return null;
      const parsed = new Date(agendamento.data_marcada);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const getAgendamentoHorarioTexto = (agendamento: Agendamento) => {
      const dateTime = getAgendamentoDateTime(agendamento);
      if (dateTime) return format(dateTime, 'HH:mm');
      return agendamento.horario || '--:--';
    };
    
    const getPresenceVisuals = (agendamento: Agendamento) => {
      if (agendamento.presenca === "Compareceu") {
        return { container: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Compareceu' };
      }
      if (agendamento.presenca === "Não compareceu") {
        return { container: 'bg-red-50 border-red-200 text-red-700', label: 'Faltou' };
      }
      if (agendamento.confirmado) {
        return { container: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Confirmado' };
      }
      return { container: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Pendente' };
    };
    
    const getStatusBadgeStyles = (agendamento: Agendamento) => {
      if (agendamento.presenca === "Compareceu") {
        return { label: "Compareceu", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      }
      if (agendamento.presenca === "Não compareceu") {
        return { label: "Não compareceu", classes: "bg-rose-50 text-rose-700 border-rose-200" };
      }
      if (agendamento.confirmado) {
        return { label: "Confirmado", classes: "bg-blue-50 text-blue-700 border-blue-200" };
      }
      return { label: "Pendente", classes: "bg-amber-50 text-amber-700 border-amber-200" };
    };

    const sortAgendamentosByDataMarcada = (items: Agendamento[]) => {
      return [...items].sort((a, b) => {
        const dateA = getAgendamentoDateTime(a);
        const dateB = getAgendamentoDateTime(b);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateA.getTime() - dateB.getTime();
      });
    };

    // Função para atualizar presença do agendamento
    const updatePresenca = async (agendamentoId: string, presenca: "Compareceu" | "Não compareceu" | null) => {
      try {
        const { error } = await supabase
          .from('agendamento')
          .update({ presenca })
          .eq('id', agendamentoId);

        if (error) throw error;

        setAgendamentos(prev =>
          prev.map(agg => (agg.id === agendamentoId ? { ...agg, presenca } : agg))
        );

        toast.success('Presença atualizada com sucesso');
      } catch (error) {
        console.error('Error updating presenca:', error);
        toast.error('Erro ao atualizar presença');
      }
    };

    const handlePresenceSelection = async (agendamentoId: string, value: "Compareceu" | "Não compareceu" | null, current?: string | null) => {
      if (current === value) return;
      setPresenceLoadingIds(prev => new Set(prev).add(agendamentoId));
      try {
        await updatePresenca(agendamentoId, value);
      } finally {
        setPresenceLoadingIds(prev => {
          const next = new Set(prev);
          next.delete(agendamentoId);
          return next;
        });
      }
    };

    // Função para atualizar o source do agendamento
    const updateSource = async (agendamentoId: string, source: string | null) => {
      try {
        const { error } = await supabase
          .from('agendamento')
          .update({ 
            source,
            updated_at: new Date().toISOString()
          })
          .eq('id', agendamentoId);

        if (error) throw error;

        setAgendamentos(prev => prev.map(agg => 
          agg.id === agendamentoId ? { ...agg, source } : agg
        ));

        toast.success(source === 'codefy' ? 'Codefy' : 'Removido Codefy');
      } catch (error) {
        console.error('Error updating source:', error);
        toast.error('Erro ao atualizar origem do agendamento');
      } finally {
        setLoadingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(agendamentoId);
          return newSet;
        });
      }
    };
    
    const toggleCardExpansion = (cardId: string) => {
      setExpandedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else {
          newSet.add(cardId);
        }
        return newSet;
      });
    };
    
    const getAgendamentosForDay = (day: Date) => {
      return filteredAgendamentos.filter(agendamento => {
        const targetDate = getAgendamentoDateTime(agendamento);
        if (!targetDate) return false;

        const isSameDay = targetDate.toDateString() === day.toDateString();

        return isSameDay;
      });
    };
    
    
    const MonthlyView = () => {
      const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      };
      
      const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
      };
      
      const daysInMonth = getDaysInMonth(currentDate);
      const firstDay = getFirstDayOfMonth(currentDate);
      const days = [];
      
      // Add empty cells for days before month starts
      for (let i = 0; i < firstDay; i++) {
        days.push(null);
      }
      
      // Add days of month
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }
      
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="border-white/60 bg-white/80 text-slate-700 hover:bg-white"
            >
              ←
            </Button>
            <h3 className="text-xl font-semibold text-slate-800">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="border-white/60 bg-white/80 text-slate-700 hover:bg-white"
            >
              →
            </Button>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}
            
            {days.map((day, index) => {
              const dayDate = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
              const dayAgendamentos = dayDate ? sortAgendamentosByDataMarcada(getAgendamentosForDay(dayDate)) : [];
              const isToday = dayDate && dayDate.toDateString() === new Date().toDateString();
              const hasAgendamentos = dayAgendamentos.length > 0;
              
              const handleDayClick = () => {
                if (!dayDate || !hasAgendamentos) return;
                const alreadyOpen = expandedDay?.toDateString() === dayDate.toDateString();
                setExpandedDay(alreadyOpen ? null : dayDate);
              };
              
              return (
                <div
                  key={index}
                  onClick={hasAgendamentos ? handleDayClick : undefined}
                  className={`min-h-[80px] rounded-lg border ${
                    day ? 'border-white/40 bg-white/70' : 'border-transparent'
                  } p-2 ${isToday ? 'ring-2 ring-blue-400' : ''} ${
                    hasAgendamentos ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''
                  }`}
                  title={hasAgendamentos && dayDate ? `Ver detalhes de ${format(dayDate, 'dd/MM')}` : undefined}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                        {day}
                      </div>
                      <div className="mt-1 space-y-1">
                        {dayAgendamentos.slice(0, 3).map((agendamento, i) => {
                          const presenceVisual = getPresenceVisuals(agendamento);
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[11px] ${presenceVisual.container}`}
                              title={`${agendamento.nome} • ${agendamento.dentista || 'Sem dentista'}`}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-semibold">{getAgendamentoHorarioTexto(agendamento)}</span>
                                <span className="truncate max-w-[80px]">{agendamento.nome.split(' ')[0]}</span>
                              </div>
                              <span className="text-[10px] font-medium whitespace-nowrap">{presenceVisual.label}</span>
                            </div>
                          );
                        })}
                        {dayAgendamentos.length > 3 && (
                          <div className="text-xs text-slate-500 font-medium">
                            +{dayAgendamentos.length - 3} agend.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    
    const WeeklyView = () => {
      const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 0 });
      const endOfCurrentWeek = addDays(startOfCurrentWeek, 6);
      const weekDays = eachDayOfInterval({ start: startOfCurrentWeek, end: endOfCurrentWeek });
      
      const weekNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      // Funções de navegação rápida
      const goToToday = () => setCurrentDate(new Date());
      const goToWeek = (weekNumber: number) => {
        const year = currentDate.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const daysToAdd = (weekNumber - 1) * 7 - firstDayOfYear.getDay();
        const targetDate = new Date(year, 0, 1 + daysToAdd);
        setCurrentDate(targetDate);
      };
      
      // Calcular número da semana atual
      const currentWeekNumber = Math.ceil((startOfCurrentWeek.getTime() - new Date(startOfCurrentWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const totalWeeksInYear = 52;
      
      // Gerar opções de semanas com intervalos de datas
      const weekOptions = Array.from({ length: totalWeeksInYear }, (_, i) => {
        const weekNum = i + 1;
        const year = currentDate.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const daysToAdd = (weekNum - 1) * 7 - firstDayOfYear.getDay();
        const weekStart = new Date(year, 0, 1 + daysToAdd);
        const weekEnd = addDays(weekStart, 6);
        
        return {
          number: weekNum,
          label: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
          start: weekStart,
          end: weekEnd
        };
      });
      
      // Filtrar apenas os dias visíveis
      const filteredWeekDays = weekDays.filter((_, index) => visibleWeekDays[index]);
      const filteredWeekNames = weekNames.filter((_, index) => visibleWeekDays[index]);
      
      const toggleDayVisibility = (dayIndex: number) => {
        setVisibleWeekDays(prev => {
          const newVisible = [...prev];
          newVisible[dayIndex] = !newVisible[dayIndex];
          return newVisible;
        });
      };
      
      const getAgendamentosForDaySorted = (day: Date) => {
        return sortAgendamentosByDataMarcada(getAgendamentosForDay(day));
      };
      
      const weekStats = filteredWeekDays.reduce(
        (acc, day) => {
          const ags = getAgendamentosForDay(day);
          acc.total += ags.length;
          ags.forEach((ag) => {
            if (ag.presenca === "Compareceu") acc.compareceu += 1;
            else if (ag.presenca === "Não compareceu") acc.faltou += 1;
            else if (ag.confirmado) acc.confirmados += 1;
            else acc.pendentes += 1;
          });
          return acc;
        },
        { total: 0, compareceu: 0, faltou: 0, confirmados: 0, pendentes: 0 }
      );
      
      return (
        <div className="space-y-4">
          {/* Controles de Navegação de Semanas */}
          <div className="flex flex-col gap-3">
            {/* Navegação Principal */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, -7))}
                className="border-white/60 bg-white/80 text-slate-700 hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Semana Anterior
              </Button>
              
              <div className="text-center">
                <h3 className="text-xl font-semibold text-slate-800">
                  Semana {currentWeekNumber} de {currentDate.getFullYear()}
                </h3>
                <p className="text-sm text-slate-600">
                  {format(startOfCurrentWeek, 'dd/MM')} a {format(endOfCurrentWeek, 'dd/MM/yyyy')}
                </p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, 7))}
                className="border-white/60 bg-white/80 text-slate-700 hover:bg-white"
              >
                Próxima Semana
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            {/* Navegação Rápida */}
            <div className="flex items-center justify-center gap-4 p-3 bg-white/50 rounded-lg border border-white/40">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                Hoje
              </Button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Ir para semana:</span>
                <select
                  value={currentWeekNumber}
                  onChange={(e) => goToWeek(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {weekOptions.map(week => (
                    <option key={week.number} value={week.number}>
                      {week.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Ano:</span>
                <input
                  type="number"
                  value={currentDate.getFullYear()}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    if (newYear >= 2020 && newYear <= 2030) {
                      const newDate = new Date(currentDate);
                      newDate.setFullYear(newYear);
                      setCurrentDate(newDate);
                    }
                  }}
                  min="2020"
                  max="2030"
                  className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/40 bg-white/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total da semana</p>
              <p className="text-2xl font-semibold text-slate-800">{weekStats.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-emerald-600">Compareceram</p>
              <p className="text-2xl font-semibold text-emerald-700">{weekStats.compareceu}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-blue-600">Confirmados</p>
              <p className="text-2xl font-semibold text-blue-700">{weekStats.confirmados}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-amber-600">Pendentes / Faltaram</p>
              <p className="text-2xl font-semibold text-amber-700">
                {weekStats.pendentes + weekStats.faltou}
                <span className="text-xs text-rose-500 font-medium ml-2">({weekStats.faltou} faltas)</span>
              </p>
            </div>
          </div>
          
          {/* Controles de visibilidade dos dias */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/70 p-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Dias no painel</span>
            <div className="flex flex-wrap gap-1.5">
              {weekNames.map((dayName, index) => (
                <button
                  key={index}
                  onClick={() => toggleDayVisibility(index)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    visibleWeekDays[index]
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                  title={visibleWeekDays[index] ? `Ocultar ${dayName}` : `Mostrar ${dayName}`}
                >
                  {dayName.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
          
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${filteredWeekDays.length}, 1fr)` }}>
            {filteredWeekDays.map((day, originalIndex) => {
              const dayAgendamentos = getAgendamentosForDaySorted(day);
              const isToday = day.toDateString() === new Date().toDateString();
              const filteredIndex = weekDays.findIndex(d => d.toDateString() === day.toDateString());
              
              const daySummary = {
                confirmados: dayAgendamentos.filter(ag => ag.confirmado || ag.presenca === "Compareceu").length,
                pendentes: dayAgendamentos.filter(ag => !ag.confirmado && !ag.presenca).length,
              };
              
              return (
                <div
                  key={originalIndex}
                  className={`rounded-3xl border border-white/50 bg-gradient-to-b from-white/90 to-white/70 p-3 shadow-[0_15px_35px_-25px_rgba(15,23,42,1)] transition-all duration-200 ${
                    isToday ? 'ring-2 ring-blue-300 scale-[1.01]' : 'hover:-translate-y-1'
                  }`}
                >
                  <div
                    className={`mb-4 rounded-2xl border px-3 py-3 text-center ${
                      isToday
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-100 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p className="text-3xl font-bold tracking-tight">{format(day, 'dd')}</p>
                    <p className="text-xs font-medium uppercase tracking-[0.2em]">
                      {weekNames[filteredIndex]}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                      <span>{dayAgendamentos.length} agend.</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-blue-600">{daySummary.confirmados} conf.</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-amber-600">{daySummary.pendentes} pend.</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 overflow-y-auto max-h-[420px] custom-scrollbar pr-1">
                    {dayAgendamentos.map((agendamento, i) => {
                      const cardId = `${agendamento.id}-${format(day, 'dd/MM')}`;
                      const isExpanded = expandedCards.has(cardId);
                      const compareceu = agendamento.presenca === "Compareceu";
                      const naoCompareceu = agendamento.presenca === "Não compareceu";
                      const statusBadge = getStatusBadgeStyles(agendamento);
                      
                      const palette = compareceu
                        ? { container: 'bg-emerald-50 border-emerald-200', heading: 'text-emerald-900', sub: 'text-emerald-700' }
                        : naoCompareceu
                          ? { container: 'bg-rose-50 border-rose-200', heading: 'text-rose-900', sub: 'text-rose-700' }
                          : { container: 'bg-amber-50 border-amber-200', heading: 'text-amber-900', sub: 'text-amber-700' };
                      
                      const cardVisualClasses = `${palette.container} ${isExpanded ? 'ring-1 ring-white/40' : ''}`;
                      
                      return (
                        <div
                          key={i}
                          onClick={() => setExpandedDay(expandedDay?.toDateString() === day.toDateString() ? null : day)}
                          className={`rounded-2xl cursor-pointer transition-all duration-300 ${cardVisualClasses} shadow-[0_15px_35px_-35px_rgba(15,23,42,1)]`}
                          title={`Clique para ver todos os detalhes de ${agendamento.nome} - ${format(day, 'dd/MM')}`}
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-white/60 px-4 py-3">
                            <div>
                              <p className={`text-sm font-semibold ${palette.heading} leading-tight truncate max-w-[140px]`}>
                                {agendamento.nome}
                              </p>
                              <p className={`text-xs ${palette.sub}`}>
                                {agendamento.data_marcada ? format(new Date(agendamento.data_marcada), 'HH:mm') : 'Sem horário'}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded-full border text-[10px] font-semibold ${statusBadge.classes}`}>
                              {statusBadge.label}
                            </div>
                          </div>
                          <div className="px-4 py-3 space-y-2 text-xs text-slate-600">
                            {agendamento.dentista && (
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-slate-400" />
                                <span className="truncate">Dr(a). {agendamento.dentista}</span>
                              </div>
                            )}
                            {agendamento.telefone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{agendamento.telefone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 justify-between">
                              {agendamento.source === 'codefy' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-200">
                                  <Check className="h-3 w-3" /> Codefy
                                </span>
                              ) : agendamento.source === 'campanha' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600 border border-purple-200">
                                  <Users className="h-3 w-3" /> Campanha
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">Urna</span>
                              )}
                              <span className="text-[10px] text-slate-400 italic">Clique para detalhes</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {dayAgendamentos.length === 0 && (
                      <div className="py-8">
                        {/* Espaço vazio sem botão de adicionar */}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    
    const renderExpandedDayModal = () => {
      if (!expandedDay || typeof document === 'undefined') return null;
      const agendamentosDoDia = sortAgendamentosByDataMarcada(getAgendamentosForDay(expandedDay));
      
      return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExpandedDay(null)} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {format(expandedDay, 'dd')} de {format(expandedDay, 'MMMM yyyy', { locale: ptBR })}
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {weekNames[expandedDay.getDay()]} • {agendamentosDoDia.length} agendamentos
                  </p>
                </div>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {agendamentosDoDia.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum agendamento para este dia</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agendamentosDoDia.map((agendamento, i) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                    >
                      {/* Header Principal - Nome e Status */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Avatar/Ícone do Paciente */}
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-6 w-6 text-blue-600" />
                            </div>
                            
                            {/* Nome e Identificação */}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {agendamento.nome}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {agendamento.source === 'codefy' && (
                                  <div className="flex items-center gap-1 bg-blue-50 rounded-full px-2 py-1 border border-blue-200">
                                    <Check className="h-3 w-3 text-blue-600" />
                                    <span className="text-xs text-blue-600 font-medium">Codefy</span>
                                  </div>
                                )}
                                <span className="text-sm text-gray-500">
                                  ID: {agendamento.id.substring(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Indicadores de Status */}
                          <div className="flex items-center gap-2">
                            {agendamento.confirmado && (
                              <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                Confirmado
                              </div>
                            )}
                            {agendamento.presenca === "Compareceu" && (
                              <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                Compareceu
                              </div>
                            )}
                            {agendamento.presenca === "Não compareceu" && (
                              <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                Não compareceu
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Corpo - Informações Detalhadas */}
                      <div className="p-6">
                                                {/* Seção Principal - Profissional e Horário */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <User className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 font-medium">Profissional</p>
                                <p className="text-base font-semibold text-gray-900">
                                  {agendamento.dentista || 'Não informado'}
                                </p>
                              </div>
                            </div>

                            {agendamento.tratamento && (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500 font-medium">Tratamento</p>
                                  <p className="text-base font-semibold text-gray-900">
                                    {agendamento.tratamento}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-4">
                            {agendamento.telefone && (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                  <Phone className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500 font-medium">Telefone</p>
                                  <p className="text-base font-semibold text-gray-900">
                                    {agendamento.telefone}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {agendamento.data_marcada && (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                  <Clock className="h-5 w-5 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-500 font-medium">Data e Horário</p>
                                  <DateTimePicker
                                    value={agendamento.data_marcada ? new Date(agendamento.data_marcada) : null}
                                    onChange={(date) => handleUpdateDataMarcada(agendamento.id, date)}
                                    placeholder="Selecionar data e horário"
                                    className="w-full"
                                  />
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                        
                        {/* Seção de presença e origem */}
                        <div className="border-t border-gray-200 pt-4 space-y-4">
                          <div>
                            <p className="text-sm text-gray-500 font-medium mb-2">Registro de comparecimento</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePresenceSelection(agendamento.id, "Compareceu", agendamento.presenca);
                                }}
                                disabled={presenceLoadingIds.has(agendamento.id)}
                                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                                  agendamento.presenca === "Compareceu"
                                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                                } ${presenceLoadingIds.has(agendamento.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                Compareceu
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePresenceSelection(agendamento.id, "Não compareceu", agendamento.presenca);
                                }}
                                disabled={presenceLoadingIds.has(agendamento.id)}
                                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                                  agendamento.presenca === "Não compareceu"
                                    ? 'bg-red-600 text-white border-red-600 shadow'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                                } ${presenceLoadingIds.has(agendamento.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                Não compareceu
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePresenceSelection(agendamento.id, null, agendamento.presenca);
                                }}
                                disabled={presenceLoadingIds.has(agendamento.id)}
                                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                                  !agendamento.presenca
                                    ? 'bg-amber-500 text-white border-amber-500 shadow'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-amber-300'
                                } ${presenceLoadingIds.has(agendamento.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                Marcar como pendente
                              </button>
                              {presenceLoadingIds.has(agendamento.id) && (
                                <span className="text-xs text-gray-500">Atualizando...</span>
                              )}
                            </div>
                          </div>
                                                  </div>
                        
                        {/* Metadata - Informações Adicionais */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Criado em: {agendamento.created_at ? new Date(agendamento.created_at).toLocaleString('pt-BR') : 'N/A'}</span>
                            <div className="flex items-center gap-2">
                              <span>ID: {agendamento.id.substring(0, 8)}...</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAgendamento(agendamento);
                                }}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Deletar agendamento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      );
    };
    
    return (
      <>
      <div className="rounded-[32px] border border-white/35 bg-white/25 p-6 shadow-[0_40px_120px_-60px_rgba(7,12,28,0.9)] backdrop-blur-[24px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-800">Calendário</h3>
            <div className="flex items-center rounded-lg border border-white/60 bg-white/80 p-1">
              <Button
                variant={calendarStyle === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCalendarStyle('monthly')}
                className={`rounded-md ${calendarStyle === 'monthly' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Calendar className="h-4 w-4" />
                Mensal
              </Button>
              <Button
                variant={calendarStyle === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCalendarStyle('weekly')}
                className={`rounded-md ${calendarStyle === 'weekly' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <CalendarDays className="h-4 w-4" />
                Semanal
              </Button>
            </div>
                      </div>
        </div>
        
        {calendarStyle === 'monthly' ? <MonthlyView /> : <WeeklyView />}
        </div>
        {renderExpandedDayModal()}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-xl text-slate-500">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-['Myriad_Pro','Plus_Jakarta_Sans','Inter',sans-serif] relative min-h-screen overflow-hidden bg-[#06122b] text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-[0.1]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/55 to-white/70 backdrop-blur-[4px]" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:py-14">
        <div className="flex flex-col gap-6 rounded-[32px] border border-white/35 bg-white/25 p-6 shadow-[0_40px_100px_-50px_rgba(7,12,28,0.85)] backdrop-blur-[30px] animate-in fade-in duration-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/home')}
                className="rounded-2xl border-white/70 bg-white/80 text-slate-700 hover:bg-white"
                title="Voltar ao Menu Inicial"
              >
                <Home className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">Agendamentos</h1>
                  <span className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm">
                    {displayedAgendamentos.length} {displayedAgendamentos.length === 1 ? 'consulta' : 'consultas'}
                  </span>
                </div>
                <p className="text-sm text-slate-500">Cockpit de consultas e confirmações OralDents</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-white/60 bg-white/80 p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={`rounded-md ${viewMode === 'calendar' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
                                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className={`rounded-md ${viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Columns className="h-4 w-4" />
                  Kanban
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleExportToSheets}
                disabled={exporting}
                className="gap-2 rounded-2xl border-white/60 bg-white/80 text-slate-700 hover:bg-white"
              >
                <FileSpreadsheet className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exportando...' : 'Google Sheets'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleExportCSV}
                title="Exportar CSV"
                className="rounded-2xl border-white/60 bg-white/80 text-slate-700 hover:bg-white"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Atualizar"
                className="rounded-2xl border-white/60 bg-white/80 text-slate-700 hover:bg-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="default"
                onClick={() => setShowManualPatientModal(true)}
                className="gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
              >
                <Plus className="h-4 w-4" />
                Cadastrar paciente
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros adicionais */}
        <div className="rounded-[28px] border border-white/35 bg-white/25 p-4 shadow-[0_30px_90px_-55px_rgba(7,12,28,0.85)] backdrop-blur-[20px] flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Dentista</span>
            <Select value={dentistFilter} onValueChange={setDentistFilter}>
              <SelectTrigger className="w-[220px] bg-white/85 border-white/60 text-slate-700 rounded-xl">
                <SelectValue placeholder="Todos os dentistas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueDentistas.map((dentista) => (
                  <SelectItem key={dentista} value={dentista}>
                    Dr(a). {dentista}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Tratamento</span>
            <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
              <SelectTrigger className="w-[220px] bg-white/85 border-white/60 text-slate-700 rounded-xl">
                <SelectValue placeholder="Todos os tratamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueTratamentos.map((tratamento) => (
                  <SelectItem key={tratamento} value={tratamento}>
                    {tratamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(dentistFilter !== "all" || treatmentFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDentistFilter("all");
                setTreatmentFilter("all");
              }}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Renderização condicional das visualizações */}
        {viewMode === 'calendar' ? (
          <CalendarView />
        ) : viewMode === 'kanban' ? (
          <KanbanView />
        ) : (
          <div className="rounded-[32px] border border-white/35 bg-white/25 p-0 shadow-[0_40px_120px_-60px_rgba(7,12,28,0.9)] backdrop-blur-[24px]">
            {displayedAgendamentos.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/60">
                  <FileSpreadsheet className="h-10 w-10 text-slate-400" />
                </div>
                <p className="text-xl font-semibold text-slate-900">Nenhum agendamento encontrado</p>
                <p className="mt-2 text-sm text-slate-500">Os agendamentos aparecerão aqui quando forem criados</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[30px] border border-white/40 bg-white/70">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/60">
                      <TableHead className="font-semibold text-slate-700 py-4">Paciente</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Data e Horário</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Contato</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Profissional</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Confirmação</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Presença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAgendamentos.map((agendamento, index) => (
                      <TableRow
                        key={agendamento.id}
                        className={`
                          border-b border-white/50 last:border-0 transition-colors hover:bg-slate-50/60
                          ${index % 2 === 0 ? 'bg-white/70' : 'bg-white/50'}
                        `}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
                              <span className="text-sm font-bold">
                                {agendamento.nome?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900">{agendamento.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <DateTimePicker
                            value={agendamento.data_marcada ? new Date(agendamento.data_marcada) : null}
                            onChange={(date) => handleUpdateDataMarcada(agendamento.id, date)}
                            placeholder="Selecionar data"
                            className="w-[220px]"
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          {agendamento.telefone ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                              {agendamento.telefone}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {agendamento.dentista ? (
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              Dr(a). {agendamento.dentista}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {agendamento.confirmado ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                              <BadgeCheck className="h-4 w-4" />
                              Confirmado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                              Pendente
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {agendamento.presenca === "Compareceu" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
                              <CheckCircle2 className="h-4 w-4" />
                              Compareceu
                            </span>
                          ) : agendamento.presenca === "Não compareceu" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600">
                              <XCircle className="h-4 w-4" />
                              Faltou
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                              Aguardando
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      
      <Dialog open={showManualPatientModal} onOpenChange={setShowManualPatientModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-green-50 via-white to-emerald-50">
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-900">Cadastrar novo paciente</DialogTitle>
            <DialogDescription className="text-slate-600">
              Registre rapidamente uma nova consulta urna sem sair dos agendamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ManualPatientForm
              onCompleted={async () => {
                setShowManualPatientModal(false);
                await loadAgendamentos();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal do LeadProfileDialog para cards de reagendamento */}
      {selectedLead && (
        <LeadProfileDialog
          lead={selectedLead}
          isOpen={showLeadProfileModal}
          onClose={() => {
            setShowLeadProfileModal(false);
            setSelectedLead(null);
          }}
          onUpdate={async () => {
            await loadAgendamentos();
          }}
        />
      )}
    </div>
  );
};

export default Agendamentos;
