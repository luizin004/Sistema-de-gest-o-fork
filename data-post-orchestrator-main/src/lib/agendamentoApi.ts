import { supabase } from "@/integrations/supabase/client";

const EXPORT_FUNCTION_URL = "https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/export-to-sheets";

export interface Agendamento {
  id: string;
  nome: string;
  horario: string | null;
  telefone: string | null;
  dentista: string | null;
  tratamento?: string | null;
  data: string | null;
  data_marcada: string | null;
  presenca: string | null;
  confirmado: boolean | null;
  source: string | null; // 'codefy' ou null para outros
  created_at: string;
  author_id?: string;
}

interface UpsertOptions {
  onConflict?: string;
}

interface AgendamentoInput {
  nome: string;
  horario?: string | null;
  telefone?: string | null;
  dentista?: string | null;
  tratamento?: string | null;
  data?: string | null;
  data_marcada?: string | null;
  source?: string | null; // 'codefy' ou null para outros
  author_id: string; // Obrigatório para RLS/Schema
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

export async function fetchAgendamentos(): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from('agendamento')
    .select('*')
    .order('data_marcada', { ascending: true });
  
  if (error) {
    throw new Error(error.message || 'Failed to fetch agendamentos');
  }
  
  // Casting para forçar a compatibilidade, assumindo que o banco pode ter campos que a tipagem local desconhece (ex: source)
  return (data || []) as unknown as Agendamento[];
}

export async function upsertAgendamento(
  agendamento: AgendamentoInput,
  options?: UpsertOptions
): Promise<Agendamento> {
  console.log("Iniciando upsertAgendamento via cliente Supabase:", agendamento);
  
  // Usando 'as any' para permitir campos que podem não estar na definição de tipo gerada (ex: source)
  const { data, error } = await (supabase.from('agendamento') as any)
    .upsert(agendamento, {
      onConflict: options?.onConflict ?? 'telefone',
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to save agendamento');
  }
  
  return data as Agendamento;
}

export async function deleteAgendamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('agendamento')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw new Error(error.message || 'Failed to delete agendamento');
  }
}

export async function exportToGoogleSheets(): Promise<{ success: boolean; message: string; count: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(EXPORT_FUNCTION_URL, {
    method: 'POST',
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to export to Google Sheets');
  }
  
  return response.json();
}
