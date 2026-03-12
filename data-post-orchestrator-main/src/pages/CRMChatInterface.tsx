import { useState, useEffect, useCallback } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { supabase } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  dentista: string | null;
  created_at: string;
  ultima_mensagem_at?: string | null;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

const CRMChatInterface = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const tenantId = getTenantId();
      let query = (supabase as any)
        .from('posts')
        .select('id, nome, telefone, status, data, horario, tratamento, dentista, created_at, ultima_mensagem_at, feedback, campanha_id, campanha_nome')
        .order('ultima_mensagem_at', { ascending: false, nullsFirst: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reordenar lista em tempo real quando um post receber nova mensagem
  useEffect(() => {
    const tenantId = getTenantId();
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel('chat-vivo-posts-order')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', ...(filter ? { filter } : {}) },
        (payload) => {
          const updated = payload.new as Lead;
          if (!updated.ultima_mensagem_at) return;
          setLeads(prev => {
            const idx = prev.findIndex(l => l.id === updated.id);
            if (idx === -1) return prev;
            const updated_lead = { ...prev[idx], ultima_mensagem_at: updated.ultima_mensagem_at };
            const rest = prev.filter(l => l.id !== updated.id);
            return [updated_lead, ...rest];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 160px)' }} className="bg-gray-50 overflow-hidden rounded-xl">
      <ChatInterface leads={leads} />
    </div>
  );
};

export default CRMChatInterface;
