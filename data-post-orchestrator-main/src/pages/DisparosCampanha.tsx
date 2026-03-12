import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Target,
  ArrowLeft,
  Plus,
  Users,
  Edit3,
  Trash2,
  RefreshCw,
  BarChart3,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  FileText,
  ChevronDown,
  Pause,
  Play,
  Volume2,
  Wifi,
  WifiOff,
  AlertTriangle,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { supabaseUntyped } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";
import { parseCSV, findPhoneColumn, findNameColumn } from "@/utils/csvParser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EDGE_CAMPANHAS_URL = `${SUPABASE_URL}/functions/v1/cadastro-campanhas`;
const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  mensagem_template: string;
  enviar_audio_vazio: boolean;
  uazapi_instance_id: string | null;
  instance_name?: string;
  status: "ativa" | "pausada" | "finalizada";
  total_leads: number;
  total_enviados: number;
  total_pendentes: number;
  total_falharam: number;
  total_responderam: number;
  created_at: string;
}

interface UazapiInstance {
  id: string;
  name: string | null;
  connected: boolean;
  owner_phone?: string | null;
}

interface GlobalStats {
  total_leads: number;
  total_enviados: number;
  total_pendentes: number;
  total_falharam: number;
  total_responderam: number;
  campanhas_ativas: number;
  campanhas_total: number;
}

type NoveDigitoMode = "add" | "remove" | "keep";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAuthHeaders(tenantId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "X-Tenant-Id": tenantId,
  };
}

function normalizeTelefone(
  raw: string,
  noveMode: NoveDigitoMode = "add"
): string {
  if (!raw) return "";
  const primeiro = raw.split(/[/,;]/)[0];
  let digits = primeiro.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  let ddd = "";
  let num = "";

  if (digits.startsWith("55") && digits.length >= 12) {
    ddd = digits.slice(2, 4);
    num = digits.slice(4);
  } else if (digits.length === 10 || digits.length === 11) {
    ddd = digits.slice(0, 2);
    num = digits.slice(2);
  } else if (digits.length === 8 || digits.length === 9) {
    return digits;
  } else {
    return digits;
  }

  if (noveMode === "add" && num.length === 8) {
    num = "9" + num;
  } else if (noveMode === "remove" && num.length === 9 && num.startsWith("9")) {
    num = num.slice(1);
  }

  return "55" + ddd + num;
}

