import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Target, ArrowLeft, Plus, TrendingUp, Users, Calendar, MessageSquare, Edit3, Trash2, RefreshCw, BarChart3, AlertTriangle, CheckCircle, Clock, XCircle, Upload, FileText, ChevronDown, Pause, Play } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = 'https://wtqhpovjntjbjhobqttk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts';
const EDGE_FUNCTION_URL = 'https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/cadastro-campanhas';
const TOGGLE_DISPAROS_URL = 'https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/toggle-disparos';
const METRICAS_URL = 'https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/campanha-metricas';

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  mensagem_template: string;
  enviar_audio_vazio?: boolean;
  data_inicio: string;
  data_fim: string;
  status: 'ativa' | 'pausada' | 'finalizada';
  total_leads: number;
  disparos_feitos: number;
  disparos_pendentes: number;
  falharam: number;
  responderam: number;
  nao_responderam: number;
}

interface StatsGerais {
  total_leads: number;
  disparos_feitos: number;
  disparos_pendentes: number;
  falharam: number;
  responderam: number;
  nao_responderam: number;
  campanhas_ativas: number;
  campanhas_total: number;
}

const DisparosCampanha = () => {
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [disparosAtivos, setDisparosAtivos] = useState<boolean | null>(null);
  const [togglingDisparos, setTogglingDisparos] = useState(false);
  const [editMessageOpen, setEditMessageOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    nome: "",
    descricao: "",
    mensagem_template: "",
    id_campanha: "",
    enviar_audio_vazio: false
  });
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [csvLeads, setCsvLeads] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvCampanhaId, setCsvCampanhaId] = useState("");
  const [csvColNome, setCsvColNome] = useState("");
  const [csvColTelefone, setCsvColTelefone] = useState("");
  const [csvColExtras, setCsvColExtras] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvTab, setCsvTab] = useState<'upload' | 'paste' | 'filter'>('upload');
  const [csvPasteText, setCsvPasteText] = useState("");
  const [noveDigito, setNoveDigito] = useState<'add' | 'remove' | 'keep'>('add');
  const [csvFormatado, setCsvFormatado] = useState(false);
  // Aba filtro
  const [filterOrigemIds, setFilterOrigemIds] = useState<string[]>([]);
  const [filterDestinoCampanhaId, setFilterDestinoCampanhaId] = useState("");
  const [filterEnviados, setFilterEnviados] = useState(false);
  const [filterNaoEnviados, setFilterNaoEnviados] = useState(false);
  const [filterResponderam, setFilterResponderam] = useState(false);
  const [filterNaoResponderam, setFilterNaoResponderam] = useState(false);
  const [filterPreview, setFilterPreview] = useState<{nome: string; telefone: string}[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterImporting, setFilterImporting] = useState(false);
  const [editCampaignOpen, setEditCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState({
    id: "",
    nome: "",
    descricao: "",
    mensagem_template: "",
    id_campanha: "",
    total_leads: 0,
    disparos_feitos: 0,
    disparos_pendentes: 0,
    falharam: 0,
    responderam: 0,
    nao_responderam: 0,
    enviar_audio_vazio: false
  });

  useEffect(() => {
    fetchCampanhas();
    fetchDisparosStatus();
  }, []);

  const fetchDisparosStatus = async () => {
    try {
      const res = await fetch(TOGGLE_DISPAROS_URL, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      const data = await res.json();
      setDisparosAtivos(data.active ?? false);
    } catch { setDisparosAtivos(null); }
  };

  const toggleDisparos = async () => {
    if (disparosAtivos === null) return;
    setTogglingDisparos(true);
    try {
      const action = disparosAtivos ? 'pause' : 'resume';
      const res = await fetch(TOGGLE_DISPAROS_URL, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        setDisparosAtivos(data.active);
        toast.success(data.active ? 'Disparos retomados!' : 'Disparos pausados!');
      } else {
        toast.error('Erro ao alterar estado dos disparos');
      }
    } catch { toast.error('Erro ao conectar'); }
    finally { setTogglingDisparos(false); }
  };

  const formatDateToISO = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };

  // Estatísticas gerais calculadas via useMemo
  const statsGerais = useMemo<StatsGerais>(() => {
    const stats: StatsGerais = {
      total_leads: 0,
      disparos_feitos: 0,
      disparos_pendentes: 0,
      falharam: 0,
      responderam: 0,
      nao_responderam: 0,
      campanhas_ativas: 0,
      campanhas_total: campanhas.length,
    };
    campanhas.forEach(c => {
      stats.total_leads += c.total_leads;
      stats.disparos_feitos += c.disparos_feitos;
      stats.disparos_pendentes += c.disparos_pendentes;
      stats.falharam += c.falharam;
      stats.responderam += c.responderam;
      stats.nao_responderam += c.nao_responderam;
      if (c.status === 'ativa') stats.campanhas_ativas++;
    });
    return stats;
  }, [campanhas]);

  const fetchCampanhas = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar campanhas e leads em paralelo
      const authHeaders = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      };

      const [campanhasResponse, metricasResponse] = await Promise.all([
        fetch(EDGE_FUNCTION_URL, { method: 'GET', headers: authHeaders }),
        fetch(METRICAS_URL, { method: 'GET', headers: authHeaders })
      ]);

      if (!campanhasResponse.ok) {
        throw new Error(`Erro ao buscar campanhas: ${campanhasResponse.statusText}`);
      }

      const result = await campanhasResponse.json();
      const campanhasData = result.data || [];
      
      // Leads vêm da Edge Function campanha-metricas (que tem permissão e cache)
      let leadsData: any[] = [];
      if (metricasResponse.ok) {
        const metricasResult = await metricasResponse.json();
        leadsData = metricasResult.data || [];
      }
      
      // Agrupar leads por ID_campanha com estatísticas completas
      const statsByCampaign: Record<string, { total_leads: number; disparos_feitos: number; disparos_pendentes: number; falharam: number; responderam: number; }> = {};
      
      leadsData.forEach((lead: any) => {
        const campaignId = lead.ID_campanha || lead.id_campanha || 'unknown';
        
        if (!statsByCampaign[campaignId]) {
          statsByCampaign[campaignId] = {
            total_leads: 0,
            disparos_feitos: 0,
            disparos_pendentes: 0,
            falharam: 0,
            responderam: 0,
          };
        }
        
        const s = statsByCampaign[campaignId];
        s.total_leads++;
        
        const isFalhou = lead.extras?.disparo_falhou === true;
        
        if (isFalhou) {
          s.falharam++;
        } else if (lead.disparo_feito === true) {
          s.disparos_feitos++;
          if (lead.respondeu === true) {
            s.responderam++;
          }
        } else {
          s.disparos_pendentes++;
        }
      });
      
      // Transformar dados para o formato esperado
      const campanhasFormatadas: Campanha[] = campanhasData.map((camp: any) => {
        const cs = statsByCampaign[camp.id] || { total_leads: 0, disparos_feitos: 0, disparos_pendentes: 0, falharam: 0, responderam: 0 };
        const naoResponderam = cs.disparos_feitos - cs.responderam;
        
        const dataInicio = formatDateToISO(camp.criado_em) || new Date().toISOString().split('T')[0];

        return {
          id: camp.id,
          nome: camp.nome,
          descricao: camp.descricao || camp.descricacao || `Campanha com ID: ${camp.id}`,
          mensagem_template: camp.mensagem_template || camp.mensagem || '',
          enviar_audio_vazio: camp.enviar_audio_vazio ?? false,
          data_inicio: dataInicio,
          data_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: camp.status || 'ativa',
          total_leads: cs.total_leads,
          disparos_feitos: cs.disparos_feitos,
          disparos_pendentes: cs.disparos_pendentes,
          falharam: cs.falharam,
          responderam: cs.responderam,
          nao_responderam: naoResponderam > 0 ? naoResponderam : 0,
        };
      });
      
      setCampanhas(campanhasFormatadas);
    } catch (error) {
      console.error('Erro ao buscar campanhas:', error);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa': return 'bg-green-100 text-green-800';
      case 'pausada': return 'bg-yellow-100 text-yellow-800';
      case 'finalizada': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ativa': return 'Ativa';
      case 'pausada': return 'Pausada';
      case 'finalizada': return 'Finalizada';
      default: return status;
    }
  };

  const getActiveCampaign = () => {
    return (campanhas || []).find(c => c.status === 'ativa');
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    try {
      const campaign = (campanhas || []).find(c => c.id === campaignId);
      if (!campaign) return;

      // Permite múltiplas campanhas ativas - apenas alterna o status
      const newStatus = campaign.status === 'ativa' ? 'pausada' : 'ativa';

      const response = await fetch(`${EDGE_FUNCTION_URL}?id=${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: campaignId, status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao atualizar status');
      }

      // Ao reativar, limpar pulado_disparo dos leads pendentes para voltarem à fila
      if (newStatus === 'ativa') {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/limpar_pulado_disparo_campanha`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_campanha_id: campaignId })
        });
      }

      // Atualiza localmente para refletir rapidamente
      setCampanhas(prev => prev.map(c => 
        c.id === campaignId ? {...c, status: newStatus} : c
      ));

      toast.success(`Campanha ${newStatus === 'ativa' ? 'ativada' : 'pausada'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status da campanha');
    }
  };

  const openEditMessage = (campanha: Campanha) => {
    setSelectedCampanha(campanha);
    setEditingMessage(campanha.mensagem_template);
    setEditMessageOpen(true);
  };

  const openEditCampaign = (campanha: Campanha) => {
    setEditingCampaign({
      id: campanha.id,
      nome: campanha.nome,
      descricao: campanha.descricao || "",
      mensagem_template: campanha.mensagem_template,
      id_campanha: campanha.id, // Usar o id como id_campanha para edição
      total_leads: campanha.total_leads,
      disparos_feitos: campanha.disparos_feitos,
      disparos_pendentes: campanha.disparos_pendentes,
      falharam: campanha.falharam,
      responderam: campanha.responderam,
      nao_responderam: campanha.nao_responderam,
      enviar_audio_vazio: campanha.enviar_audio_vazio || false
    });
    setEditCampaignOpen(true);
  };

  const saveCampaign = async () => {
    if (!editingCampaign.nome.trim() || !editingCampaign.id_campanha.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}?id=${editingCampaign.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: editingCampaign.id,
          nome: editingCampaign.nome,
          descricao: editingCampaign.descricao,
          mensagem_template: editingCampaign.mensagem_template,
          enviar_audio_vazio: editingCampaign.enviar_audio_vazio
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro: ${response.statusText}`);
      }

      toast.success('Campanha atualizada com sucesso!');
      setEditCampaignOpen(false);
      setEditingCampaign({ id: "", nome: "", descricao: "", mensagem_template: "", id_campanha: "", total_leads: 0, disparos_feitos: 0, disparos_pendentes: 0, falharam: 0, responderam: 0, nao_responderam: 0, enviar_audio_vazio: false });
      
      // Recarregar lista de campanhas
      await fetchCampanhas();
      
    } catch (error) {
      console.error('Erro ao atualizar campanha:', error);
      toast.error(`Erro ao atualizar campanha: ${(error as Error).message}`);
    }
  };

  const saveMessage = async () => {
    if (!selectedCampanha) return;

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}?id=${selectedCampanha.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: selectedCampanha.id,
          nome: selectedCampanha.nome,
          mensagem: editingMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro: ${response.statusText}`);
      }

      toast.success('Mensagem da campanha atualizada com sucesso!');
      setEditMessageOpen(false);
      setSelectedCampanha(null);
      setEditingMessage("");
      
      // Recarregar lista de campanhas
      await fetchCampanhas();
      
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      toast.error(`Erro ao salvar mensagem: ${(error as Error).message}`);
    }
  };

  const openNewCampaign = () => {
    setNewCampaign({
      nome: "",
      descricao: "",
      mensagem_template: "",
      id_campanha: "",
      enviar_audio_vazio: false
    });
    setNewCampaignOpen(true);
  };

  const createNewCampaign = async () => {
    if (!newCampaign.nome.trim() || !newCampaign.id_campanha.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: newCampaign.id_campanha,
          nome: newCampaign.nome,
          descricao: newCampaign.descricao,
          mensagem_template: newCampaign.mensagem_template || "🎯 Olá {nome}! Temos uma oferta especial para você! 🦷✨",
          status: 'ativa',
          enviar_audio_vazio: newCampaign.enviar_audio_vazio
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro: ${response.statusText}`);
      }

      toast.success('Campanha criada com sucesso!');
      setNewCampaignOpen(false);
      setNewCampaign({ nome: "", descricao: "", mensagem_template: "", id_campanha: "", enviar_audio_vazio: false });
      
      // Recarregar lista de campanhas
      await fetchCampanhas();
      
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error(`Erro ao criar campanha: ${(error as Error).message}`);
    }
  };

  const normalizeTelefone = (raw: string, noveMode: 'add' | 'remove' | 'keep' = noveDigito): string => {
    if (!raw) return '';
    // Se vier mais de um número separado por / ou , ou ; pega o primeiro
    const primeiro = raw.split(/[\/,;]/)[0];
    // Remove tudo que não é dígito
    let digits = primeiro.replace(/\D/g, '');
    // Remove prefixo internacional 00
    if (digits.startsWith('00')) digits = digits.slice(2);

    // Extrair partes: prefixo 55, DDD, número
    let ddd = '';
    let num = '';

    if (digits.startsWith('55') && digits.length >= 12) {
      ddd = digits.slice(2, 4);
      num = digits.slice(4);
    } else if (digits.length === 10 || digits.length === 11) {
      ddd = digits.slice(0, 2);
      num = digits.slice(2);
    } else if (digits.length === 8 || digits.length === 9) {
      // Sem DDD — retorna limpo sem modificar 9
      return digits;
    } else {
      return digits;
    }

    // Aplicar regra do 9
    if (noveMode === 'add' && num.length === 8) {
      num = '9' + num;
    } else if (noveMode === 'remove' && num.length === 9 && num.startsWith('9')) {
      num = num.slice(1);
    }
    // 'keep' não altera num

    return '55' + ddd + num;
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV deve ter cabeçalho e ao menos uma linha'); return; }
    const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
    const cols = lines[0].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(cols.map((c, i) => [c, vals[i] ?? '']));
    });
    setCsvColumns(cols);
    setCsvLeads(rows);
    const nomeCol = cols.find(c => /nome/i.test(c)) ?? '';
    const telCol = cols.find(c => /tel|fone|phone|whats/i.test(c)) ?? '';
    setCsvColNome(nomeCol);
    setCsvColTelefone(telCol);
  };

  // Busca paginada sem limite da REST API (padrão é 1000)
  const fetchAllPages = async (baseUrl: string, extraHeaders: Record<string, string> = {}) => {
    const pageSize = 1000;
    let offset = 0;
    let all: any[] = [];
    while (true) {
      const res = await fetch(`${baseUrl}&limit=${pageSize}&offset=${offset}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=none',
          ...extraHeaders
        }
      });
      const page: any[] = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;
      all = all.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  };

  const fetchFilterPreview = async () => {
    if (!filterOrigemIds.length) { toast.error('Selecione ao menos uma campanha de origem'); return; }
    setFilterLoading(true);
    setFilterPreview([]);
    try {
      // 1. Buscar TODOS os leads das campanhas de origem (paginado)
      const origemFilter = filterOrigemIds.map(id => `ID_campanha.eq.${id}`).join(',');
      const baseUrl = `${SUPABASE_URL}/rest/v1/tabela_campanha?or=(${encodeURIComponent(origemFilter)})&select=nome,telefone,disparo_feito`;
      let leads: { nome: string; telefone: string; disparo_feito: boolean }[] = await fetchAllPages(baseUrl);
      if (!leads?.length) { setFilterPreview([]); setFilterLoading(false); return; }

      // 2. Filtro de disparo
      const filtrarDisparo = filterEnviados || filterNaoEnviados;
      if (filtrarDisparo && !(filterEnviados && filterNaoEnviados)) {
        leads = leads.filter(l => {
          if (filterEnviados) return l.disparo_feito === true;
          if (filterNaoEnviados) return l.disparo_feito === false || l.disparo_feito === null;
          return true;
        });
      }
      if (!leads.length) { setFilterPreview([]); setFilterLoading(false); return; }

      // 3. Filtro de resposta — buscar direto da view que já calcula respondeu corretamente
      //    (mesma lógica: EXISTS posts.campanha_id=tc.id OR arquivados.campanha_id=tc.id)
      const filtrarResposta = filterResponderam || filterNaoResponderam;
      if (filtrarResposta && !(filterResponderam && filterNaoResponderam)) {
        const viewBase = `${SUPABASE_URL}/rest/v1/vw_campanha_metricas_completa?or=(${encodeURIComponent(origemFilter)})&select=telefone,respondeu`;
        const viewLeads: { telefone: string; respondeu: boolean }[] = await fetchAllPages(viewBase);
        const respondeuPorTelefone = new Map<string, boolean>();
        for (const v of viewLeads) respondeuPorTelefone.set(v.telefone, v.respondeu === true);

        leads = leads.filter(l => {
          const respondeu = respondeuPorTelefone.get(l.telefone) ?? false;
          if (filterResponderam) return respondeu;
          if (filterNaoResponderam) return !respondeu;
          return true;
        });
      }

      // Deduplicar por telefone
      const seen = new Set<string>();
      const unique = leads.filter(l => { if (seen.has(l.telefone)) return false; seen.add(l.telefone); return true; });
      setFilterPreview(unique.map(l => ({ nome: l.nome, telefone: l.telefone })));
    } catch (e) {
      toast.error('Erro ao buscar leads');
    } finally {
      setFilterLoading(false);
    }
  };

  const importFilterLeads = async () => {
    if (!filterDestinoCampanhaId) { toast.error('Selecione a campanha de destino'); return; }
    if (!filterPreview.length) { toast.error('Nenhum lead para importar'); return; }
    setFilterImporting(true);
    let ok = 0; let fail = 0;
    try {
      for (const lead of filterPreview) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/tabela_campanha`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ nome: lead.nome, telefone: normalizeTelefone(lead.telefone), ID_campanha: filterDestinoCampanhaId, disparo_feito: false })
        });
        if (r.ok) ok++; else fail++;
      }
      toast.success(`${ok} leads importados!${fail > 0 ? ` (${fail} falharam)` : ''}`);
      setImportCsvOpen(false);
      setFilterPreview([]); setFilterOrigemIds([]); setFilterDestinoCampanhaId('');
      await fetchCampanhas();
    } catch {
      toast.error('Erro ao importar leads');
    } finally {
      setFilterImporting(false);
    }
  };

  const parseXlsxFile = (buffer: ArrayBuffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) { toast.error('Planilha vazia ou sem dados'); return; }
    const cols = Object.keys(rows[0]);
    setCsvColumns(cols);
    setCsvLeads(rows.map(r => Object.fromEntries(cols.map(c => [c, String(r[c] ?? '')]))));
    const nomeCol = cols.find(c => /nome/i.test(c)) ?? '';
    const telCol = cols.find(c => /tel|fone|phone|whats/i.test(c)) ?? '';
    setCsvColNome(nomeCol);
    setCsvColTelefone(telCol);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (ev) => parseXlsxFile(ev.target?.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => parseCsvText(ev.target?.result as string);
      reader.readAsText(file, 'UTF-8');
    }
  };

  const importCsvLeads = async () => {
    if (!csvCampanhaId) { toast.error('Selecione uma campanha'); return; }
    if (!csvColNome) { toast.error('Selecione a coluna de nome'); return; }
    if (!csvColTelefone) { toast.error('Selecione a coluna de telefone'); return; }
    if (csvLeads.length === 0) { toast.error('Nenhum lead no CSV'); return; }

    setCsvImporting(true);
    let ok = 0; let fail = 0;
    try {
      for (const row of csvLeads) {
        const nome = row[csvColNome]?.trim();
        const telefone = normalizeTelefone(row[csvColTelefone] ?? '');
        if (!nome || !telefone) { fail++; continue; }
        
        // Preparar dados extras se coluna selecionada
        let extras = null;
        if (csvColExtras && row[csvColExtras]) {
          extras = { [csvColExtras]: row[csvColExtras]?.trim() };
        }
        
        const payload: any = { nome, telefone, ID_campanha: csvCampanhaId, disparo_feito: false };
        if (extras) {
          payload.extras = extras;
        }
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tabela_campanha`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) ok++; else fail++;
      }
      toast.success(`${ok} leads importados com sucesso!${fail > 0 ? ` (${fail} falharam)` : ''}`);
      setImportCsvOpen(false);
      setCsvLeads([]); setCsvColumns([]); setCsvCampanhaId(''); setCsvColNome(''); setCsvColTelefone(''); setCsvColExtras(''); setCsvFileName('');
      await fetchCampanhas();
    } catch (err) {
      toast.error('Erro ao importar leads');
    } finally {
      setCsvImporting(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}?id=${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro: ${response.statusText}`);
      }

      toast.success('Campanha excluída com sucesso!');
      
      // Recarregar lista de campanhas
      await fetchCampanhas();
      
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error(`Erro ao excluir campanha: ${(error as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos")}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Campanhas</h1>
                  <p className="text-sm text-gray-500">Gerencie suas campanhas de marketing</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={toggleDisparos}
                disabled={togglingDisparos || disparosAtivos === null}
                className={disparosAtivos
                  ? 'border-red-300 text-red-600 hover:bg-red-50'
                  : 'border-green-300 text-green-600 hover:bg-green-50'}
              >
                {togglingDisparos ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : disparosAtivos ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {disparosAtivos === null ? 'Carregando...' : disparosAtivos ? 'Pausar Disparos' : 'Retomar Disparos'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setCsvLeads([]); setCsvColumns([]); setCsvCampanhaId(''); setCsvColNome(''); setCsvColTelefone(''); setCsvColExtras(''); setCsvFileName(''); setImportCsvOpen(true); }}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
              <Button
                onClick={openNewCampaign}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estatísticas Gerais de Todas as Campanhas */}
        <Card className="mb-8 shadow-lg border-gray-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-violet-600 text-white pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Estatísticas Gerais</CardTitle>
                  <CardDescription className="text-purple-200">
                    Resumo de todas as {statsGerais.campanhas_total} campanhas ({statsGerais.campanhas_ativas} ativas)
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/disparos/campanha/leads")}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Users className="h-4 w-4 mr-2" />
                Ver Leads
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-700">{statsGerais.total_leads}</p>
                <p className="text-xs text-purple-600 font-medium mt-1">Total Leads</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                <div className="flex items-center justify-center mb-2">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-700">{statsGerais.disparos_feitos}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">Disparos Feitos</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-700">{statsGerais.disparos_pendentes}</p>
                <p className="text-xs text-amber-600 font-medium mt-1">Pendentes</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-700">{statsGerais.responderam}</p>
                <p className="text-xs text-green-600 font-medium mt-1">Responderam</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                <div className="flex items-center justify-center mb-2">
                  <MessageSquare className="h-5 w-5 text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-700">{statsGerais.nao_responderam}</p>
                <p className="text-xs text-gray-600 font-medium mt-1">Não Responderam</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600">{statsGerais.falharam}</p>
                <p className="text-xs text-red-600 font-medium mt-1">Falharam</p>
              </div>
            </div>
            {/* Barra de progresso geral */}
            {statsGerais.total_leads > 0 && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Progresso geral dos disparos</span>
                  <span>{statsGerais.total_leads > 0 ? Math.round((statsGerais.disparos_feitos / statsGerais.total_leads) * 100) : 0}% enviados</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full rounded-full flex">
                    <div className="bg-green-500 h-full" style={{ width: `${(statsGerais.responderam / statsGerais.total_leads) * 100}%` }} title="Responderam" />
                    <div className="bg-gray-400 h-full" style={{ width: `${(statsGerais.nao_responderam / statsGerais.total_leads) * 100}%` }} title="Não responderam" />
                    <div className="bg-red-400 h-full" style={{ width: `${(statsGerais.falharam / statsGerais.total_leads) * 100}%` }} title="Falharam" />
                    <div className="bg-amber-300 h-full" style={{ width: `${(statsGerais.disparos_pendentes / statsGerais.total_leads) * 100}%` }} title="Pendentes" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Responderam</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Não responderam</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Falharam</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" /> Pendentes</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campanhas List */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Suas Campanhas</h2>
            <p className="text-gray-600 mt-1">Gerencie e monitore suas campanhas ativas</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              fetchCampanhas();
              toast.success('Dados atualizados com sucesso!');
            }}
            className="text-purple-600 border-purple-600 hover:bg-purple-50"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Campanhas
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(campanhas || []).map((campanha) => (
            <Card 
              key={campanha.id} 
              className={`shadow-lg border-2 hover:shadow-xl transition-all duration-300 relative overflow-hidden ${
                campanha.status === 'ativa' 
                  ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-violet-50 shadow-purple-200/50 hover:shadow-purple-300/60' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              style={campanha.status === 'ativa' ? {
                boxShadow: '0 0 0 1px rgba(168, 85, 247, 0.3), 0 4px 6px -1px rgba(168, 85, 247, 0.1), 0 2px 4px -1px rgba(168, 85, 247, 0.06)'
              } : {}}
            >
              {/* Animated Border for Active Campaign */}
              {campanha.status === 'ativa' && (
                <div className="absolute inset-0 rounded-lg pointer-events-none">
                  <div className="absolute inset-0 rounded-lg border-2 border-purple-400 animate-pulse opacity-30"></div>
                  <div className="absolute inset-0 rounded-lg border border-purple-300 animate-ping opacity-20"></div>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className={`text-xl ${campanha.status === 'ativa' ? 'text-purple-900 font-bold' : 'text-gray-900'} flex items-center gap-2`}>
                      <Target className={`h-5 w-5 ${campanha.status === 'ativa' ? 'text-purple-600' : 'text-gray-400'}`} />
                      {campanha.nome}
                    </CardTitle>
                    <CardDescription className={`${campanha.status === 'ativa' ? 'text-purple-700' : 'text-gray-600'} mt-1 flex items-center gap-2`}>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-mono">
                        ID: {campanha.id}
                      </span>
                      {campanha.descricao}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(campanha.status)}`}>
                    {getStatusText(campanha.status)}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Message Preview */}
                  <div className={`${campanha.status === 'ativa' 
                    ? 'bg-gradient-to-r from-purple-100 to-violet-100 border-purple-300' 
                    : 'bg-gray-50 border-gray-200'
                  } border rounded-lg p-3`}>
                    <div className="flex-1">
                      <p className={`text-sm ${campanha.status === 'ativa' ? 'text-purple-800' : 'text-gray-700'} line-clamp-2 min-h-[2.5rem]`}>
                        {campanha.mensagem_template || 'Mensagem não definida'}
                        {campanha.mensagem_template && campanha.mensagem_template.split('\n').length > 2 ? '...' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{campanha.data_inicio} até {campanha.data_fim}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className={`${campanha.status === 'ativa' ? 'bg-purple-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-lg font-bold text-gray-900">{campanha.total_leads}</p>
                      <p className="text-xs text-gray-600">Total Leads</p>
                    </div>
                    <div className={`${campanha.status === 'ativa' ? 'bg-blue-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-lg font-bold text-blue-700">{campanha.disparos_feitos}</p>
                      <p className="text-xs text-gray-600">Disparos Feitos</p>
                    </div>
                    <div className={`${campanha.status === 'ativa' ? 'bg-green-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className="text-lg font-bold text-green-700">{campanha.responderam}</p>
                      <p className="text-xs text-gray-600">Responderam</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-amber-700">{campanha.disparos_pendentes}</p>
                      <p className="text-[10px] text-amber-600">Pendentes</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-gray-600">{campanha.nao_responderam}</p>
                      <p className="text-[10px] text-gray-500">Não Responderam</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-red-600">{campanha.falharam}</p>
                      <p className="text-[10px] text-red-500">Falharam</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditCampaign(campanha)}
                      className="flex-1 relative z-20"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant={campanha.status === 'ativa' ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => toggleCampaignStatus(campanha.id)}
                      className="flex-1 relative z-20"
                      disabled={campanha.status === 'finalizada'}
                    >
                      {campanha.status === 'ativa' ? (
                        <>
                          <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                          Desativar
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCampaign(campanha.id)}
                      className="px-3 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                      title="Excluir campanha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {(!campanhas || campanhas.length === 0) && (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-gray-600 mb-4">Crie sua primeira campanha para começar a enviar mensagens personalizadas.</p>
              <Button
                onClick={openNewCampaign}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Import CSV Dialog */}
      <Dialog open={importCsvOpen} onOpenChange={(o) => { if (!csvImporting) setImportCsvOpen(o); }}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] xl:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-600" />
              Importar Leads
            </DialogTitle>
            <DialogDescription>
              Importe leads via CSV ou filtrando por campanha existente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Abas Upload / Colar */}
            <div>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3">
                <button
                  onClick={() => setCsvTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${csvTab === 'upload' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Upload className="h-4 w-4" /> Fazer Upload
                </button>
                <button
                  onClick={() => setCsvTab('paste')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${csvTab === 'paste' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <FileText className="h-4 w-4" /> Colar CSV
                </button>
                <button
                  onClick={() => { setCsvTab('filter'); setFilterPreview([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${csvTab === 'filter' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <ChevronDown className="h-4 w-4" /> Por Filtro
                </button>
              </div>

              {csvTab === 'filter' ? (
                <div className="space-y-4">
                  {/* Campanhas de origem (múltipla seleção) */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Campanhas de Origem * <span className="text-gray-400 font-normal">(selecione uma ou mais)</span></Label>
                    <div className="border border-gray-300 rounded-lg bg-white max-h-36 overflow-y-auto p-2 space-y-1">
                      {campanhas.map(c => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer select-none px-1 py-0.5 rounded hover:bg-purple-50">
                          <input
                            type="checkbox"
                            checked={filterOrigemIds.includes(c.id)}
                            onChange={() => {
                              setFilterOrigemIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                              setFilterPreview([]);
                            }}
                            className="w-4 h-4 accent-purple-600"
                          />
                          <span className="text-sm text-gray-700">{c.nome}</span>
                        </label>
                      ))}
                    </div>
                    {filterOrigemIds.length > 0 && (
                      <p className="text-xs text-purple-600">{filterOrigemIds.length} campanha(s) selecionada(s)</p>
                    )}
                  </div>

                  {/* Campanha de destino */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Campanha de Destino *</Label>
                    <select
                      value={filterDestinoCampanhaId}
                      onChange={e => setFilterDestinoCampanhaId(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>

                  {/* Filtros */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filtros de Disparo <span className="text-gray-400 font-normal normal-case">(nenhum = todos)</span></p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filterEnviados} onChange={e => { setFilterEnviados(e.target.checked); setFilterPreview([]); }} className="w-4 h-4 accent-purple-600" />
                        <span className="text-sm text-gray-700">Enviados</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filterNaoEnviados} onChange={e => { setFilterNaoEnviados(e.target.checked); setFilterPreview([]); }} className="w-4 h-4 accent-purple-600" />
                        <span className="text-sm text-gray-700">Não Enviados <span className="text-xs text-gray-400">(incl. falharam)</span></span>
                      </label>
                    </div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">Filtros de Resposta <span className="text-gray-400 font-normal normal-case">(nenhum = todos)</span></p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filterResponderam} onChange={e => { setFilterResponderam(e.target.checked); setFilterPreview([]); }} className="w-4 h-4 accent-purple-600" />
                        <span className="text-sm text-gray-700">Responderam</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filterNaoResponderam} onChange={e => { setFilterNaoResponderam(e.target.checked); setFilterPreview([]); }} className="w-4 h-4 accent-purple-600" />
                        <span className="text-sm text-gray-700">Não Responderam</span>
                      </label>
                    </div>
                  </div>

                  {/* Botão buscar preview */}
                  <Button
                    variant="outline"
                    onClick={fetchFilterPreview}
                    disabled={!filterOrigemIds.length || filterLoading}
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    {filterLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Buscando...</> : <><RefreshCw className="h-4 w-4 mr-2" />Buscar leads com esses filtros</>}
                  </Button>

                  {/* Preview resultado */}
                  {filterPreview.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-gray-700">Preview ({Math.min(filterPreview.length, 5)} de {filterPreview.length} leads)</Label>
                        {filterDestinoCampanhaId && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            Destino: {campanhas.find(c => c.id === filterDestinoCampanhaId)?.nome}
                          </span>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                              <th className="px-3 py-2 text-left font-semibold text-purple-700">Nome</th>
                              <th className="px-3 py-2 text-left font-semibold text-blue-700">Telefone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filterPreview.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-purple-800">{row.nome}</td>
                                <td className="px-3 py-2 font-mono text-blue-700">{row.telefone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filterPreview.length > 5 && (
                          <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
                            + {filterPreview.length - 5} leads adicionais não exibidos
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {filterPreview.length === 0 && !filterLoading && filterOrigemIds.length > 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Nenhum lead encontrado com esses filtros.</p>
                  )}
                </div>
              ) : csvTab === 'upload' ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    {csvFileName ? (
                      <>
                        <FileText className="h-6 w-6 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">{csvFileName}</span>
                        <span className="text-xs text-purple-500">{csvLeads.length} leads detectados</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-purple-400" />
                        <span className="text-sm text-purple-600 font-medium">Clique para selecionar o CSV</span>
                        <span className="text-xs text-purple-400">Suporta CSV (.csv) e Excel (.xlsx, .xls)</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleCsvFile} />
                </label>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder={"Cole o conteúdo do CSV aqui...\nExemplo:\nnome,telefone\nJoão Silva,11999999999\nMaria Souza,11988888888"}
                    value={csvPasteText}
                    onChange={e => setCsvPasteText(e.target.value)}
                    className="min-h-[120px] font-mono text-xs resize-none"
                    rows={6}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (csvPasteText.trim()) parseCsvText(csvPasteText); }}
                    disabled={!csvPasteText.trim()}
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Processar texto colado {csvLeads.length > 0 ? `(${csvLeads.length} leads detectados)` : ''}
                  </Button>
                </div>
              )}
            </div>

            {/* Switch dígito 9 — visível nas abas upload e colar */}
            {csvTab !== 'filter' && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide mr-2">Dígito 9:</span>
                {([
                  { value: 'add', label: 'Adicionar 9', desc: '8 dígitos → 9 dígitos' },
                  { value: 'keep', label: 'Manter', desc: 'Sem alteração' },
                  { value: 'remove', label: 'Remover 9', desc: '9 dígitos → 8 dígitos' },
                ] as { value: 'add' | 'remove' | 'keep'; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setNoveDigito(opt.value)}
                    title={opt.desc}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border ${
                      noveDigito === opt.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                    <span className={`block text-[10px] font-normal mt-0.5 ${noveDigito === opt.value ? 'text-purple-200' : 'text-gray-400'}`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {csvLeads.length > 0 && (
              <>
                {/* Configuração de colunas e campanha */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Campanha *</Label>
                    <select
                      value={csvCampanhaId}
                      onChange={e => setCsvCampanhaId(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {campanhas.map(c => (
                        <option key={c.id} value={c.id}>{c.nome} ({c.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Coluna Nome *</Label>
                    <select
                      value={csvColNome}
                      onChange={e => setCsvColNome(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Coluna Telefone *</Label>
                    <select
                      value={csvColTelefone}
                      onChange={e => { setCsvColTelefone(e.target.value); setCsvFormatado(false); }}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {csvColTelefone && (
                      <button
                        onClick={() => setCsvFormatado(v => !v)}
                        className={`w-full mt-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          csvFormatado
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {csvFormatado ? '✓ Mostrando formatado' : 'Ver números formatados'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Coluna Extras (opcional)</Label>
                    <select
                      value={csvColExtras}
                      onChange={e => setCsvColExtras(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {csvColExtras && (
                      <div className="text-xs text-gray-500 mt-1">
                        Dados desta coluna serão salvos no campo extras
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-gray-700">Preview ({Math.min(csvLeads.length, 5)} de {csvLeads.length} leads)</Label>
                    {csvCampanhaId && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        ID_campanha: {csvCampanhaId}
                      </span>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                            {csvColumns.map(col => (
                              <th key={col} className={`px-3 py-2 text-left font-semibold ${
                                col === csvColNome ? 'text-purple-700 bg-purple-50' :
                                col === csvColTelefone ? 'text-blue-700 bg-blue-50' :
                                col === csvColExtras ? 'text-green-700 bg-green-50' : 'text-gray-600'
                              }`}>
                                {col}
                                {col === csvColNome && <span className="ml-1 text-[9px] bg-purple-200 text-purple-700 rounded px-1">nome</span>}
                                {col === csvColTelefone && <span className="ml-1 text-[9px] bg-blue-200 text-blue-700 rounded px-1">tel</span>}
                                {col === csvColExtras && <span className="ml-1 text-[9px] bg-green-200 text-green-700 rounded px-1">extras</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvLeads.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                              {csvColumns.map(col => {
                                const isTel = col === csvColTelefone;
                                const raw = row[col] || '';
                                const formatted = isTel ? normalizeTelefone(raw) : raw;
                                const changed = isTel && csvFormatado && formatted !== raw.replace(/\D/g, '');
                                return (
                                  <td key={col} className={`px-3 py-2 ${
                                    col === csvColNome ? 'font-medium text-purple-800' :
                                    isTel ? 'font-mono text-blue-700' :
                                    col === csvColExtras ? 'font-medium text-green-700' : 'text-gray-700'
                                  }`}>
                                    {isTel && csvFormatado ? (
                                      <span className="flex flex-col gap-0.5">
                                        <span className="text-blue-700 font-semibold">{formatted}</span>
                                        {changed && <span className="text-gray-400 line-through text-[10px]">{raw}</span>}
                                      </span>
                                    ) : (
                                      raw || <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvLeads.length > 5 && (
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
                        + {csvLeads.length - 5} leads adicionais não exibidos
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setImportCsvOpen(false)} disabled={csvImporting || filterImporting}>
                Cancelar
              </Button>
              {csvTab === 'filter' ? (
                <Button
                  onClick={importFilterLeads}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={filterImporting || filterPreview.length === 0 || !filterDestinoCampanhaId}
                >
                  {filterImporting ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Importar {filterPreview.length > 0 ? `${filterPreview.length} leads` : ''}</>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={importCsvLeads}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={csvImporting || csvLeads.length === 0 || !csvCampanhaId || !csvColNome || !csvColTelefone}
                >
                  {csvImporting ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Importar {csvLeads.length > 0 ? `${csvLeads.length} leads` : ''}</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Campaign Dialog */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Criar Nova Campanha
            </DialogTitle>
            <DialogDescription>
              Crie uma nova campanha para enviar mensagens personalizadas aos seus clientes
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name" className="text-sm font-medium text-gray-700">
                Nome da Campanha *
              </Label>
              <Input
                id="campaign-name"
                value={newCampaign.nome}
                onChange={(e) => setNewCampaign(prev => ({...prev, nome: e.target.value}))}
                placeholder="Ex: Promoção de Verão"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-description" className="text-sm font-medium text-gray-700">
                Descrição da Campanha
              </Label>
              <Textarea
                id="campaign-description"
                value={newCampaign.descricao}
                onChange={(e) => setNewCampaign(prev => ({...prev, descricao: e.target.value}))}
                placeholder="Descreva os objetivos e detalhes desta campanha..."
                className="min-h-[80px] resize-none"
                rows={3}
              />
              <div className="text-xs text-gray-500">
                <p>Descreva o objetivo da campanha, público-alvo e principais benefícios.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-id" className="text-sm font-medium text-gray-700">
                ID da Campanha *
              </Label>
              <Input
                id="campaign-id"
                value={newCampaign.id_campanha}
                onChange={(e) => setNewCampaign(prev => ({...prev, id_campanha: e.target.value}))}
                placeholder="Ex: PROMO_VERAO_2024"
                className="w-full"
              />
              <div className="text-xs text-gray-500">
                <p>Este ID será usado para atribuir leads automaticamente.</p>
                <p>Use letras maiúsculas e underscores. Ex: PROMO_VERAO_2024</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-message" className="text-sm font-medium text-gray-700">
                Mensagem Padrão
              </Label>
              <Textarea
                id="campaign-message"
                value={newCampaign.mensagem_template}
                onChange={(e) => setNewCampaign(prev => ({...prev, mensagem_template: e.target.value}))}
                placeholder="🎯 Olá {nome}! Temos uma oferta especial para você! 🦷✨"
                className="min-h-[100px] resize-none"
                rows={4}
              />
              <div className="text-xs text-gray-500">
                <p>Dicas para personalização:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Use {"{nome}"} para inserir o nome do cliente</li>
                  <li>Use {"{telefone}"} para inserir o telefone</li>
                  <li>Use emojis para tornar a mensagem mais atrativa ✨</li>
                  <li>Limite recomendado: 160 caracteres por mensagem</li>
                </ul>
              </div>
              <div className="pt-3">
                <Button
                  type="button"
                  variant={newCampaign.enviar_audio_vazio ? 'default' : 'outline'}
                  onClick={() => setNewCampaign(prev => ({ ...prev, enviar_audio_vazio: !prev.enviar_audio_vazio }))}
                  className={newCampaign.enviar_audio_vazio ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-700'}
                >
                  {newCampaign.enviar_audio_vazio ? 'Áudio vazio ativado' : 'Ativar envio de áudio vazio'}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Quando ativado, um áudio vazio de 5s será enviado logo após o texto para aumentar a taxa de abertura.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setNewCampaignOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={createNewCampaign}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!newCampaign.nome.trim() || !newCampaign.id_campanha.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={editCampaignOpen} onOpenChange={setEditCampaignOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-purple-600" />
              Editar Campanha
            </DialogTitle>
            <DialogDescription>
              Atualize as informações da campanha "{editingCampaign.nome}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-campaign-name" className="text-sm font-medium text-gray-700">
                  Nome da Campanha *
                </Label>
                <Input
                  id="edit-campaign-name"
                  value={editingCampaign.nome}
                  onChange={(e) => setEditingCampaign(prev => ({...prev, nome: e.target.value}))}
                  placeholder="Ex: Promoção de Verão"
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-campaign-id" className="text-sm font-medium text-gray-700">
                  ID da Campanha *
                </Label>
                <Input
                  id="edit-campaign-id"
                  value={editingCampaign.id_campanha}
                  onChange={(e) => setEditingCampaign(prev => ({...prev, id_campanha: e.target.value}))}
                  placeholder="Ex: PROMO_VERAO_2024"
                  className="w-full"
                  disabled
                />
                <div className="text-xs text-gray-500">
                  ID não pode ser alterado após a criação
                </div>
              </div>
            </div>
            
            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-description" className="text-sm font-medium text-gray-700">
                Descrição da Campanha
              </Label>
              <Textarea
                id="edit-campaign-description"
                value={editingCampaign.descricao}
                onChange={(e) => setEditingCampaign(prev => ({...prev, descricao: e.target.value}))}
                placeholder="Descreva os objetivos e detalhes desta campanha..."
                className="min-h-[80px] resize-none"
                rows={3}
              />
              <div className="text-xs text-gray-500">
                <p>Descreva o objetivo da campanha, público-alvo e principais benefícios.</p>
              </div>
            </div>
            
            {/* Mensagem */}
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-message" className="text-sm font-medium text-gray-700">
                Mensagem WhatsApp
              </Label>
              <Textarea
                id="edit-campaign-message"
                value={editingCampaign.mensagem_template || ''}
                onChange={(e) => setEditingCampaign(prev => ({...prev, mensagem_template: e.target.value}))}
                placeholder="🎯 Olá {nome}! Temos uma oferta especial para você! 🦷✨"
                className="min-h-[120px] resize-none"
                rows={5}
              />
              <div className="text-xs text-gray-500">
                <p>Dicas para personalização:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Use {"{nome}"} para inserir o nome do cliente</li>
                  <li>Use {"{telefone}"} para inserir o telefone</li>
                  <li>Use emojis para tornar a mensagem mais atrativa ✨</li>
                  <li>Limite recomendado: 160 caracteres por mensagem</li>
                </ul>
              </div>
              <div className="pt-4">
                <Button
                  type="button"
                  variant={editingCampaign.enviar_audio_vazio ? 'default' : 'outline'}
                  onClick={() => setEditingCampaign(prev => ({ ...prev, enviar_audio_vazio: !prev.enviar_audio_vazio }))} 
                  className={`w-full md:w-auto ${editingCampaign.enviar_audio_vazio ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-700'}`}
                >
                  {editingCampaign.enviar_audio_vazio ? 'Enviar áudio vazio ativado' : 'Ativar envio de áudio vazio'}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Ative para disparar um áudio vazio logo após o texto desta campanha. Útil para manter a conversa em destaque no WhatsApp.
                </p>
              </div>
            </div>
            
            {/* Estatísticas */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 font-medium mb-3">
                📊 Estatísticas da Campanha:
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-purple-700">{editingCampaign.total_leads || 0}</p>
                  <p className="text-xs text-gray-600">Total Leads</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-blue-700">{editingCampaign.disparos_feitos || 0}</p>
                  <p className="text-xs text-gray-600">Disparos Feitos</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-green-700">{editingCampaign.responderam || 0}</p>
                  <p className="text-xs text-gray-600">Responderam</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-amber-600">{editingCampaign.disparos_pendentes || 0}</p>
                  <p className="text-xs text-gray-600">Pendentes</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-gray-600">{editingCampaign.nao_responderam || 0}</p>
                  <p className="text-xs text-gray-600">Não Responderam</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-lg font-bold text-red-600">{editingCampaign.falharam || 0}</p>
                  <p className="text-xs text-gray-600">Falharam</p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditCampaignOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={saveCampaign}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!editingCampaign.nome.trim() || !editingCampaign.id_campanha.trim()}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Salvar Campanha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={editMessageOpen} onOpenChange={setEditMessageOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Editar Mensagem da Campanha
            </DialogTitle>
            <DialogDescription>
              Personalize a mensagem que será enviada para os clientes da campanha "{selectedCampanha?.nome}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                Mensagem WhatsApp
              </Label>
              <Textarea
                id="message"
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                placeholder="Digite sua mensagem aqui..."
                className="min-h-[150px] resize-none"
                rows={6}
              />
              <div className="text-xs text-gray-500">
                <p>Dicas para personalização:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Use {"{nome}"} para inserir o nome do cliente</li>
                  <li>Use {"{telefone}"} para inserir o telefone</li>
                  <li>Use emojis para tornar a mensagem mais atrativa ✨</li>
                  <li>Limite recomendado: 160 caracteres por mensagem</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditMessageOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={saveMessage}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!editingMessage.trim()}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Salvar Mensagem
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisparosCampanha;
