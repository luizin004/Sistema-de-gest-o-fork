import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Upload, Play, Pause, StopCircle,
  Eye, Smartphone, RefreshCw, ChevronUp, ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

import { EmuladorService, Emulador } from "@/services/EmuladorService";
import { TarefasAdminService, Lead, TarefaDetalhe } from "@/services/TarefasAdminService";

const CAMPANHAS_KEY = "disparos_emulador_campanhas";

interface CampanhaLocal {
  id: string;
  createdAt: string;
  total: number;
  enviados: number;
  erros: number;
  pausados: number;
  aguardando: number;
  status: "aguardando" | "processando" | "pausado" | "concluido";
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj;
  }).filter((row) => Object.values(row).some(Boolean));
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    aguardando: "bg-slate-100 text-slate-600",
    processando: "bg-blue-100 text-blue-700",
    enviado: "bg-green-100 text-green-700",
    erro: "bg-red-100 text-red-700",
    pausado: "bg-amber-100 text-amber-700",
    concluido: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function DisparosEmulador() {
  const navigate = useNavigate();

  const [emuladores, setEmuladores] = useState<Emulador[]>([]);
  const [loadingEmuladores, setLoadingEmuladores] = useState(true);

  const [showEmuladorDialog, setShowEmuladorDialog] = useState(false);
  const [editingEmulador, setEditingEmulador] = useState<Emulador | null>(null);
  const [emNome, setEmNome] = useState("");
  const [emPorta, setEmPorta] = useState("");
  const [emPrioridade, setEmPrioridade] = useState("1");

  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<number>(0);
  const [messageTemplate, setMessageTemplate] = useState("Olá {nome}, tudo bem?");
  const [selectedEmuladorId, setSelectedEmuladorId] = useState("");
  const [useFailover, setUseFailover] = useState(true);
  const [sendAudio, setSendAudio] = useState(true);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const [campanhas, setCampanhas] = useState<CampanhaLocal[]>(() => {
    try {
      const saved = localStorage.getItem(CAMPANHAS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [detailsCampanhaId, setDetailsCampanhaId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<TarefaDetalhe[]>([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const saveCampanhas = (updated: CampanhaLocal[]) => {
    setCampanhas(updated);
    localStorage.setItem(CAMPANHAS_KEY, JSON.stringify(updated));
  };

  const loadEmuladores = useCallback(async () => {
    setLoadingEmuladores(true);
    try {
      const data = await EmuladorService.getEmuladores();
      setEmuladores(data);
    } catch {
      toast.error("Erro ao carregar emuladores");
    } finally {
      setLoadingEmuladores(false);
    }
  }, []);

  useEffect(() => { loadEmuladores(); }, [loadEmuladores]);

  const pollCampanhas = useCallback(async () => {
    const active = campanhas.filter(
      (c) => c.status === "processando" || c.status === "aguardando"
    );
    if (active.length === 0) return;

    const updated = [...campanhas];
    for (const camp of active) {
      try {
        const status = await TarefasAdminService.getCampaignStatus(camp.id, false, 10);
        const enviados = status.resumo.find((s) => s.status === "enviado")?.total ?? 0;
        const erros = status.resumo.find((s) => s.status === "erro")?.total ?? 0;
        const pausados = status.resumo.find((s) => s.status === "pausado")?.total ?? 0;
        const aguardando = status.resumo.find((s) => s.status === "aguardando")?.total ?? 0;
        const processados = enviados + erros;

        const idx = updated.findIndex((c) => c.id === camp.id);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            enviados,
            erros,
            pausados,
            aguardando,
            total: status.total,
            status: processados >= status.total && status.total > 0
              ? "concluido"
              : updated[idx].status,
          };
        }
      } catch {
        // silently skip individual polling errors
      }
    }
    saveCampanhas(updated);
  }, [campanhas]);

  useEffect(() => {
    pollingRef.current = setInterval(pollCampanhas, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [pollCampanhas]);

  const openAddEmulador = () => {
    setEditingEmulador(null);
    setEmNome("");
    setEmPorta("");
    setEmPrioridade(String(emuladores.length + 1));
    setShowEmuladorDialog(true);
  };

  const openEditEmulador = (emu: Emulador) => {
    setEditingEmulador(emu);
    setEmNome(emu.nome);
    setEmPorta(emu.porta);
    setEmPrioridade(String(emu.prioridade));
    setShowEmuladorDialog(true);
  };

  const handleSaveEmulador = async () => {
    if (!emNome.trim() || !emPorta.trim()) {
      toast.error("Nome e porta são obrigatórios");
      return;
    }
    let ok: boolean;
    if (editingEmulador) {
      ok = await EmuladorService.updateEmulador(editingEmulador.id, {
        nome: emNome,
        porta: emPorta,
        prioridade: Number(emPrioridade),
      });
    } else {
      ok = await EmuladorService.addEmulador(emNome, emPorta, Number(emPrioridade));
    }
    if (ok) {
      toast.success(editingEmulador ? "Emulador atualizado!" : "Emulador adicionado!");
      setShowEmuladorDialog(false);
      loadEmuladores();
    } else {
      toast.error("Erro ao salvar emulador");
    }
  };

  const handleRemoveEmulador = async (id: string) => {
    const ok = await EmuladorService.removeEmulador(id);
    if (ok) {
      toast.success("Emulador removido");
      loadEmuladores();
    } else {
      toast.error("Erro ao remover emulador");
    }
  };

  const handleToggleAtivo = async (emu: Emulador) => {
    await EmuladorService.updateEmulador(emu.id, { ativo: !emu.ativo });
    loadEmuladores();
  };

  const handleMovePriority = async (emu: Emulador, direction: "up" | "down") => {
    const sorted = [...emuladores].sort((a, b) => a.prioridade - b.prioridade);
    const idx = sorted.findIndex((e) => e.id === emu.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const swap = sorted[swapIdx];
    await EmuladorService.updateEmulador(current.id, { prioridade: swap.prioridade });
    await EmuladorService.updateEmulador(swap.id, { prioridade: current.prioridade });
    loadEmuladores();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setCsvPreview(rows.length);
    };
    reader.readAsText(f);
  };

  const handleCreateCampaign = async () => {
    if (!file) { toast.error("Selecione um arquivo CSV"); return; }
    if (!messageTemplate.trim()) { toast.error("Digite um template de mensagem"); return; }
    if (!selectedEmuladorId) { toast.error("Selecione um emulador principal"); return; }

    const emuladorPrincipal = emuladores.find((e) => e.id === selectedEmuladorId);
    if (!emuladorPrincipal) { toast.error("Emulador não encontrado"); return; }

    const portasFailover = useFailover
      ? emuladores
          .filter((e) => e.ativo && e.id !== selectedEmuladorId)
          .sort((a, b) => a.prioridade - b.prioridade)
          .map((e) => e.porta)
      : [];

    setCreatingCampaign(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { toast.error("CSV vazio ou inválido"); return; }

      const campanhaId = crypto.randomUUID();
      const batchId = crypto.randomUUID();

      const leads: Lead[] = rows.map((row) => ({
        lead_id: row.lead_id ?? row.id ?? crypto.randomUUID(),
        nome: row.nome ?? row.name ?? "",
        telefone: row.telefone ?? row.phone ?? "",
        porta_adb: emuladorPrincipal.porta,
        porta_adb_override: portasFailover,
        mensagem_template: messageTemplate.replace("{nome}", row.nome ?? row.name ?? ""),
        batch_id: batchId,
        enviar_audio: sendAudio,
      }));

      const result = await TarefasAdminService.createCampaign(campanhaId, leads);

      const nova: CampanhaLocal = {
        id: campanhaId,
        createdAt: new Date().toISOString(),
        total: result.inserted,
        enviados: 0,
        erros: 0,
        pausados: 0,
        aguardando: result.inserted,
        status: "aguardando",
      };

      saveCampanhas([nova, ...campanhas]);
      toast.success(`Campanha criada! ${result.inserted} leads importados.`);
      setFile(null);
      setCsvPreview(0);
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handlePausar = async (id: string) => {
    try {
      const result = await TarefasAdminService.updateStatus(id, "pausado");
      const updated = campanhas.map((c) =>
        c.id === id ? { ...c, status: "pausado" as const } : c
      );
      saveCampanhas(updated);
      toast.success(`${result.updated} tarefas pausadas`);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleRetomar = async (id: string) => {
    try {
      const result = await TarefasAdminService.updateStatus(id, "aguardando");
      const updated = campanhas.map((c) =>
        c.id === id ? { ...c, status: "processando" as const } : c
      );
      saveCampanhas(updated);
      toast.success(`${result.updated} tarefas retomadas`);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleDeletar = async (id: string) => {
    try {
      const result = await TarefasAdminService.deleteCampaign(id, false);
      saveCampanhas(campanhas.filter((c) => c.id !== id));
      toast.success(`${result.deleted} tarefas removidas`);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleVerDetalhes = async (id: string) => {
    setDetailsCampanhaId(id);
    setLoadingDetalhes(true);
    try {
      const status = await TarefasAdminService.getCampaignStatus(id, true, 200);
      setDetalhes(status.detalhes ?? []);
    } catch (e: any) {
      toast.error(`Erro ao buscar detalhes: ${e.message}`);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const emAtivos = emuladores.filter((e) => e.ativo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline" size="icon"
            onClick={() => navigate("/disparos")}
            className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Disparos por Emulador
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie emuladores ADB e envie campanhas de mensagens
            </p>
          </div>
        </div>

        {/* ─────────────────────────── SEÇÃO A: EMULADORES ─────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                Meus Emuladores ADB
              </CardTitle>
              <CardDescription>
                Configure os emuladores deste tenant. Cada um tem sua própria porta ADB.
              </CardDescription>
            </div>
            <Button onClick={openAddEmulador} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent>
            {loadingEmuladores ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : emuladores.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum emulador configurado. Adicione um para começar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Pri.</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Porta ADB</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emuladores.map((emu, idx) => (
                    <TableRow key={emu.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            onClick={() => handleMovePriority(emu, "up")}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-center text-slate-500">{emu.prioridade}</span>
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            onClick={() => handleMovePriority(emu, "down")}
                            disabled={idx === emuladores.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{emu.nome}</TableCell>
                      <TableCell className="font-mono text-sm">{emu.porta}</TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleAtivo(emu)}>
                          <Badge
                            variant={emu.ativo ? "default" : "secondary"}
                            className="cursor-pointer"
                          >
                            {emu.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => openEditEmulador(emu)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleRemoveEmulador(emu.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ─────────────────────────── SEÇÃO B: NOVA CAMPANHA ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-indigo-600" />
              Nova Campanha
            </CardTitle>
            <CardDescription>
              Faça upload de um CSV com leads e configure o disparo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Arquivo CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                {csvPreview > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    ✓ {csvPreview} leads detectados
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  Formato: <code>lead_id, nome, telefone</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Emulador Principal</Label>
                {emAtivos.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    Adicione pelo menos um emulador ativo acima.
                  </p>
                ) : (
                  <Select value={selectedEmuladorId} onValueChange={setSelectedEmuladorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar emulador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emAtivos.map((emu) => (
                        <SelectItem key={emu.id} value={emu.id}>
                          {emu.nome} — <span className="font-mono">{emu.porta}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de Mensagem</Label>
              <Textarea
                placeholder="Olá {nome}, tudo bem?"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-slate-400">
                Use <code>{"{nome}"}</code> para personalizar com o nome do lead
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="failover"
                  checked={useFailover}
                  onCheckedChange={(v) => setUseFailover(!!v)}
                />
                <Label htmlFor="failover" className="cursor-pointer">
                  Usar outros emuladores como backup (failover automático)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="audio"
                  checked={sendAudio}
                  onCheckedChange={(v) => setSendAudio(!!v)}
                />
                <Label htmlFor="audio" className="cursor-pointer">
                  Enviar áudio após mensagem
                </Label>
              </div>
            </div>

            <Button
              onClick={handleCreateCampaign}
              disabled={creatingCampaign || !file || !selectedEmuladorId}
              className="w-full md:w-auto"
            >
              {creatingCampaign ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Criar Campanha</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ─────────────────────────── SEÇÃO C: CAMPANHAS ATIVAS ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Campanhas</CardTitle>
            <CardDescription>
              Acompanhe e controle suas campanhas em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campanhas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma campanha criada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhas.map((camp) => {
                    const processed = camp.enviados + camp.erros;
                    const pct = camp.total > 0 ? Math.round((processed / camp.total) * 100) : 0;
                    return (
                      <TableRow key={camp.id}>
                        <TableCell className="font-mono text-xs text-slate-500">
                          {camp.id.substring(0, 8)}…
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(camp.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>{camp.total}</TableCell>
                        <TableCell className="text-green-700 font-medium">{camp.enviados}</TableCell>
                        <TableCell className="text-red-600">{camp.erros}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="space-y-1">
                            <Progress value={pct} className="h-2" />
                            <span className="text-xs text-slate-500">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(camp.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button
                              variant="ghost" size="icon"
                              title="Ver detalhes"
                              onClick={() => handleVerDetalhes(camp.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(camp.status === "processando" || camp.status === "aguardando") && (
                              <Button
                                variant="ghost" size="icon"
                                title="Pausar"
                                onClick={() => handlePausar(camp.id)}
                              >
                                <Pause className="h-4 w-4 text-amber-600" />
                              </Button>
                            )}
                            {camp.status === "pausado" && (
                              <Button
                                variant="ghost" size="icon"
                                title="Retomar"
                                onClick={() => handleRetomar(camp.id)}
                              >
                                <Play className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="icon"
                              title="Deletar pendentes"
                              onClick={() => handleDeletar(camp.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <StopCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────── DIALOG: ADICIONAR/EDITAR EMULADOR ─────────────────────────── */}
      <Dialog open={showEmuladorDialog} onOpenChange={setShowEmuladorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmulador ? "Editar Emulador" : "Novo Emulador"}</DialogTitle>
            <DialogDescription>
              Configure a porta ADB deste emulador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Emulador Principal"
                value={emNome}
                onChange={(e) => setEmNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Porta ADB</Label>
              <Input
                placeholder="Ex: 127.0.0.1:5825"
                value={emPorta}
                onChange={(e) => setEmPorta(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                type="number"
                min={1}
                value={emPrioridade}
                onChange={(e) => setEmPrioridade(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Menor número = maior prioridade no failover
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmuladorDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEmulador}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────── DIALOG: DETALHES DA CAMPANHA ─────────────────────────── */}
      <Dialog
        open={!!detailsCampanhaId}
        onOpenChange={(open) => { if (!open) { setDetailsCampanhaId(null); setDetalhes([]); } }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {detailsCampanhaId}
            </DialogDescription>
          </DialogHeader>
          {loadingDetalhes ? (
            <p className="text-sm text-slate-400 py-4 text-center">Carregando detalhes...</p>
          ) : detalhes.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Nenhum detalhe disponível.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Porta ADB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.lead_id}</TableCell>
                    <TableCell>{d.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{d.telefone}</TableCell>
                    <TableCell className="font-mono text-xs">{d.porta_adb}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {new Date(d.updated_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
