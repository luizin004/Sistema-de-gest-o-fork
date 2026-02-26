import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard";
import { supabase } from "@/integrations/supabase/client";

interface Post {
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
}

interface CRMContext {
  posts: Post[];
}

type Arquivado = Post;

function getDateCutoff(period: string): Date | null {
  if (period === 'all') return null;
  const days = parseInt(period, 10);
  if (isNaN(days)) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

const CRMDashboard = () => {
  const { posts } = useOutletContext<CRMContext>();
  const [lastDisparosTotal, setLastDisparosTotal] = useState(0);
  const [funnelPeriod, setFunnelPeriod] = useState('all');
  const [arquivados, setArquivados] = useState<Arquivado[]>([]);

  useEffect(() => {
    const fetchArquivados = async () => {
      const { data, error } = await supabase
        .from('arquivados' as any)
        .select('id, nome, status, data, horario, tratamento, telefone, dentista, data_marcada, created_at');
      if (!error && data) {
        setArquivados(data as unknown as Arquivado[]);
      }
    };
    fetchArquivados();
  }, []);

  const fetchCampanhaDisparos = useCallback(async (period: string) => {
    try {
      let query = supabase
        .from('tabela_campanha')
        .select('*', { count: 'exact', head: true })
        .eq('disparo_feito', true);

      const cutoff = getDateCutoff(period);
      if (cutoff) {
        query = query.gte('criado_em', cutoff.toISOString());
      }

      const { count, error } = await query;

      if (!error && count !== null) {
        setLastDisparosTotal(count);
      }
    } catch (error) {
      console.error("Error fetching campaign disparos:", error);
    }
  }, []);

  useEffect(() => {
    fetchCampanhaDisparos(funnelPeriod);
  }, [funnelPeriod, fetchCampanhaDisparos]);

  const allLeads = useMemo(() => [...posts, ...arquivados], [posts, arquivados]);

  const filteredPosts = useMemo(() => {
    const cutoff = getDateCutoff(funnelPeriod);
    if (!cutoff) return allLeads;
    return allLeads.filter(p => new Date(p.created_at) >= cutoff);
  }, [allLeads, funnelPeriod]);

  const handlePeriodChange = useCallback((period: string) => {
    setFunnelPeriod(period);
  }, []);

  return (
    <Dashboard
      posts={filteredPosts}
      lastDisparosTotal={lastDisparosTotal}
      funnelPeriod={funnelPeriod}
      onFunnelPeriodChange={handlePeriodChange}
    />
  );
};

export default CRMDashboard;
