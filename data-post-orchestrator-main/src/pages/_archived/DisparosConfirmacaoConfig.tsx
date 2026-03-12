import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, Clock, MessageSquare, Play, Calendar, CheckCircle, AlertCircle, CheckSquare, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DisparoConfig {
  id: string;
  tipo: string;
  mensagem_template: string;
  horario_disparo: string;
  dias_antes: number;
  ativo: boolean;
  uazapi_base_url?: string;
  uazapi_instance_token?: string;
  uazapi_admin_token?: string;
}

interface AgendamentoRow {
  nome: string;
  telefone: string;
  data: string;
}

const DisparosConfirmacaoConfig = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DisparoConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [testingLoading, setTestingLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const { data, error } = await supabase
        .from('disparos_config' as any)
        .select('*')
        .eq('tipo', 'consulta')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setConfig(data as unknown as DisparoConfig);
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      // Se não encontrar, cria configuração padrão
      await createDefaultConfig();
    } finally {
      setConfigLoading(false);
    }
  };

  const createDefaultConfig = async () => {
    const defaultConfig: Partial<DisparoConfig> = {
      tipo: 'consulta',
      mensagem_template: '✅ Olá {nome}! Sua consulta está confirmada para {data_consulta}. Por favor, chegue 15 minutos antes. 🏥 Odontomanager LamorIA',
      horario_disparo: '09:00',
      dias_antes: 1,
      ativo: true
    };

    try {
      const { data, error } = await supabase
        .from('disparos_config' as any)
        .insert(defaultConfig)
        .select()
        .single();

      if (error) throw error;
      setConfig(data as unknown as DisparoConfig);
    } catch (error) {
      console.error('Erro ao criar configuração padrão:', error);
      toast.error('Erro ao inicializar configuração');
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setConfigLoading(true);
    try {
      // 1. Salvar configuração
      const { error: configError } = await supabase
        .from('disparos_config' as any)
        .upsert({
          id: config.id,
          tipo: config.tipo,
          mensagem_template: config.mensagem_template,
          horario_disparo: config.horario_disparo,
          dias_antes: config.dias_antes,
          ativo: config.ativo,
          uazapi_base_url: config.uazapi_base_url,
          uazapi_instance_token: config.uazapi_instance_token,
          uazapi_admin_token: config.uazapi_admin_token
        });

      if (configError) throw configError;

      // 2. Atualizar tabela disparos com novas datas de disparo
      await updateDisparosDates();

      toast.success('Configuração salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setConfigLoading(false);
    }
  };

  const updateDisparosDates = async () => {
    if (!config) return;

    try {
      // Buscar todos os agendamentos futuros
      const { data: agendamentos, error: fetchError } = await supabase
        .from('agendamento' as any)
        .select('*')
        .gte('data', new Date().toISOString().split('T')[0]);

      if (fetchError) throw fetchError;

      const typedAgendamentos = (agendamentos as unknown as AgendamentoRow[]) ?? [];

      if (typedAgendamentos.length === 0) return;

      // Calcular e atualizar datas de disparo
      const disparosUpdates = typedAgendamentos.map((ag) => {
        const dataConsulta = new Date(ag.data);
        const dataDisparo = new Date(dataConsulta);
        dataDisparo.setDate(dataDisparo.getDate() - config.dias_antes);

        return {
          nome: ag.nome,
          telefone: ag.telefone,
          data_consulta: ag.data,
          data_disparo: dataDisparo.toISOString().split('T')[0],
          horario_disparo: config.horario_disparo,
          mensagem_template: config.mensagem_template,
          tipo: config.tipo,
          status: 'pendente'
        };
      });

      // Upsert na tabela disparos
      const { error: upsertError } = await supabase
        .from('disparos' as any)
        .upsert(disparosUpdates, {
          onConflict: 'nome,telefone,data_consulta,tipo'
        });

      if (upsertError) throw upsertError;
    } catch (error) {
      console.error('Erro ao atualizar datas de disparo:', error);
      // Não lança erro para não impedir salvamento da config
    }
  };

  const handleTest = async () => {
    if (!config) return;

    setTestingLoading(true);
    try {
      const response = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/disparos-scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MjQ4MDAsImV4cCI6MjA1MTAwMDQwMH0.W2h_4d7x3MzBPXPnBhJZ3KQYzXJhX8ZqF1wY8ZqF1wY'
        },
        body: JSON.stringify({
          action: 'test',
          tipo: 'consulta',
          config: config
        })
      });

      if (!response.ok) throw new Error('Erro ao testar configuração');
      
      const result = await response.json();
      toast.success('Teste enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao testar:', error);
      toast.error('Erro ao enviar teste');
    } finally {
      setTestingLoading(false);
    }
  };

  if (configLoading && !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
      {/* Header Professional */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos/confirmacao")}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-green-600 to-teal-600 p-2 rounded-lg">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Configuração - Confirmação</h1>
                  <p className="text-sm text-gray-500">Consultas Automáticas - Odontomanager LamorIA</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Message Configuration */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Configuração de Mensagem</CardTitle>
                    <CardDescription className="text-gray-600">
                      Personalize a mensagem de confirmação para pacientes
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="mensagem" className="text-sm font-medium text-gray-700">
                    Mensagem Template
                  </Label>
                  <Textarea
                    id="mensagem"
                    value={config?.mensagem_template || ''}
                    onChange={(e) => setConfig(prev => prev ? {...prev, mensagem_template: e.target.value} : null)}
                    rows={4}
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500 resize-none"
                    placeholder="Digite sua mensagem de confirmação aqui..."
                  />
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-medium mb-2">Variáveis disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      <code className="bg-white px-2 py-1 rounded text-xs border border-green-300">{"{nome}"}</code>
                      <code className="bg-white px-2 py-1 rounded text-xs border border-green-300">{"{data_consulta}"}</code>
                      <code className="bg-white px-2 py-1 rounded text-xs border border-green-300">{"{telefone}"}</code>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="horario" className="text-sm font-medium text-gray-700">
                      Horário de Disparo
                    </Label>
                    <div className="relative">
                      <Clock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                      <Input
                        id="horario"
                        type="time"
                        value={config?.horario_disparo || ''}
                        onChange={(e) => setConfig(prev => prev ? {...prev, horario_disparo: e.target.value} : null)}
                        className="pl-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dias" className="text-sm font-medium text-gray-700">
                      Dias Antes da Consulta
                    </Label>
                    <div className="relative">
                      <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                      <Input
                        id="dias"
                        type="number"
                        min="0"
                        max="30"
                        value={config?.dias_antes || 1}
                        onChange={(e) => setConfig(prev => prev ? {...prev, dias_antes: parseInt(e.target.value) || 1} : null)}
                        className="pl-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={config?.ativo || false}
                    onChange={(e) => setConfig(prev => prev ? {...prev, ativo: e.target.checked} : null)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <Label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                    Ativar confirmações automáticas
                  </Label>
                  {config?.ativo && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Ativo</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* UAZAPI Configuration */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <Settings className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Configuração UAZAPI</CardTitle>
                    <CardDescription className="text-gray-600">
                      Credenciais para envio via WhatsApp UAZAPI
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="base_url" className="text-sm font-medium text-gray-700">
                    Base URL UAZAPI
                  </Label>
                  <Input
                    id="base_url"
                    type="text"
                    value={config?.uazapi_base_url || ''}
                    onChange={(e) => setConfig(prev => prev ? {...prev, uazapi_base_url: e.target.value} : null)}
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    placeholder="https://oralaligner.uazapi.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instance_token" className="text-sm font-medium text-gray-700">
                    Instance Token
                  </Label>
                  <Input
                    id="instance_token"
                    type="password"
                    value={config?.uazapi_instance_token || ''}
                    onChange={(e) => setConfig(prev => prev ? {...prev, uazapi_instance_token: e.target.value} : null)}
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    placeholder="Instance Token da UAZAPI"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_token" className="text-sm font-medium text-gray-700">
                    Admin Token (Opcional)
                  </Label>
                  <Input
                    id="admin_token"
                    type="password"
                    value={config?.uazapi_admin_token || ''}
                    onChange={(e) => setConfig(prev => prev ? {...prev, uazapi_admin_token: e.target.value} : null)}
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    placeholder="Admin Token da UAZAPI"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Status do Sistema</CardTitle>
                    <CardDescription className="text-gray-600">
                      Configuração atual
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confirmações</span>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${
                      config?.ativo 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {config?.ativo ? (
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
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Horário</span>
                    <span className="text-sm font-medium text-gray-900">{config?.horario_disparo || '--:--'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Antecedência</span>
                    <span className="text-sm font-medium text-gray-900">{config?.dias_antes || 1} dia(s)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Play className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Ações</CardTitle>
                    <CardDescription className="text-gray-600">
                      Teste e salve configurações
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Button
                  onClick={handleTest}
                  disabled={testingLoading || !config?.ativo}
                  className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md"
                >
                  {testingLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Teste
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={configLoading}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md"
                >
                  {configLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configuração
                    </>
                  )}
                </Button>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 text-center">
                    O teste enviará uma mensagem de confirmação para verificar se a configuração está funcionando corretamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparosConfirmacaoConfig;
