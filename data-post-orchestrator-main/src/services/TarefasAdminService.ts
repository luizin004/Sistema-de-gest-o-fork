import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

const PROXY_URL = `${SUPABASE_URL}/functions/v1/tarefas-proxy`;

export interface Lead {
  lead_id: string;
  nome: string;
  telefone: string;
  porta_adb: string;
  porta_adb_override?: string[];
  mensagem_template?: string;
  batch_id?: string;
  enviar_audio?: boolean;
  cliente_id?: string; // Pode ser herdado do nível raiz ou especificado por lead
  campanha_id?: string; // Pode ser herdado do nível raiz ou especificado por lead
}

export interface TarefaDetalhe {
  id: string;
  lead_id: string;
  nome: string;
  telefone: string;
  status: string;
  porta_adb: string;
  cliente_id: string;
  campanha_id: string;
  created_at: string;
  updated_at: string;
}

export interface ResumoStatus {
  status: string;
  total: number;
}

export interface CampanhaStatus {
  filtros: {
    campanha_id: string;
    porta_adb: string | null;
    status: string[];
  };
  resumo: ResumoStatus[];
  total: number;
  detalhes?: TarefaDetalhe[];
}

async function getAuthHeaders(): Promise<HeadersInit> {
  // O sistema usa autenticação customizada via localStorage, não Supabase Auth
  // Então usamos a anon key do Supabase para autenticar na Edge Function
  const usuario = localStorage.getItem('usuario');
  console.log("[TarefasAdmin] Auth check:", { hasUsuario: !!usuario });
  
  if (!usuario) {
    console.error("[TarefasAdmin] No usuario in localStorage");
    throw new Error("Usuário não autenticado");
  }
  
  const userData = JSON.parse(usuario);
  console.log("[TarefasAdmin] User authenticated:", userData.email);
  
  // Usar a anon key do Supabase para autenticar na Edge Function
  // A Edge Function vai validar usando o Service Role Key internamente
  return {
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    "X-User-Id": userData.id,
    "X-Tenant-Id": userData.tenant_id,
  };
}

export class TarefasAdminService {
  static async createCampaign(
    campanhaId: string,
    leads: Lead[]
  ): Promise<{ inserted: number }> {
    console.log("[TarefasAdmin] Creating campaign:", { campanhaId, leadCount: leads.length, proxyUrl: PROXY_URL });
    const headers = await getAuthHeaders();
    const payload = {
      action: "create",
      campanha_id: campanhaId,
      leads,
    };
    console.log("[TarefasAdmin] Payload:", payload);
    
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    console.log("[TarefasAdmin] Response status:", response.status);
    
    if (!response.ok) {
      const err = await response.text();
      console.error("[TarefasAdmin] Error response:", err);
      throw new Error(`Erro ao criar campanha (${response.status}): ${err}`);
    }

    const result = await response.json();
    console.log("[TarefasAdmin] Success:", result);
    return result;
  }

  static async getCampaignStatus(
    campanhaId: string,
    detailed: boolean = false,
    limit: number = 100
  ): Promise<CampanhaStatus> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      campanha_id: campanhaId,
      detailed: detailed.toString(),
      limit: limit.toString(),
    });

    console.log("[TarefasAdmin] GET campaign status:", { campanhaId, detailed, limit });

    const response = await fetch(`${PROXY_URL}?${params}`, {
      method: "GET",
      headers,
    });

    console.log("[TarefasAdmin] GET response status:", response.status);

    if (!response.ok) {
      const err = await response.text();
      console.error("[TarefasAdmin] GET error response:", err);
      throw new Error(`Erro ao buscar status (${response.status}): ${err}`);
    }

    const result = await response.json();
    console.log("[TarefasAdmin] GET success:", result);
    return result;
  }

  static async updateStatus(
    campanhaId: string,
    novoStatus: "aguardando" | "pausado"
  ): Promise<{ updated: number }> {
    const headers = await getAuthHeaders();
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "update_status",
        campanha_id: campanhaId,
        novo_status: novoStatus,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro ao atualizar status: ${err}`);
    }

    return response.json();
  }

  static async deleteCampaign(
    campanhaId: string,
    incluirProcessados: boolean = false
  ): Promise<{ deleted: number }> {
    const headers = await getAuthHeaders();
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "delete",
        campanha_id: campanhaId,
        incluir_processados: incluirProcessados,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro ao deletar campanha: ${err}`);
    }

    return response.json();
  }
}
