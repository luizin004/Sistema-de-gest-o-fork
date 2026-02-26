import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, Download, Trash2, Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

interface Filter {
  campo: string;
  operador: string;
  valor: string;
}

const FormataListas = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const [incluirDDI, setIncluirDDI] = useState(false);
  const [incluirDDD, setIncluirDDD] = useState(true);
  const [nonoDigito, setNonoDigito] = useState("auto");
  const [apenasNome, setApenasNome] = useState(false);
  
  const [filtros, setFiltros] = useState<Filter[]>([]);
  const [filtroCampo, setFiltroCampo] = useState("indicante");
  const [filtroOperador, setFiltroOperador] = useState("igual");
  const [filtroValor, setFiltroValor] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview("");
      setJobId("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log('[FormataListas] Enviando arquivo...');
      const response = await fetchApi("/api/formata-lista/upload", {
        method: "POST",
        body: formData,
      });

      console.log('[FormataListas] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FormataListas] Erro do servidor:', errorText);
        throw new Error(`Erro no upload: ${response.status}`);
      }

      const data = await response.json();
      console.log('[FormataListas] Upload bem-sucedido:', data);
      setJobId(data.session_id);
      const previewText = data.preview ? JSON.stringify(data.preview.slice(0, 3), null, 2) : "";
      setPreview(previewText);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error('[FormataListas] Erro completo:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao enviar arquivo: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFiltro = () => {
    if (!filtroValor.trim()) {
      toast.error("Digite um valor para o filtro");
      return;
    }

    setFiltros([...filtros, { campo: filtroCampo, operador: filtroOperador, valor: filtroValor }]);
    setFiltroValor("");
    toast.success("Filtro adicionado");
  };

  const handleRemoveFiltro = (index: number) => {
    setFiltros(filtros.filter((_, i) => i !== index));
    toast.success("Filtro removido");
  };

  const handleProcessar = async () => {
    if (!jobId) {
      toast.error("Faça upload de um arquivo primeiro");
      return;
    }

    setLoading(true);

    try {
      const incluirNonoDigito = nonoDigito === "incluir" ? true : nonoDigito === "remover" ? false : null;
      
      const response = await fetchApi(`/api/formata-lista/processar/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone_config: {
            incluir_ddi: incluirDDI,
            incluir_ddd: incluirDDD,
            incluir_nono_digito: incluirNonoDigito,
          },
          apenas_primeiro_nome: apenasNome,
          filtros: filtros,
        }),
      });

      if (!response.ok) throw new Error("Erro ao processar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `formatado_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("CSV formatado baixado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setJobId("");
    setPreview("");
    setFiltros([]);
    setIncluirDDI(false);
    setIncluirDDD(true);
    setNonoDigito("auto");
    setApenasNome(false);
    toast.success("Formulário resetado");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/disparos')}
            className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Formatação de Listas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Importe e formate seus arquivos CSV/Excel
            </p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              1. Importar Arquivo
            </CardTitle>
            <CardDescription>
              Selecione um arquivo CSV, XLSX ou XLS para processar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
            {preview && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <pre className="text-xs overflow-x-auto">{preview}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>2. Configurar Formatação</CardTitle>
            <CardDescription>
              Defina como os dados devem ser formatados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Formato do Telefone</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ddi"
                    checked={incluirDDI}
                    onCheckedChange={(checked) => setIncluirDDI(checked as boolean)}
                  />
                  <Label htmlFor="ddi" className="cursor-pointer">
                    Incluir 55 (DDI)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ddd"
                    checked={incluirDDD}
                    onCheckedChange={(checked) => setIncluirDDD(checked as boolean)}
                  />
                  <Label htmlFor="ddd" className="cursor-pointer">
                    Incluir DDD
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Label>Nono dígito (9):</Label>
                  <Select value={nonoDigito} onValueChange={setNonoDigito}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="incluir">Incluir</SelectItem>
                      <SelectItem value="remover">Remover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Formato do Nome</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nome"
                  checked={apenasNome}
                  onCheckedChange={(checked) => setApenasNome(checked as boolean)}
                />
                <Label htmlFor="nome" className="cursor-pointer">
                  Apenas primeiro nome
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Filtros (opcional)</h3>
              <div className="flex gap-2">
                <Select value={filtroCampo} onValueChange={setFiltroCampo}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indicante">Indicante</SelectItem>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroOperador} onValueChange={setFiltroOperador}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="igual">Igual</SelectItem>
                    <SelectItem value="contem">Contém</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Valor"
                  value={filtroValor}
                  onChange={(e) => setFiltroValor(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddFiltro} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {filtros.length > 0 && (
                <div className="space-y-2">
                  {filtros.map((filtro, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted/30 p-3 rounded-lg"
                    >
                      <span className="text-sm">
                        <strong>{filtro.campo}</strong> {filtro.operador} "{filtro.valor}"
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFiltro(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              3. Processar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleProcessar}
                disabled={!jobId || loading}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? "Processando..." : "Processar e Baixar CSV"}
              </Button>
              <Button onClick={handleReset} variant="outline">
                Resetar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FormataListas;
