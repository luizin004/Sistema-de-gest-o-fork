import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Search, Filter, Download, RefreshCw, User, Phone, Building, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";

// Interface para grupos com limite
interface GrupoComLimite extends GrupoCampanha {
  totalOriginal: number; // Total antes de aplicar limite
}
interface CampanhaRecord {
  id: number;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  idade: number | null;
  funcao: string | null;
  empresa: string | null;
  ID_campanha: string | null;
  disparo_feito: boolean | null; // Permitir null
  extras: any | null; // Tipo JSON para dados complexos
  created_at?: string;
  updated_at?: string;
  respondeu: boolean; // NOVO CAMPO
}

interface GrupoCampanha {
  id_campanha: string;
  registros: CampanhaRecord[];
  stats: {
    total: number;
    com_telefone: number;
    com_instagram: number;
    com_idade: number;
    com_funcao: number;
    disparos_feitos: number;
    disparos_pendentes: number;
    falharam: number;          // NOVO
    responderam: number;      // NOVO
    nao_responderam: number; // NOVO
  };
}

const DisparosCampanhaLeads = () => {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<CampanhaRecord[]>([]);
  const [gruposCampanha, setGruposCampanha] = useState<GrupoCampanha[]>([]);
  const [estatisticasGerais, setEstatisticasGerais] = useState<{
    total: number;
    responderam: number;
    naoResponderam: number;
    taxaResposta: string;
  } | null>(null);
  const [selectedCampanhaId, setSelectedCampanhaId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [feitoChecked, setFeitoChecked] = useState<boolean>(true); // NOVO: Checkbox de disparos feitos
  const [pendenteChecked, setPendenteChecked] = useState<boolean>(true); // NOVO: Checkbox de disparos pendentes
  const [falhouChecked, setFalhouChecked] = useState<boolean>(true); // NOVO: Checkbox de disparos falharam
  const [respondeuChecked, setRespondeuChecked] = useState<boolean>(true); // NOVO: Checkbox de respondeu
  const [naoRespondeuChecked, setNaoRespondeuChecked] = useState<boolean>(true); // NOVO: Checkbox de não respondeu
  const [expandedCampanhas, setExpandedCampanhas] = useState<{[key: string]: boolean}>({}); // NOVO: Controlar expansão das campanhas
  const [campanhaFilters, setCampanhaFilters] = useState<{[key: string]: {
    searchTerm: string;
    feitoChecked: boolean;
    pendenteChecked: boolean;
    falhouChecked: boolean;
    respondeuChecked: boolean;
    naoRespondeuChecked: boolean;
    sortOrder: 'asc' | 'desc';
  }}>({}); // NOVO: Filtros individuais por campanha

  // Função para toggle de expansão das campanhas
  const toggleCampanhaExpansion = (campanhaId: string) => {
    setExpandedCampanhas(prev => ({
      ...prev,
      [campanhaId]: !prev[campanhaId]
    }));
    
    // Inicializar filtros da campanha se não existirem
    if (!expandedCampanhas[campanhaId]) {
      setCampanhaFilters(prev => ({
        ...prev,
        [campanhaId]: {
          searchTerm: '',
          feitoChecked: true,
          pendenteChecked: true,
          falhouChecked: true,
          respondeuChecked: true,
          naoRespondeuChecked: true,
          sortOrder: 'desc'
        }
      }));
    }
  };

  // Função para atualizar filtros individuais da campanha
  const updateCampanhaFilter = (campanhaId: string, filterType: string, value: any) => {
    setCampanhaFilters(prev => ({
      ...prev,
      [campanhaId]: {
        ...prev[campanhaId],
        [filterType]: value
      }
    }));
  };

  // Função para exportar CSV de uma campanha específica
  const exportCampanhaToCSV = (grupo: CampanhaGroup) => {
    const filteredRegistros = filterCampanhaRegistros(grupo.registros, grupo.id_campanha);
    
    if (filteredRegistros.length === 0) {
      alert('Nenhum registro para exportar com os filtros atuais.');
      return;
    }

    // Cabeçalho do CSV
    const headers = ['ID', 'Nome', 'Telefone', 'Empresa', 'Disparo Feito', 'Respondeu', 'Data Disparo', 'ID Campanha'];
    
    // Converter dados para formato CSV
    const csvData = filteredRegistros.map(registro => [
      registro.id,
      registro.nome || '',
      registro.telefone || '',
      registro.empresa || '',
      registro.disparo_feito === true ? 'Feito' : registro.disparo_feito === false ? 'Falhou' : 'Pendente',
      registro.respondeu === true ? 'Sim' : 'Não',
      registro.data_disparo || '',
      grupo.id_campanha
    ]);

    // Criar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Criar blob e download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `campanha_${grupo.id_campanha}_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para filtrar registros de uma campanha específica
  const filterCampanhaRegistros = (registros: CampanhaRecord[], campanhaId: string) => {
    const filters = campanhaFilters[campanhaId];
    if (!filters) return registros;
    
    let filteredRegistros = registros.filter(registro => {
      // Filtro de pesquisa
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!registro.nome.toLowerCase().includes(searchLower) &&
            !registro.telefone?.includes(filters.searchTerm) &&
            !registro.empresa?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Filtros de status
      if (filters.feitoChecked && registro.disparo_feito === true) return true;
      if (filters.pendenteChecked && registro.disparo_feito === null) return true;
      if (filters.falhouChecked && registro.disparo_feito === false) return true;
      
      return false;
    }).filter(registro => {
      const filters = campanhaFilters[campanhaId];
      // Filtros de resposta
      if (filters.respondeuChecked && registro.respondeu === true) return true;
      if (filters.naoRespondeuChecked && registro.respondeu === false) return true;
      
      return false;
    });

    // Aplicar ordenação
    filteredRegistros.sort((a, b) => {
      const dateA = new Date(a.created_at || '').getTime();
      const dateB = new Date(b.created_at || '').getTime();
      
      if (filters.sortOrder === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });

    return filteredRegistros;
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    try {
      setLoading(true);
      
      console.log(`[${new Date().toISOString()}] [frontend] 🚀 Iniciando busca de métricas...`);
      
      // Usar nova Edge Function com métricas
      const url = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/campanha-metricas';
      console.log(`[${new Date().toISOString()}] [frontend] 📡 URL da requisição: ${url}`);
      
      const headers = {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`[${new Date().toISOString()}] [frontend] 📊 Status da resposta: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[${new Date().toISOString()}] [frontend] ❌ Erro na requisição:`, errorText);
        throw new Error(`Erro na requisição: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`[${new Date().toISOString()}] [frontend] ✅ Dados recebidos:`, result);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro na resposta da Edge Function');
      }

      const registrosData: CampanhaRecord[] = result.data || [];
      console.log(`[${new Date().toISOString()}] [frontend] 📋 Quantidade de registros: ${registrosData.length}`);
      
      setRegistros(registrosData);

      // Agrupar por ID_campanha
      console.log(`[${new Date().toISOString()}] [frontend] 🔄 Agrupando por ID_campanha...`);
      const grupos: { [key: string]: CampanhaRecord[] } = registrosData.reduce((acc, registro) => {
        const campanhaId = registro.ID_campanha || 'sem_campanha';
        if (!acc[campanhaId]) {
          acc[campanhaId] = [];
        }
        acc[campanhaId].push(registro);
        return acc;
      }, {});

      const gruposFormatados: GrupoCampanha[] = Object.entries(grupos).map(([id_campanha, regs]) => {
        // Debug detalhado de cada registro
        console.log(`[${new Date().toISOString()}] [frontend] 🔍 Analisando grupo ${id_campanha}:`);
        regs.forEach((reg, index) => {
          console.log(`  [${index}] ${reg.nome}: disparo_feito=${reg.disparo_feito}, extras.disparo_falhou=${reg.extras?.disparo_falhou}, respondeu=${reg.respondeu}`);
        });

        const stats = {
          total: regs.length,
          com_telefone: regs.filter(r => r.telefone).length,
          com_instagram: regs.filter(r => r.instagram).length,
          com_idade: regs.filter(r => r.idade).length,
          com_funcao: regs.filter(r => r.funcao).length,
          disparos_feitos: 0, // Será calculado abaixo
          disparos_pendentes: regs.filter(r => 
            r.disparo_feito === false && 
            r.extras?.disparo_falhou !== true
          ).length,
          falharam: regs.filter(r => r.extras?.disparo_falhou === true).length,  // NOVO
          responderam: regs.filter(r => r.respondeu === true).length,      // NOVO
          nao_responderam: 0 // Será calculado abaixo
        };

        // Calcular disparos_feitos corretamente: total - pendentes - falharam
        stats.disparos_feitos = stats.total - stats.disparos_pendentes - stats.falharam;
        
        // Calcular nao_responderam baseado apenas em disparos_feitos
        stats.nao_responderam = stats.disparos_feitos - stats.responderam;

        console.log(`[${new Date().toISOString()}] [frontend] 📈 Estatísticas do grupo ${id_campanha}:`, {
          total: stats.total,
          disparos_pendentes: stats.disparos_pendentes,
          falharam: stats.falharam,
          disparos_feitos_calculado: stats.disparos_feitos,
          responderam: stats.responderam,
          nao_responderam_calculado: stats.nao_responderam,
          verificacao: `${stats.total} - ${stats.disparos_pendentes} - ${stats.falharam} = ${stats.disparos_feitos}`,
          verificacao_nao_respondeu: `${stats.disparos_feitos} - ${stats.responderam} = ${stats.nao_responderam}`
        });

        return {
          id_campanha,
          registros: regs,
          stats
        };
      });

      setGruposCampanha(gruposFormatados);
      console.log(`[${new Date().toISOString()}] [frontend] ✅ Busca de métricas concluída com sucesso`);
      
      // Atualizar estatísticas gerais se disponíveis
      if (result.stats?.geral) {
        console.log(`[${new Date().toISOString()}] [frontend] 📊 Estatísticas gerais atualizadas:`, result.stats.geral);
        setEstatisticasGerais(result.stats.geral);
      }
      
      if (result.stats?.campanhas) {
        console.log(`[${new Date().toISOString()}] [frontend] 📊 Estatísticas por campanha atualizadas:`, result.stats.campanhas);
        // Atualizar estatísticas individuais dos grupos
        const gruposAtualizados = gruposFormatados.map(grupo => {
          const statsCampanha = result.stats.campanhas.find(c => c.id_campanha === grupo.id_campanha);
          if (statsCampanha) {
            return {
              ...grupo,
              stats: {
                ...grupo.stats,
                responderam: statsCampanha.responderam,
                nao_responderam: statsCampanha.naoResponderam
              }
            };
          }
          return grupo;
        });
        setGruposCampanha(gruposAtualizados);
      }
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [frontend] ❌ Erro ao buscar registros:`, error);
      console.log(`[${new Date().toISOString()}] [frontend] Stack trace:`, (error as Error).stack);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRegistros();
    setRefreshing(false);
    toast.success('Dados atualizados!');
  };

  // Filtrar grupos com base nos filtros
  const gruposFiltrados = gruposCampanha.filter(grupo => {
    if (selectedCampanhaId !== 'all' && grupo.id_campanha !== selectedCampanhaId) {
      return false;
    }

    const registrosFiltrados = grupo.registros.filter(registro => {
      const matchesSearch = registro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (registro.telefone && registro.telefone.includes(searchTerm)) ||
                           (registro.empresa && registro.empresa.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });

    return registrosFiltrados.length > 0 || (!searchTerm && selectedCampanhaId === 'all');
  });

  const gruposComRegistrosFiltrados: GrupoComLimite[] = gruposFiltrados.map(grupo => {
    const registrosFiltrados = grupo.registros.filter(registro => {
      const matchesSearch = registro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (registro.telefone && registro.telefone.includes(searchTerm)) ||
                           (registro.empresa && registro.empresa.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Aplicar filtros de disparo
      let matchesDisparo = true;
      const isFeito = registro.disparo_feito === true && registro.extras?.disparo_falhou !== true;
      const isPendente = registro.disparo_feito === false && registro.extras?.disparo_falhou !== true;
      const isFalhou = registro.extras?.disparo_falhou === true;
      
      const selectedDisparos = [];
      if (feitoChecked) selectedDisparos.push(isFeito);
      if (pendenteChecked) selectedDisparos.push(isPendente);
      if (falhouChecked) selectedDisparos.push(isFalhou);
      
      if (selectedDisparos.length > 0) {
        matchesDisparo = selectedDisparos.some(Boolean);
      }
      
      // Aplicar filtros de resposta
      let matchesResposta = true;
      if (respondeuChecked && registro.respondeu === true) matchesResposta = true;
      else if (naoRespondeuChecked && registro.respondeu === false) matchesResposta = true;
      else if (!respondeuChecked && !naoRespondeuChecked) matchesResposta = false;
      
      return matchesSearch && matchesDisparo && matchesResposta;
    });

    return {
      ...grupo,
      registros: registrosFiltrados,
      totalOriginal: registrosFiltrados.length
    };
  });

  // Calcular total de leads filtrados
  const totalLeadsFiltrados = gruposComRegistrosFiltrados.reduce(
    (total, grupo) => total + grupo.registros.length, 
    0
  );

  // Calcular estatísticas gerais
  const statsGerais = gruposCampanha.reduce((acc, grupo) => {
    return {
      total: acc.total + grupo.stats.total,
      com_telefone: acc.com_telefone + grupo.stats.com_telefone,
      com_instagram: acc.com_instagram + grupo.stats.com_instagram,
      com_idade: acc.com_idade + grupo.stats.com_idade,
      com_funcao: acc.com_funcao + grupo.stats.com_funcao,
      disparos_feitos: acc.disparos_feitos + grupo.stats.disparos_feitos,
      disparos_pendentes: acc.disparos_pendentes + grupo.stats.disparos_pendentes,
      falharam: acc.falharam + grupo.stats.falharam,          // NOVO
      responderam: acc.responderam + grupo.stats.responderam,      // NOVO
      nao_responderam: acc.nao_responderam + grupo.stats.nao_responderam // NOVO
    };
  }, { 
    total: 0, 
    com_telefone: 0, 
    com_instagram: 0, 
    com_idade: 0, 
    com_funcao: 0, 
    disparos_feitos: 0, 
    disparos_pendentes: 0,
    falharam: 0,          // NOVO
    responderam: 0,      // NOVO
    nao_responderam: 0   // NOVO
  });

  const exportToCSV = () => {
    // Coletar apenas os leads filtrados (após aplicação de todos os filtros)
    const filteredRegistros = gruposComRegistrosFiltrados.flatMap(grupo => 
      grupo.registros.map(registro => ({
        ...registro,
        nome_campanha: grupo.id_campanha,
        respondeu: registro.respondeu ? 'Sim' : 'Não'
      }))
    );

    // Estrutura melhorada do CSV com mais informações
    const headers = [
      'ID',
      'Nome', 
      'Telefone',
      'Empresa',
      'Instagram',
      'Idade',
      'Função',
      'ID Campanha',
      'Status Disparo',
      'Respondeu',
      'Data Criação',
      'Data Atualização'
    ];

    const csvData = [
      headers,
      ...filteredRegistros.map(registro => [
        registro.id.toString(),
        registro.nome || '',
        registro.telefone || '',
        registro.empresa || '',
        registro.instagram || '',
        registro.idade?.toString() || '',
        registro.funcao || '',
        registro.nome_campanha || '',
        registro.extras?.disparo_falhou === true ? 'Falhou' : 
          registro.disparo_feito === true ? 'Feito' : 'Pendente',
        registro.respondeu ? 'Sim' : 'Não',
        registro.created_at ? new Date(registro.created_at).toLocaleString('pt-BR') : '',
        registro.updated_at ? new Date(registro.updated_at).toLocaleString('pt-BR') : ''
      ])
    ];

    const csv = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_filtrados_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`CSV exportado com ${filteredRegistros.length} leads filtrados!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos/campanha")}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Tabela Campanha</h1>
                  <p className="text-sm text-gray-500">
                    {gruposCampanha.length} campanhas - {statsGerais.total} registros totais
                    {totalLeadsFiltrados !== statsGerais.total && (
                      <span className="text-purple-600 font-medium">
                        {' '}• {totalLeadsFiltrados} filtrados
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estatísticas Gerais */}
        {estatisticasGerais && (
          <Card className="shadow-lg border-gray-200 mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Estatísticas Gerais de Campanhas</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center bg-blue-50 rounded-lg px-6 py-4 border border-blue-200">
                  <p className="text-3xl font-bold text-blue-600">{estatisticasGerais.total}</p>
                  <p className="text-sm text-blue-700 font-medium">Total Leads</p>
                </div>
                <div className="text-center bg-green-50 rounded-lg px-6 py-4 border border-green-200">
                  <p className="text-3xl font-bold text-green-600">{estatisticasGerais.responderam}</p>
                  <p className="text-sm text-green-700 font-medium">Responderam</p>
                </div>
                <div className="text-center bg-red-50 rounded-lg px-6 py-4 border border-red-200">
                  <p className="text-3xl font-bold text-red-600">{estatisticasGerais.naoResponderam}</p>
                  <p className="text-sm text-red-700 font-medium">Não Responderam</p>
                </div>
                <div className="text-center bg-purple-50 rounded-lg px-6 py-4 border border-purple-200">
                  <p className="text-3xl font-bold text-purple-600">{estatisticasGerais.taxaResposta}%</p>
                  <p className="text-sm text-purple-700 font-medium">Taxa de Resposta</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card className="shadow-lg border-gray-200 mb-6">
          <CardContent className="p-6">
            {/* Filtros Principais */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, telefone ou empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedCampanhaId}
                  onChange={(e) => setSelectedCampanhaId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">Todas as Campanhas</option>
                  {gruposCampanha.map(grupo => (
                    <option key={grupo.id_campanha} value={grupo.id_campanha}>
                      {grupo.id_campanha === 'sem_campanha' ? 'Sem Campanha' : grupo.id_campanha} ({grupo.stats.total} registros)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Filtros de Exibição */}
            <div className="border-t pt-4">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Filtros de Exibição */}
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros de Exibição</h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex items-center gap-4 px-3 py-2 border border-gray-300 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Disparos:</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feitoChecked}
                          onChange={(e) => setFeitoChecked(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Feitos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pendenteChecked}
                          onChange={(e) => setPendenteChecked(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Pendentes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={falhouChecked}
                          onChange={(e) => setFalhouChecked(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Falharam</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-4 px-3 py-2 border border-gray-300 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Respostas:</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={respondeuChecked}
                          onChange={(e) => setRespondeuChecked(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Respondeu</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={naoRespondeuChecked}
                          onChange={(e) => setNaoRespondeuChecked(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Não Respondeu</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campanhas Separadas */}
        <div className="space-y-8">
          {gruposComRegistrosFiltrados.map((grupo) => (
            <Card key={grupo.id_campanha} className={`shadow-lg border-2 ${selectedCampanhaId === grupo.id_campanha ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}>
                <CardHeader 
                  className="bg-gradient-to-r from-purple-50 to-violet-50 cursor-pointer hover:from-purple-100 hover:to-violet-100 transition-colors"
                  onClick={() => toggleCampanhaExpansion(grupo.id_campanha)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900 flex items-center gap-3">
                          {grupo.id_campanha === 'sem_campanha' ? 'Sem Campanha' : grupo.id_campanha}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Registros agrupados por ID_campanha
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-6">
                        <div className="text-center bg-gray-50 rounded-lg px-6 py-4 border border-gray-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-gray-900">{grupo.stats.total}</p>
                          <p className="text-xs text-gray-600 font-medium">Total</p>
                        </div>
                        <div className="text-center bg-emerald-50 rounded-lg px-6 py-4 border border-emerald-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-emerald-600">{grupo.stats.disparos_feitos}</p>
                          <p className="text-xs text-emerald-700 font-medium">Feitos</p>
                        </div>
                        <div className="text-center bg-amber-50 rounded-lg px-6 py-4 border border-amber-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-amber-600">{grupo.stats.disparos_pendentes}</p>
                          <p className="text-xs text-amber-700 font-medium">Pendentes</p>
                        </div>
                        <div className="text-center bg-red-50 rounded-lg px-6 py-4 border border-red-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-red-600">{grupo.stats.falharam}</p>
                          <p className="text-xs text-red-700 font-medium">Falharam</p>
                        </div>
                        <div className="text-center bg-green-50 rounded-lg px-6 py-4 border border-green-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-green-600">{grupo.stats.responderam}</p>
                          <p className="text-xs text-green-700 font-medium">Respondeu</p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-lg px-6 py-4 border border-gray-200 min-w-[100px]">
                          <p className="text-2xl font-bold text-gray-600">{grupo.stats.nao_responderam}</p>
                          <p className="text-xs text-gray-700 font-medium">Não Respondeu</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-purple-600">
                        <span className="text-sm font-medium">
                          {expandedCampanhas[grupo.id_campanha] ? 'Ocultar' : 'Expandir'}
                        </span>
                        {expandedCampanhas[grupo.id_campanha] ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5 transform -rotate-90" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedCampanhas[grupo.id_campanha] ? 'max-h-[2000px]' : 'max-h-0'
                }`}>
                  <CardContent className="p-6">
                  {/* Filtros individuais da campanha */}
                  <div className="border-b pb-4 mb-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      {/* Campo de pesquisa da campanha */}
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Buscar por nome, telefone ou empresa..."
                            value={campanhaFilters[grupo.id_campanha]?.searchTerm || ''}
                            onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'searchTerm', e.target.value)}
                            className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                      
                      {/* Botão de download CSV */}
                      <div className="flex items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportCampanhaToCSV(grupo)}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar CSV
                        </Button>
                      </div>
                    </div>
                    
                    {/* Filtros de Exibição - Modelo igual aos gerais */}
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Filtros de Disparo */}
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Disparos</h3>
                        <div className="flex items-center gap-4 px-3 py-2 border border-gray-300 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Status:</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={campanhaFilters[grupo.id_campanha]?.feitoChecked || false}
                              onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'feitoChecked', e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Feitos</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={campanhaFilters[grupo.id_campanha]?.pendenteChecked || false}
                              onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'pendenteChecked', e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Pendentes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={campanhaFilters[grupo.id_campanha]?.falhouChecked || false}
                              onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'falhouChecked', e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Falharam</span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Filtros de Respostas */}
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Respostas</h3>
                        <div className="flex items-center gap-4 px-3 py-2 border border-gray-300 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Status:</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={campanhaFilters[grupo.id_campanha]?.respondeuChecked || false}
                              onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'respondeuChecked', e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Respondeu</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={campanhaFilters[grupo.id_campanha]?.naoRespondeuChecked || false}
                              onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'naoRespondeuChecked', e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Não Respondeu</span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Ordenação */}
                      <div className="lg:w-48">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Ordenação</h3>
                        <div className="flex items-center gap-4">
                          <select
                            value={campanhaFilters[grupo.id_campanha]?.sortOrder || 'desc'}
                            onChange={(e) => updateCampanhaFilter(grupo.id_campanha, 'sortOrder', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="desc">Mais Recente</option>
                            <option value="asc">Menos Recente</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {grupo.registros.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <h4 className="text-md font-semibold text-gray-900 mb-1">Nenhum registro neste grupo</h4>
                      <p className="text-sm text-gray-600">
                        {searchTerm
                          ? 'Nenhum registro corresponde aos filtros aplicados'
                          : 'Este grupo não possui registros'
                        }
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const filteredRegistros = filterCampanhaRegistros(grupo.registros, grupo.id_campanha);
                      
                      return (
                        <>
                          {filteredRegistros.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                              <h4 className="text-md font-semibold text-gray-900 mb-1">Nenhum registro encontrado</h4>
                              <p className="text-sm text-gray-600">
                                {campanhaFilters[grupo.id_campanha]?.searchTerm || 
                                 !campanhaFilters[grupo.id_campanha]?.feitoChecked ||
                                 !campanhaFilters[grupo.id_campanha]?.pendenteChecked ||
                                 !campanhaFilters[grupo.id_campanha]?.falhouChecked ||
                                 !campanhaFilters[grupo.id_campanha]?.respondeuChecked ||
                                 !campanhaFilters[grupo.id_campanha]?.naoRespondeuChecked
                                  ? 'Nenhum registro corresponde aos filtros aplicados'
                                  : 'Este grupo não possui registros'
                                }
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Nome</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Telefone</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Respondeu</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredRegistros.map((registro) => (
                            <tr key={registro.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-purple-100 p-2 rounded-lg">
                                    <User className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{registro.nome}</p>
                                    <p className="text-sm text-gray-500">ID: {registro.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                {registro.telefone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-blue-500" />
                                    <span className="text-sm text-gray-900">{registro.telefone}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-4">
                                {registro.extras?.disparo_falhou === true ? (
                                  <div className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-red-500" />
                                    <span className="text-sm text-red-700 font-medium">Falhou</span>
                                  </div>
                                ) : registro.disparo_feito === true ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    <span className="text-sm text-emerald-700 font-medium">Feito</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-amber-500" />
                                    <span className="text-sm text-amber-700 font-medium">Pendente</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-4">
                                {registro.respondeu === true ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                    <span className="text-sm text-green-700 font-medium">Sim</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-gray-500" />
                                    <span className="text-sm text-gray-700 font-medium">Não</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </CardContent>
              </div>
            </Card>
            ))}

        {/* Mensagem quando não há registros */}
        {gruposComRegistrosFiltrados.length === 0 && (
          <Card className="shadow-lg border-gray-200">
            <CardContent className="p-12">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum registro encontrado</h3>
                <p className="text-gray-600">
                  {searchTerm || selectedCampanhaId !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Nenhum registro encontrado na tabela_campanha'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
};

export default DisparosCampanhaLeads;
