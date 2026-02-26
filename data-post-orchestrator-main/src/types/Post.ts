// Interface centralizada para Post
export interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  created_at: string;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
  agendamento_id?: string | null; // Relacionamento com agendamento
  marcado_codefy?: boolean; // Controle do Codefy
  ultima_mensagem_at?: string | null; // Timestamp da última mensagem
}
