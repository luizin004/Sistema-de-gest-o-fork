import { useCallback } from "react";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";

export interface ChatbotConfig {
  id?: string;
  tenant_id?: string;
  name: string;
  mode: string;
  bot_enabled: boolean;
  system_prompt: string;
  clinic_name: string;
  clinic_tone: string;
  cadence_timeout_hours: number;
  cadence_max_attempts: number;
  cadence_templates: string[];
  bot_persona: string;
  bot_context: string;
  bot_services_info: string;
  bot_restrictions: string;
  confirmation_template: string;
  // These are kept for backwards compat but no longer per-bot
  openai_model?: string;
  max_history_messages?: number;
  openai_api_key?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TenantSettings {
  id?: string;
  tenant_id?: string;
  openai_api_key: string;
  openai_model: string;
  max_history_messages: number;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleDay {
  day: number; // 0=Domingo, 1=Segunda, ..., 6=Sabado
  start: string; // "08:00"
  end: string; // "18:00"
}

export interface ScheduleConfig {
  id?: string;
  chatbot_config_id?: string;
  tenant_id?: string;
  weekly_schedule: ScheduleDay[];
  lookahead_days: number;
  allow_bot_cancel: boolean;
  slot_buffer_minutes: number;
  allowed_dates: string[]; // ["2026-03-15", "2026-03-20"] - datas específicas permitidas
  allow_double_booking: boolean; // permite dois pacientes no mesmo horário
  created_at?: string;
  updated_at?: string;
}

export interface BlockedPeriod {
  id?: string;
  chatbot_config_id?: string;
  tenant_id?: string;
  blocked_date: string; // "2026-03-15"
  start_time: string; // "14:00"
  end_time: string; // "16:00"
  reason?: string;
  created_at?: string;
}

export interface Tratamento {
  id: string;
  nome: string;
  duracao_minutos: number;
}

export const DEFAULT_SCHEDULE_CONFIG: Omit<ScheduleConfig, "id" | "chatbot_config_id" | "tenant_id" | "created_at" | "updated_at"> = {
  weekly_schedule: [],
  lookahead_days: 14,
  allow_bot_cancel: false,
  slot_buffer_minutes: 0,
  allowed_dates: [],
  allow_double_booking: false,
};

export interface UazapiInstance {
  id: string;
  instance_id: string;
  name: string | null;
  profile_name: string | null;
  chatbot_config_id: string | null;
  connected: boolean | null;
  status: string | null;
}

export const MAX_BOTS_PER_TENANT = 5;

export const DEFAULT_CHATBOT_CONFIG: Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at" | "openai_model" | "max_history_messages" | "openai_api_key"> = {
  name: "Novo Bot",
  mode: "agendamento_flexivel",
  bot_enabled: false,
  system_prompt: "",
  clinic_name: "",
  clinic_tone: "profissional e acolhedor",
  cadence_timeout_hours: 3,
  cadence_max_attempts: 2,
  cadence_templates: [],
  bot_persona: "",
  bot_context: "",
  bot_services_info: "",
  bot_restrictions: "",
  confirmation_template: "",
};

export const DEFAULT_TENANT_SETTINGS: Omit<TenantSettings, "id" | "tenant_id" | "created_at" | "updated_at"> = {
  openai_api_key: "",
  openai_model: "gpt-4o-mini",
  max_history_messages: 15,
};

export const useChatbotConfig = () => {
  const tenantId = getTenantId();

  // ====================================================================
  // Tenant Settings (global: API key, model, max history)
  // ====================================================================

  const fetchTenantSettings = useCallback(async (): Promise<TenantSettings> => {
    if (!tenantId) return { ...DEFAULT_TENANT_SETTINGS };

    const { data, error } = await (supabaseUntyped as any)
      .from("chatbot_tenant_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar tenant settings:", error);
      return { ...DEFAULT_TENANT_SETTINGS };
    }

    if (!data) return { ...DEFAULT_TENANT_SETTINGS };

    return {
      id: data.id,
      tenant_id: data.tenant_id,
      openai_api_key: data.openai_api_key || "",
      openai_model: data.openai_model || "gpt-4o-mini",
      max_history_messages: data.max_history_messages ?? 15,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }, [tenantId]);

  const saveTenantSettings = useCallback(
    async (settings: Omit<TenantSettings, "id" | "tenant_id" | "created_at" | "updated_at">): Promise<boolean> => {
      if (!tenantId) return false;

      const now = new Date().toISOString();

      // Try update first
      const { data: existing } = await (supabaseUntyped as any)
        .from("chatbot_tenant_settings")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await (supabaseUntyped as any)
          .from("chatbot_tenant_settings")
          .update({ ...settings, updated_at: now })
          .eq("id", existing.id);

        if (error) {
          console.error("Erro ao atualizar tenant settings:", error);
          return false;
        }
      } else {
        const { error } = await (supabaseUntyped as any)
          .from("chatbot_tenant_settings")
          .insert({ ...settings, tenant_id: tenantId, created_at: now, updated_at: now });

        if (error) {
          console.error("Erro ao criar tenant settings:", error);
          return false;
        }
      }

      return true;
    },
    [tenantId]
  );

