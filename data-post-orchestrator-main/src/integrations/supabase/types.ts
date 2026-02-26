export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamento: {
        Row: {
          author_id: string
          confirmado: boolean | null
          created_at: string
          data: string | null
          data_marcada: string | null
          dentista: string | null
          horario: string | null
          id: string
          nome: string
          presenca: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          confirmado?: boolean | null
          created_at?: string
          data?: string | null
          data_marcada?: string | null
          dentista?: string | null
          horario?: string | null
          id?: string
          nome: string
          presenca?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          confirmado?: boolean | null
          created_at?: string
          data?: string | null
          data_marcada?: string | null
          dentista?: string | null
          horario?: string | null
          id?: string
          nome?: string
          presenca?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uazapi_chat_messages: {
        Row: {
          id: string;
          lead_id: string | null;
          phone_number: string;
          direction: string;
          content: string | null;
          media_url: string | null;
          media_type: string | null;
          status: string;
          provider_id: string | null;
          message_type: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        }
        Insert: {
          id?: string;
          lead_id?: string | null;
          phone_number: string;
          direction: string;
          content?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          status?: string;
          provider_id?: string | null;
          message_type?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        }
        Update: {
          id?: string;
          lead_id?: string | null;
          phone_number?: string;
          direction?: string;
          content?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          status?: string;
          provider_id?: string | null;
          message_type?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          direction: string
          id: string
          message: string
          message_id: string | null
          phone: string
          sender_name: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          message: string
          message_id?: string | null
          phone: string
          sender_name?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          message?: string
          message_id?: string | null
          phone?: string
          sender_name?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string | null
          created_at: string | null
          data: string | null
          data_marcada: string | null
          dentista: string | null
          feedback: string | null
          horario: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
          tratamento: string | null
          updated_at: string | null
          nao_respondeu: boolean
          ultima_mensagem_at: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          data?: string | null
          data_marcada?: string | null
          dentista?: string | null
          feedback?: string | null
          horario?: string | null
          id?: string
          nome: string
          status: string
          telefone?: string | null
          tratamento?: string | null
          updated_at?: string | null
          nao_respondeu?: boolean
          ultima_mensagem_at?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          data?: string | null
          data_marcada?: string | null
          dentista?: string | null
          feedback?: string | null
          horario?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          tratamento?: string | null
          updated_at?: string | null
          nao_respondeu?: boolean
          ultima_mensagem_at?: string | null
        }
        Relationships: []
      }
      teste: {
        Row: {
          created_at: string
          teste: string
        }
        Insert: {
          created_at?: string
          teste: string
        }
        Update: {
          created_at?: string
          teste?: string
        }
        Relationships: []
      }
      disparos: {
        Row: {
          id: string
          nome: string
          telefone: string
          data_nascimento: string | null
          data_limpeza: string | null
          data_clareamento: string | null
          data_consulta: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          telefone: string
          data_nascimento?: string | null
          data_limpeza?: string | null
          data_clareamento?: string | null
          data_consulta?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          telefone?: string
          data_nascimento?: string | null
          data_limpeza?: string | null
          data_clareamento?: string | null
          data_consulta?: string | null
          created_at?: string
        }
        Relationships: []
      }
      dentistas: {
        Row: {
          id: string
          nome: string
          especialidade: string | null
          cor_hex: string | null
          ativo: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          especialidade?: string | null
          cor_hex?: string | null
          ativo?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          especialidade?: string | null
          cor_hex?: string | null
          ativo?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      consultorios: {
        Row: {
          id: string
          nome: string
          numero: number | null
          ativo: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          numero?: number | null
          ativo?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          numero?: number | null
          ativo?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      escala_semanal: {
        Row: {
          id: string
          dentista_id: string
          consultorio_id: string
          dia_semana: number
          horario_inicio: string
          created_at: string | null
        }
        Insert: {
          id?: string
          dentista_id: string
          consultorio_id: string
          dia_semana: number
          horario_inicio: string
          created_at?: string | null
        }
        Update: {
          id?: string
          dentista_id?: string
          consultorio_id?: string
          dia_semana?: number
          horario_inicio?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_semanal_consultorio_id_fkey"
            columns: ["consultorio_id"]
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_semanal_dentista_id_fkey"
            columns: ["dentista_id"]
            referencedRelation: "dentistas"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      agendamentos_export: {
        Row: {
          dentista: string | null
          horario: string | null
          nome: string | null
          telefone: string | null
        }
        Insert: {
          dentista?: string | null
          horario?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          dentista?: string | null
          horario?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
