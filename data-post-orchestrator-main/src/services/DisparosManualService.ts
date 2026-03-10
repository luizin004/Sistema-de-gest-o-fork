import { supabaseUntyped } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { getTenantId, getCurrentUser } from "@/utils/tenantUtils";
import { normalizePhone, interpolateTemplate } from "@/utils/csvParser";

export interface CampaignConfig {
  uazapi_instance_id: string;
  message_template: string;
  delay_seconds: number;
  batch_size: number;
  batch_pause_hours: number;
  only_business_hours: boolean;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  uazapi_instance_id: string;
  message_template: string;
  delay_seconds: number;
  batch_size: number;
  batch_pause_hours: number;
  only_business_hours: boolean;
  status: string;
  total: number;
  processed: number;
  success: number;
  error: number;
  batch_sent_count: number;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CampaignLead {
  id: string;
  campanha_id: string;
  tenant_id: string;
  telefone: string;
  nome: string | null;
  dados_csv: Record<string, string>;
  mensagem_final: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface UazapiInstanceInfo {
  id: string;
  instance_id: string;
  token: string;
  name: string;
  profile_name: string;
  owner_phone: string;
  connected: boolean;
}

export class DisparosManualService {
  /**
   * Busca instâncias UAZAPI do tenant
   */
  static async getUazapiInstances(): Promise<UazapiInstanceInfo[]> {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const { data, error } = await supabaseUntyped
      .from("uazapi_instances")
      .select("id, instance_id, token, name, profile_name, owner_phone, connected")
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("Erro ao buscar instâncias UAZAPI:", error);
      return [];
    }

    return (data || []) as UazapiInstanceInfo[];
  }

  /**
   * Cria uma nova campanha com todos os leads
   */
  static async createCampaign(
    config: CampaignConfig,
    parsedRows: Record<string, string>[],
    phoneColumn: string,
    nameColumn: string | null
  ): Promise<string | null> {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId) return null;

    // Criar campanha
    const { data: campaign, error: campaignError } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .insert({
        tenant_id: tenantId,
        uazapi_instance_id: config.uazapi_instance_id,
        message_template: config.message_template,
        delay_seconds: config.delay_seconds,
        batch_size: config.batch_size,
        batch_pause_hours: config.batch_pause_hours,
        only_business_hours: config.only_business_hours,
        status: "aguardando",
        total: parsedRows.length,
        processed: 0,
        success: 0,
        error: 0,
        batch_sent_count: 0,
        created_by: user?.id || null,
      })
      .select("id")
      .single();

    if (campaignError || !campaign) {
      console.error("Erro ao criar campanha:", campaignError);
      return null;
    }

    const campanhaId = campaign.id;

    // Preparar leads em batch
    const leads = parsedRows.map((row) => {
      const telefone = normalizePhone(row[phoneColumn] || "");
      const nome = nameColumn ? row[nameColumn] || null : null;
      const mensagemFinal = interpolateTemplate(config.message_template, row);

      return {
        campanha_id: campanhaId,
        tenant_id: tenantId,
        telefone,
        nome,
        dados_csv: row,
        mensagem_final: mensagemFinal,
        status: "pendente",
      };
    });

    // Inserir leads em batches de 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      const { error: leadsError } = await supabaseUntyped
        .from("disparos_manual_leads")
        .insert(batch);

      if (leadsError) {
        console.error("Erro ao inserir leads:", leadsError);
        // Limpar campanha se falhou
        await supabaseUntyped
          .from("disparos_manual_campanhas")
          .delete()
          .eq("id", campanhaId);
        return null;
      }
    }

    return campanhaId;
  }

  /**
   * Busca uma campanha por ID
   */
  static async getCampaign(id: string): Promise<Campaign | null> {
    const tenantId = getTenantId();
    if (!tenantId) return null;

    const { data, error } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) return null;
    return data as Campaign;
  }

  /**
   * Lista últimas campanhas do tenant
   */
  static async getCampaigns(limit = 20): Promise<Campaign[]> {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const { data, error } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as Campaign[];
  }

  /**
   * Inicia uma campanha (chama Edge Function worker)
   */
  static async startCampaign(id: string): Promise<boolean> {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId || !user) return false;

    // Atualizar status para processando
    const { error: updateError } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .update({ status: "processando", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("Erro ao atualizar status:", updateError);
      return false;
    }

    // Chamar Edge Function worker
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/disparos-manual-worker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
            "X-Tenant-Id": tenantId,
            "X-User-Id": user.id,
          },
          body: JSON.stringify({ campanha_id: id }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Erro ao chamar worker:", errorData);
        // Reverter status
        await supabaseUntyped
          .from("disparos_manual_campanhas")
          .update({ status: "erro", updated_at: new Date().toISOString() })
          .eq("id", id);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Erro ao chamar worker:", error);
      await supabaseUntyped
        .from("disparos_manual_campanhas")
        .update({ status: "erro", updated_at: new Date().toISOString() })
        .eq("id", id);
      return false;
    }
  }

  /**
   * Pausa uma campanha (worker detecta na próxima iteração)
   */
  static async pauseCampaign(id: string): Promise<boolean> {
    const tenantId = getTenantId();
    if (!tenantId) return false;

    const { error } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .update({ status: "pausado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    return !error;
  }

  /**
   * Retoma uma campanha pausada
   */
  static async resumeCampaign(id: string): Promise<boolean> {
    return this.startCampaign(id);
  }

  /**
   * Cancela uma campanha
   */
  static async cancelCampaign(id: string): Promise<boolean> {
    const tenantId = getTenantId();
    if (!tenantId) return false;

    const { error } = await supabaseUntyped
      .from("disparos_manual_campanhas")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    return !error;
  }

  /**
   * Busca leads processados para log em tempo real
   */
  static async getProcessedLeads(
    campanhaId: string,
    limit = 30
  ): Promise<CampaignLead[]> {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const { data, error } = await supabaseUntyped
      .from("disparos_manual_leads")
      .select("*")
      .eq("campanha_id", campanhaId)
      .eq("tenant_id", tenantId)
      .in("status", ["enviado", "erro"])
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as CampaignLead[];
  }

  /**
   * Exporta relatório da campanha como CSV blob
   */
  static async exportReport(campanhaId: string): Promise<Blob | null> {
    const tenantId = getTenantId();
    if (!tenantId) return null;

    const { data, error } = await supabaseUntyped
      .from("disparos_manual_leads")
      .select("telefone, nome, status, error_message, sent_at, mensagem_final")
      .eq("campanha_id", campanhaId)
      .eq("tenant_id", tenantId)
      .order("created_at");

    if (error || !data) return null;

    const headers = ["Telefone", "Nome", "Status", "Erro", "Enviado em", "Mensagem"];
    const rows = data.map((lead: any) => {
      const values = [
        lead.telefone || "",
        lead.nome || "",
        lead.status || "",
        lead.error_message || "",
        lead.sent_at || "",
        (lead.mensagem_final || "").replace(/"/g, '""'),
      ];
      return values.map((v) => `"${v}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    return new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  }
}
