import { useCallback } from "react";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";

export interface ChatbotConfig {
  id?: string;
  tenant_id?: string;
  bot_enabled: boolean;
  system_prompt: string;
  clinic_name: string;
  clinic_tone: string;
  openai_model: string;
  max_history_messages: number;
  cadence_timeout_hours: number;
  cadence_max_attempts: number;
  cadence_templates: string[];
  openai_api_key: string;
  confirmation_template: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_CHATBOT_CONFIG: Omit<ChatbotConfig, "id" | "tenant_id" | "created_at" | "updated_at"> = {
  bot_enabled: false,
  system_prompt: "",
  clinic_name: "",
  clinic_tone: "profissional e acolhedor",
  openai_model: "gpt-4o-mini",
  max_history_messages: 15,
  cadence_timeout_hours: 3,
  cadence_max_attempts: 2,
  cadence_templates: [],
  openai_api_key: "",
  confirmation_template: "",
};

export const useChatbotConfig = () => {
  const tenantId = getTenantId();

  const fetchConfig = useCallback(async (): Promise<ChatbotConfig | null> => {
    if (!tenantId) return null;

    const { data, error } = await (supabaseUntyped as any)
      .from("chatbot_config")
      .select("*")
      .eq("tenant_id", tenantId)
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

      const payload = {
        ...config,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabaseUntyped as any)
        .from("chatbot_config")
        .upsert(payload, { onConflict: "tenant_id" })
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar chatbot_config:", error);
        return null;
      }

      return data as ChatbotConfig;
    },
    [tenantId]
  );

  return { fetchConfig, saveConfig, tenantId };
};
