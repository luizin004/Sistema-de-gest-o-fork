import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Upload,
  Send,
  Square,
  RefreshCw,
  Download,
  Play,
  Pause,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  DisparosManualService,
  type Campaign,
  type CampaignLead,
  type UazapiInstanceInfo,
} from "@/services/DisparosManualService";
import {
  parseCSV,
  findPhoneColumn,
  findNameColumn,
  maskPhone,
} from "@/utils/csvParser";

const DisparosManual = () => {
  const navigate = useNavigate();

  // CSV State
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>("");
  const [nameColumn, setNameColumn] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Campaign config
  const [messageTemplate, setMessageTemplate] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [batchSize, setBatchSize] = useState(0);
  const [batchPauseHours, setBatchPauseHours] = useState(0);
  const [onlyBusinessHours, setOnlyBusinessHours] = useState(false);

  // UAZAPI Instance
  const [instances, setInstances] = useState<UazapiInstanceInfo[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [loadingInstances, setLoadingInstances] = useState(true);

  // Campaign state
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Logs
  const [logs, setLogs] = useState<CampaignLead[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "erro">("all");

  // History
  const [campaignHistory, setCampaignHistory] = useState<Campaign[]>([]);

  // Polling refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load UAZAPI instances on mount
  useEffect(() => {
    loadInstances();
    loadCampaignHistory();
  }, []);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await DisparosManualService.getUazapiInstances();
      setInstances(data);
      // Auto-select first connected instance
      const connected = data.find((i) => i.connected);
      if (connected) {
        setSelectedInstanceId(connected.id);
      }
    } catch (err) {
      console.error("Erro ao carregar instancias:", err);
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadCampaignHistory = async () => {
    const campaigns = await DisparosManualService.getCampaigns(10);
    setCampaignHistory(campaigns);
  };

  // Polling for campaign status and logs
  useEffect(() => {
    if (campaignId && (isRunning || isPaused)) {
      pollingRef.current = setInterval(async () => {
        const data = await DisparosManualService.getCampaign(campaignId);
        if (data) {
          setCampaign(data);
          if (data.status === "concluido" || data.status === "cancelado" || data.status === "erro") {
            setIsRunning(false);
            setIsPaused(false);
          } else if (data.status === "pausado") {
            setIsRunning(false);
            setIsPaused(true);
          } else if (data.status === "processando") {
            setIsRunning(true);
            setIsPaused(false);
          }
        }

        // Fetch logs
        const logsData = await DisparosManualService.getProcessedLeads(campaignId, 30);
        setLogs(logsData);
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [campaignId, isRunning, isPaused]);

  // === Handlers ===

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview("");
      setParsedRows([]);
      setCsvHeaders([]);
      setCampaignId("");
      setCampaign(null);
      setLogs([]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV primeiro");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error("CSV vazio ou formato inválido");
        return;
      }

      const headers = Object.keys(rows[0]);
      setCsvHeaders(headers);
      setParsedRows(rows);

      // Auto-detect columns
      const detectedPhone = findPhoneColumn(headers);
      const detectedName = findNameColumn(headers);
      if (detectedPhone) setPhoneColumn(detectedPhone);
      if (detectedName) setNameColumn(detectedName);

      // Preview
      const previewData = rows.slice(0, 3);
      setPreview(JSON.stringify(previewData, null, 2));

      toast.success(`${rows.length} contatos identificados!`);
    } catch (error) {
      console.error("Erro ao processar CSV:", error);
      toast.error("Erro ao processar o arquivo CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndStart = async () => {
    if (parsedRows.length === 0) {
      toast.error("Carregue um CSV primeiro");
      return;
    }
    if (!messageTemplate.trim()) {
      toast.error("Digite uma mensagem template");
      return;
    }
    if (!selectedInstanceId) {
      toast.error("Selecione uma instância UAZAPI");
      return;
    }
    if (!phoneColumn) {
      toast.error("Selecione a coluna de telefone");
      return;
    }

    setLoading(true);
    try {
      // Create campaign
      const id = await DisparosManualService.createCampaign(
        {
          uazapi_instance_id: selectedInstanceId,
          message_template: messageTemplate,
          delay_seconds: delaySeconds,
          batch_size: batchSize,
          batch_pause_hours: batchPauseHours,
          only_business_hours: onlyBusinessHours,
        },
        parsedRows,
        phoneColumn,
        nameColumn || null
      );

      if (!id) {
        toast.error("Erro ao criar campanha");
        return;
      }

      setCampaignId(id);

      // Start campaign (calls Edge Function)
      const started = await DisparosManualService.startCampaign(id);
      if (started) {
        setIsRunning(true);
        setCampaign(await DisparosManualService.getCampaign(id));
        toast.success("Campanha iniciada! Os disparos continuam em background.");
        loadCampaignHistory();
      } else {
        toast.error("Erro ao iniciar campanha");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao iniciar campanha");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!campaignId) return;
    const ok = await DisparosManualService.pauseCampaign(campaignId);
    if (ok) {
      setIsRunning(false);
      setIsPaused(true);
      toast.success("Campanha pausada. O worker irá parar na próxima iteração.");
    }
  };

  const handleResume = async () => {
    if (!campaignId) return;
    setLoading(true);
    const ok = await DisparosManualService.resumeCampaign(campaignId);
    if (ok) {
      setIsRunning(true);
      setIsPaused(false);
      toast.success("Campanha retomada!");
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!campaignId) return;
    const ok = await DisparosManualService.cancelCampaign(campaignId);
    if (ok) {
      setIsRunning(false);
      setIsPaused(false);
      toast.success("Campanha cancelada.");
      loadCampaignHistory();
    }
  };

  const handleDownloadReport = async () => {
    if (!campaignId) return;
    const blob = await DisparosManualService.exportReport(campaignId);
    if (!blob) {
      toast.error("Erro ao gerar relatório");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_campanha_${campaignId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadCampaign = async (id: string) => {
    setCampaignId(id);
    const data = await DisparosManualService.getCampaign(id);
    if (data) {
      setCampaign(data);
      setMessageTemplate(data.message_template);
      setDelaySeconds(data.delay_seconds);
      setBatchSize(data.batch_size);
      setBatchPauseHours(Number(data.batch_pause_hours));
      setOnlyBusinessHours(data.only_business_hours);
      setSelectedInstanceId(data.uazapi_instance_id);

      if (data.status === "processando") {
        setIsRunning(true);
        setIsPaused(false);
      } else if (data.status === "pausado") {
        setIsRunning(false);
        setIsPaused(true);
      } else {
        setIsRunning(false);
        setIsPaused(false);
      }

      const logsData = await DisparosManualService.getProcessedLeads(id, 30);
      setLogs(logsData);
    }
  };

  // === Computed ===

  const progressPercentage = campaign
    ? campaign.total > 0
      ? (campaign.processed / campaign.total) * 100
      : 0
    : 0;

  const filteredLogs =
    logFilter === "erro" ? logs.filter((l) => l.status === "erro") : logs;

  const connectedInstances = instances.filter((i) => i.connected);

  const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    aguardando: { label: "Aguardando", variant: "secondary" },
    processando: { label: "Processando", variant: "default" },
    pausado: { label: "Pausado", variant: "outline" },
    concluido: { label: "Concluído", variant: "secondary" },
    cancelado: { label: "Cancelado", variant: "destructive" },
    erro: { label: "Erro", variant: "destructive" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/disparos")}
            className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text">
              Disparos Manual WhatsApp
            </h1>
            <p className="text-sm text-indigo-600 mt-1">
              Envie mensagens personalizadas em massa via UAZAPI
            </p>
          </div>
        </div>

        <Tabs defaultValue="disparos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="formatar">Formatar Listas</TabsTrigger>
            <TabsTrigger value="disparos">Disparos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Tab: Formatar Listas */}
          <TabsContent value="formatar" className="space-y-6 mt-6">
            <Button
              onClick={() => navigate("/formata-listas")}
              className="w-full h-24 text-lg"
              variant="outline"
            >
              <Upload className="h-6 w-6 mr-3" />
              Acessar Formatação de Listas
              <ArrowLeft className="h-5 w-5 ml-3 rotate-180" />
            </Button>
          </TabsContent>

          {/* Tab: Disparos */}
          <TabsContent value="disparos" className="space-y-6 mt-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              {/* Left: Config */}
              <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm order-2 xl:order-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    2. Configurar Disparos
                  </CardTitle>
                  <CardDescription>
                    Configure a mensagem e parâmetros de envio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Message template */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem (template)</Label>
                    <Textarea
                      id="message"
                      placeholder="Olá {nome}, tudo bem em {cidade}?"
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      rows={5}
                      className="resize-none"
                      disabled={isRunning}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use campos do CSV:{" "}
                      {csvHeaders.length > 0
                        ? csvHeaders
                            .map((h) => (
                              <code
                                key={h}
                                className="bg-muted px-1 rounded mx-0.5"
                              >{`{${h}}`}</code>
                            ))
                        : (
                            <>
                              <code className="bg-muted px-1 rounded">{"{nome}"}</code>,{" "}
                              <code className="bg-muted px-1 rounded">{"{cidade}"}</code>, etc.
                            </>
                          )}
                    </p>
                  </div>

                  {/* Config grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay">Delay (segundos)</Label>
                      <Input
                        id="delay"
                        type="number"
                        min="0"
                        value={delaySeconds}
                        onChange={(e) => setDelaySeconds(Number(e.target.value))}
                        disabled={isRunning}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch">Lote (qtd por lote)</Label>
                      <Input
                        id="batch"
                        type="number"
                        min="0"
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        disabled={isRunning}
                      />
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label htmlFor="pause">Pausa entre lotes (h)</Label>
                      <Input
                        id="pause"
                        type="number"
                        min="0"
                        step="0.5"
                        value={batchPauseHours}
                        onChange={(e) =>
                          setBatchPauseHours(Number(e.target.value))
                        }
                        disabled={isRunning}
                      />
                    </div>
                  </div>

                  {/* Business hours */}
                  <div className="flex items-start space-x-2 rounded-lg border border-dashed border-border/60 p-3">
                    <Checkbox
                      id="business"
                      checked={onlyBusinessHours}
                      onCheckedChange={(checked) =>
                        setOnlyBusinessHours(checked as boolean)
                      }
                      className="mt-1"
                      disabled={isRunning}
                    />
                    <Label
                      htmlFor="business"
                      className="cursor-pointer text-sm leading-relaxed"
                    >
                      Somente horário comercial (Brasil): Seg-Sex 08:00-18:00,
                      Sáb 09:00-12:00
                    </Label>
                  </div>

                  {/* UAZAPI Instance Selector */}
                  <div className="space-y-2">
                    <Label>Instância UAZAPI</Label>
                    {loadingInstances ? (
                      <div className="text-sm text-muted-foreground">
                        Carregando instâncias...
                      </div>
                    ) : instances.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                        <AlertCircle className="h-4 w-4" />
                        Nenhuma instância UAZAPI configurada. Configure em
                        Configurações.
                      </div>
                    ) : (
                      <Select
                        value={selectedInstanceId}
                        onValueChange={setSelectedInstanceId}
                        disabled={isRunning}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma instância" />
                        </SelectTrigger>
                        <SelectContent>
                          {instances.map((inst) => (
                            <SelectItem
                              key={inst.id}
                              value={inst.id}
                              disabled={!inst.connected}
                            >
                              <div className="flex items-center gap-2">
                                {inst.connected ? (
                                  <Wifi className="h-3 w-3 text-green-500" />
                                ) : (
                                  <WifiOff className="h-3 w-3 text-red-500" />
                                )}
                                <span>
                                  {inst.name || inst.profile_name || inst.instance_id}
                                </span>
                                {inst.owner_phone && (
                                  <span className="text-xs text-muted-foreground">
                                    ({inst.owner_phone})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!isRunning && !isPaused && (
                      <Button
                        onClick={handleCreateAndStart}
                        disabled={
                          parsedRows.length === 0 ||
                          loading ||
                          !selectedInstanceId ||
                          !messageTemplate.trim()
                        }
                        className="flex-1 min-w-[160px]"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {loading ? "Iniciando..." : "Iniciar Disparos"}
                      </Button>
                    )}
                    {isRunning && (
                      <Button
                        onClick={handlePause}
                        variant="outline"
                        className="flex-1 min-w-[120px] border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
                      </Button>
                    )}
                    {isPaused && (
                      <>
                        <Button
                          onClick={handleResume}
                          disabled={loading}
                          className="flex-1 min-w-[120px]"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Retomar
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="destructive"
                          className="flex-1 min-w-[120px]"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Upload + Progress + Logs */}
              <div className="space-y-6 order-1 xl:order-2">
                {/* Upload CSV */}
                <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-indigo-600" />
                      1. Importar CSV
                    </CardTitle>
                    <CardDescription>
                      Selecione um arquivo CSV com os contatos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="flex-1"
                        disabled={isRunning}
                      />
                      <Button
                        onClick={handleUpload}
                        disabled={!file || loading || isRunning}
                      >
                        {loading ? "Lendo..." : "Carregar"}
                      </Button>
                    </div>

                    {parsedRows.length > 0 && !isRunning && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-semibold">
                            {parsedRows.length} contatos identificados
                          </span>
                        </div>

                        {/* Column selectors */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Coluna telefone</Label>
                            <Select
                              value={phoneColumn}
                              onValueChange={setPhoneColumn}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Telefone" />
                              </SelectTrigger>
                              <SelectContent>
                                {csvHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Coluna nome</Label>
                            <Select
                              value={nameColumn}
                              onValueChange={setNameColumn}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Nome (opcional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {csvHeaders.map((h) => (
                                  <SelectItem key={h} value={h}>
                                    {h}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {preview && (
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">Preview:</p>
                        <pre className="text-xs overflow-x-auto max-h-32">
                          {preview}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Progress */}
                <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-indigo-900">3. Progresso</span>
                      {campaign && (
                        <Badge
                          variant={
                            statusLabel[campaign.status]?.variant || "secondary"
                          }
                        >
                          {statusLabel[campaign.status]?.label || campaign.status}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Acompanhe o andamento dos disparos em tempo real
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-indigo-600">Progresso</span>
                        <span className="font-medium text-indigo-900">
                          {progressPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                    </div>

                    {/* Stats */}
                    {campaign && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-indigo-100/50 p-3 rounded-lg text-center">
                          <p className="text-xs text-indigo-600">Total</p>
                          <p className="text-xl font-bold text-indigo-900">
                            {campaign.total}
                          </p>
                        </div>
                        <div className="bg-blue-100/50 p-3 rounded-lg text-center">
                          <p className="text-xs text-blue-600">Processados</p>
                          <p className="text-xl font-bold text-blue-900">
                            {campaign.processed}
                          </p>
                        </div>
                        <div className="bg-green-500/10 p-3 rounded-lg text-center">
                          <p className="text-xs text-green-600">Sucesso</p>
                          <p className="text-xl font-bold text-green-600">
                            {campaign.success}
                          </p>
                        </div>
                        <div className="bg-red-500/10 p-3 rounded-lg text-center">
                          <p className="text-xs text-red-600">Erros</p>
                          <p className="text-xl font-bold text-red-600">
                            {campaign.error}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Download buttons */}
                    {campaign &&
                      (campaign.status === "concluido" ||
                        campaign.status === "cancelado" ||
                        campaign.processed > 0) && (
                        <Button
                          onClick={handleDownloadReport}
                          variant="outline"
                          className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar Relatório CSV
                        </Button>
                      )}
                  </CardContent>
                </Card>

                {/* Logs */}
                {campaign && campaign.processed > 0 && (
                  <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-indigo-900">
                          Log de Envios
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {filteredLogs.length} eventos
                          </span>
                          <Select
                            value={logFilter}
                            onValueChange={(v) =>
                              setLogFilter(v as "all" | "erro")
                            }
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="erro">Só erros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="h-[280px]">
                        <div className="space-y-1">
                          {filteredLogs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50"
                            >
                              <span className="text-muted-foreground w-16 shrink-0">
                                {log.sent_at
                                  ? new Date(log.sent_at).toLocaleTimeString(
                                      "pt-BR",
                                      { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                                    )
                                  : "--:--:--"}
                              </span>
                              <span className="truncate w-28">
                                {log.nome || "---"}
                              </span>
                              <span className="text-muted-foreground font-mono w-24 shrink-0">
                                {maskPhone(log.telefone)}
                              </span>
                              {log.status === "enviado" ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-green-100 text-green-700 text-[10px] px-1.5"
                                >
                                  Enviado
                                </Badge>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge
                                        variant="destructive"
                                        className="text-[10px] px-1.5"
                                      >
                                        Erro
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs text-xs">
                                        {log.error_message || "Erro desconhecido"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          ))}
                          {filteredLogs.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-8">
                              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              Aguardando envios...
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="space-y-4 mt-6">
            <Card className="border-indigo-200/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-indigo-900">
                    Campanhas Anteriores
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadCampaignHistory}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {campaignHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma campanha encontrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {campaignHistory.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => {
                          handleLoadCampaign(c.id);
                          // Switch to disparos tab
                          const trigger = document.querySelector(
                            '[value="disparos"]'
                          ) as HTMLElement;
                          trigger?.click();
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              statusLabel[c.status]?.variant || "secondary"
                            }
                            className="text-xs"
                          >
                            {statusLabel[c.status]?.label || c.status}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {c.total} contatos
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-green-600">
                            {c.success} ok
                          </span>
                          <span className="text-red-600">{c.error} erros</span>
                          <Progress
                            value={
                              c.total > 0
                                ? (c.processed / c.total) * 100
                                : 0
                            }
                            className="w-20 h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DisparosManual;