  // ====================================================================
  // Bot CRUD (per-bot settings)
  // ====================================================================

  const fetchBots = useCallback(async (): Promise<ChatbotConfig[]> => {
    if (!tenantId) return [];

    const { data, error } = await (supabaseUntyped as any)
      .from("chatbot_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar chatbot_config:", error);
      return [];
    }

    return (data || []) as ChatbotConfig[];
  }, [tenantId]);

  const fetchBot = useCallback(async (botId: string): Promise<ChatbotConfig | null> => {
    if (!tenantId) return null;

    const { data, error } = await (supabaseUntyped as any)
      .from("chatbot_config")
      .select("*")
      .eq("id", botId)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      console.error("Erro ao buscar bot:", error);
      return null;
    }

    return data as ChatbotConfig;
  }, [tenantId]);

  const createBot = useCallback(
    async (config: Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at">): Promise<ChatbotConfig | null> => {
      if (!tenantId) return null;

      // Check bot limit
      const { count, error: countError } = await (supabaseUntyped as any)
        .from("chatbot_config")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if (!countError && (count ?? 0) >= MAX_BOTS_PER_TENANT) {
        console.error(`Limite de ${MAX_BOTS_PER_TENANT} bots atingido`);
        return null;
      }

      const now = new Date().toISOString();
      // Strip global fields that shouldn't be stored per-bot
      const { openai_api_key, openai_model, max_history_messages, ...botFields } = config as any;
      const payload = {
        ...botFields,
        tenant_id: tenantId,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_config")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar bot:", error);
        return null;
      }

      return data as ChatbotConfig;
    },
    [tenantId]
  );

  const updateBot = useCallback(
    async (botId: string, config: Partial<Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at">>): Promise<ChatbotConfig | null> => {
      if (!tenantId) return null;

      // Strip global fields
      const { openai_api_key, openai_model, max_history_messages, ...botFields } = config as any;
      const payload = {
        ...botFields,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_config")
        .update(payload)
        .eq("id", botId)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar bot:", error);
        return null;
      }

      return data as ChatbotConfig;
    },
    [tenantId]
  );

  const deleteBot = useCallback(
    async (botId: string): Promise<boolean> => {
      if (!tenantId) return false;

      await (supabaseUntyped as any)
        .from("uazapi_instances")
        .update({ chatbot_config_id: null })
        .eq("chatbot_config_id", botId);

      const { error } = await (supabaseUntyped as any)
        .from("chatbot_config")
        .delete()
        .eq("id", botId)
        .eq("tenant_id", tenantId);

      if (error) {
        console.error("Erro ao deletar bot:", error);
        return false;
      }

      return true;
    },
    [tenantId]
  );

  // ====================================================================
  // Instances
  // ====================================================================

  const fetchInstances = useCallback(async (): Promise<UazapiInstance[]> => {
    if (!tenantId) return [];

    const { data, error } = await (supabaseUntyped as any)
      .from("uazapi_instances")
      .select("id, instance_id, name, profile_name, chatbot_config_id, connected, status")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao buscar instâncias:", error);
      return [];
    }

    return (data || []) as UazapiInstance[];
  }, [tenantId]);

  const linkInstance = useCallback(
    async (instanceId: string, botId: string | null): Promise<boolean> => {
      const { error } = await (supabaseUntyped as any)
        .from("uazapi_instances")
        .update({ chatbot_config_id: botId })
        .eq("id", instanceId);

      if (error) {
        console.error("Erro ao vincular instância:", error);
        return false;
      }

      return true;
    },
    []
  );

  // ====================================================================
  // Schedule Config (per-bot, agendamento_fixo)
  // ====================================================================

  const fetchScheduleConfig = useCallback(
    async (botId: string): Promise<ScheduleConfig> => {
      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_schedule_config")
        .select("*")
        .eq("chatbot_config_id", botId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar schedule config:", error);
        return { ...DEFAULT_SCHEDULE_CONFIG };
      }
      if (!data) return { ...DEFAULT_SCHEDULE_CONFIG };

      return {
        id: data.id,
        chatbot_config_id: data.chatbot_config_id,
        tenant_id: data.tenant_id,
        weekly_schedule: data.weekly_schedule || [],
        lookahead_days: data.lookahead_days ?? 14,
        allow_bot_cancel: data.allow_bot_cancel ?? false,
        slot_buffer_minutes: data.slot_buffer_minutes ?? 0,
        allowed_dates: data.allowed_dates || [],
        allow_double_booking: data.allow_double_booking ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    },
    []
  );

  const saveScheduleConfig = useCallback(
    async (botId: string, config: Omit<ScheduleConfig, "id" | "chatbot_config_id" | "tenant_id" | "created_at" | "updated_at">): Promise<boolean> => {
      if (!tenantId) return false;

      const now = new Date().toISOString();

      const { data: existing } = await (supabaseUntyped as any)
        .from("chatbot_schedule_config")
        .select("id")
        .eq("chatbot_config_id", botId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await (supabaseUntyped as any)
          .from("chatbot_schedule_config")
          .update({ ...config, updated_at: now })
          .eq("id", existing.id);

        if (error) {
          console.error("Erro ao atualizar schedule config:", error);
          return false;
        }
      } else {
        const { error } = await (supabaseUntyped as any)
          .from("chatbot_schedule_config")
          .insert({
            ...config,
            chatbot_config_id: botId,
            tenant_id: tenantId,
            created_at: now,
            updated_at: now,
          });

        if (error) {
          console.error("Erro ao criar schedule config:", error);
          return false;
        }
      }

      return true;
    },
    [tenantId]
  );

  // ====================================================================
  // Blocked Periods (per-bot)
  // ====================================================================

  const fetchBlockedPeriods = useCallback(
    async (botId: string): Promise<BlockedPeriod[]> => {
      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_blocked_periods")
        .select("*")
        .eq("chatbot_config_id", botId)
        .order("blocked_date", { ascending: true });

      if (error) {
        console.error("Erro ao buscar blocked periods:", error);
        return [];
      }

      return (data || []) as BlockedPeriod[];
    },
    []
  );

  const addBlockedPeriod = useCallback(
    async (botId: string, period: Omit<BlockedPeriod, "id" | "chatbot_config_id" | "tenant_id" | "created_at">): Promise<BlockedPeriod | null> => {
      if (!tenantId) return null;

      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_blocked_periods")
        .insert({
          ...period,
          chatbot_config_id: botId,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar blocked period:", error);
        return null;
      }

      return data as BlockedPeriod;
    },
    [tenantId]
  );

  const deleteBlockedPeriod = useCallback(
    async (periodId: string): Promise<boolean> => {
      const { error } = await (supabaseUntyped as any)
        .from("chatbot_blocked_periods")
        .delete()
        .eq("id", periodId);

      if (error) {
        console.error("Erro ao deletar blocked period:", error);
        return false;
      }

      return true;
    },
    []
  );

  // ====================================================================
  // Tratamentos (duration)
  // ====================================================================

  const fetchTratamentos = useCallback(async (): Promise<Tratamento[]> => {
    if (!tenantId) return [];

    const { data, error } = await (supabaseUntyped as any)
      .from("tratamentos")
      .select("id, nome, duracao_minutos")
      .eq("tenant_id", tenantId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao buscar tratamentos:", error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      nome: t.nome,
      duracao_minutos: t.duracao_minutos ?? 60,
    }));
  }, [tenantId]);

  const updateTratamentoDuration = useCallback(
    async (tratamentoId: string, duracao: number): Promise<boolean> => {
      const { error } = await (supabaseUntyped as any)
        .from("tratamentos")
        .update({ duracao_minutos: duracao })
        .eq("id", tratamentoId);

      if (error) {
        console.error("Erro ao atualizar duração:", error);
        return false;
      }

      return true;
    },
    []
  );

  // ====================================================================
  // Legacy compat
  // ====================================================================

  const fetchConfig = useCallback(async (): Promise<ChatbotConfig | null> => {
    if (!tenantId) return null;

    const { data, error } = await (supabaseUntyped as any)
      .from("chatbot_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar chatbot_config:", error);
      return null;
    }

    return data as ChatbotConfig | null;
  }, [tenantId]);

  const saveConfig = useCallback(
    async (config: Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at">): Promise<ChatbotConfig | null> => {
      if (!tenantId) return null;

      const existing = await fetchConfig();
      if (existing?.id) {
        return updateBot(existing.id, config);
      } else {
        return createBot(config);
      }
    },
    [tenantId, fetchConfig, updateBot, createBot]
  );

  return {
    // Tenant settings (global)
    fetchTenantSettings,
    saveTenantSettings,
    // Bot CRUD
    fetchBots,
    fetchBot,
    createBot,
    updateBot,
    deleteBot,
    // Instances
    fetchInstances,
    linkInstance,
    // Schedule (agendamento_fixo)
    fetchScheduleConfig,
    saveScheduleConfig,
    fetchBlockedPeriods,
    addBlockedPeriod,
    deleteBlockedPeriod,
    // Tratamentos
    fetchTratamentos,
    updateTratamentoDuration,
    // Legacy
    fetchConfig,
    saveConfig,
    tenantId,
  };
};
