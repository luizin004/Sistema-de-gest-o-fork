import { supabaseUntyped } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";

export interface Emulador {
  id: string;
  nome: string;
  porta: string;
  ativo: boolean;
  prioridade: number;
}

export class EmuladorService {
  static async getEmuladores(): Promise<Emulador[]> {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const { data, error } = await supabaseUntyped
      .from("usuarios")
      .select("adb_emuladores")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .limit(1)
      .single();

    if (error || !data?.adb_emuladores) return [];
    return (data.adb_emuladores as Emulador[]).sort((a, b) => a.prioridade - b.prioridade);
  }

  static async saveEmuladores(emuladores: Emulador[]): Promise<boolean> {
    const tenantId = getTenantId();
    if (!tenantId) return false;

    const { error } = await supabaseUntyped
      .from("usuarios")
      .update({ adb_emuladores: emuladores })
      .eq("tenant_id", tenantId)
      .eq("ativo", true);

    return !error;
  }

  static async addEmulador(nome: string, porta: string, prioridade: number): Promise<boolean> {
    const emuladores = await this.getEmuladores();
    const novoEmulador: Emulador = {
      id: crypto.randomUUID(),
      nome,
      porta,
      ativo: true,
      prioridade,
    };
    return this.saveEmuladores([...emuladores, novoEmulador]);
  }

  static async updateEmulador(id: string, updates: Partial<Emulador>): Promise<boolean> {
    const emuladores = await this.getEmuladores();
    const updated = emuladores.map((e) => (e.id === id ? { ...e, ...updates } : e));
    return this.saveEmuladores(updated);
  }

  static async removeEmulador(id: string): Promise<boolean> {
    const emuladores = await this.getEmuladores();
    return this.saveEmuladores(emuladores.filter((e) => e.id !== id));
  }
}
