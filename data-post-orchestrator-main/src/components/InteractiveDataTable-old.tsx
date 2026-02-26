import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, RefreshCw, X, Target } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

interface InteractiveDataTableProps {
  posts: Post[];
  onRefresh?: () => void;
}

interface TableState {
  searchTerm: string;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | null;
  visibleColumns: Record<string, boolean>;
  dateFilter: string;
  statusFilter: string;
  dentistaFilter: string;
  tratamentoFilter: string;
  campanhaFilter: string;
  isLoading: boolean;
}

// Configuração das colunas
const columnConfig = [
  { key: 'nome', label: 'Nome', required: true, defaultVisible: true },
  { key: 'telefone', label: 'Telefone', required: false, defaultVisible: true },
  { key: 'status', label: 'Status', required: false, defaultVisible: true },
  { key: 'dentista', label: 'Dentista', required: false, defaultVisible: true },
  { key: 'data', label: 'Data', required: false, defaultVisible: true },
  { key: 'tratamento', label: 'Tratamento', required: false, defaultVisible: true },
  { key: 'campanha_nome', label: 'Campanha', required: false, defaultVisible: true },
  { key: 'horario', label: 'Horário', required: false, defaultVisible: false },
  { key: 'created_at', label: 'Criado em', required: false, defaultVisible: false },
  { key: 'feedback', label: 'Feedback', required: false, defaultVisible: false },
  { key: 'id', label: 'ID', required: false, defaultVisible: false }
];

