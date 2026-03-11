import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Save, Plus, Trash2, Key, Eye, EyeOff } from "lucide-react";
import { useChatbotConfig, DEFAULT_CHATBOT_CONFIG, ChatbotConfig } from "@/hooks/useChatbotConfig";

const SYSTEM_PROMPT_PLACEHOLDER = `Você é um assistente virtual da {clinic_name}. Seu tom é {clinic_tone}.

Suas responsabilidades:
- Responder dúvidas sobre tratamentos e agendamentos
- Confirmar e remarcar consultas
- Coletar informações do paciente para novos agendamentos

Sempre seja cordial, empático e objetivo. Nunca invente informações que não foram fornecidas.`;

const ChatbotConfigPage = () => {
  const { fetchConfig, saveConfig, tenantId } = useChatbotConfig();

  const [config, setConfig] = useState<Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at">>(
    DEFAULT_CHATBOT_CONFIG
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await fetchConfig();
      if (data) {
        const { id, tenant_id, created_at, updated_at, ...rest } = data;
        setConfig({
          ...DEFAULT_CHATBOT_CONFIG,
          ...rest,
          cadence_templates: Array.isArray(rest.cadence_templates) ? rest.cadence_templates : [],
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configuração do chatbot:", error);
      toast.error("Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast.error("Tenant não identificado. Faça login novamente.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveConfig(config);
      if (saved) {
        toast.success("Configuração salva com sucesso!");
      } else {
        toast.error("Erro ao salvar configuração");
      }
    } catch (error) {
      console.error("Erro ao salvar configuração do chatbot:", error);
      toast.error("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTemplate = () => {
    const trimmed = newTemplate.trim();
    if (!trimmed) return;
    setConfig((prev) => ({
      ...prev,
      cadence_templates: [...prev.cadence_templates, trimmed],
    }));
    setNewTemplate("");
  };

  const handleUpdateTemplate = (index: number, value: string) => {
    setConfig((prev) => {
      const updated = [...prev.cadence_templates];
      updated[index] = value;
      return { ...prev, cadence_templates: updated };
    });
  };

  const handleRemoveTemplate = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      cadence_templates: prev.cadence_templates.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-600 to-slate-600 p-2 rounded-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chatbot IA - Configuração</h1>
                <p className="text-sm text-gray-500">
                  Configure o comportamento e a cadência do assistente virtual
                </p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-slate-700 hover:from-purple-700 hover:to-slate-800 text-white shadow-md"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Bot Enable + Clinic Identity */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Bot className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg text-gray-900">Identidade da Clínica</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Bot Enabled Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Chatbot Ativo</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ativa o atendimento automático via IA para novos contatos
                </p>
              </div>
              <Switch
                checked={config.bot_enabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, bot_enabled: checked }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Clinic Name */}
              <div className="space-y-2">
                <Label htmlFor="clinic_name" className="text-sm font-medium text-gray-700">
                  Nome da Clínica
                </Label>
                <Input
                  id="clinic_name"
                  value={config.clinic_name}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, clinic_name: e.target.value }))
                  }
                  placeholder="Ex: Clínica Odonto Vida"
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              {/* Clinic Tone */}
              <div className="space-y-2">
                <Label htmlFor="clinic_tone" className="text-sm font-medium text-gray-700">
                  Tom de Comunicação
                </Label>
                <Input
                  id="clinic_tone"
                  value={config.clinic_tone}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, clinic_tone: e.target.value }))
                  }
                  placeholder="profissional e acolhedor"
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OpenAI API Key */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Key className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg text-gray-900">Chave da OpenAI</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai_api_key" className="text-sm font-medium text-gray-700">
                API Key da OpenAI
              </Label>
              <div className="relative">
                <Input
                  id="openai_api_key"
                  type={showApiKey ? "text" : "password"}
                  value={config.openai_api_key}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, openai_api_key: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowApiKey((v) => !v)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Cada tenant precisa da sua própria chave. Obtenha em{" "}
                <span className="font-medium">platform.openai.com/api-keys</span>. A chave é armazenada de forma segura no banco de dados.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Model + System Prompt */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
            <CardTitle className="text-lg text-gray-900">Modelo e Prompt do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* OpenAI Model */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Modelo OpenAI</Label>
                <Select
                  value={config.openai_model}
                  onValueChange={(value) =>
                    setConfig((prev) => ({ ...prev, openai_model: value }))
                  }
                >
                  <SelectTrigger className="border-gray-300 focus:ring-purple-500">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  gpt-4o-mini é mais rápido e econômico; gpt-4o oferece maior qualidade de raciocínio
                </p>
              </div>

              {/* Max History Messages */}
              <div className="space-y-2">
                <Label htmlFor="max_history" className="text-sm font-medium text-gray-700">
                  Máx. Mensagens no Histórico
                </Label>
                <Input
                  id="max_history"
                  type="number"
                  min={1}
                  max={50}
                  value={config.max_history_messages}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      max_history_messages: parseInt(e.target.value) || 15,
                    }))
                  }
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500">Quantidade de mensagens anteriores enviadas ao modelo como contexto</p>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="system_prompt" className="text-sm font-medium text-gray-700">
                Prompt do Sistema
              </Label>
              <Textarea
                id="system_prompt"
                value={config.system_prompt}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))
                }
                rows={8}
                placeholder={SYSTEM_PROMPT_PLACEHOLDER}
                className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Instrução principal que define o comportamento do chatbot. Use{" "}
                <code className="bg-gray-100 px-1 rounded">{"{clinic_name}"}</code> e{" "}
                <code className="bg-gray-100 px-1 rounded">{"{clinic_tone}"}</code> como variáveis dinâmicas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cadence Settings */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
            <CardTitle className="text-lg text-gray-900">Cadência de Follow-up</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cadence Timeout */}
              <div className="space-y-2">
                <Label htmlFor="cadence_timeout" className="text-sm font-medium text-gray-700">
                  Intervalo entre Tentativas (horas)
                </Label>
                <Input
                  id="cadence_timeout"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={config.cadence_timeout_hours}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      cadence_timeout_hours: parseFloat(e.target.value) || 3,
                    }))
                  }
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500">
                  Tempo de espera sem resposta antes de enviar a próxima mensagem da cadência
                </p>
              </div>

              {/* Cadence Max Attempts */}
              <div className="space-y-2">
                <Label htmlFor="cadence_max" className="text-sm font-medium text-gray-700">
                  Máx. Tentativas de Follow-up
                </Label>
                <Input
                  id="cadence_max"
                  type="number"
                  min={1}
                  max={10}
                  value={config.cadence_max_attempts}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      cadence_max_attempts: parseInt(e.target.value) || 2,
                    }))
                  }
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500">
                  Número máximo de mensagens de follow-up antes de encerrar a cadência
                </p>
              </div>
            </div>

            {/* Cadence Templates */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Templates de Cadência
              </Label>
              <p className="text-xs text-gray-500">
                Mensagens enviadas sequencialmente quando o paciente não responde. Use{" "}
                <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code> para personalizar.
              </p>

              {config.cadence_templates.length === 0 && (
                <div className="text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                  Nenhum template adicionado. Adicione abaixo.
                </div>
              )}

              {config.cadence_templates.map((template, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-2.5 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <Textarea
                    value={template}
                    onChange={(e) => handleUpdateTemplate(index, e.target.value)}
                    rows={2}
                    className="flex-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-none text-sm"
                    placeholder={`Mensagem ${index + 1} da cadência`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTemplate(index)}
                    className="mt-1 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    aria-label="Remover template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add new template */}
              <div className="flex items-start gap-2 pt-1">
                <div className="flex-shrink-0 mt-2.5 w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold flex items-center justify-center">
                  +
                </div>
                <Textarea
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddTemplate();
                    }
                  }}
                  rows={2}
                  className="flex-1 border-dashed border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-none text-sm"
                  placeholder="Digite o novo template e clique em Adicionar (ou Ctrl+Enter)"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAddTemplate}
                  disabled={!newTemplate.trim()}
                  className="mt-1 border-purple-300 text-purple-600 hover:bg-purple-50 flex-shrink-0"
                  aria-label="Adicionar template"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Template */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
            <CardTitle className="text-lg text-gray-900">Template de Confirmação de Agendamento</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Textarea
              id="confirmation_template"
              value={config.confirmation_template}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, confirmation_template: e.target.value }))
              }
              rows={5}
              placeholder={`Ex: Olá {nome}! Sua consulta na {clinic_name} está confirmada para {data} às {horario}.\n\nCaso precise remarcar, é só nos avisar. Até lá!`}
              className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
            />
            <p className="text-xs text-gray-500">
              Mensagem enviada ao paciente após confirmação do agendamento. Variáveis disponíveis:{" "}
              <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{data}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{horario}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{clinic_name}"}</code>.
            </p>
          </CardContent>
        </Card>

        {/* Bottom Save */}
        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-slate-700 hover:from-purple-700 hover:to-slate-800 text-white shadow-md px-8"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configuração
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotConfigPage;
