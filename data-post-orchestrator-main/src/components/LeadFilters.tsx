import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Calendar, ChevronDown, ChevronUp, Sparkles, UserCheck, Stethoscope } from "lucide-react";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
}

export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  dentistaFilter: string;
  tratamentoFilter: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface LeadFiltersProps {
  posts: Post[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  compact?: boolean;
}

export const useLeadFilters = (posts: Post[]) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: "",
    statusFilter: "all",
    dentistaFilter: "all",
    tratamentoFilter: "all",
    dateFrom: undefined,
    dateTo: undefined,
  });

  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      post.telefone?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      post.tratamento?.toLowerCase().includes(filters.searchTerm.toLowerCase());
    
    const matchesStatus = filters.statusFilter === "all" || 
      post.status.toLowerCase() === filters.statusFilter.toLowerCase();
    const matchesDentista = filters.dentistaFilter === "all" || post.dentista === filters.dentistaFilter;
    const matchesTratamento = filters.tratamentoFilter === "all" || post.tratamento === filters.tratamentoFilter;

    let matchesDate = true;
    if (filters.dateFrom || filters.dateTo) {
      const postDate = post.data ? new Date(post.data) : null;
      if (!postDate) {
        matchesDate = false;
      } else {
        if (filters.dateFrom && postDate < filters.dateFrom) matchesDate = false;
        if (filters.dateTo) {
          const endOfDay = new Date(filters.dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (postDate > endOfDay) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesDentista && matchesTratamento && matchesDate;
  });

  return { filters, setFilters, filteredPosts };
};

export const LeadFilters = ({ posts, filters, onFiltersChange, compact = false }: LeadFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Extrair valores únicos
  const uniqueStatuses = Array.from(new Set(posts.map(p => p.status)));
  const uniqueDentistas = Array.from(new Set(posts.map(p => p.dentista).filter(Boolean))) as string[];
  const uniqueTratamentos = Array.from(new Set(posts.map(p => p.tratamento).filter(Boolean))) as string[];

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: "",
      statusFilter: "all",
      dentistaFilter: "all",
      tratamentoFilter: "all",
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = 
    filters.searchTerm || 
    filters.statusFilter !== "all" || 
    filters.dentistaFilter !== "all" ||
    filters.tratamentoFilter !== "all" ||
    filters.dateFrom ||
    filters.dateTo;

  const activeFilterCount = [
    filters.searchTerm,
    filters.statusFilter !== "all",
    filters.dentistaFilter !== "all",
    filters.tratamentoFilter !== "all",
    filters.dateFrom || filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="filter-card mb-4 overflow-hidden animate-fade-in">
      {/* Header */}
      <div 
        className={`flex items-center justify-between px-4 py-3 ${compact ? 'cursor-pointer hover:bg-muted/30' : ''} transition-all duration-200`}
        onClick={() => compact && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
            <p className="text-xs text-muted-foreground">Refine sua busca</p>
          </div>
          {activeFilterCount > 0 && (
            <Badge className="h-6 px-2 text-xs bg-primary text-primary-foreground border-0 animate-scale-in">
              {activeFilterCount} {activeFilterCount === 1 ? 'ativo' : 'ativos'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Limpar tudo
            </Button>
          )}
          {compact && (
            <div className={`w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Filters Grid */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/40 bg-muted/10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            {/* Search */}
            <div className="relative col-span-2 md:col-span-1 lg:col-span-2 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Buscar nome, telefone..."
                value={filters.searchTerm}
                onChange={(e) => updateFilter("searchTerm", e.target.value)}
                className="pl-10 h-10 filter-input rounded-lg"
              />
            </div>

            {/* Status Filter */}
            <Select 
              value={filters.statusFilter} 
              onValueChange={(v) => updateFilter("statusFilter", v)}
            >
              <SelectTrigger className="h-10 filter-input rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Dentista Filter */}
            <Select 
              value={filters.dentistaFilter} 
              onValueChange={(v) => updateFilter("dentistaFilter", v)}
            >
              <SelectTrigger className="h-10 filter-input rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Dentista" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os dentistas</SelectItem>
                {uniqueDentistas.map(dentista => (
                  <SelectItem key={dentista} value={dentista}>
                    Dr(a). {dentista}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tratamento Filter */}
            <Select 
              value={filters.tratamentoFilter} 
              onValueChange={(v) => updateFilter("tratamentoFilter", v)}
            >
              <SelectTrigger className="h-10 filter-input rounded-lg">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Tratamento" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tratamentos</SelectItem>
                {uniqueTratamentos.map(tratamento => (
                  <SelectItem key={tratamento} value={tratamento}>
                    {tratamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`h-10 justify-start text-left font-normal filter-input rounded-lg ${(filters.dateFrom || filters.dateTo) ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  {filters.dateFrom || filters.dateTo ? (
                    <span className="truncate font-medium">
                      {filters.dateFrom ? format(filters.dateFrom, "dd/MM", { locale: ptBR }) : "..."} 
                      {" → "}
                      {filters.dateTo ? format(filters.dateTo, "dd/MM", { locale: ptBR }) : "..."}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 border-b bg-muted/30">
                  <p className="text-sm font-semibold mb-3">Atalhos rápidos</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        const today = new Date();
                        updateFilter("dateFrom", today);
                        updateFilter("dateTo", today);
                      }}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        const today = new Date();
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        onFiltersChange({ ...filters, dateFrom: weekAgo, dateTo: today });
                      }}
                    >
                      7 dias
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        const today = new Date();
                        const monthAgo = new Date(today);
                        monthAgo.setDate(monthAgo.getDate() - 30);
                        onFiltersChange({ ...filters, dateFrom: monthAgo, dateTo: today });
                      }}
                    >
                      30 dias
                    </Button>
                  </div>
                </div>
                <div className="flex">
                  <div className="p-3 border-r">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Data inicial</p>
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => updateFilter("dateFrom", date)}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Data final</p>
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => updateFilter("dateTo", date)}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </div>
                </div>
                {(filters.dateFrom || filters.dateTo) && (
                  <div className="p-3 border-t bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined });
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpar datas
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
};