// Cores de status
const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("entrou")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (statusLower.includes("interessado")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (statusLower.includes("agendou")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (statusLower.includes("compareceu") && !statusLower.includes("não")) return "bg-green-600/20 text-green-400 border-green-500/30";
  if (statusLower.includes("não")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (statusLower.includes("negociação")) return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (statusLower.includes("follow-up")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (statusLower.includes("concluí")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (statusLower.includes("problema") || statusLower.includes("perdido")) return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
};

// Cor de tratamento
const getTreatmentColor = (tratamento?: string | null) => {
  if (!tratamento) return "bg-slate-100 text-slate-700";
  
  const normalized = tratamento.toLowerCase();
  if (normalized.includes("limpeza") || normalized.includes("profilaxia")) return "bg-sky-100 text-sky-800";
  if (normalized.includes("clareamento")) return "bg-amber-100 text-amber-800";
  if (normalized.includes("cirurgia") || normalized.includes("implante")) return "bg-rose-100 text-rose-800";
  if (normalized.includes("aparelho") || normalized.includes("ortodontia")) return "bg-purple-100 text-purple-800";
  if (normalized.includes("canal") || normalized.includes("endodontia")) return "bg-emerald-100 text-emerald-800";
  if (normalized.includes("avali") || normalized.includes("check-up") || normalized.includes("revis")) return "bg-green-100 text-green-800";
  if (normalized.includes("bruxismo") || normalized.includes("dor") || normalized.includes("relax")) return "bg-indigo-100 text-indigo-800";
  return "bg-slate-100 text-slate-700";
};

// Calcular threshold temporal
const getDateThreshold = (filter: string) => {
  const now = new Date();
  const thresholds: Record<string, number> = {
    '1h': 1 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() - (thresholds[filter] || 0));
};

export const InteractiveDataTable = ({ posts, onRefresh }: InteractiveDataTableProps) => {
  // Estado inicial das colunas visíveis
  const [state, setState] = useState<TableState>(() => {
    const savedColumns = localStorage.getItem('table-visible-columns');
    const visibleColumns = savedColumns ? JSON.parse(savedColumns) : {};
    
    // Aplicar configurações padrão
    columnConfig.forEach(col => {
      if (visibleColumns[col.key] === undefined) {
        visibleColumns[col.key] = col.defaultVisible;
      }
    });
    
    return {
      searchTerm: '',
      sortBy: null,
      sortOrder: null,
      visibleColumns,
      dateFilter: '',
      statusFilter: '',
      dentistaFilter: '',
      tratamentoFilter: '',
      campanhaFilter: '',
      isLoading: false
    };
  });

  // Salvar colunas visíveis no localStorage
  useEffect(() => {
    localStorage.setItem('table-visible-columns', JSON.stringify(state.visibleColumns));
  }, [state.visibleColumns]);

  // Extrair valores únicos para filtros
  const uniqueValues = useMemo(() => {
    const statuses = [...new Set(posts.map(p => p.status).filter(Boolean))];
    const dentistas = [...new Set(posts.map(p => p.dentista).filter(Boolean))];
    const tratamentos = [...new Set(posts.map(p => p.tratamento).filter(Boolean))];
    const campanhas = [...new Set(posts.map(p => p.campanha_nome).filter(Boolean))];
    
    return { statuses, dentistas, tratamentos, campanhas };
  }, [posts]);

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    let filtered = posts;

    // Busca textual
    if (state.searchTerm) {
      const searchLower = state.searchTerm.toLowerCase();
      filtered = filtered.filter(post => 
        post.nome.toLowerCase().includes(searchLower) ||
        (post.telefone && post.telefone.includes(searchLower)) ||
        post.status.toLowerCase().includes(searchLower) ||
        (post.dentista && post.dentista.toLowerCase().includes(searchLower)) ||
        (post.tratamento && post.tratamento.toLowerCase().includes(searchLower)) ||
        (post.campanha_nome && post.campanha_nome.toLowerCase().includes(searchLower)) ||
        (post.feedback && post.feedback.toLowerCase().includes(searchLower)) ||
        post.id.toLowerCase().includes(searchLower)
      );
    }

    // Filtros dropdown
    if (state.statusFilter) {
      filtered = filtered.filter(post => post.status === state.statusFilter);
    }
    if (state.dentistaFilter) {
      filtered = filtered.filter(post => post.dentista === state.dentistaFilter);
    }
    if (state.tratamentoFilter) {
      filtered = filtered.filter(post => post.tratamento === state.tratamentoFilter);
    }
    if (state.campanhaFilter) {
      filtered = filtered.filter(post => post.campanha_nome === state.campanhaFilter);
    }

    // Filtro temporal
    if (state.dateFilter) {
      const threshold = getDateThreshold(state.dateFilter);
      filtered = filtered.filter(post => new Date(post.created_at) >= threshold);
    }

    // Ordenação
    if (state.sortBy && state.sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[state.sortBy as keyof Post] || '';
        const bValue = b[state.sortBy as keyof Post] || '';
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return state.sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) return state.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return state.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [posts, state]);

  // Funções de atualização de estado
  const updateState = useCallback((updates: Partial<TableState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSort = useCallback((column: string) => {
    setState(prev => {
      if (prev.sortBy !== column) {
        return { ...prev, sortBy: column, sortOrder: 'asc' };
      }
      if (prev.sortOrder === 'asc') {
        return { ...prev, sortOrder: 'desc' };
      }
      return { ...prev, sortBy: null, sortOrder: null };
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await onRefresh?.();
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [onRefresh]);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchTerm: '',
      dateFilter: '',
      statusFilter: '',
      dentistaFilter: '',
      tratamentoFilter: '',
      campanhaFilter: '',
      sortBy: null,
      sortOrder: null
    }));
  }, []);

  const toggleColumn = useCallback((column: string, visible: boolean) => {
    setState(prev => ({
      ...prev,
      visibleColumns: { ...prev.visibleColumns, [column]: visible }
    }));
  }, []);

  // Verificar se há filtros ativos
  const hasActiveFilters = Boolean(
    state.searchTerm ||
    state.dateFilter ||
    state.statusFilter ||
    state.dentistaFilter ||
    state.tratamentoFilter ||
    state.campanhaFilter ||
    state.sortBy
  );

  // Colunas visíveis
  const visibleColumnsConfig = columnConfig.filter(col => 
    state.visibleColumns[col.key] || col.required
  );

  // Formatação de células
  const formatCellValue = useCallback((post: Post, column: string) => {
    const value = post[column as keyof Post];
    
    switch (column) {
      case 'nome':
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {post.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
            </div>
            <span className="font-medium text-foreground">{post.nome}</span>
          </div>
        );

      case 'telefone':
        return value ? (
          <span className="font-mono text-sm bg-muted/50 px-2 py-1 rounded-md">{value}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'status':
        return (
          <Badge className={`border ${getStatusColor(post.status)}`}>
            {post.status}
          </Badge>
        );

      case 'dentista':
        return value ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-medium">
              {value[0]}
            </div>
            <span className="text-foreground/80">Dr(a). {value}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'data':
        return value ? (
          <span className="bg-muted/50 px-2 py-1 rounded-md text-sm">
            {format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'horario':
        return value ? (
          <span className="font-mono text-sm bg-muted/50 px-2 py-1 rounded-md">{value}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'tratamento':
        return value ? (
          <Badge variant="secondary" className={`font-normal ${getTreatmentColor(value as string)}`}>
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'campanha_nome':
        return value ? (
          <Badge className="bg-purple-100 text-purple-700 text-[10px] h-5 font-semibold px-2 rounded-full border-0">
            <Target className="h-3 w-3 mr-1" />
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );

      case 'created_at':
        return (
          <span className="text-muted-foreground text-sm">
            {format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </span>
        );

      case 'feedback':
        return value || <span className="text-muted-foreground/50">—</span>;

      case 'id':
        return <span className="font-mono text-xs text-muted-foreground">{value}</span>;

      default:
        return value || <span className="text-muted-foreground/50">—</span>;
    }
  }, []);

  // Renderizar ícone de ordenação
  const renderSortIcon = (column: string) => {
    if (state.sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    if (state.sortOrder === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    }
    if (state.sortOrder === 'desc') {
      return <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4" />;
  };

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl bg-muted/20">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <Search className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">Nenhum lead encontrado</p>
        <p className="text-sm text-muted-foreground/70">Os leads aparecerão aqui quando criados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <TableToolbar
        filteredCount={filteredAndSortedData.length}
        totalCount={posts.length}
        isLoading={state.isLoading}
        hasActiveFilters={hasActiveFilters}
        onRefresh={handleRefresh}
        onClearFilters={clearFilters}
      />

      {/* Filtros */}
      <TableFilters
        state={state}
        uniqueValues={uniqueValues}
        onUpdateState={updateState}
      />

      {/* Tabela */}
      <div className="border-2 border-foreground/30 rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted">
                {visibleColumnsConfig.map(column => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-foreground/15 cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {renderSortIcon(column.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnsConfig.length} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Search className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nenhum resultado encontrado</p>
                      <p className="text-sm text-muted-foreground/70">Tente ajustar os filtros</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((post, index) => (
                  <tr
                    key={post.id}
                    className={`border-b border-foreground/15 last:border-0 transition-colors ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/40'
                    } hover:bg-muted/50`}
                  >
                    {visibleColumnsConfig.map(column => (
                      <td key={column.key} className="px-4 py-3 whitespace-nowrap">
                        {formatCellValue(post, column.key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seletor de Colunas */}
      <TableColumnSelector
        columns={columnConfig}
        visibleColumns={state.visibleColumns}
        onToggleColumn={toggleColumn}
      />
    </div>
  );
};
