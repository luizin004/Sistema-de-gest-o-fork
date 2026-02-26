import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Send, Square, RefreshCw, Download, FileText, Home, Users } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

interface JobStatus {
  status: string;
  total: number;
  processed: number;
  success: number;
  error: number;
  message?: string;
}

const DisparosManual = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [messageTemplate, setMessageTemplate] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [batchSize, setBatchSize] = useState(0);
  const [batchPauseHours, setBatchPauseHours] = useState(0);
  const [onlyBusinessHours, setOnlyBusinessHours] = useState(false);

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && jobId) {
      interval = setInterval(() => {
        fetchStatus();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, jobId]);

  const fetchStatus = async (id?: string) => {
    const targetId = id || jobId;
    if (!targetId) return;

    try {
      const response = await fetchApi(`/api/status/${targetId}`);
      if (!response.ok) throw new Error("Erro ao buscar status");

      const data = await response.json();
      setJobStatus(data);

      if (data.status === "completed" || data.status === "stopped") {
        setIsRunning(false);
      }
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview("");
      setJobId("");
      setJobStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV primeiro");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log("[DisparosWhatsapp] Enviando arquivo...");
      const response = await fetchApi("/api/upload", {
        method: "POST",
        body: formData,
      });

      console.log("[DisparosWhatsapp] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DisparosWhatsapp] Erro do servidor:", errorText);
        throw new Error(`Erro no upload: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DisparosWhatsapp] Upload bem-sucedido:", data);
      setJobId(data.job_id);
      
      const previewText = data.preview
        ? Array.isArray(data.preview)
          ? JSON.stringify(data.preview.slice(0, 3), null, 2)
          : JSON.stringify(data.preview, null, 2)
        : "";
      setPreview(previewText);

      // Busca o status imediatamente para pegar a contagem total
      const statusData = await fetchStatus(data.job_id);
      
      if (statusData && statusData.total) {
        toast.success(`Arquivo enviado! ${statusData.total} leads identificados.`);
      } else {
        toast.success("Arquivo enviado com sucesso!");
      }
    } catch (error) {
      console.error("[DisparosWhatsapp] Erro completo:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao enviar arquivo: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!jobId) {
      toast.error("Faça upload de um arquivo primeiro");
      return;
    }

    if (!messageTemplate.trim()) {
      toast.error("Digite uma mensagem template");
      return;
    }

    setLoading(true);

    try {
      const response = await fetchApi("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          message_template: messageTemplate,
          delay_seconds: delaySeconds,
          request_timeout_seconds: timeoutSeconds,
          batch_size: batchSize,
          batch_pause_hours: batchPauseHours,
          only_business_hours: onlyBusinessHours,
        }),
      });

      if (!response.ok) throw new Error("Erro ao iniciar");

      const data = await response.json();
      toast.success(data.message || "Transmissão iniciada!");
      setIsRunning(true);
      fetchStatus();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar transmissão");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!jobId) return;

    try {
      const response = await fetchApi(`/api/stop/${jobId}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Erro ao parar");

      const data = await response.json();
      toast.success(data.message || "Transmissão parada!");
      setIsRunning(false);
      fetchStatus();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao parar transmissão");
    }
  };


  const handleDownloadReport = () => {
    if (!jobId) return;
    const url = `/api/report/${jobId}`;
    const apiUrl = import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}${url}` : url;
    window.open(apiUrl, "_blank");
  };

  const handleDownloadLog = () => {
    if (!jobId) return;
    const url = `/api/log/${jobId}`;
    const apiUrl = import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}${url}` : url;
    window.open(apiUrl, "_blank");
  };

  const progressPercentage = jobStatus
    ? jobStatus.total > 0
      ? (jobStatus.processed / jobStatus.total) * 100
      : 0
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
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
              Sistema de Disparos WhatsApp
            </h1>
            <p className="text-sm text-indigo-600 mt-1">
              Formate listas e envie mensagens personalizadas em massa
            </p>
          </div>
        </div>

        <Tabs defaultValue="formatar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="formatar">📋 Formatar Listas</TabsTrigger>
            <TabsTrigger value="disparos">📤 Disparos WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="formatar" className="space-y-6 mt-6">
            <Button onClick={() => navigate("/formata-listas")} className="w-full h-24 text-lg" variant="outline">
              <Upload className="h-6 w-6 mr-3" />
              Acessar Formatação de Listas
              <ArrowLeft className="h-5 w-5 ml-3 rotate-180" />
            </Button>
          </TabsContent>

          <TabsContent value="disparos" className="space-y-6 mt-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm order-2 xl:order-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    2. Configurar Disparos
                  </CardTitle>
                  <CardDescription>Configure a mensagem e parâmetros de envio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem (template)</Label>
                      <Textarea
                        id="message"
                        placeholder="Olá {nome}, tudo bem em {cidade}?"
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        rows={5}
                        className="resize-none"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use campos do CSV: <code className="bg-muted px-1 rounded">{"{nome}"}</code>,{" "}
                      <code className="bg-muted px-1 rounded">{"{cidade}"}</code>, etc.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="delay">Delay (segundos)</Label>
                        <Input
                          id="delay"
                          type="number"
                          min="0"
                          value={delaySeconds}
                          onChange={(e) => setDelaySeconds(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (segundos)</Label>
                        <Input
                          id="timeout"
                          type="number"
                          min="5"
                          value={timeoutSeconds}
                          onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pause">Pausa entre lotes (h)</Label>
                        <Input
                          id="pause"
                          type="number"
                          min="0"
                          step="0.5"
                          value={batchPauseHours}
                          onChange={(e) => setBatchPauseHours(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="flex items-start space-x-2 rounded-lg border border-dashed border-border/60 p-3">
                      <Checkbox
                        id="business"
                        checked={onlyBusinessHours}
                        onCheckedChange={(checked) => setOnlyBusinessHours(checked as boolean)}
                        className="mt-1"
                      />
                      <Label htmlFor="business" className="cursor-pointer text-sm leading-relaxed">
                        Somente horário comercial (Brasil): Seg–Sex 08:00–18:00, Sáb 09:00–12:00
                      </Label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleStart} disabled={!jobId || loading || isRunning} className="flex-1 min-w-[160px]">
                        <Send className="h-4 w-4 mr-2" />
                        Iniciar
                      </Button>
                      <Button onClick={handleStop} disabled={!isRunning} variant="destructive" className="flex-1 min-w-[120px]">
                        <Square className="h-4 w-4 mr-2" />
                        Parar
                      </Button>
                      <Button onClick={() => fetchStatus()} disabled={!jobId} variant="outline" size="icon">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6 order-1 xl:order-2">
                <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-indigo-600" />
                      1. Importar CSV
                    </CardTitle>
                    <CardDescription>Selecione um arquivo CSV formatado com os contatos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input type="file" accept=".csv" onChange={handleFileChange} className="flex-1" />
                      <Button onClick={handleUpload} disabled={!file || loading}>
                        {loading ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                    
                    {jobStatus && jobStatus.total > 0 && !isRunning && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">{jobStatus.total} contatos identificados</span>
                        <span className="text-emerald-600 font-normal ml-auto text-xs">Pronto para iniciar</span>
                      </div>
                    )}

                    {preview && (
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">Preview:</p>
                        <pre className="text-xs overflow-x-auto">{preview}</pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-indigo-900">3. Progresso</CardTitle>
                    <CardDescription>Acompanhe o andamento dos disparos em tempo real</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-indigo-600">Progresso</span>
                        <span className="font-medium text-indigo-900">{progressPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                    </div>

                    {jobStatus && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-indigo-100/50 p-4 rounded-lg">
                          <p className="text-xs text-indigo-600 mb-1">Total</p>
                          <p className="text-2xl font-bold text-indigo-900">{jobStatus.total}</p>
                        </div>
                        <div className="bg-blue-100/50 p-4 rounded-lg">
                          <p className="text-xs text-blue-600 mb-1">Processados</p>
                          <p className="text-2xl font-bold text-blue-900">{jobStatus.processed}</p>
                        </div>
                        <div className="bg-green-500/10 p-4 rounded-lg">
                          <p className="text-xs text-green-600 mb-1">Sucesso</p>
                          <p className="text-2xl font-bold text-green-600">{jobStatus.success}</p>
                        </div>
                        <div className="bg-red-500/10 p-4 rounded-lg">
                          <p className="text-xs text-red-600 mb-1">Erros</p>
                          <p className="text-2xl font-bold text-red-600">{jobStatus.error}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-indigo-900">Status:</p>
                      <p className="text-sm text-indigo-600">{jobStatus?.message || "Aguardando upload..."}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleDownloadReport} disabled={!jobId} variant="outline" className="flex-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Relatório
                      </Button>
                      <Button onClick={handleDownloadLog} disabled={!jobId} variant="outline" className="flex-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                        <FileText className="h-4 w-4 mr-2" />
                        Baixar Log
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DisparosManual;
