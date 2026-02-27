import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, Edit, Plus, Search, Trash2, Stethoscope, MessageSquare, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import OralDentsLogo from '@/components/OralDentsLogo';

interface Dentista {
  id: string;
  nome: string;
  especialidade: string | null;
  ativo: boolean;
  created_at: string;
}

interface Tratamento {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number | null;
  created_at: string;
}

export default function Dados() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dentistas, setDentistas] = useState<Dentista[]>([]);
  const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tratamentoSearchTerm, setTratamentoSearchTerm] = useState('');
  const [showTratamentoDialog, setShowTratamentoDialog] = useState(false);
  const [editingTratamento, setEditingTratamento] = useState<Tratamento | null>(null);
  const [newTratamento, setNewTratamento] = useState({ nome: '', descricao: '', valor: '' });
  const [activeTab, setActiveTab] = useState<'dentistas' | 'tratamentos'>('dentistas');

  const [showDentistaDialog, setShowDentistaDialog] = useState(false);
  const [editingDentista, setEditingDentista] = useState<Dentista | null>(null);
  const [newDentista, setNewDentista] = useState({ nome: '', especialidade: '' });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const dentistasPromise = supabase.from('dentistas').select('*').order('nome');
      const tratamentosPromise = supabase
        .from('tratamentos' as any)
        .select('*')
        .order('nome')
        .returns<Tratamento[]>();

      const [dentistasRes, tratamentosRes] = await Promise.all([dentistasPromise, tratamentosPromise]);

      if (dentistasRes.error) {
        throw dentistasRes.error;
      }

      setDentistas(dentistasRes.data || []);

      if (tratamentosRes.error) {
        console.warn('Não foi possível carregar tratamentos. Verifique se a tabela existe.', tratamentosRes.error);
        setTratamentos([]);
      } else {
        setTratamentos(tratamentosRes.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do banco de dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const salvarTratamento = async () => {
    try {
      if (!newTratamento.nome.trim()) {
        toast({
          title: 'Nome obrigatório',
          description: 'Informe o nome do tratamento antes de salvar',
          variant: 'destructive',
        });
        return;
      }

      const valorNumero = newTratamento.valor ? parseFloat(newTratamento.valor.replace(',', '.')) : null;

      if (editingTratamento) {
        const { error } = await supabase
          .from('tratamentos' as any)
          .update({
            nome: newTratamento.nome,
            descricao: newTratamento.descricao || null,
            valor: valorNumero,
          })
          .eq('id', editingTratamento.id);

        if (error) throw error;
        toast({ title: 'Atualizado', description: 'Tratamento atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('tratamentos' as any)
          .insert([
            {
              nome: newTratamento.nome,
              descricao: newTratamento.descricao || null,
              valor: valorNumero,
            },
          ]);

        if (error) throw error;
        toast({ title: 'Cadastrado', description: 'Tratamento criado com sucesso' });
      }

      setShowTratamentoDialog(false);
      setEditingTratamento(null);
      setNewTratamento({ nome: '', descricao: '', valor: '' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar tratamento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o tratamento',
        variant: 'destructive',
      });
    }
  };

  const excluirTratamento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este tratamento? Essa ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase.from('tratamentos' as any).delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Excluído', description: 'Tratamento removido com sucesso' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir tratamento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o tratamento',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const excluirDentista = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este dentista? Essa ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase.from('dentistas').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Excluído', description: 'Dentista removido com sucesso' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir dentista:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o dentista',
        variant: 'destructive',
      });
    }
  };

  const salvarDentista = async () => {
    try {
      if (!newDentista.nome.trim()) {
        toast({
          title: 'Nome obrigatório',
          description: 'Informe o nome do dentista antes de salvar',
          variant: 'destructive',
        });
        return;
      }

      if (editingDentista) {
        const { error } = await supabase
          .from('dentistas')
          .update({
            nome: newDentista.nome,
            especialidade: newDentista.especialidade || null,
          })
          .eq('id', editingDentista.id);

        if (error) throw error;
        toast({ title: 'Atualizado', description: 'Dentista atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('dentistas')
          .insert([{ nome: newDentista.nome, especialidade: newDentista.especialidade || null, ativo: true }]);

        if (error) throw error;
        toast({ title: 'Cadastrado', description: 'Dentista criado com sucesso' });
      }

      setShowDentistaDialog(false);
      setEditingDentista(null);
      setNewDentista({ nome: '', especialidade: '' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar dentista:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o dentista',
        variant: 'destructive',
      });
    }
  };

  const dentistasFiltrados = dentistas.filter((dentista) => {
    const termo = searchTerm.toLowerCase();
    const matchNome = dentista.nome.toLowerCase().includes(termo);
    const matchEspecialidade = (dentista.especialidade || '').toLowerCase().includes(termo);
    const estaAtivo = dentista.ativo !== false;

    return (matchNome || matchEspecialidade) && estaAtivo;
  });

  const tratamentosFiltrados = tratamentos.filter((tratamento) => {
    const termo = tratamentoSearchTerm.toLowerCase();
    const matchNome = (tratamento.nome || '').toLowerCase().includes(termo);
    const matchDescricao = (tratamento.descricao || '').toLowerCase().includes(termo);

    return matchNome || matchDescricao;
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) {
      return 'Valor não informado';
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dentistas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/home')}
                className="flex items-center space-x-2 hover:bg-blue-50"
              >
                <Home className="h-4 w-4" />
                <span>Início</span>
              </Button>
              <div className="flex items-center space-x-4">
              <OralDentsLogo size="md" />
              <h1 className="text-2xl font-bold text-gray-900">Dados</h1>
            </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/monitoramento')}
                className="flex items-center space-x-2 hover:bg-green-50 border-green-300 text-green-700"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Monitoramento</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'dentistas', label: 'Dentistas' },
            { id: 'tratamentos', label: 'Tratamentos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'dentistas' | 'tratamentos')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>{activeTab === 'dentistas' ? 'Filtros de Dentistas' : 'Filtros de Tratamentos'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={activeTab === 'dentistas' ? 'Buscar dentista...' : 'Buscar tratamento...'}
                value={activeTab === 'dentistas' ? searchTerm : tratamentoSearchTerm}
                onChange={(e) =>
                  activeTab === 'dentistas'
                    ? setSearchTerm(e.target.value)
                    : setTratamentoSearchTerm(e.target.value)
                }
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                {activeTab === 'dentistas' ? <Users className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
                <span>
                  {activeTab === 'dentistas'
                    ? `Lista de Dentistas (${dentistasFiltrados.length})`
                    : `Lista de Tratamentos (${tratamentosFiltrados.length})`}
                </span>
              </CardTitle>
              <CardDescription>
                {activeTab === 'dentistas'
                  ? 'Gerencie o cadastro de dentistas da clínica. Esta lista é a mesma utilizada na aba de Consultórios.'
                  : 'Visualize os tratamentos disponíveis e mantenha as informações alinhadas com os demais módulos.'}
              </CardDescription>
            </div>
            {activeTab === 'dentistas' ? (
              <Button size="sm" onClick={() => setShowDentistaDialog(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Novo Dentista</span>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowTratamentoDialog(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Novo Tratamento</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {activeTab === 'dentistas' ? (
              <>
                {dentistasFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {searchTerm ? 'Nenhum dentista encontrado com o termo informado' : 'Nenhum dentista cadastrado'}
                    </p>
                    {!searchTerm && (
                      <Button className="mt-4" onClick={() => setShowDentistaDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar Primeiro Dentista
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dentistasFiltrados.map((dentista) => (
                      <div
                        key={dentista.id}
                        className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                          dentista.ativo
                            ? 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg'
                            : 'border-gray-200 bg-gray-50 opacity-60'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div
                                className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                                  dentista.ativo ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gray-400'
                                }`}
                              >
                                {dentista.nome
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">{dentista.nome}</h3>
                                <p className="text-gray-600 font-medium">
                                  {dentista.especialidade || 'Especialidade não informada'}
                                </p>
                                <span className="text-xs text-gray-500">ID: {dentista.id.substring(0, 8)}...</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingDentista(dentista);
                                  setNewDentista({
                                    nome: dentista.nome,
                                    especialidade: dentista.especialidade || '',
                                  });
                                  setShowDentistaDialog(true);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => excluirDentista(dentista.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 text-xs text-gray-400">
                            Cadastrado em: {new Date(dentista.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {tratamentosFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {tratamentoSearchTerm
                        ? 'Nenhum tratamento encontrado com o termo informado'
                        : 'Nenhum tratamento cadastrado'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tratamentosFiltrados.map((tratamento) => (
                      <div
                        key={tratamento.id}
                        className="group rounded-xl border-2 border-gray-200 bg-white hover:border-purple-300 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">{tratamento.nome}</h3>
                              <p className="text-gray-600 font-medium">
                                {tratamento.descricao || 'Descrição não informada'}
                              </p>
                            </div>
                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingTratamento(tratamento);
                                  setNewTratamento({
                                    nome: tratamento.nome,
                                    descricao: tratamento.descricao || '',
                                    valor: tratamento.valor?.toString() || '',
                                  });
                                  setShowTratamentoDialog(true);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => excluirTratamento(tratamento.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Integração com Consultórios</h3>
                <p className="text-sm text-blue-700">
                  Os dentistas cadastrados aqui são os mesmos exibidos na aba de Consultórios para alocação nas escalas. Atualize esta lista para
                  manter a gestão sincronizada.
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/consultorios')}
                    className="border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    Ir para Consultórios
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-purple-900 mb-1">Monitoramento de Mensagens</h3>
                <p className="text-sm text-purple-700">
                  Acompanhe em tempo real as mensagens enviadas pelos funcionários hoje. Visualize métricas de produtividade e desempenho da equipe.
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/monitoramento')}
                    className="border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    Ir para Monitoramento
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDentistaDialog} onOpenChange={setShowDentistaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDentista ? 'Editar Dentista' : 'Novo Dentista'}</DialogTitle>
            <DialogDescription>
              {editingDentista ? 'Edite as informações do dentista selecionado' : 'Preencha os dados para cadastrar um novo dentista'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Nome completo do dentista"
                value={newDentista.nome}
                onChange={(e) => setNewDentista((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="especialidade">Especialidade</Label>
              <Input
                id="especialidade"
                placeholder="Ex: Ortodontia, Implante..."
                value={newDentista.especialidade}
                onChange={(e) => setNewDentista((prev) => ({ ...prev, especialidade: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDentistaDialog(false);
                setEditingDentista(null);
                setNewDentista({ nome: '', especialidade: '' });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvarDentista}>{editingDentista ? 'Atualizar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTratamentoDialog} onOpenChange={setShowTratamentoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTratamento ? 'Editar Tratamento' : 'Novo Tratamento'}</DialogTitle>
            <DialogDescription>
              {editingTratamento
                ? 'Edite as informações do tratamento selecionado'
                : 'Preencha os dados para cadastrar um novo tratamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tratamento-nome">Nome *</Label>
              <Input
                id="tratamento-nome"
                placeholder="Ex: Limpeza, Clareamento..."
                value={newTratamento.nome}
                onChange={(e) => setNewTratamento((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tratamento-descricao">Descrição</Label>
              <Input
                id="tratamento-descricao"
                placeholder="Detalhes ou observações"
                value={newTratamento.descricao}
                onChange={(e) => setNewTratamento((prev) => ({ ...prev, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tratamento-valor">Valor</Label>
              <Input
                id="tratamento-valor"
                placeholder="Ex: 250.00"
                value={newTratamento.valor}
                onChange={(e) => setNewTratamento((prev) => ({ ...prev, valor: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTratamentoDialog(false);
                setEditingTratamento(null);
                setNewTratamento({ nome: '', descricao: '', valor: '' });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvarTratamento}>{editingTratamento ? 'Atualizar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
