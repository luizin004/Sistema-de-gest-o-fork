import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, ChevronDown, ChevronUp, Users, Settings, Calendar, Clock, CheckCircle, AlertCircle, Cake, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

interface DisparoClient {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string | null;
  data_limpeza: string | null;
  data_clareamento: string | null;
  data_consulta: string | null;
  created_at: string;
}

const DisparosAniversario = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [isTableCollapsed, setIsTableCollapsed] = useState(true);
  const [clients, setClients] = useState<DisparoClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('disparos')
        .select('*')
        .not('data_nascimento', 'is', null)
        .order('nome');
      
      if (error) {
        console.error('Error fetching clients:', error);
        toast.error('Erro ao carregar clientes');
        return;
      }
      
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoadingClients(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview("");
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
      console.log("[DisparosAniversario] Enviando arquivo...");
      const response = await fetchApi("/api/upload?tipo=aniversario", {
        method: "POST",
        body: formData,
      });

      console.log("[DisparosAniversario] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DisparosAniversario] Erro do servidor:", errorText);
        throw new Error(`Erro no upload: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DisparosAniversario] Upload bem-sucedido:", data);
      setJobId(data.job_id);
      const previewText = data.preview
        ? Array.isArray(data.preview)
          ? JSON.stringify(data.preview.slice(0, 3), null, 2)
          : JSON.stringify(data.preview, null, 2)
        : "";
      setPreview(previewText);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("[DisparosAniversario] Erro completo:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao enviar arquivo: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const [importLoading, setImportLoading] = useState(false);

  const handleImportToSupabase = async () => {
    if (!file) {
      toast.error("Faça upload e visualize o arquivo antes de importar");
      return;
    }
    setImportLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      console.log("[DisparosAniversario] Iniciando importação para Supabase...");
      
      // Primeiro, salvar no Supabase via Edge Function
      const response = await fetch(`https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/disparos-brumadinho?tipo=aniversario`, {
        method: "POST",
        headers: {
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MjQ4MDAsImV4cCI6MjA1MTAwMDQwMH0.W2h_4d7x3MzBPXPnBhJZ3KQYzXJhX8ZqF1wY8ZqF1wY",
        },
        body: formData,
      });
      
      console.log("[DisparosAniversario] Status da resposta Supabase:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DisparosAniversario] Erro na resposta Supabase:", errorText);
        throw new Error(errorText || `Erro ${response.status}`);
      }
      
      const data = await response.json();
      console.log("[DisparosAniversario] Dados recebidos do Supabase:", data);
      console.log("[DisparosAniversario] Clients array:", data.clients);
      console.log("[DisparosAniversario] Clients é array?", Array.isArray(data.clients));
      
      toast.success(`Importado(s): ${data.inserted || 0} pacientes no Supabase`);
      
      // Agora, sincronizar com Google Sheets
      try {
        console.log("[DisparosAniversario] Iniciando sincronização com Google Sheets...");
        
        if (data.sheetsSent) {
          console.log("⚠️ Edge Function diz que enviou, mas vamos garantir com envio manual...");
          toast.warning(`Verificando sincronização com planilha...`);
        }
        
        // Sempre enviar manualmente para garantir
        try {
          console.log("[DisparosAniversario] Iniciando sincronização manual com Google Sheets...");
          
          // Se não temos clients, vamos buscar os dados que acabaram de ser inseridos
          let clientsToSync = data.clients;
          
          if (!clientsToSync || !Array.isArray(clientsToSync)) {
            console.log("[DisparosAniversario] Buscando pacientes recém-inseridos...");
            const { data: recentClients } = await supabase
              .from('disparos')
              .select('*')
              .not('data_nascimento', 'is', null)
              .order('created_at', { ascending: false })
              .limit(data.inserted || 1);
            
            clientsToSync = recentClients || [];
          }
          
          if (clientsToSync && Array.isArray(clientsToSync) && clientsToSync.length > 0) {
            console.log("Enviando para Google Sheets:", clientsToSync.length, "pacientes");
            
            // Usar URL hardcoded como fallback se env estiver undefined
            const sheetsUrl = import.meta.env.VITE_GOOGLE_SHEETS_ANIVERSARIO_URL || 
              "https://script.google.com/macros/s/AKfycbxiMmIPjQ_wa3YL94tXm9cS80M1nGe4wGHy0Zq7DAa8im5oINNhxLQcLQ2vuLR4WOY/exec";
            
            console.log("URL:", sheetsUrl);
            console.log("Env var:", import.meta.env.VITE_GOOGLE_SHEETS_ANIVERSARIO_URL);
            
            // Montar array de payloads para enviar todos de uma vez
            const sheetsPayloads = clientsToSync.map(client => ({
              nome: client.nome || client.name,
              telefone: client.telefone || client.phone,
              datamarcada: client.data_nascimento || client.birth_date,
              tratamento: "Parabéns de Aniversário",
              aniversario: "sim"
            }));
            
            console.log("[DisparosAniversario] Payload para Google Sheets:", sheetsPayloads);
            
            const sheetsResponse = await fetch(sheetsUrl, {
              method: "POST",
              body: JSON.stringify(sheetsPayloads),
              mode: "no-cors",
            });
            
            console.log("[DisparosAniversario] Resposta do Google Sheets:", sheetsResponse);
            
            console.log("✅ Dados enviados para Google Sheets!");
            toast.success(`Sincronizado: ${clientsToSync.length} pacientes na planilha`);
          } else {
            console.warn("[DisparosAniversario] Nenhum paciente encontrado para enviar ao Google Sheets");
            toast.error("Não foi possível encontrar os dados para sincronizar com Google Sheets");
          }
        } catch (sheetsError) {
          console.error("[DisparosAniversario] Erro ao enviar para Google Sheets:", sheetsError);
          toast.error("Aviso: Erro ao sincronizar com Google Sheets, mas dados foram salvos no sistema");
        }
        
        fetchClients();
      } catch (error) {
        console.error("[DisparosAniversario] Erro geral na importação:", error);
        const message = error instanceof Error ? error.message : "Erro ao importar";
        toast.error(message);
      } finally {
        setImportLoading(false);
      }
    } catch (error) {
      console.error("[DisparosAniversario] Erro geral na importação:", error);
      const message = error instanceof Error ? error.message : "Erro ao importar";
      toast.error(message);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header Professional */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/disparos")}
                className="text-pink-600 hover:text-pink-900 hover:bg-pink-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-2 rounded-lg">
                  <Cake className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-pink-900">Feliz Aniversário!</h1>
                  <p className="text-sm text-pink-600">Gestão de Parabéns - Odontomanager LamorIA</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-pink-500">
              <Clock className="h-4 w-4" />
              {new Date().toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-pink-500 to-pink-600 text-white border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-pink-100 text-sm font-medium">Pacientes Cadastrados</p>
                  <p className="text-3xl font-bold mt-2">{clients.length}</p>
                  <p className="text-pink-100 text-xs mt-1">Com data de aniversário</p>
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Status do Sistema</p>
                  <p className="text-3xl font-bold mt-2">Ativo</p>
                  <p className="text-purple-100 text-xs mt-1">Parabéns automáticos funcionando</p>
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Próximos Envios</p>
                  <p className="text-3xl font-bold mt-2">Diário</p>
                  <p className="text-indigo-100 text-xs mt-1">Verifica aniversariantes</p>
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <Calendar className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Client Management */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Table */}
            <Card className="shadow-lg border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-pink-100 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-pink-900">Pacientes Aniversariantes</CardTitle>
                      <CardDescription className="text-pink-600">
                        {clients.length} pacientes encontrados
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTableCollapsed(!isTableCollapsed)}
                    className="border-pink-300 text-pink-700 hover:bg-pink-50"
                  >
                    {isTableCollapsed ? (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Expandir
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Recolher
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isTableCollapsed && (
                  <div className="overflow-x-auto">
                    {loadingClients ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
                      </div>
                    ) : clients.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Nenhum paciente encontrado</p>
                        <p className="text-gray-400 text-sm mt-1">Importe um arquivo CSV para começar</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-gray-50 border-b">
                          <TableRow>
                            <TableHead className="font-semibold text-gray-700">Nome do Paciente</TableHead>
                            <TableHead className="font-semibold text-gray-700">Telefone</TableHead>
                            <TableHead className="font-semibold text-gray-700">Data de Nascimento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clients.map((client, index) => (
                            <TableRow key={client.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <TableCell className="font-medium text-gray-900">{client.nome}</TableCell>
                              <TableCell className="text-gray-600">{client.telefone}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Cake className="h-4 w-4 text-pink-500" />
                                  <span className="text-gray-900 font-medium">{client.data_nascimento}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upload Section */}
          <div className="space-y-6">
            {/* CSV Upload Card */}
            <Card className="shadow-lg border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-200">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg">
                    <FileSpreadsheet className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-pink-900">Importar Pacientes</CardTitle>
                    <CardDescription className="text-pink-600">
                      Adicione novos pacientes via arquivo CSV
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-sm font-medium text-gray-700">Arquivo CSV</Label>
                  <div className="relative">
                    <Input 
                      id="file"
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileChange} 
                      className="pl-10 border-gray-300 focus:border-pink-500 focus:ring-pink-500"
                    />
                    <FileSpreadsheet className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  </div>
                  <p className="text-xs text-gray-500">Formato: nome, telefone, data_nascimento</p>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={handleUpload} 
                    disabled={!file || loading} 
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white shadow-md"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar Arquivo
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleImportToSupabase}
                    disabled={!file || importLoading}
                    variant="outline"
                    className="w-full border-purple-500 text-purple-600 hover:bg-purple-50"
                  >
                    {importLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Salvar no Sistema
                      </>
                    )}
                  </Button>
                </div>

                {preview && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-pink-500" />
                      <p className="text-sm font-medium text-gray-700">Pré-visualização</p>
                    </div>
                    <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded border border-gray-200">
                      {preview}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-lg border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-200">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg">
                    <Settings className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-pink-900">Configurações</CardTitle>
                    <CardDescription className="text-pink-600">
                      Gerencie parabéns automáticos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Button 
                  onClick={() => navigate("/disparos/aniversario/config")}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-md"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Parabéns Automáticos
                </Button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Configure mensagens de aniversário e horários
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparosAniversario;
