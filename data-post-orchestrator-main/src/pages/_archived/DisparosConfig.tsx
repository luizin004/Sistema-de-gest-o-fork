import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings, Clock, MessageSquare, Save, Play, Calendar, CheckCircle, AlertCircle, Sparkles, Cake, CheckSquare, Send, Users, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DisparoConfig {
  id: string;
  tipo: string;
  mensagem_template: string;
  horario_disparo: string;
  dias_antes: number;
  ativo: boolean;
  zapi_instance_id?: string;
  zapi_token?: string;
}

const DisparosConfig = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<DisparoConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingLoading, setTestingLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('disparos_config' as any)
        .select('*')
        .order('tipo');

      if (error) throw error;
      setConfigs((data as unknown) as DisparoConfig[] || []);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações');
    }
  };

  const updateConfig = async (id: string, field: keyof DisparoConfig, value: any) => {
    try {
      const { error } = await supabase
        .from('disparos_config' as any)
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setConfigs(prev => prev.map(config => 
        config.id === id ? { ...config, [field]: value } : config
      ));

      toast.success('Configuração atualizada');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const testScheduler = async (tipo: string) => {
    setTestingLoading(tipo);
    try {
      const response = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/disparos-scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true, tipo }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      toast.success(`Teste ${tipo} executado: ${result.message}`);
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error(`Erro no teste ${tipo}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setTestingLoading(null);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels = {
      'aniversario': '🎂 Aniversário',
      'limpeza': '🦷 Limpeza',
      'clareamento': '✨ Clareamento',
      'consulta': '📅 Confirmação'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  const getPlaceholderMessage = (tipo: string) => {
    const placeholders = {
      'aniversario': '🎉 Parabéns {nome}! Desejamos um feliz aniversário cheio de saúde e alegria! 🎂',
      'limpeza': '🦷 Olá {nome}! Lembre-se da sua limpeza agendada. Estamos aguardando você! ✨',
      'clareamento': '✨ Olá {nome}! Seu clareamento está agendado. Prepare-se para um sorriso mais brilhante! 🌟',
      'consulta': '📅 Olá {nome}! Confirmamos sua consulta para hoje. Esperamos você! 😊'
    };
    return placeholders[tipo as keyof typeof placeholders] || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header Professional */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos")}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-900">Odontomanager LamorIA</span>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Configurações de Disparos</h1>
                  <p className="text-sm text-gray-500">Central de Controle - Odontomanager LamorIA</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {new Date().toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate("/disparos/limpeza")}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-gray-900">Limpeza</CardTitle>
                  <CardDescription className="text-xs text-gray-600">Gestão de limpezas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Ativo</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate("/disparos/aniversario")}>
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-pink-100 p-2 rounded-lg">
                  <Cake className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-gray-900">Aniversário</CardTitle>
                  <CardDescription className="text-xs text-gray-600">Parabéns automáticos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Ativo</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate("/disparos/clareamento")}>
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-gray-900">Clareamento</CardTitle>
                  <CardDescription className="text-xs text-gray-600">Tratamentos especiais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Ativo</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate("/disparos/confirmacao")}>
            <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <CheckSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-gray-900">Confirmação</CardTitle>
                  <CardDescription className="text-xs text-gray-600">Consultas manuais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Ativo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Cards */}
        <div className="grid gap-6">
          {configs.map((config) => {
            const getThemeColors = (tipo: string) => {
              switch(tipo) {
                case 'aniversario':
                  return { bg: 'from-pink-50 to-purple-50', icon: 'bg-pink-100', iconColor: 'text-pink-600', button: 'bg-pink-600 hover:bg-pink-700' };
                case 'limpeza':
                  return { bg: 'from-blue-50 to-cyan-50', icon: 'bg-blue-100', iconColor: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700' };
                case 'clareamento':
                  return { bg: 'from-amber-50 to-yellow-50', icon: 'bg-amber-100', iconColor: 'text-amber-600', button: 'bg-amber-600 hover:bg-amber-700' };
                case 'consulta':
                  return { bg: 'from-green-50 to-teal-50', icon: 'bg-green-100', iconColor: 'text-green-600', button: 'bg-green-600 hover:bg-green-700' };
                default:
                  return { bg: 'from-gray-50 to-gray-100', icon: 'bg-gray-100', iconColor: 'text-gray-600', button: 'bg-gray-600 hover:bg-gray-700' };
              }
            };

            const theme = getThemeColors(config.tipo);
            const getIcon = (tipo: string) => {
              switch(tipo) {
                case 'aniversario': return <Cake className="h-5 w-5" />;
                case 'limpeza': return <Users className="h-5 w-5" />;
                case 'clareamento': return <Sparkles className="h-5 w-5" />;
                case 'consulta': return <CheckSquare className="h-5 w-5" />;
                default: return <Settings className="h-5 w-5" />;
              }
            };

            return (
              <Card key={config.id} className="shadow-lg border-gray-200">
                <CardHeader className={`bg-gradient-to-r ${theme.bg} border-b`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`${theme.icon} p-2 rounded-lg`}>
                        <div className={theme.iconColor}>
                          {getIcon(config.tipo)}
                        </div>
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">
                          {getTipoLabel(config.tipo)}
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                          Configurações automáticas
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        config.ativo 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {config.ativo ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Inativo
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor={`mensagem-${config.id}`} className="text-sm font-medium text-gray-700">
                        Mensagem Template
                      </Label>
                      <Textarea
                        id={`mensagem-${config.id}`}
                        value={config.mensagem_template}
                        onChange={(e) => updateConfig(config.id, 'mensagem_template', e.target.value)}
                        rows={3}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
                        placeholder={getPlaceholderMessage(config.tipo)}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`horario-${config.id}`} className="text-sm font-medium text-gray-700">
                          Horário de Disparo
                        </Label>
                        <div className="relative">
                          <Clock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                          <Input
                            id={`horario-${config.id}`}
                            type="time"
                            value={config.horario_disparo}
                            onChange={(e) => updateConfig(config.id, 'horario_disparo', e.target.value)}
                            className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`dias-${config.id}`} className="text-sm font-medium text-gray-700">
                          Dias Antes
                        </Label>
                        <div className="relative">
                          <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                          <Input
                            id={`dias-${config.id}`}
                            type="number"
                            min="0"
                            max="30"
                            value={config.dias_antes}
                            onChange={(e) => updateConfig(config.id, 'dias_antes', parseInt(e.target.value) || 0)}
                            className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={config.ativo}
                            onCheckedChange={(checked) => updateConfig(config.id, 'ativo', checked)}
                          />
                          <Label className="text-sm font-medium text-gray-700">
                            Disparos Automáticos
                          </Label>
                        </div>
                        {config.ativo && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">Ativo</span>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => testScheduler(config.tipo)}
                        disabled={testingLoading === config.tipo}
                        className={`w-full ${theme.button} text-white shadow-md`}
                      >
                        {testingLoading === config.tipo ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Testando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar Teste
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Statistics Card */}
        <Card className="shadow-lg border-gray-200 mt-8">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <Database className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-gray-900">Estatísticas do Sistema</CardTitle>
                <CardDescription className="text-gray-600">
                  Visão geral dos disparos automáticos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{configs.length}</div>
                <div className="text-sm text-gray-600">Total de Configs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {configs.filter(c => c.ativo).length}
                </div>
                <div className="text-sm text-gray-600">Ativos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {configs.filter(c => !c.ativo).length}
                </div>
                <div className="text-sm text-gray-600">Inativos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">100%</div>
                <div className="text-sm text-gray-600">Disponibilidade</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DisparosConfig;