function mapRawCampanha(raw: any, instancesMap: Map<string, string>): Campanha {
  const totalLeads = raw.total_leads ?? 0;
  const totalEnviados = raw.total_enviados ?? 0;
  const totalFalharam = raw.total_falharam ?? 0;
  const totalPendentes = Math.max(0, totalLeads - totalEnviados - totalFalharam);

  return {
    id: raw.id,
    nome: raw.nome ?? "",
    descricao: raw.descricao ?? "",
    mensagem_template: raw.mensagem_template ?? "",
    enviar_audio_vazio: raw.enviar_audio_vazio ?? false,
    uazapi_instance_id: raw.uazapi_instance_id ?? null,
    instance_name: raw.uazapi_instance_id
      ? instancesMap.get(raw.uazapi_instance_id)
      : undefined,
    status: raw.status ?? "pausada",
    total_leads: totalLeads,
    total_enviados: totalEnviados,
    total_pendentes: totalPendentes,
    total_falharam: totalFalharam,
    total_responderam: raw.total_responderam ?? 0,
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DisparosCampanha = () => {
  const navigate = useNavigate();
  const tenantId = getTenantId();
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Core state ----
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingAll, setTogglingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- Create dialog ----
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    nome: "",
    descricao: "",
    mensagem_template: "",
    uazapi_instance_id: "",
    enviar_audio_vazio: false,
  });
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // ---- Edit dialog ----
  const [editCampaignOpen, setEditCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campanha | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // ---- Delete confirm dialog ----
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campanha | null>(
    null
  );

  // ---- Finalize confirm dialog ----
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [campaignToFinalize, setCampaignToFinalize] = useState<Campanha | null>(
    null
  );
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  // ---- CSV Import dialog ----
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [csvTab, setCsvTab] = useState<"upload" | "paste" | "filter">("upload");
  const [csvLeads, setCsvLeads] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvCampanhaId, setCsvCampanhaId] = useState("");
  const [csvColNome, setCsvColNome] = useState("");
  const [csvColTelefone, setCsvColTelefone] = useState("");
  const [csvColExtras, setCsvColExtras] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPasteText, setCsvPasteText] = useState("");
  const [noveDigito, setNoveDigito] = useState<NoveDigitoMode>("add");
  const [csvFormatado, setCsvFormatado] = useState(false);
  // filter tab
  const [filterOrigemIds, setFilterOrigemIds] = useState<string[]>([]);
  const [filterDestinoCampanhaId, setFilterDestinoCampanhaId] = useState("");
  const [filterEnviados, setFilterEnviados] = useState(false);
  const [filterNaoEnviados, setFilterNaoEnviados] = useState(false);
  const [filterResponderam, setFilterResponderam] = useState(false);
  const [filterNaoResponderam, setFilterNaoResponderam] = useState(false);
  const [filterPreview, setFilterPreview] = useState<
    { nome: string; telefone: string }[]
  >([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterImporting, setFilterImporting] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchInstances = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await (supabase as any)
        .from("uazapi_instances")
        .select("id, name, connected, owner_phone")
        .eq("tenant_id", tenantId);
      if (data) setInstances(data as UazapiInstance[]);
    } catch (err) {
      console.error("Erro ao buscar instâncias:", err);
    }
  }, [tenantId]);

  const fetchCampanhas = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const headers = buildAuthHeaders(tenantId);

      const res = await fetch(EDGE_CAMPANHAS_URL, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const result = await res.json();
      const raw: any[] = result.data ?? [];

      // Build instance name map from current instances state
      const instancesMap = new Map<string, string>(
        instances.map((i) => [i.id, i.name ?? i.id])
      );

      const formatted = raw.map((c) => mapRawCampanha(c, instancesMap));
      setCampanhas(formatted);
    } catch (error) {
      console.error("Erro ao buscar campanhas:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  }, [tenantId, instances]);

  // Initial load: fetch instances and campaigns in parallel
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    Promise.all([fetchInstances(), fetchCampanhas()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Realtime subscriptions: update instantly when data changes
  useEffect(() => {
    if (!tenantId) return;

    // Debounce to avoid rapid-fire refreshes when multiple rows change at once
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchCampanhas();
      }, 800);
    };

    // Subscribe to campanhas table changes (status, counters, etc.)
    const campanhasChannel = supabaseUntyped
      .channel('campanhas-realtime')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'campanhas',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          console.log('[realtime] campanhas changed');
          debouncedRefresh();
        }
      )
      .subscribe();

    // Fallback polling every 90s in case realtime misses something
    const fallbackInterval = setInterval(() => {
      fetchCampanhas();
    }, 90_000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(fallbackInterval);
      supabaseUntyped.removeChannel(campanhasChannel);
    };
  }, [tenantId, fetchCampanhas]);

  // Rebuild instance_name on campaigns whenever instances change
  useEffect(() => {
    if (instances.length === 0) return;
    const instancesMap = new Map<string, string>(
      instances.map((i) => [i.id, i.name ?? i.id])
    );
    setCampanhas((prev) =>
      prev.map((c) => ({
        ...c,
        instance_name: c.uazapi_instance_id
          ? instancesMap.get(c.uazapi_instance_id)
          : undefined,
      }))
    );
  }, [instances]);

  // ---------------------------------------------------------------------------
  // Global stats
  // ---------------------------------------------------------------------------

  const globalStats = useMemo<GlobalStats>(() => {
    return campanhas.reduce<GlobalStats>(
      (acc, c) => {
        acc.total_leads += c.total_leads;
        acc.total_enviados += c.total_enviados;
        acc.total_pendentes += c.total_pendentes;
        acc.total_falharam += c.total_falharam;
        acc.total_responderam += c.total_responderam;
        if (c.status === "ativa") acc.campanhas_ativas++;
        return acc;
      },
      {
        total_leads: 0,
        total_enviados: 0,
        total_pendentes: 0,
        total_falharam: 0,
        total_responderam: 0,
        campanhas_ativas: 0,
        campanhas_total: campanhas.length,
      }
    );
  }, [campanhas]);

  // ---------------------------------------------------------------------------
  // Campaign CRUD
  // ---------------------------------------------------------------------------

  const createCampaign = async () => {
    if (!newCampaign.nome.trim()) {
      toast.error("O nome da campanha é obrigatório");
      return;
    }
    if (!newCampaign.mensagem_template.trim()) {
      toast.error("A mensagem template é obrigatória");
      return;
    }
    setCreatingCampaign(true);
    try {
      const headers = buildAuthHeaders(tenantId);
      const body: Record<string, unknown> = {
        nome: newCampaign.nome.trim(),
        descricao: newCampaign.descricao.trim(),
        mensagem_template: newCampaign.mensagem_template.trim(),
        enviar_audio_vazio: newCampaign.enviar_audio_vazio,
        status: "pausada",
      };
      if (newCampaign.uazapi_instance_id) {
        body.uazapi_instance_id = newCampaign.uazapi_instance_id;
      }

      const res = await fetch(EDGE_CAMPANHAS_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Campanha criada com sucesso!");
      setNewCampaignOpen(false);
      setNewCampaign({
        nome: "",
        descricao: "",
        mensagem_template: "",
        uazapi_instance_id: "",
        enviar_audio_vazio: false,
      });
      await fetchCampanhas();
    } catch (error) {
      console.error("Erro ao criar campanha:", error);
      toast.error(`Erro ao criar campanha: ${(error as Error).message}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const saveCampaign = async () => {
    if (!editingCampaign) return;
    if (!editingCampaign.nome.trim()) {
      toast.error("O nome da campanha é obrigatório");
      return;
    }
    if (!editingCampaign.mensagem_template.trim()) {
      toast.error("A mensagem template é obrigatória");
      return;
    }
    setSavingCampaign(true);
    try {
      const headers = buildAuthHeaders(tenantId);
      const body: Record<string, unknown> = {
        id: editingCampaign.id,
        nome: editingCampaign.nome.trim(),
        descricao: editingCampaign.descricao.trim(),
        mensagem_template: editingCampaign.mensagem_template.trim(),
        enviar_audio_vazio: editingCampaign.enviar_audio_vazio,
        uazapi_instance_id: editingCampaign.uazapi_instance_id ?? null,
      };

      const res = await fetch(`${EDGE_CAMPANHAS_URL}?id=${editingCampaign.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Campanha atualizada com sucesso!");
      setEditCampaignOpen(false);
      setEditingCampaign(null);
      await fetchCampanhas();
    } catch (error) {
      console.error("Erro ao atualizar campanha:", error);
      toast.error(`Erro ao atualizar campanha: ${(error as Error).message}`);
    } finally {
      setSavingCampaign(false);
    }
  };

  const confirmDeleteCampaign = (campanha: Campanha) => {
    setCampaignToDelete(campanha);
    setDeleteConfirmOpen(true);
  };

  const deleteCampaign = async () => {
    if (!campaignToDelete) return;
    setDeletingId(campaignToDelete.id);
    try {
      const headers = buildAuthHeaders(tenantId);
      const res = await fetch(
        `${EDGE_CAMPANHAS_URL}?id=${campaignToDelete.id}`,
        { method: "DELETE", headers }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Campanha excluída com sucesso!");
      setDeleteConfirmOpen(false);
      setCampaignToDelete(null);
      await fetchCampanhas();
    } catch (error) {
      console.error("Erro ao excluir campanha:", error);
      toast.error(`Erro ao excluir campanha: ${(error as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Status control
  // ---------------------------------------------------------------------------

  const validateActivation = (campanha: Campanha): string | null => {
    if (!campanha.uazapi_instance_id) {
      return "Selecione uma instância UAZAPI antes de ativar a campanha.";
    }
    return null;
  };

  const toggleCampaignStatus = async (campanha: Campanha) => {

    const newStatus = campanha.status === "ativa" ? "pausada" : "ativa";

    if (newStatus === "ativa") {
      const validationError = validateActivation(campanha);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    setTogglingId(campanha.id);
    try {
      const headers = buildAuthHeaders(tenantId);
      const res = await fetch(`${EDGE_CAMPANHAS_URL}?id=${campanha.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: campanha.id, status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      setCampanhas((prev) =>
        prev.map((c) =>
          c.id === campanha.id ? { ...c, status: newStatus } : c
        )
      );
      toast.success(
        `Campanha ${newStatus === "ativa" ? "ativada" : "pausada"} com sucesso!`
      );
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status da campanha");
    } finally {
      setTogglingId(null);
    }
  };

  const toggleAllCampaigns = async () => {
    const hasActive = campanhas.some((c) => c.status === "ativa");
    const targetStatus = hasActive ? "pausada" : "ativa";

    setTogglingAll(true);
    try {
      const headers = buildAuthHeaders(tenantId);
      const targets = campanhas.filter((c) => {
        if (c.status === "finalizada") return false;
        if (targetStatus === "ativa") {
          return c.status === "pausada" && validateActivation(c) === null;
        }
        return c.status === "ativa";
      });

      await Promise.all(
        targets.map((c) =>
          fetch(`${EDGE_CAMPANHAS_URL}?id=${c.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ id: c.id, status: targetStatus }),
          })
        )
      );

      toast.success(
        `${targets.length} campanha(s) ${
          targetStatus === "ativa" ? "ativadas" : "pausadas"
        }!`
      );
      await fetchCampanhas();
    } catch (error) {
      console.error("Erro ao alternar campanhas:", error);
      toast.error("Erro ao alternar campanhas");
    } finally {
      setTogglingAll(false);
    }
  };

  const confirmFinalizeCampaign = (campanha: Campanha) => {
    setCampaignToFinalize(campanha);
    setFinalizeConfirmOpen(true);
  };

  const finalizeCampaign = async () => {
    if (!campaignToFinalize) return;
    setFinalizingId(campaignToFinalize.id);
    try {
      const headers = buildAuthHeaders(tenantId);
      const res = await fetch(
        `${EDGE_CAMPANHAS_URL}?id=${campaignToFinalize.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            id: campaignToFinalize.id,
            status: "finalizada",
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Campanha finalizada!");
      setFinalizeConfirmOpen(false);
      setCampaignToFinalize(null);
      setCampanhas((prev) =>
        prev.map((c) =>
          c.id === campaignToFinalize.id ? { ...c, status: "finalizada" } : c
        )
      );
    } catch (error) {
      console.error("Erro ao finalizar campanha:", error);
      toast.error(`Erro ao finalizar campanha: ${(error as Error).message}`);
    } finally {
      setFinalizingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // CSV / XLSX parsing
  // ---------------------------------------------------------------------------

  const applyCsvData = (rows: Record<string, string>[]) => {
    if (rows.length === 0) {
      toast.error("Nenhum dado encontrado");
      return;
    }
    const cols = Object.keys(rows[0]);
    setCsvColumns(cols);
    setCsvLeads(rows);
    const nomeCol = findNameColumn(cols) ?? "";
    const telCol = findPhoneColumn(cols) ?? "";
    setCsvColNome(nomeCol);
    setCsvColTelefone(telCol);
    setCsvColExtras("");
    setCsvFormatado(false);
  };

  const parseCsvText = (text: string) => {
    const rows = parseCSV(text);
    if (rows.length === 0) {
      toast.error("CSV deve ter cabeçalho e ao menos uma linha de dados");
      return;
    }
    applyCsvData(rows);
  };

  const parseXlsxFile = (buffer: ArrayBuffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });
    if (rows.length === 0) {
      toast.error("Planilha vazia ou sem dados");
      return;
    }
    applyCsvData(
      rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
      )
    );
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();
    if (ext === "xlsx" || ext === "xls") {
      reader.onload = (ev) => parseXlsxFile(ev.target?.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (ev) => parseCsvText(ev.target?.result as string);
      reader.readAsText(file, "UTF-8");
    }
  };

  const resetImportDialog = () => {
    setCsvLeads([]);
    setCsvColumns([]);
    setCsvCampanhaId("");
    setCsvColNome("");
    setCsvColTelefone("");
    setCsvColExtras("");
    setCsvFileName("");
    setCsvPasteText("");
    setCsvFormatado(false);
    setFilterPreview([]);
    setFilterOrigemIds([]);
    setFilterDestinoCampanhaId("");
    setFilterEnviados(false);
    setFilterNaoEnviados(false);
    setFilterResponderam(false);
    setFilterNaoResponderam(false);
  };

  // ---------------------------------------------------------------------------
  // CSV import (batch insert via supabase client)
  // ---------------------------------------------------------------------------

  const importCsvLeads = async () => {
    if (!csvCampanhaId) {
      toast.error("Selecione uma campanha");
      return;
    }
    if (!csvColNome) {
      toast.error("Selecione a coluna de nome");
      return;
    }
    if (!csvColTelefone) {
      toast.error("Selecione a coluna de telefone");
      return;
    }
    if (csvLeads.length === 0) {
      toast.error("Nenhum lead no CSV");
      return;
    }

    setCsvImporting(true);

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const row of csvLeads) {
      const nome = row[csvColNome]?.trim();
      const rawTel = row[csvColTelefone] ?? "";
      const telefone = normalizeTelefone(rawTel, noveDigito);
      if (!nome || !telefone) {
        skipped++;
        continue;
      }
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        ID_campanha: csvCampanhaId,
        nome,
        telefone,
        disparo_feito: false,
      };
      if (csvColExtras && row[csvColExtras]) {
        payload.extras = { [csvColExtras]: row[csvColExtras].trim() };
      }
      rows.push(payload);
    }

    if (rows.length === 0) {
      toast.error("Nenhum lead válido encontrado");
      setCsvImporting(false);
      return;
    }

    const BATCH = 500;
    let ok = 0;
    let fail = 0;

    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await (supabase as any)
          .from("tabela_campanha")
          .insert(batch);
        if (error) {
          console.error("Batch insert error:", error);
          fail += batch.length;
        } else {
          ok += batch.length;
        }
      }

      if (skipped > 0) {
        toast.warning(
          `${ok} leads importados. ${skipped} linhas ignoradas (nome/telefone vazio).${
            fail > 0 ? ` ${fail} falharam.` : ""
          }`
        );
      } else {
        toast.success(
          `${ok} leads importados com sucesso!${fail > 0 ? ` (${fail} falharam)` : ""}`
        );
      }

      setImportCsvOpen(false);
      resetImportDialog();
      await fetchCampanhas();
    } catch (err) {
      console.error("Erro ao importar leads:", err);
      toast.error("Erro ao importar leads");
    } finally {
      setCsvImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filter-based lead import
  // ---------------------------------------------------------------------------

  const fetchAllSupabasePages = async (
    query: any,
    maxRecords = 10_000
  ): Promise<any[]> => {
    const pageSize = 1000;
    let offset = 0;
    const all: any[] = [];
    while (all.length < maxRecords) {
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (let i = 0; i < data.length; i++) all.push(data[i]);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  };

  const fetchFilterPreview = async () => {
    if (!filterOrigemIds.length) {
      toast.error("Selecione ao menos uma campanha de origem");
      return;
    }
    setFilterLoading(true);
    setFilterPreview([]);
    try {
      let leadsQuery = (supabase as any)
        .from("tabela_campanha")
        .select("nome,telefone,disparo_feito,respondeu")
        .eq("tenant_id", tenantId)
        .in("ID_campanha", filterOrigemIds);

      let leads: {
        nome: string;
        telefone: string;
        disparo_feito: boolean;
        respondeu: boolean;
      }[] = await fetchAllSupabasePages(leadsQuery);

      if (!leads.length) {
        setFilterPreview([]);
        return;
      }

      const filtrarDisparo = filterEnviados || filterNaoEnviados;
      if (filtrarDisparo && !(filterEnviados && filterNaoEnviados)) {
        leads = leads.filter((l) => {
          if (filterEnviados) return l.disparo_feito === true;
          if (filterNaoEnviados)
            return l.disparo_feito === false || l.disparo_feito === null;
          return true;
        });
      }

      if (!leads.length) {
        setFilterPreview([]);
        return;
      }

      const filtrarResposta = filterResponderam || filterNaoResponderam;
      if (filtrarResposta && !(filterResponderam && filterNaoResponderam)) {
        leads = leads.filter((l) => {
          if (filterResponderam) return l.respondeu === true;
          if (filterNaoResponderam)
            return l.respondeu === false || l.respondeu === null;
          return true;
        });
      }

      // Deduplicate by phone
      const seen = new Set<string>();
      const unique = leads.filter((l) => {
        if (seen.has(l.telefone)) return false;
        seen.add(l.telefone);
        return true;
      });
      setFilterPreview(unique.map((l) => ({ nome: l.nome, telefone: l.telefone })));
    } catch (e) {
      console.error("Erro ao buscar leads:", e);
      toast.error("Erro ao buscar leads");
    } finally {
      setFilterLoading(false);
    }
  };

  const importFilterLeads = async () => {
    if (!filterDestinoCampanhaId) {
      toast.error("Selecione a campanha de destino");
      return;
    }
    if (!filterPreview.length) {
      toast.error("Nenhum lead para importar");
      return;
    }

    setFilterImporting(true);
    const BATCH = 500;
    let ok = 0;
    let fail = 0;

    try {
      const rows = filterPreview.map((lead) => ({
        tenant_id: tenantId,
        ID_campanha: filterDestinoCampanhaId,
        nome: lead.nome,
        telefone: normalizeTelefone(lead.telefone, noveDigito),
        disparo_feito: false,
      }));

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await (supabase as any)
          .from("tabela_campanha")
          .insert(batch);
        if (error) {
          console.error("Batch insert error:", error);
          fail += batch.length;
        } else {
          ok += batch.length;
        }
      }

      toast.success(
        `${ok} leads importados!${fail > 0 ? ` (${fail} falharam)` : ""}`
      );
      setImportCsvOpen(false);
      resetImportDialog();
      await fetchCampanhas();
    } catch {
      toast.error("Erro ao importar leads");
    } finally {
      setFilterImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  const getStatusBadge = (status: Campanha["status"]) => {
    switch (status) {
      case "ativa":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            Ativa
          </Badge>
        );
      case "pausada":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
            Pausada
          </Badge>
        );
      case "finalizada":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
            Finalizada
          </Badge>
        );
    }
  };

  const getInstanceBadge = (campanha: Campanha) => {
    if (!campanha.uazapi_instance_id) {
      return (
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <WifiOff className="h-3 w-3" /> Sem instância
        </span>
      );
    }
    const inst = instances.find((i) => i.id === campanha.uazapi_instance_id);
    return (
      <span
        className={`flex items-center gap-1 text-xs ${
          inst?.connected ? "text-green-600" : "text-amber-500"
        }`}
      >
        {inst?.connected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {campanha.instance_name ?? campanha.uazapi_instance_id}
      </span>
    );
  };

  const hasActiveCampaigns = campanhas.some((c) => c.status === "ativa");

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading && campanhas.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos")}
                className="text-gray-600 hover:text-gray-900"
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
                  <p className="text-sm text-gray-500">
                    Gerencie suas campanhas de marketing
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Pausar / Ativar Todas */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllCampaigns}
                disabled={togglingAll || campanhas.filter((c) => c.status !== "finalizada").length === 0}
                className={
                  hasActiveCampaigns
                    ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                    : "border-green-300 text-green-700 hover:bg-green-50"
                }
              >
                {togglingAll ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : hasActiveCampaigns ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {hasActiveCampaigns ? "Pausar Todas" : "Ativar Todas"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetImportDialog();
                  setImportCsvOpen(true);
                }}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar Leads
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setNewCampaign({
                    nome: "",
                    descricao: "",
                    mensagem_template: "",
                    uazapi_instance_id: "",
                    enviar_audio_vazio: false,
                  });
                  setNewCampaignOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchCampanhas()}
                disabled={loading}
                title="Atualizar"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ------------------------------------------------------------------ */}
        {/* Info Banner */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Intervalo de disparo: 1 mensagem a cada 3 minutos por campanha</p>
            <p className="mt-1 text-amber-600">
              Para evitar queda da instancia UAZAPI, mantenha no maximo 1 campanha ativa por instancia.
              Campanhas de usuarios diferentes disparam em paralelo sem interferir entre si.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Global Stats */}
        {/* ------------------------------------------------------------------ */}
        <Card className="shadow-lg border-gray-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-violet-600 text-white pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">
                    Estatísticas Gerais
                  </CardTitle>
                  <CardDescription className="text-purple-200">
                    {globalStats.campanhas_total} campanhas &mdash;{" "}
                    {globalStats.campanhas_ativas} ativas
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
              {[
                {
                  label: "Total Leads",
                  value: globalStats.total_leads,
                  color: "purple",
                  Icon: Users,
                },
                {
                  label: "Enviados",
                  value: globalStats.total_enviados,
                  color: "blue",
                  Icon: Send,
                },
                {
                  label: "Pendentes",
                  value: globalStats.total_pendentes,
                  color: "amber",
                  Icon: Clock,
                },
                {
                  label: "Falharam",
                  value: globalStats.total_falharam,
                  color: "red",
                  Icon: XCircle,
                },
                {
                  label: "Responderam",
                  value: globalStats.total_responderam,
                  color: "green",
                  Icon: CheckCircle,
                },
                {
                  label: "Taxa Resposta",
                  value:
                    globalStats.total_enviados > 0
                      ? `${Math.round((globalStats.total_responderam / globalStats.total_enviados) * 100)}%`
                      : "—",
                  color: "violet",
                  Icon: BarChart3,
                },
              ].map(({ label, value, color, Icon }) => (
                <div
                  key={label}
                  className={`bg-${color}-50 rounded-xl p-4 text-center border border-${color}-100`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <Icon className={`h-5 w-5 text-${color}-600`} />
                  </div>
                  <p className={`text-2xl font-bold text-${color}-700`}>
                    {value}
                  </p>
                  <p className={`text-xs text-${color}-600 font-medium mt-1`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {globalStats.total_leads > 0 && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Progresso geral</span>
                  <span>
                    {Math.round(
                      (globalStats.total_enviados / globalStats.total_leads) *
                        100
                    )}
                    % enviados
                  </span>
                </div>
                <Progress
                  value={Math.round(
                    (globalStats.total_enviados / globalStats.total_leads) * 100
                  )}
                  className="h-2.5"
                />
                <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{" "}
                    Responderam
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{" "}
                    Enviados
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{" "}
                    Falharam
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />{" "}
                    Pendentes
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Campaign Cards */}
        {/* ------------------------------------------------------------------ */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Suas Campanhas
              </h2>
              <p className="text-gray-600 mt-1">
                Gerencie e monitore suas campanhas
              </p>
            </div>
          </div>

          {campanhas.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma campanha encontrada
                </h3>
                <p className="text-gray-600 mb-4">
                  Crie sua primeira campanha para começar a enviar mensagens
                  personalizadas.
                </p>
                <Button
                  onClick={() => setNewCampaignOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Campanha
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campanhas.map((campanha) => {
                const progressPct =
                  campanha.total_leads > 0
                    ? Math.round(
                        (campanha.total_enviados / campanha.total_leads) * 100
                      )
                    : 0;
                const isActive = campanha.status === "ativa";
                const isFinalized = campanha.status === "finalizada";

                return (
                  <Card
                    key={campanha.id}
                    className={`shadow-lg border-2 hover:shadow-xl transition-all duration-300 relative overflow-hidden ${
                      isActive
                        ? "border-purple-400 bg-gradient-to-br from-purple-50 to-violet-50"
                        : isFinalized
                        ? "border-gray-200 bg-gray-50 opacity-80"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg pointer-events-none">
                        <div className="absolute inset-0 rounded-lg border-2 border-purple-400 animate-pulse opacity-30" />
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle
                            className={`text-lg flex items-center gap-2 truncate ${
                              isActive ? "text-purple-900" : "text-gray-900"
                            }`}
                          >
                            <Target
                              className={`h-4 w-4 shrink-0 ${
                                isActive
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }`}
                            />
                            <span className="truncate">{campanha.nome}</span>
                            {campanha.enviar_audio_vazio && (
                              <Volume2
                                className="h-4 w-4 shrink-0 text-violet-500"
                                title="Áudio silencioso ativado"
                              />
                            )}
                          </CardTitle>
                          {campanha.descricao && (
                            <CardDescription className="mt-1 text-sm line-clamp-1">
                              {campanha.descricao}
                            </CardDescription>
                          )}
                          <div className="mt-1.5">
                            {getInstanceBadge(campanha)}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(campanha.status)}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-4">
                      {/* Message preview */}
                      <div
                        className={`rounded-lg p-3 border text-sm line-clamp-2 ${
                          isActive
                            ? "bg-purple-100/60 border-purple-200 text-purple-800"
                            : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        {campanha.mensagem_template ||
                          "Mensagem não definida"}
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Progresso</span>
                          <span>
                            {campanha.total_enviados}/{campanha.total_leads}{" "}
                            ({progressPct}%)
                          </span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {[
                          {
                            label: "Leads",
                            value: campanha.total_leads,
                            className: "text-gray-700",
                          },
                          {
                            label: "Enviados",
                            value: campanha.total_enviados,
                            className: "text-blue-700",
                          },
                          {
                            label: "Pendentes",
                            value: campanha.total_pendentes,
                            className: "text-amber-600",
                          },
                          {
                            label: "Falharam",
                            value: campanha.total_falharam,
                            className: "text-red-600",
                          },
                          {
                            label: "Responderam",
                            value: campanha.total_responderam,
                            className: "text-green-700",
                          },
                        ].map(({ label, value, className }) => (
                          <div
                            key={label}
                            className="bg-white/70 rounded-lg p-2 border border-gray-100"
                          >
                            <p className={`text-sm font-bold ${className}`}>
                              {value}
                            </p>
                            <p className="text-[10px] text-gray-500 leading-tight">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {/* Edit */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCampaign({ ...campanha });
                            setEditCampaignOpen(true);
                          }}
                          className="flex-1"
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Editar
                        </Button>

                        {/* Play / Pause */}
                        <Button
                          size="sm"
                          variant={isActive ? "destructive" : "default"}
                          onClick={() => toggleCampaignStatus(campanha)}
                          disabled={togglingId === campanha.id}
                          className={`flex-1 ${
                            !isActive && !isFinalized
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : ""
                          }`}
                        >
                          {togglingId === campanha.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : isActive ? (
                            <Pause className="h-4 w-4 mr-1" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                          {isActive ? "Pausar" : "Ativar"}
                        </Button>

                        {/* Finalize */}
                        {!isFinalized && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmFinalizeCampaign(campanha)}
                            disabled={finalizingId === campanha.id}
                            className="px-2 hover:bg-gray-100 hover:border-gray-400 text-gray-500"
                            title="Finalizar campanha"
                          >
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteCampaign(campanha)}
                          disabled={deletingId === campanha.id}
                          className="px-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                          title="Excluir campanha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Delete Confirm Dialog */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Excluir Campanha
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a campanha{" "}
              <strong>"{campaignToDelete?.nome}"</strong>? Todos os leads
              associados serão removidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCampaignToDelete(null);
              }}
              disabled={!!deletingId}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={deleteCampaign}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Finalize Confirm Dialog */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={finalizeConfirmOpen}
        onOpenChange={setFinalizeConfirmOpen}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-700">
              <StopCircle className="h-5 w-5" />
              Finalizar Campanha
            </DialogTitle>
            <DialogDescription>
              Finalizar a campanha{" "}
              <strong>"{campaignToFinalize?.nome}"</strong> irá pausar os
              disparos permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFinalizeConfirmOpen(false);
                setCampaignToFinalize(null);
              }}
              disabled={!!finalizingId}
            >
              Cancelar
            </Button>
            <Button
              onClick={finalizeCampaign}
              disabled={!!finalizingId}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {finalizingId ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4 mr-2" />
              )}
              Finalizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Create Campaign Dialog */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Nova Campanha
            </DialogTitle>
            <DialogDescription>
              Crie uma nova campanha para enviar mensagens personalizadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="new-nome">Nome *</Label>
              <Input
                id="new-nome"
                value={newCampaign.nome}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, nome: e.target.value }))
                }
                placeholder="Ex: Promoção Verão 2025"
              />
            </div>

            {/* Descricao */}
            <div className="space-y-2">
              <Label htmlFor="new-descricao">Descrição</Label>
              <Textarea
                id="new-descricao"
                value={newCampaign.descricao}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, descricao: e.target.value }))
                }
                placeholder="Descreva o objetivo da campanha..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Mensagem template */}
            <div className="space-y-2">
              <Label htmlFor="new-msg">
                Mensagem Template *
              </Label>
              <Textarea
                id="new-msg"
                value={newCampaign.mensagem_template}
                onChange={(e) =>
                  setNewCampaign((p) => ({
                    ...p,
                    mensagem_template: e.target.value,
                  }))
                }
                placeholder={"Olá {nome}! Temos uma novidade para você!"}
                rows={4}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Use{" "}
                <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code> e{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {"{telefone}"}
                </code>{" "}
                para personalizar a mensagem.
              </p>
            </div>

            {/* Instancia UAZAPI */}
            <div className="space-y-2">
              <Label>Instância UAZAPI</Label>
              <Select
                value={newCampaign.uazapi_instance_id || "none"}
                onValueChange={(v) =>
                  setNewCampaign((p) => ({
                    ...p,
                    uazapi_instance_id: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <span className="flex items-center gap-2">
                        {inst.connected ? (
                          <Wifi className="h-3 w-3 text-green-500" />
                        ) : (
                          <WifiOff className="h-3 w-3 text-gray-400" />
                        )}
                        {inst.name ?? inst.id}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio vazio */}
            <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <Checkbox
                id="new-audio"
                checked={newCampaign.enviar_audio_vazio}
                onCheckedChange={(v) =>
                  setNewCampaign((p) => ({
                    ...p,
                    enviar_audio_vazio: v === true,
                  }))
                }
              />
              <div>
                <Label htmlFor="new-audio" className="cursor-pointer font-medium">
                  Áudio silencioso
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Áudios rotacionados automaticamente. Envia um áudio vazio
                  após o texto para destacar a conversa no WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setNewCampaignOpen(false)}
                disabled={creatingCampaign}
              >
                Cancelar
              </Button>
              <Button
                onClick={createCampaign}
                disabled={
                  creatingCampaign ||
                  !newCampaign.nome.trim() ||
                  !newCampaign.mensagem_template.trim()
                }
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {creatingCampaign ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Criar Campanha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Edit Campaign Dialog */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={editCampaignOpen}
        onOpenChange={(o) => {
          if (!o) setEditingCampaign(null);
          setEditCampaignOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-purple-600" />
              Editar Campanha
            </DialogTitle>
            <DialogDescription>
              Atualize as informações da campanha "{editingCampaign?.nome}"
            </DialogDescription>
          </DialogHeader>

          {editingCampaign && (
            <div className="space-y-4 pt-1">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome *</Label>
                <Input
                  id="edit-nome"
                  value={editingCampaign.nome}
                  onChange={(e) =>
                    setEditingCampaign((p) =>
                      p ? { ...p, nome: e.target.value } : p
                    )
                  }
                  placeholder="Nome da campanha"
                />
              </div>

              {/* Descricao */}
              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Textarea
                  id="edit-descricao"
                  value={editingCampaign.descricao}
                  onChange={(e) =>
                    setEditingCampaign((p) =>
                      p ? { ...p, descricao: e.target.value } : p
                    )
                  }
                  placeholder="Descreva o objetivo da campanha..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Mensagem template */}
              <div className="space-y-2">
                <Label htmlFor="edit-msg">Mensagem Template *</Label>
                <Textarea
                  id="edit-msg"
                  value={editingCampaign.mensagem_template}
                  onChange={(e) =>
                    setEditingCampaign((p) =>
                      p ? { ...p, mensagem_template: e.target.value } : p
                    )
                  }
                  placeholder={"Olá {nome}! Temos uma novidade para você!"}
                  rows={5}
                  className="resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Use{" "}
                  <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code>{" "}
                  e{" "}
                  <code className="bg-gray-100 px-1 rounded">
                    {"{telefone}"}
                  </code>{" "}
                  para personalizar.
                </p>
              </div>

              {/* Instancia UAZAPI */}
              <div className="space-y-2">
                <Label>Instância UAZAPI</Label>
                <Select
                  value={editingCampaign.uazapi_instance_id ?? "none"}
                  onValueChange={(v) =>
                    setEditingCampaign((p) =>
                      p
                        ? {
                            ...p,
                            uazapi_instance_id: v === "none" ? null : v,
                          }
                        : p
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <span className="flex items-center gap-2">
                          {inst.connected ? (
                            <Wifi className="h-3 w-3 text-green-500" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-gray-400" />
                          )}
                          {inst.name ?? inst.id}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Audio vazio */}
              <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <Checkbox
                  id="edit-audio"
                  checked={editingCampaign.enviar_audio_vazio}
                  onCheckedChange={(v) =>
                    setEditingCampaign((p) =>
                      p ? { ...p, enviar_audio_vazio: v === true } : p
                    )
                  }
                />
                <div>
                  <Label
                    htmlFor="edit-audio"
                    className="cursor-pointer font-medium"
                  >
                    Áudio silencioso
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Áudios rotacionados automaticamente.
                  </p>
                </div>
              </div>

              {/* Read-only stats */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Estatísticas da campanha (somente leitura)
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {[
                    {
                      label: "Leads",
                      value: editingCampaign.total_leads,
                      color: "text-gray-700",
                    },
                    {
                      label: "Enviados",
                      value: editingCampaign.total_enviados,
                      color: "text-blue-700",
                    },
                    {
                      label: "Pendentes",
                      value: editingCampaign.total_pendentes,
                      color: "text-amber-600",
                    },
                    {
                      label: "Falharam",
                      value: editingCampaign.total_falharam,
                      color: "text-red-600",
                    },
                    {
                      label: "Responderam",
                      value: editingCampaign.total_responderam,
                      color: "text-green-700",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-white rounded-lg p-2.5 border text-center"
                    >
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditCampaignOpen(false);
                    setEditingCampaign(null);
                  }}
                  disabled={savingCampaign}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveCampaign}
                  disabled={
                    savingCampaign ||
                    !editingCampaign.nome.trim() ||
                    !editingCampaign.mensagem_template.trim()
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {savingCampaign ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Edit3 className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Import CSV Dialog */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={importCsvOpen}
        onOpenChange={(o) => {
          if (!csvImporting && !filterImporting) {
            setImportCsvOpen(o);
            if (!o) resetImportDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[95vw] md:max-w-[860px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-600" />
              Importar Leads
            </DialogTitle>
            <DialogDescription>
              Importe leads via arquivo CSV/XLSX, colagem de texto ou
              filtrando de campanhas existentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <Tabs
              value={csvTab}
              onValueChange={(v) => {
                setCsvTab(v as typeof csvTab);
                if (v === "filter") setFilterPreview([]);
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Upload
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex-1 gap-2">
                  <FileText className="h-4 w-4" /> Colar CSV
                </TabsTrigger>
                <TabsTrigger value="filter" className="flex-1 gap-2">
                  <ChevronDown className="h-4 w-4" /> Por Filtro
                </TabsTrigger>
              </TabsList>

              {/* Upload tab */}
              <TabsContent value="upload" className="mt-3">
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    {csvFileName ? (
                      <>
                        <FileText className="h-6 w-6 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">
                          {csvFileName}
                        </span>
                        <span className="text-xs text-purple-500">
                          {csvLeads.length} leads detectados
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-purple-400" />
                        <span className="text-sm text-purple-600 font-medium">
                          Clique para selecionar o arquivo
                        </span>
                        <span className="text-xs text-purple-400">
                          Suporta CSV (.csv) e Excel (.xlsx, .xls)
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={handleCsvFile}
                  />
                </label>
              </TabsContent>

              {/* Paste tab */}
              <TabsContent value="paste" className="mt-3 space-y-2">
                <Textarea
                  placeholder={
                    "Cole o conteúdo do CSV aqui...\nExemplo:\nnome,telefone\nJoão Silva,11999999999"
                  }
                  value={csvPasteText}
                  onChange={(e) => setCsvPasteText(e.target.value)}
                  className="min-h-[120px] font-mono text-xs resize-none"
                  rows={6}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (csvPasteText.trim()) parseCsvText(csvPasteText);
                  }}
                  disabled={!csvPasteText.trim()}
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Processar texto colado
                  {csvLeads.length > 0
                    ? ` (${csvLeads.length} leads detectados)`
                    : ""}
                </Button>
              </TabsContent>

              {/* Filter tab */}
              <TabsContent value="filter" className="mt-3 space-y-4">
                {/* Source campaigns */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Campanhas de Origem *{" "}
                    <span className="text-gray-400 font-normal">
                      (uma ou mais)
                    </span>
                  </Label>
                  <div className="border border-gray-300 rounded-lg bg-white max-h-36 overflow-y-auto p-2 space-y-1">
                    {campanhas.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 cursor-pointer select-none px-1 py-0.5 rounded hover:bg-purple-50"
                      >
                        <input
                          type="checkbox"
                          checked={filterOrigemIds.includes(c.id)}
                          onChange={() => {
                            setFilterOrigemIds((prev) =>
                              prev.includes(c.id)
                                ? prev.filter((x) => x !== c.id)
                                : [...prev, c.id]
                            );
                            setFilterPreview([]);
                          }}
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-sm text-gray-700">{c.nome}</span>
                      </label>
                    ))}
                  </div>
                  {filterOrigemIds.length > 0 && (
                    <p className="text-xs text-purple-600">
                      {filterOrigemIds.length} campanha(s) selecionada(s)
                    </p>
                  )}
                </div>

                {/* Destination campaign */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Campanha de Destino *
                  </Label>
                  <select
                    value={filterDestinoCampanhaId}
                    onChange={(e) =>
                      setFilterDestinoCampanhaId(e.target.value)
                    }
                    className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">Selecione...</option>
                    {campanhas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filters */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Filtros de Disparo{" "}
                    <span className="text-gray-400 font-normal normal-case">
                      (nenhum = todos)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterEnviados}
                        onChange={(e) => {
                          setFilterEnviados(e.target.checked);
                          setFilterPreview([]);
                        }}
                        className="w-4 h-4 accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">Enviados</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterNaoEnviados}
                        onChange={(e) => {
                          setFilterNaoEnviados(e.target.checked);
                          setFilterPreview([]);
                        }}
                        className="w-4 h-4 accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">
                        Não Enviados{" "}
                        <span className="text-xs text-gray-400">
                          (incl. falharam)
                        </span>
                      </span>
                    </label>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">
                    Filtros de Resposta{" "}
                    <span className="text-gray-400 font-normal normal-case">
                      (nenhum = todos)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterResponderam}
                        onChange={(e) => {
                          setFilterResponderam(e.target.checked);
                          setFilterPreview([]);
                        }}
                        className="w-4 h-4 accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">
                        Responderam
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterNaoResponderam}
                        onChange={(e) => {
                          setFilterNaoResponderam(e.target.checked);
                          setFilterPreview([]);
                        }}
                        className="w-4 h-4 accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">
                        Não Responderam
                      </span>
                    </label>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={fetchFilterPreview}
                  disabled={!filterOrigemIds.length || filterLoading}
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {filterLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Buscar leads com esses filtros
                    </>
                  )}
                </Button>

                {filterPreview.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Preview ({Math.min(filterPreview.length, 5)} de{" "}
                        {filterPreview.length} leads)
                      </Label>
                      {filterDestinoCampanhaId && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          Destino:{" "}
                          {
                            campanhas.find(
                              (c) => c.id === filterDestinoCampanhaId
                            )?.nome
                          }
                        </span>
                      )}
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">
                              #
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-purple-700">
                              Nome
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-blue-700">
                              Telefone
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filterPreview.slice(0, 5).map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-gray-400">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2 font-medium text-purple-800">
                                {row.nome}
                              </td>
                              <td className="px-3 py-2 font-mono text-blue-700">
                                {row.telefone}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filterPreview.length > 5 && (
                        <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
                          + {filterPreview.length - 5} leads adicionais
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {filterPreview.length === 0 &&
                  !filterLoading &&
                  filterOrigemIds.length > 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      Nenhum lead encontrado com esses filtros.
                    </p>
                  )}
              </TabsContent>
            </Tabs>

            {/* Digit 9 option — only for upload/paste tabs */}
            {csvTab !== "filter" && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide mr-2">
                  Dígito 9:
                </span>
                {(
                  [
                    {
                      value: "add",
                      label: "Adicionar 9",
                      desc: "8 dígitos → 9",
                    },
                    { value: "keep", label: "Manter", desc: "Sem alteração" },
                    {
                      value: "remove",
                      label: "Remover 9",
                      desc: "9 dígitos → 8",
                    },
                  ] as { value: NoveDigitoMode; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNoveDigito(opt.value)}
                    title={opt.desc}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border ${
                      noveDigito === opt.value
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                    <span
                      className={`block text-[10px] font-normal mt-0.5 ${
                        noveDigito === opt.value
                          ? "text-purple-200"
                          : "text-gray-400"
                      }`}
                    >
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Column config + preview table — only when leads are loaded */}
            {csvLeads.length > 0 && csvTab !== "filter" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Campanha */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Campanha *
                    </Label>
                    <select
                      value={csvCampanhaId}
                      onChange={(e) => setCsvCampanhaId(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {campanhas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Coluna nome */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Coluna Nome *
                    </Label>
                    <select
                      value={csvColNome}
                      onChange={(e) => setCsvColNome(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Coluna telefone */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Coluna Telefone *
                    </Label>
                    <select
                      value={csvColTelefone}
                      onChange={(e) => {
                        setCsvColTelefone(e.target.value);
                        setCsvFormatado(false);
                      }}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {csvColTelefone && (
                      <button
                        onClick={() => setCsvFormatado((v) => !v)}
                        className={`w-full mt-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          csvFormatado
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        {csvFormatado
                          ? "Mostrando formatado"
                          : "Ver números formatados"}
                      </button>
                    )}
                  </div>

                  {/* Coluna extras */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Extras (opcional)
                    </Label>
                    <select
                      value={csvColExtras}
                      onChange={(e) => setCsvColExtras(e.target.value)}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Selecione...</option>
                      {csvColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Preview ({Math.min(csvLeads.length, 5)} de{" "}
                      {csvLeads.length} leads)
                    </Label>
                    {csvCampanhaId && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {campanhas.find((c) => c.id === csvCampanhaId)?.nome}
                      </span>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">
                              #
                            </th>
                            {csvColumns.map((col) => (
                              <th
                                key={col}
                                className={`px-3 py-2 text-left font-semibold ${
                                  col === csvColNome
                                    ? "text-purple-700 bg-purple-50"
                                    : col === csvColTelefone
                                    ? "text-blue-700 bg-blue-50"
                                    : col === csvColExtras
                                    ? "text-green-700 bg-green-50"
                                    : "text-gray-600"
                                }`}
                              >
                                {col}
                                {col === csvColNome && (
                                  <span className="ml-1 text-[9px] bg-purple-200 text-purple-700 rounded px-1">
                                    nome
                                  </span>
                                )}
                                {col === csvColTelefone && (
                                  <span className="ml-1 text-[9px] bg-blue-200 text-blue-700 rounded px-1">
                                    tel
                                  </span>
                                )}
                                {col === csvColExtras && (
                                  <span className="ml-1 text-[9px] bg-green-200 text-green-700 rounded px-1">
                                    extras
                                  </span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvLeads.slice(0, 5).map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-gray-400">
                                {i + 1}
                              </td>
                              {csvColumns.map((col) => {
                                const isTel = col === csvColTelefone;
                                const raw = row[col] || "";
                                const formatted = isTel
                                  ? normalizeTelefone(raw, noveDigito)
                                  : raw;
                                const changed =
                                  isTel &&
                                  csvFormatado &&
                                  formatted !== raw.replace(/\D/g, "");
                                return (
                                  <td
                                    key={col}
                                    className={`px-3 py-2 ${
                                      col === csvColNome
                                        ? "font-medium text-purple-800"
                                        : isTel
                                        ? "font-mono text-blue-700"
                                        : col === csvColExtras
                                        ? "font-medium text-green-700"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {isTel && csvFormatado ? (
                                      <span className="flex flex-col gap-0.5">
                                        <span className="text-blue-700 font-semibold">
                                          {formatted}
                                        </span>
                                        {changed && (
                                          <span className="text-gray-400 line-through text-[10px]">
                                            {raw}
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      raw || (
                                        <span className="text-gray-300">
                                          —
                                        </span>
                                      )
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
                        + {csvLeads.length - 5} leads adicionais
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setImportCsvOpen(false);
                  resetImportDialog();
                }}
                disabled={csvImporting || filterImporting}
              >
                Cancelar
              </Button>

              {csvTab === "filter" ? (
                <Button
                  onClick={importFilterLeads}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={
                    filterImporting ||
                    filterPreview.length === 0 ||
                    !filterDestinoCampanhaId
                  }
                >
                  {filterImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar{" "}
                      {filterPreview.length > 0
                        ? `${filterPreview.length} leads`
                        : ""}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={importCsvLeads}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={
                    csvImporting ||
                    csvLeads.length === 0 ||
                    !csvCampanhaId ||
                    !csvColNome ||
                    !csvColTelefone
                  }
                >
                  {csvImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar{" "}
                      {csvLeads.length > 0 ? `${csvLeads.length} leads` : ""}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisparosCampanha;
