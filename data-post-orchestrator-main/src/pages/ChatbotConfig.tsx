import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bot, Save, Plus, Trash2, Key, Eye, EyeOff, MessageSquare, Settings,
  ShieldAlert, Info, Package, ArrowLeft, Link2, Unlink, Pencil, Copy,
  Globe, Calendar, Clock, Ban, Timer,
} from "lucide-react";
import {
  useChatbotConfig,
  DEFAULT_CHATBOT_CONFIG,
  DEFAULT_TENANT_SETTINGS,
  MAX_BOTS_PER_TENANT,
  ChatbotConfig,
  TenantSettings,
  UazapiInstance,
  ScheduleConfig,
  ScheduleDay,
  BlockedPeriod,
  Tratamento,
  DEFAULT_SCHEDULE_CONFIG,
} from "@/hooks/useChatbotConfig";

// ============================================================================
// Bot List View
// ============================================================================

interface BotListProps {
  bots: ChatbotConfig[];
  instances: UazapiInstance[];
  tenantSettings: TenantSettings;
  onEdit: (bot: ChatbotConfig) => void;
  onNew: () => void;
  onDelete: (botId: string) => void;
  onDuplicate: (bot: ChatbotConfig) => void;
  onEditGlobal: () => void;
}

function BotList({ bots, instances, tenantSettings, onEdit, onNew, onDelete, onDuplicate, onEditGlobal }: BotListProps) {
  const getLinkedInstances = (botId: string) =>
    instances.filter((inst) => inst.chatbot_config_id === botId);

  const canCreateMore = bots.length < MAX_BOTS_PER_TENANT;

  return (
    <div className="space-y-6">
      {/* Global Settings Card */}
      <Card className="shadow-lg border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-lg">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Configurações Gerais</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Chave OpenAI, modelo e histórico — compartilhados por todos os bots
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
                <span>Modelo: <strong className="text-gray-700">{tenantSettings.openai_model || "—"}</strong></span>
                <span className="text-gray-300">|</span>
                <span>API Key: <strong className="text-gray-700">{tenantSettings.openai_api_key ? "Configurada" : "Não configurada"}</strong></span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditGlobal}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configurar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot List */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seus Bots</h2>
          <p className="text-sm text-gray-500">
            {bots.length}/{MAX_BOTS_PER_TENANT} bots criados — vincule a instâncias WhatsApp
          </p>
        </div>
        <Button
          onClick={onNew}
          disabled={!canCreateMore}
          className="bg-gradient-to-r from-purple-600 to-slate-700 hover:from-purple-700 hover:to-slate-800 text-white shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Bot
        </Button>
      </div>

      {!canCreateMore && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Limite de {MAX_BOTS_PER_TENANT} bots atingido. Exclua um bot existente para criar outro.
        </div>
      )}

      {bots.length === 0 ? (
        <Card className="shadow-lg border-dashed border-2 border-gray-300">
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">Nenhum bot criado</h3>
            <p className="text-sm text-gray-400 mb-6">
              Crie seu primeiro bot para automatizar o atendimento via WhatsApp
            </p>
            <Button onClick={onNew} variant="outline" className="border-purple-300 text-purple-600">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => {
            const linked = getLinkedInstances(bot.id!);
            return (
              <Card key={bot.id} className="shadow-lg border-gray-200 hover:shadow-xl transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${bot.bot_enabled ? "bg-green-100" : "bg-gray-100"}`}>
                        <Bot className={`h-5 w-5 ${bot.bot_enabled ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{bot.name || "Bot sem nome"}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={bot.bot_enabled ? "default" : "secondary"} className="text-xs">
                            {bot.bot_enabled ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {(bot.mode || "agendamento_flexivel").replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {bot.clinic_name && (
                    <p className="text-sm text-gray-500 mb-2">
                      {bot.clinic_name} {bot.clinic_tone ? `· ${bot.clinic_tone}` : ""}
                    </p>
                  )}

                  {/* Linked instances */}
                  <div className="mb-4">
                    {linked.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {linked.map((inst) => (
                          <Badge key={inst.id} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                            <Link2 className="h-3 w-3 mr-1" />
                            {inst.name || inst.profile_name || inst.instance_id}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlink className="h-3 w-3" />
                        Nenhuma instância vinculada
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(bot)}
                      className="flex-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicate(bot)}
                      disabled={!canCreateMore}
                      className="text-gray-500 border-gray-200 hover:bg-gray-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir "${bot.name}"?`)) {
                          onDelete(bot.id!);
                        }
                      }}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Global Settings Editor
// ============================================================================

interface GlobalSettingsEditorProps {
  settings: TenantSettings;
  onSave: (settings: Omit<TenantSettings, "id" | "tenant_id" | "created_at" | "updated_at">) => Promise<boolean>;
  onBack: () => void;
}

function GlobalSettingsEditor({ settings, onSave, onBack }: GlobalSettingsEditorProps) {
  const [form, setForm] = useState({
    openai_api_key: settings.openai_api_key,
    openai_model: settings.openai_model,
    max_history_messages: settings.max_history_messages,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await onSave(form);
      if (success) {
        toast.success("Configurações gerais salvas!");
        onBack();
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key */}
      <Card className="shadow-lg border-gray-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900">Chave da OpenAI</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">Usada por todos os bots do seu tenant</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai_api_key" className="text-sm font-medium text-gray-700">API Key</Label>
            <div className="relative">
              <Input
                id="openai_api_key"
                type={showApiKey ? "text" : "password"}
                value={form.openai_api_key}
                onChange={(e) => setForm((prev) => ({ ...prev, openai_api_key: e.target.value }))}
                placeholder="sk-..."
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10 font-mono text-sm"
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
              Obtenha em <span className="font-medium">platform.openai.com/api-keys</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Model + History */}
      <Card className="shadow-lg border-gray-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b">
          <CardTitle className="text-lg text-gray-900">Modelo e Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Modelo OpenAI</Label>
              <Select
                value={form.openai_model}
                onValueChange={(value) => setForm((prev) => ({ ...prev, openai_model: value }))}
              >
                <SelectTrigger className="border-gray-300 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Modelo usado por todos os bots</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_history" className="text-sm font-medium text-gray-700">Máx. Mensagens no Histórico</Label>
              <Input
                id="max_history"
                type="number"
                min={1}
                max={50}
                value={form.max_history_messages}
                onChange={(e) => setForm((prev) => ({ ...prev, max_history_messages: parseInt(e.target.value) || 15 }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">Quantidade de mensagens enviadas ao modelo como contexto</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-slate-700 hover:from-blue-700 hover:to-slate-800 text-white shadow-md px-8"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações Gerais
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

const ChatbotConfigPage = () => {
  const {
    fetchBots, createBot, updateBot, deleteBot, fetchInstances, linkInstance,
    fetchTenantSettings, saveTenantSettings, tenantId,
    fetchScheduleConfig, saveScheduleConfig, fetchBlockedPeriods, addBlockedPeriod, deleteBlockedPeriod, fetchTratamentos, updateTratamentoDuration,
  } = useChatbotConfig();

  const [bots, setBots] = useState<ChatbotConfig[]>([]);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({ ...DEFAULT_TENANT_SETTINGS });

  // View state: "list" | "editBot" | "editGlobal"
  const [view, setView] = useState<"list" | "editBot" | "editGlobal">("list");
  const [editingBot, setEditingBot] = useState<ChatbotConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [config, setConfig] = useState<Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at">>(
    DEFAULT_CHATBOT_CONFIG as any
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");

  // Schedule (agendamento_fixo)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({ ...DEFAULT_SCHEDULE_CONFIG });
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedStart, setNewBlockedStart] = useState("08:00");
  const [newBlockedEnd, setNewBlockedEnd] = useState("18:00");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const [newAllowedDate, setNewAllowedDate] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [botsData, instancesData, settingsData] = await Promise.all([
        fetchBots(),
        fetchInstances(),
        fetchTenantSettings(),
      ]);
      setBots(botsData);
      setInstances(instancesData);
      setTenantSettings(settingsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [fetchBots, fetchInstances, fetchTenantSettings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNew = () => {
    if (bots.length >= MAX_BOTS_PER_TENANT) {
      toast.error(`Limite de ${MAX_BOTS_PER_TENANT} bots atingido`);
      return;
    }
    setEditingBot(null);
    setIsNew(true);
    setConfig({ ...DEFAULT_CHATBOT_CONFIG } as any);
    setScheduleConfig({ ...DEFAULT_SCHEDULE_CONFIG });
    setBlockedPeriods([]);
    setTratamentos([]);
    setNewAllowedDate("");
    setView("editBot");
  };

  const handleEdit = (bot: ChatbotConfig) => {
    setEditingBot(bot);
    setIsNew(false);
    const { id, tenant_id, created_at, updated_at, openai_api_key, openai_model, max_history_messages, ...rest } = bot as any;
    setConfig({
      ...DEFAULT_CHATBOT_CONFIG,
      ...rest,
      cadence_templates: Array.isArray(rest.cadence_templates) ? rest.cadence_templates : [],
    } as any);
    setView("editBot");
    // Load schedule data if fixo mode
    if (bot.mode === "agendamento_fixo" && bot.id) {
      Promise.all([
        fetchScheduleConfig(bot.id),
        fetchBlockedPeriods(bot.id),
        fetchTratamentos(),
      ]).then(([sched, blocked, trats]) => {
        setScheduleConfig(sched);
        setBlockedPeriods(blocked);
        setTratamentos(trats);
      });
    }
  };

  const handleDuplicate = async (bot: ChatbotConfig) => {
    if (bots.length >= MAX_BOTS_PER_TENANT) {
      toast.error(`Limite de ${MAX_BOTS_PER_TENANT} bots atingido`);
      return;
    }
    const { id, tenant_id, created_at, updated_at, openai_api_key, openai_model, max_history_messages, ...rest } = bot as any;
    const duplicated = await createBot({
      ...DEFAULT_CHATBOT_CONFIG,
      ...rest,
      name: `${rest.name || "Bot"} (cópia)`,
      cadence_templates: Array.isArray(rest.cadence_templates) ? rest.cadence_templates : [],
    } as any);
    if (duplicated) {
      toast.success("Bot duplicado com sucesso!");
      await loadData();
    } else {
      toast.error("Erro ao duplicar bot");
    }
  };

  const handleDelete = async (botId: string) => {
    const success = await deleteBot(botId);
    if (success) {
      toast.success("Bot excluído");
      await loadData();
    } else {
      toast.error("Erro ao excluir bot");
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast.error("Tenant não identificado.");
      return;
    }

    if (!config.name?.trim()) {
      toast.error("O bot precisa de um nome.");
      return;
    }

    if (config.mode === "agendamento_fixo") {
      if (scheduleConfig.weekly_schedule.length === 0) {
        toast.error("Configure ao menos um dia na grade semanal para o modo Agendamento Fixo");
        return;
      }
      const invalidDay = scheduleConfig.weekly_schedule.find(s => s.start >= s.end);
      if (invalidDay) {
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        toast.error(`Horário inválido em ${dayNames[invalidDay.day]}: início deve ser antes do fim`);
        return;
      }
    }

    setSaving(true);
    try {
      let saved: ChatbotConfig | null;
      if (isNew) {
        saved = await createBot(config);
      } else if (editingBot?.id) {
        saved = await updateBot(editingBot.id, config);
      } else {
        saved = null;
      }

      if (saved) {
        // Save schedule config if agendamento_fixo
        if (config.mode === "agendamento_fixo" && saved?.id) {
          await saveScheduleConfig(saved.id, {
            weekly_schedule: scheduleConfig.weekly_schedule,
            lookahead_days: scheduleConfig.lookahead_days,
            allow_bot_cancel: scheduleConfig.allow_bot_cancel,
            slot_buffer_minutes: scheduleConfig.slot_buffer_minutes,
            allowed_dates: scheduleConfig.allowed_dates,
            allow_double_booking: scheduleConfig.allow_double_booking,
          });
        }
        toast.success(isNew ? "Bot criado com sucesso!" : "Bot atualizado!");
        await loadData();
        setView("list");
        setEditingBot(null);
        setIsNew(false);
      } else {
        toast.error("Erro ao salvar bot");
      }
    } catch (error) {
      console.error("Erro ao salvar bot:", error);
      toast.error("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setView("list");
    setEditingBot(null);
    setIsNew(false);
  };

  const handleToggleInstance = async (instanceId: string, currentBotId: string | null) => {
    const botId = editingBot?.id || null;
    if (!botId) return;

    const newValue = currentBotId === botId ? null : botId;
    const success = await linkInstance(instanceId, newValue);
    if (success) {
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId ? { ...inst, chatbot_config_id: newValue } : inst
        )
      );
      toast.success(newValue ? "Instância vinculada" : "Instância desvinculada");
    } else {
      toast.error("Erro ao vincular instância");
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

  const handleSaveGlobalSettings = async (settings: Omit<TenantSettings, "id" | "tenant_id" | "created_at" | "updated_at">) => {
    const success = await saveTenantSettings(settings);
    if (success) {
      setTenantSettings((prev) => ({ ...prev, ...settings }));
    }
    return success;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const isEditing = view === "editBot";
  const isEditingGlobal = view === "editGlobal";

  // Header title/subtitle
  let headerTitle = "Chatbot IA";
  let headerSubtitle = "Gerencie seus bots e vincule às instâncias WhatsApp";
  if (isEditing) {
    headerTitle = isNew ? "Novo Bot" : `Editando: ${editingBot?.name || "Bot"}`;
    headerSubtitle = "Configure o comportamento e personalidade";
  } else if (isEditingGlobal) {
    headerTitle = "Configurações Gerais";
    headerSubtitle = "Chave OpenAI, modelo e histórico — compartilhados por todos os bots";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {(isEditing || isEditingGlobal) && (
                <Button variant="ghost" size="icon" onClick={handleBack} className="mr-1">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className={`p-2 rounded-lg ${isEditingGlobal
                ? "bg-gradient-to-r from-blue-600 to-slate-600"
                : "bg-gradient-to-r from-purple-600 to-slate-600"
              }`}>
                {isEditingGlobal ? <Globe className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{headerTitle}</h1>
                <p className="text-sm text-gray-500">{headerSubtitle}</p>
              </div>
            </div>
            {isEditing && (
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
                    {isNew ? "Criar Bot" : "Salvar"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============================================================ */}
        {/* List View */}
        {/* ============================================================ */}
        {view === "list" && (
          <BotList
            bots={bots}
            instances={instances}
            tenantSettings={tenantSettings}
            onEdit={handleEdit}
            onNew={handleNew}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onEditGlobal={() => setView("editGlobal")}
          />
        )}

        {/* ============================================================ */}
        {/* Global Settings Editor */}
        {/* ============================================================ */}
        {view === "editGlobal" && (
          <GlobalSettingsEditor
            settings={tenantSettings}
            onSave={handleSaveGlobalSettings}
            onBack={handleBack}
          />
        )}

        {/* ============================================================ */}
        {/* Bot Editor */}
        {/* ============================================================ */}
        {view === "editBot" && (
          <>
            <Tabs defaultValue="personalidade" className="space-y-6">
              <TabsList className="bg-white border border-gray-200 shadow-sm p-1 h-auto flex-wrap">
                <TabsTrigger value="personalidade" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Personalidade
                </TabsTrigger>
                <TabsTrigger value="cadencia" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 gap-2">
                  <Bot className="h-4 w-4" />
                  Cadência
                </TabsTrigger>
                {config.mode === "agendamento_fixo" && (
                  <TabsTrigger value="agenda" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 gap-2">
                    <Calendar className="h-4 w-4" />
                    Agenda
                  </TabsTrigger>
                )}
                <TabsTrigger value="instancias" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 gap-2">
                  <Link2 className="h-4 w-4" />
                  Instâncias
                </TabsTrigger>
                <TabsTrigger value="tecnico" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 gap-2">
                  <Settings className="h-4 w-4" />
                  Técnico
                </TabsTrigger>
              </TabsList>

              {/* ========== TAB: Personalidade ========== */}
              <TabsContent value="personalidade" className="space-y-6">
                {/* Bot Name + Mode + Enabled */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Bot className="h-5 w-5 text-purple-600" />
                      </div>
                      <CardTitle className="text-lg text-gray-900">Identificação do Bot</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bot Ativo</p>
                        <p className="text-xs text-gray-500 mt-0.5">Ativa o atendimento automático para as instâncias vinculadas</p>
                      </div>
                      <Switch
                        checked={config.bot_enabled}
                        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, bot_enabled: checked }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bot_name" className="text-sm font-medium text-gray-700">Nome do Bot</Label>
                        <Input
                          id="bot_name"
                          value={config.name}
                          onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Bot Agendamento"
                          className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Modo do Bot</Label>
                        <Select
                          value={config.mode}
                          onValueChange={(val) => {
                            setConfig((p) => ({ ...p, mode: val }));
                            if (val === "agendamento_fixo") {
                              fetchTratamentos().then(setTratamentos);
                              if (editingBot?.id) {
                                fetchScheduleConfig(editingBot.id).then(setScheduleConfig);
                                fetchBlockedPeriods(editingBot.id).then(setBlockedPeriods);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="border-gray-300 focus:ring-purple-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agendamento_flexivel">Agendamento Flexível</SelectItem>
                            <SelectItem value="agendamento_fixo">Agendamento Fixo</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">O modo define o fluxo de conversa do bot</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinic_name" className="text-sm font-medium text-gray-700">Nome da Clínica</Label>
                        <Input
                          id="clinic_name"
                          value={config.clinic_name}
                          onChange={(e) => setConfig((prev) => ({ ...prev, clinic_name: e.target.value }))}
                          placeholder="Ex: Clínica Odonto Vida"
                          className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clinic_tone" className="text-sm font-medium text-gray-700">Tom de Comunicação</Label>
                      <Input
                        id="clinic_tone"
                        value={config.clinic_tone}
                        onChange={(e) => setConfig((prev) => ({ ...prev, clinic_tone: e.target.value }))}
                        placeholder="profissional e acolhedor"
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Persona */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">Persona e Papel</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">Defina quem o bot é e como se comporta</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.bot_persona}
                      onChange={(e) => setConfig((prev) => ({ ...prev, bot_persona: e.target.value }))}
                      rows={5}
                      placeholder="Ex: Você se chama Ana, é a assistente virtual da Clínica Odonto Vida. Você é simpática, usa linguagem informal mas profissional. Sempre trata o paciente pelo nome. Usa emojis com moderação."
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">O fluxo principal de atendimento (até agendamento) não será afetado.</p>
                  </CardContent>
                </Card>

                {/* Contexto */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Info className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">Contexto Inicial</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">Informações gerais sobre a clínica</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.bot_context}
                      onChange={(e) => setConfig((prev) => ({ ...prev, bot_context: e.target.value }))}
                      rows={5}
                      placeholder="Ex: A Clínica Odonto Vida fica na Rua das Flores, 123. Funciona de segunda a sexta 8h-18h, sábado 8h-12h. Aceita todos os convênios."
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Produtos e Serviços */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">Produtos e Serviços</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">O que a clínica oferece</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.bot_services_info}
                      onChange={(e) => setConfig((prev) => ({ ...prev, bot_services_info: e.target.value }))}
                      rows={5}
                      placeholder="Ex: Clareamento dental a partir de R$ 800, Implante com avaliação gratuita, Ortodontia convencional e Invisalign."
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">Os tratamentos cadastrados no sistema são incluídos automaticamente.</p>
                  </CardContent>
                </Card>

                {/* Restrições */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2 rounded-lg">
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">Restrições</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">O que o bot NÃO pode fazer</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.bot_restrictions}
                      onChange={(e) => setConfig((prev) => ({ ...prev, bot_restrictions: e.target.value }))}
                      rows={4}
                      placeholder="Ex: Nunca informar preços exatos, não dar diagnósticos, não falar sobre concorrentes."
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">Estas restrições têm prioridade máxima sobre outros comportamentos.</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== TAB: Instâncias ========== */}
              <TabsContent value="instancias" className="space-y-6">
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Link2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">Instâncias WhatsApp</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Selecione quais instâncias usarão este bot. Cada instância pode ter apenas um bot vinculado.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isNew ? (
                      <div className="text-center py-8 text-gray-400">
                        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Salve o bot primeiro para vincular instâncias</p>
                      </div>
                    ) : instances.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">Nenhuma instância WhatsApp cadastrada</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {instances.map((inst) => {
                          const isLinkedToThis = inst.chatbot_config_id === editingBot?.id;
                          const isLinkedToOther = inst.chatbot_config_id && !isLinkedToThis;
                          const otherBot = isLinkedToOther
                            ? bots.find((b) => b.id === inst.chatbot_config_id)
                            : null;

                          return (
                            <div
                              key={inst.id}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                                isLinkedToThis
                                  ? "bg-purple-50 border-purple-200"
                                  : isLinkedToOther
                                  ? "bg-gray-50 border-gray-200 opacity-60"
                                  : "bg-white border-gray-200 hover:border-purple-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isLinkedToThis}
                                  disabled={!!isLinkedToOther}
                                  onCheckedChange={() => handleToggleInstance(inst.id, inst.chatbot_config_id)}
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {inst.name || inst.profile_name || inst.instance_id}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge
                                      variant={inst.connected ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {inst.connected ? "Conectada" : "Desconectada"}
                                    </Badge>
                                    {isLinkedToOther && otherBot && (
                                      <span className="text-xs text-gray-400">
                                        Vinculada a: {otherBot.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isLinkedToThis && (
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Vinculada
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== TAB: Técnico ========== */}
              <TabsContent value="tecnico" className="space-y-6">
                {/* Info about global settings */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Globe className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <strong>Chave OpenAI, modelo e histórico</strong> são configurações globais compartilhadas por todos os bots.{" "}
                    <button
                      onClick={() => setView("editGlobal")}
                      className="underline font-medium hover:text-blue-900"
                    >
                      Editar configurações gerais
                    </button>
                  </div>
                </div>

                {/* Advanced Prompt */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <CardTitle className="text-lg text-gray-900">Prompt Avançado (Opcional)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.system_prompt}
                      onChange={(e) => setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))}
                      rows={5}
                      placeholder="Instruções adicionais avançadas para o modelo (opcional)"
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y font-mono text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Confirmation Template */}
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <CardTitle className="text-lg text-gray-900">Template de Confirmação</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea
                      value={config.confirmation_template}
                      onChange={(e) => setConfig((prev) => ({ ...prev, confirmation_template: e.target.value }))}
                      rows={3}
                      placeholder="Ex: Olá {nome}! Sua consulta na {clinic_name} está confirmada."
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-y text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Variáveis: <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code>,{" "}
                      <code className="bg-gray-100 px-1 rounded">{"{clinic_name}"}</code>
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== TAB: Cadência ========== */}
              <TabsContent value="cadencia" className="space-y-6">
                <Card className="shadow-lg border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                    <CardTitle className="text-lg text-gray-900">Cadência de Follow-up</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Intervalo (horas)</Label>
                        <Input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={config.cadence_timeout_hours}
                          onChange={(e) => setConfig((prev) => ({ ...prev, cadence_timeout_hours: parseFloat(e.target.value) || 3 }))}
                          className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Máx. Tentativas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={config.cadence_max_attempts}
                          onChange={(e) => setConfig((prev) => ({ ...prev, cadence_max_attempts: parseInt(e.target.value) || 2 }))}
                          className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    {/* Templates */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">Templates de Cadência</Label>

                      {config.cadence_templates.length === 0 && (
                        <div className="text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                          Nenhum template adicionado.
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
                            className="flex-1 border-gray-300 resize-none text-sm"
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveTemplate(index)} className="mt-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <div className="flex items-start gap-2 pt-1">
                        <div className="flex-shrink-0 mt-2.5 w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold flex items-center justify-center">+</div>
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
                          className="flex-1 border-dashed border-gray-300 resize-none text-sm"
                          placeholder="Novo template (Ctrl+Enter para adicionar)"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleAddTemplate}
                          disabled={!newTemplate.trim()}
                          className="mt-1 border-purple-300 text-purple-600"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== TAB: Agenda (agendamento_fixo only) ========== */}
              {config.mode === "agendamento_fixo" && (
                <TabsContent value="agenda" className="space-y-6">
                  {/* Grade Semanal */}
                  <Card className="shadow-lg border-gray-200">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Calendar className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Grade Semanal</CardTitle>
                          <p className="text-sm text-gray-500">Dias e horários disponíveis para agendamento</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {[
                        { day: 1, label: "Segunda-feira" },
                        { day: 2, label: "Terça-feira" },
                        { day: 3, label: "Quarta-feira" },
                        { day: 4, label: "Quinta-feira" },
                        { day: 5, label: "Sexta-feira" },
                        { day: 6, label: "Sábado" },
                        { day: 0, label: "Domingo" },
                      ].map(({ day, label }) => {
                        const existing = scheduleConfig.weekly_schedule.find((s) => s.day === day);
                        return (
                          <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <Checkbox
                              checked={!!existing}
                              onCheckedChange={(checked) => {
                                setScheduleConfig((prev) => {
                                  const filtered = prev.weekly_schedule.filter((s) => s.day !== day);
                                  if (checked) {
                                    filtered.push({ day, start: "08:00", end: "18:00" });
                                    filtered.sort((a, b) => a.day - b.day);
                                  }
                                  return { ...prev, weekly_schedule: filtered };
                                });
                              }}
                            />
                            <span className="w-32 font-medium text-gray-700">{label}</span>
                            {existing && (
                              <>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <Input
                                    type="time"
                                    value={existing.start}
                                    onChange={(e) => {
                                      setScheduleConfig((prev) => ({
                                        ...prev,
                                        weekly_schedule: prev.weekly_schedule.map((s) =>
                                          s.day === day ? { ...s, start: e.target.value } : s
                                        ),
                                      }));
                                    }}
                                    className="w-32"
                                  />
                                  <span className="text-gray-400">até</span>
                                  <Input
                                    type="time"
                                    value={existing.end}
                                    onChange={(e) => {
                                      setScheduleConfig((prev) => ({
                                        ...prev,
                                        weekly_schedule: prev.weekly_schedule.map((s) =>
                                          s.day === day ? { ...s, end: e.target.value } : s
                                        ),
                                      }));
                                    }}
                                    className="w-32"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Datas Específicas Permitidas */}
                  <Card className="shadow-lg border-gray-200">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Calendar className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Datas Específicas Permitidas</CardTitle>
                          <p className="text-sm text-gray-500">
                            Se preenchido, o bot só agenda nessas datas (ignora a grade semanal).
                            Se vazio, usa a grade semanal normalmente.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-end gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <div className="space-y-1 flex-1">
                          <Label className="text-xs">Selecione uma data</Label>
                          <Input
                            type="date"
                            value={newAllowedDate}
                            onChange={(e) => setNewAllowedDate(e.target.value)}
                            className="w-48"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!newAllowedDate}
                          onClick={() => {
                            if (!newAllowedDate) return;
                            if (scheduleConfig.allowed_dates.includes(newAllowedDate)) {
                              toast.error("Esta data já foi adicionada");
                              return;
                            }
                            setScheduleConfig((prev) => ({
                              ...prev,
                              allowed_dates: [...prev.allowed_dates, newAllowedDate].sort(),
                            }));
                            setNewAllowedDate("");
                            toast.success("Data adicionada");
                          }}
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {scheduleConfig.allowed_dates.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Nenhuma data específica — o bot usará a grade semanal
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {scheduleConfig.allowed_dates.map((date) => (
                            <Badge
                              key={date}
                              variant="secondary"
                              className="bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 text-sm flex items-center gap-2"
                            >
                              {new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}
                              <button
                                type="button"
                                className="text-green-400 hover:text-red-500 transition-colors"
                                onClick={() => {
                                  setScheduleConfig((prev) => ({
                                    ...prev,
                                    allowed_dates: prev.allowed_dates.filter((d) => d !== date),
                                  }));
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {scheduleConfig.allowed_dates.length > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <Info className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-green-700">
                            Com datas específicas configuradas, o bot <strong>só</strong> oferecerá horários nessas datas,
                            respeitando os horários da grade semanal para o dia da semana correspondente.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Configurações de Agendamento */}
                  <Card className="shadow-lg border-gray-200">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Settings className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Configurações</CardTitle>
                          <p className="text-sm text-gray-500">Janela de agendamento, buffer e permissões</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Janela de agendamento (dias à frente)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={90}
                            value={scheduleConfig.lookahead_days}
                            onChange={(e) => setScheduleConfig((p) => ({ ...p, lookahead_days: parseInt(e.target.value) || 14 }))}
                          />
                          <p className="text-xs text-gray-500">Quantos dias no futuro o bot pode agendar</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Buffer entre consultas (minutos)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={120}
                            value={scheduleConfig.slot_buffer_minutes}
                            onChange={(e) => setScheduleConfig((p) => ({ ...p, slot_buffer_minutes: parseInt(e.target.value) || 0 }))}
                          />
                          <p className="text-xs text-gray-500">Intervalo mínimo entre consultas consecutivas</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-base">Permitir cancelamento via bot</Label>
                          <p className="text-sm text-gray-500">O bot pode cancelar/reagendar consultas pelo WhatsApp</p>
                        </div>
                        <Switch
                          checked={scheduleConfig.allow_bot_cancel}
                          onCheckedChange={(checked) => setScheduleConfig((p) => ({ ...p, allow_bot_cancel: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-base">Permitir dois pacientes no mesmo horário</Label>
                          <p className="text-sm text-gray-500">Se ativado, o bot pode agendar mais de um paciente no mesmo slot</p>
                        </div>
                        <Switch
                          checked={scheduleConfig.allow_double_booking}
                          onCheckedChange={(checked) => setScheduleConfig((p) => ({ ...p, allow_double_booking: checked }))}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Períodos Bloqueados */}
                  <Card className="shadow-lg border-gray-200">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                          <Ban className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Períodos Bloqueados</CardTitle>
                          <p className="text-sm text-gray-500">Datas e horários indisponíveis para agendamento</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {/* Add new blocked period */}
                      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <div className="space-y-1">
                          <Label className="text-xs">Data</Label>
                          <Input
                            type="date"
                            value={newBlockedDate}
                            onChange={(e) => setNewBlockedDate(e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="time"
                            value={newBlockedStart}
                            onChange={(e) => setNewBlockedStart(e.target.value)}
                            className="w-32"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="time"
                            value={newBlockedEnd}
                            onChange={(e) => setNewBlockedEnd(e.target.value)}
                            className="w-32"
                          />
                        </div>
                        <div className="space-y-1 flex-1 min-w-[120px]">
                          <Label className="text-xs">Motivo (opcional)</Label>
                          <Input
                            value={newBlockedReason}
                            onChange={(e) => setNewBlockedReason(e.target.value)}
                            placeholder="Ex: Feriado"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!newBlockedDate || !newBlockedStart || !newBlockedEnd) {
                              toast.error("Preencha data, início e fim");
                              return;
                            }
                            if (newBlockedStart >= newBlockedEnd) {
                              toast.error("Horário de início deve ser antes do fim");
                              return;
                            }
                            const botId = editingBot?.id;
                            if (!botId) {
                              toast.error("Salve o bot antes de adicionar períodos bloqueados");
                              return;
                            }
                            const added = await addBlockedPeriod(botId, {
                              blocked_date: newBlockedDate,
                              start_time: newBlockedStart,
                              end_time: newBlockedEnd,
                              reason: newBlockedReason || undefined,
                            });
                            if (added) {
                              setBlockedPeriods((prev) => [...prev, added].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)));
                              setNewBlockedDate("");
                              setNewBlockedReason("");
                              toast.success("Período bloqueado adicionado");
                            } else {
                              toast.error("Erro ao adicionar período");
                            }
                          }}
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {/* List blocked periods */}
                      {blockedPeriods.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Nenhum período bloqueado</p>
                      ) : (
                        <div className="space-y-2">
                          {blockedPeriods.map((bp) => (
                            <div key={bp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                              <div className="flex items-center gap-3">
                                <Ban className="h-4 w-4 text-red-400" />
                                <span className="font-medium text-gray-700">
                                  {new Date(bp.blocked_date + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                                <span className="text-gray-500">
                                  {bp.start_time.slice(0, 5)} - {bp.end_time.slice(0, 5)}
                                </span>
                                {bp.reason && (
                                  <Badge variant="secondary" className="text-xs">{bp.reason}</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-600 hover:bg-red-100"
                                onClick={async () => {
                                  if (bp.id) {
                                    const success = await deleteBlockedPeriod(bp.id);
                                    if (success) {
                                      setBlockedPeriods((prev) => prev.filter((p) => p.id !== bp.id));
                                      toast.success("Período removido");
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Duração dos Tratamentos */}
                  <Card className="shadow-lg border-gray-200">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Timer className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Duração dos Tratamentos</CardTitle>
                          <p className="text-sm text-gray-500">Tempo de cada consulta por tipo de tratamento</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {tratamentos.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Nenhum tratamento cadastrado. Adicione tratamentos na seção de Tratamentos do sistema.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {tratamentos.map((trat) => (
                            <div key={trat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium text-gray-700">{trat.nome}</span>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={15}
                                  max={480}
                                  value={trat.duracao_minutos}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 60;
                                    setTratamentos((prev) =>
                                      prev.map((t) => (t.id === trat.id ? { ...t, duracao_minutos: val } : t))
                                    );
                                  }}
                                  onBlur={() => {
                                    updateTratamentoDuration(trat.id, trat.duracao_minutos);
                                  }}
                                  className="w-24"
                                />
                                <span className="text-sm text-gray-500">min</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>

            {/* Bottom Save (editor only) */}
            <div className="flex justify-end pb-8 pt-6">
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
                    {isNew ? "Criar Bot" : "Salvar"}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatbotConfigPage;
