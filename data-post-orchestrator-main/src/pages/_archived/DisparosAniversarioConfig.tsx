import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, Clock, MessageSquare, Play, Calendar, CheckCircle, AlertCircle, Cake, Save, Send } from "lucide-react";
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

const DisparosAniversarioConfig = () => {
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
        .eq('tipo', 'aniversario')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setConfig((data as unknown) as DisparoConfig);
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
      tipo: 'aniversario',
      mensagem_template: '🎂 Parabéns {nome}! Todo time da Odontomanager LamorIA deseja um feliz aniversário e muita saúde! 🦷✨',
      horario_disparo: '09:00',
      dias_antes: 0,
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
    console.log("[DisparosAniversarioConfig] BOTÃO SALVAR CLICADO!");
    console.log("[DisparosAniversarioConfig] Config atual:", config);
    
    if (!config) {
      console.log("[DisparosAniversarioConfig] ERRO: Config não encontrado");
      return;
    }

    console.log("[DisparosAniversarioConfig] Iniciando salvamento...");
    setConfigLoading(true);
    try {
      const payload = {
        ...config,
        horario_disparo: config.horario_disparo,
        dias_antes: config.dias_antes,
        ativo: config.ativo,
        uazapi_base_url: config.uazapi_base_url,
        uazapi_instance_token: config.uazapi_instance_token,
        uazapi_admin_token: config.uazapi_admin_token
      };
      
      console.log("[DisparosAniversarioConfig] Payload para salvar:", payload);
      
      const { error } = await supabase
        .from('disparos_config' as any)
        .upsert(payload);

      console.log("[DisparosAniversarioConfig] Resultado do upsert:", { error });
      console.log("[DisparosAniversarioConfig] Error details:", error);

      if (error) throw error;
      
      console.log("[DisparosAniversarioConfig] Salvo com sucesso!");
      toast.success('Configuração salva com sucesso!');
    } catch (error) {
      console.error('[DisparosAniversarioConfig] Erro ao salvar:', error);
      console.error('[DisparosAniversarioConfig] Erro message:', error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro ao salvar configuração');
    } finally {
      console.log("[DisparosAniversarioConfig] Finalizando salvamento...");
      setConfigLoading(false);
    }
  };

  const handleTest = async () => {
    console.log("[DisparosAniversarioConfig] BOTÃO ENVIAR TESTE CLICADO!");
    console.log("[DisparosAniversarioConfig] Config atual:", config);
    
    if (!config) {
      console.log("[DisparosAniversarioConfig] ERRO: Config não encontrado");
      return;
    }

    console.log("[DisparosAniversarioConfig] Iniciando teste...");
    setTestingLoading(true);
    
    try {
      const url = 'https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/disparos-scheduler';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MjQ4MDAsImV4cCI6MjA1MTAwMDQwMH0.W2h_4d7x3MzBPXPnBhJZ3KQYzXJhX8ZqF1wY8ZqF1wY'
      };
      
      const body = {
        test: true,
        tipo: 'aniversario',
        config: config
      };
      
      console.log("[DisparosAniversarioConfig] URL:", url);
      console.log("[DisparosAniversarioConfig] Headers:", headers);
      console.log("[DisparosAniversarioConfig] Body:", JSON.stringify(body, null, 2));
      
      console.log("[DisparosAniversarioConfig] Enviando requisição...");
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      console.log("[DisparosAniversarioConfig] Response status:", response.status);
      console.log("[DisparosAniversarioConfig] Response headers:", response.headers);
      console.log("[DisparosAniversarioConfig] Response ok:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DisparosAniversarioConfig] Erro response text:", errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      console.log("[DisparosAniversarioConfig] Parseando JSON...");
      const result = await response.json();
      console.log("[DisparosAniversarioConfig] Resultado:", result);
      
      toast.success('Teste enviado com sucesso!');
    } catch (error) {
      console.error('[DisparosAniversarioConfig] Erro completo:', error);
      console.error('[DisparosAniversarioConfig] Erro message:', error instanceof Error ? error.message : 'Erro desconhecido');
      console.error('[DisparosAniversarioConfig] Erro stack:', error instanceof Error ? error.stack : 'Sem stack');
      toast.error('Erro ao enviar teste');
    } finally {
      console.log("[DisparosAniversarioConfig] Finalizando teste...");
      setTestingLoading(false);
    }
  };

  if (configLoading && !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header Professional */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos/aniversario")}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-2 rounded-lg">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Configuração - Aniversário</h1>
                  <p className="text-sm text-gray-500">Parabéns Automáticos - Odontomanager LamorIA</p>
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
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Configuração de Mensagem</CardTitle>
                    <CardDescription className="text-gray-600">
                      Personalize a mensagem de parabéns para pacientes
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
                    className="border-gray-300 focus:border-pink-500 focus:ring-pink-500 resize-none"
                    placeholder="Digite sua mensagem de aniversário aqui..."
                  />
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                    <p className="text-xs text-pink-700 font-medium mb-2">Variáveis disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      <code className="bg-white px-2 py-1 rounded text-xs border border-pink-300">{"{nome}"}</code>
                      <code className="bg-white px-2 py-1 rounded text-xs border border-pink-300">{"{data_nascimento}"}</code>
                      <code className="bg-white px-2 py-1 rounded text-xs border border-pink-300">{"{telefone}"}</code>
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
                        className="pl-10 border-gray-300 focus:border-pink-500 focus:ring-pink-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dias" className="text-sm font-medium text-gray-700">
                      Dias Antes do Aniversário
                    </Label>
                    <div className="relative">
                      <Calendar className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                      <Input
                        id="dias"
                        type="number"
                        min="0"
                        max="30"
                        value={config?.dias_antes || 0}
                        onChange={(e) => setConfig(prev => prev ? {...prev, dias_antes: parseInt(e.target.value) || 0} : null)}
                        className="pl-10 border-gray-300 focus:border-pink-500 focus:ring-pink-500"
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
                    className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                  />
                  <Label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                    Ativar parabéns automáticos
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
                    className="border-gray-300 focus:border-pink-500 focus:ring-pink-500"
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
                    className="border-gray-300 focus:border-pink-500 focus:ring-pink-500"
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
                    className="border-gray-300 focus:border-pink-500 focus:ring-pink-500"
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
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg">
                    <Cake className="h-5 w-5 text-pink-600" />
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
                    <span className="text-sm text-gray-600">Parabéns</span>
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
                    <span className="text-sm font-medium text-gray-900">{config?.dias_antes || 0} dia(s)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg">
                    <Play className="h-5 w-5 text-pink-600" />
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
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white shadow-md"
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
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md"
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
                    O teste enviará uma mensagem de parabéns para verificar se a configuração está funcionando corretamente.
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

export default DisparosAniversarioConfig;
