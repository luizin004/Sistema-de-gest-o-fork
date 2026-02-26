import { useState, useMemo, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User, Phone, Calendar, Clock, Stethoscope, UserCheck, Target, MessageSquare, Hash } from "lucide-react";
import { format, subHours, subDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { TableColumnSelector } from "./TableColumnSelector";
import { TableExport } from "./TableExport";
import { TableStats } from "./TableStats";
import { TableStatsEnhanced } from "./TableStatsEnhanced";
import { TableSkeleton } from "./TableSkeleton";
import { supabase } from "@/integrations/supabase/client";

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

interface InteractiveDataTableProps {
  posts: Post[];
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

// Cores dos status
const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("entrou")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (statusLower.includes("interessado")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (statusLower.includes("agendou")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (statusLower.includes("compareceu") && !statusLower.includes("não")) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (statusLower.includes("não")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (statusLower.includes("em negociação")) return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (statusLower.includes("follow-up")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (statusLower.includes("concluí")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (statusLower.includes("problema") || statusLower.includes("perdido")) return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
};

export const InteractiveDataTable = ({ posts }: InteractiveDataTableProps) => {
  // Estado inicial das colunas visíveis com localStorage
  const initialColumns: Record<string, boolean> = {};
  columnConfig.forEach(col => {
    initialColumns[col.key] = col.defaultVisible;
  });
  const [visibleColumns, setVisibleColumns] = useLocalStorage('table-columns-visibility', initialColumns);

  // Estado dos filtros e ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [dateFilter, setDateFilter] = useLocalStorage('table-date-filter', 'all');
  const [statusFilter, setStatusFilter] = useLocalStorage('table-status-filter', 'all');
  const [dentistaFilter, setDentistaFilter] = useLocalStorage('table-dentista-filter', 'all');
  const [tratamentoFilter, setTratamentoFilter] = useLocalStorage('table-tratamento-filter', 'all');
  const [campanhaFilter, setCampanhaFilter] = useLocalStorage('table-campanha-filter', 'all');
  const [isLoading, setIsLoading] = useState(false);

  // Estado para controle de estatísticas completas
  const [useEnhancedStats, setUseEnhancedStats] = useState(false);

  // Extrair valores únicos para filtros
  const uniqueValues = useMemo(() => {
    const statuses = [...new Set(posts.map(p => p.status).filter(Boolean))];
    const dentistas = [...new Set(posts.map(p => p.dentista).filter(Boolean))];
    const tratamentos = [...new Set(posts.map(p => p.tratamento).filter(Boolean))];
    const campanhas = [...new Set(posts.map(p => p.campanha_nome).filter(Boolean))];
    
    return { statuses, dentistas, tratamentos, campanhas };
  }, [posts]);

  // Função de ordenação
  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortBy(null);
        setSortOrder(null);
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  // Função de filtro temporal
  const getDateThreshold = useCallback((filter: string) => {
    const now = new Date();
    switch (filter) {
      case '1h': return subHours(now, 1);
      case '6h': return subHours(now, 6);
      case '12h': return subHours(now, 12);
      case '24h': return subHours(now, 24);
      case '48h': return subHours(now, 48);
      case '7d': return subDays(now, 7);
      case '30d': return subDays(now, 30);
      default: return null;
    }
  }, []);

  // Dados filtrados e ordenados
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...posts];

    // Filtro de busca textual (com debounce)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
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

    // Filtro de data
    const dateThreshold = getDateThreshold(dateFilter);
    if (dateThreshold) {
      filtered = filtered.filter(post => 
        isAfter(new Date(post.created_at), dateThreshold)
      );
    }

    // Filtros dropdown
    if (statusFilter !== 'all') {
      filtered = filtered.filter(post => post.status === statusFilter);
    }
    if (dentistaFilter !== 'all') {
      filtered = filtered.filter(post => post.dentista === dentistaFilter);
    }
    if (tratamentoFilter !== 'all') {
      filtered = filtered.filter(post => post.tratamento === tratamentoFilter);
    }
    if (campanhaFilter !== 'all') {
      filtered = filtered.filter(post => post.campanha_nome === campanhaFilter);
    }

    // Ordenação
    if (sortBy && sortOrder) {
      filtered.sort((a, b) => {
        const aValue = a[sortBy as keyof Post];
        const bValue = b[sortBy as keyof Post];
        
        if (sortOrder === 'asc') {
          return String(aValue || '').localeCompare(String(bValue || ''), 'pt-BR');
        } else {
          return String(bValue || '').localeCompare(String(aValue || ''), 'pt-BR');
        }
      });
    }

    return filtered;
  }, [posts, debouncedSearchTerm, dateFilter, statusFilter, dentistaFilter, tratamentoFilter, campanhaFilter, sortBy, sortOrder, getDateThreshold]);

  // Função para limpar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('all');
    setStatusFilter('all');
    setDentistaFilter('all');
    setTratamentoFilter('all');
    setCampanhaFilter('all');
    setSortBy(null);
    setSortOrder(null);
  };

  // Função para atualizar dados
  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || dateFilter !== 'all' || statusFilter !== 'all' || 
                           dentistaFilter !== 'all' || tratamentoFilter !== 'all' || campanhaFilter !== 'all';

  // Colunas visíveis
  const visibleColumnConfig = columnConfig.filter(col => visibleColumns[col.key]);

  // Renderizar célula de dados
  const renderCell = (post: Post, columnKey: string) => {
    const value = post[columnKey as keyof Post];
    
    switch (columnKey) {
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
              {post.dentista[0]}
            </div>
            <span className="text-foreground/80">Dr(a). {post.dentista}</span>
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
          <Badge variant="secondary" className="font-normal bg-secondary/80">
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
            {format(new Date(post.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </span>
        );
      
      case 'feedback':
        return value ? (
          <span className="text-sm text-foreground/80 max-w-xs truncate" title={String(value)}>
            {String(value)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );
      
      case 'id':
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {post.id.slice(0, 8)}...
          </span>
        );
      
      default:
        return value || <span className="text-muted-foreground/50">—</span>;
    }
  };

  // Ícones das colunas
  const getColumnIcon = (columnKey: string) => {
    switch (columnKey) {
      case 'nome': return <User className="h-4 w-4 text-muted-foreground" />;
      case 'telefone': return <Phone className="h-4 w-4 text-muted-foreground" />;
      case 'dentista': return <UserCheck className="h-4 w-4 text-muted-foreground" />;
      case 'data': return <Calendar className="h-4 w-4 text-muted-foreground" />;
      case 'horario': return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'tratamento': return <Stethoscope className="h-4 w-4 text-muted-foreground" />;
      case 'campanha_nome': return <Target className="h-4 w-4 text-muted-foreground" />;
      case 'feedback': return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      case 'id': return <Hash className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  // Ícone de ordenação
  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    if (sortOrder === 'asc') return <ArrowUp className="h-4 w-4 text-foreground" />;
    if (sortOrder === 'desc') return <ArrowDown className="h-4 w-4 text-foreground" />;
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return <TableSkeleton rows={10} columns={visibleColumnConfig.length} />;
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl bg-muted/20">
        <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">Nenhum lead encontrado</p>
        <p className="text-sm text-muted-foreground/70">Os leads aparecerão aqui quando criados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Estatísticas */}
      {useEnhancedStats ? (
        <TableStatsEnhanced 
          data={posts} 
          filteredData={filteredAndSortedData}
          useCompleteStats={true}
        />
      ) : (
        <TableStats data={posts} filteredData={filteredAndSortedData} />
      )}
      
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em todos os campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80 h-9"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TableColumnSelector
            columns={columnConfig}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={setVisibleColumns}
          />
          
          <TableExport
            data={filteredAndSortedData}
            visibleColumns={visibleColumns}
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {/* Toggle para estatísticas completas */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
            <Switch
              checked={useEnhancedStats}
              onCheckedChange={setUseEnhancedStats}
            />
            <span className="text-xs font-medium">
              {useEnhancedStats ? 'Estatísticas Completas' : 'Estatísticas Atuais'}
            </span>
            {useEnhancedStats && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                +Arquivados
              </Badge>
            )}
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-9"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1h">1 hora</SelectItem>
            <SelectItem value="6h">6 horas</SelectItem>
            <SelectItem value="12h">12 horas</SelectItem>
            <SelectItem value="24h">24 horas</SelectItem>
            <SelectItem value="48h">48 horas</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {uniqueValues.statuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dentistaFilter} onValueChange={setDentistaFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Dentista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos dentistas</SelectItem>
            {uniqueValues.dentistas.map(dentista => (
              <SelectItem key={dentista} value={dentista}>{dentista}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tratamentoFilter} onValueChange={setTratamentoFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Tratamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tratamentos</SelectItem>
            {uniqueValues.tratamentos.map(tratamento => (
              <SelectItem key={tratamento} value={tratamento}>{tratamento}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={campanhaFilter} onValueChange={setCampanhaFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas campanhas</SelectItem>
            {uniqueValues.campanhas.map(campanha => (
              <SelectItem key={campanha} value={campanha}>{campanha}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-semibold text-foreground">{filteredAndSortedData.length}</span> de {posts.length} leads
        </p>
      </div>

      {/* Tabela */}
      <div className="border-2 border-foreground/30 rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted border-b border-foreground/15">
                {visibleColumnConfig.map(column => (
                  <TableHead
                    key={column.key}
                    className="font-semibold text-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {getColumnIcon(column.key)}
                      <span>{column.label}</span>
                      {getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnConfig.length} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Search className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nenhum resultado encontrado</p>
                      <p className="text-sm text-muted-foreground/70">Tente ajustar os filtros</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((post, index) => (
                  <TableRow
                    key={post.id}
                    className={`border-b border-foreground/15 last:border-0 ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/40'
                    } hover:bg-muted/50`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {visibleColumnConfig.map(column => (
                      <TableCell key={column.key} className="whitespace-nowrap">
                        {renderCell(post, column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
