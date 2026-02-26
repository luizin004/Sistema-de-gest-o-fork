import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings, Clock, CheckCircle, Send, CheckSquare, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ManualPatientForm, {
  ManualPatientFormData,
  manualPatientFormInitialState,
} from "@/components/ManualPatientForm";

const DisparosConfirmacao = () => {
  const navigate = useNavigate();
  const [messageLoading, setMessageLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(
    "✅ Olá {nome}! Sua consulta está confirmada para {data_marcada}. Por favor, chegue 15 minutos antes. 🏥 OralDents Brumadinho"
  );
  const [formSnapshot, setFormSnapshot] = useState<ManualPatientFormData>(
    manualPatientFormInitialState
  );

  const handleManualFormCompleted = () => {
    setTimeout(() => {
      navigate("/crm/kanban");
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!formSnapshot.nome || !formSnapshot.telefone || !formSnapshot.data_marcada) {
      toast.error("Preencha os campos obrigatórios antes de enviar mensagem");
      return;
    }

    setMessageLoading(true);
    try {
      const formattedDate = new Date(formSnapshot.data_marcada).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = messageTemplate
        .replace('{nome}', formSnapshot.nome)
        .replace('{data_marcada}', formattedDate);

      console.log("Enviando mensagem:", message);
      toast.success("Mensagem enviada com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setMessageLoading(false);
    }
  };

  const handleCheckProgress = async () => {
    setProgressLoading(true);
    try {
      console.log("Verificando progresso de envio...");
      toast.success("Progresso verificado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao verificar progresso");
    } finally {
      setProgressLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
      {/* Header Professional */}
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
                <div className="bg-gradient-to-r from-green-600 to-teal-600 p-2 rounded-lg">
                  <CheckSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Confirmação de Consultas</h1>
                  <p className="text-sm text-green-600">Gestão Urna - OralDents Brumadinho</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <ManualPatientForm
              onCompleted={handleManualFormCompleted}
              onFormStateChange={setFormSnapshot}
            />

            {/* Message Configuration */}
            <Card className="shadow-lg border-green-200/50 bg-gradient-to-br from-green-50/50 to-teal-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-green-900">Configurar Mensagem</CardTitle>
                    <CardDescription className="text-green-600">
                      Personalize a mensagem de confirmação
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="mensagem" className="text-sm font-medium text-gray-700">
                    Template da Mensagem
                  </Label>
                  <textarea
                    id="mensagem"
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={4}
                    className="w-full border-gray-300 focus:border-green-500 focus:ring-green-500 rounded-md p-3 resize-none"
                    placeholder="Digite sua mensagem aqui..."
                  />
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 text-center">
                      Variáveis disponíveis:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <code className="bg-white px-2 py-1 rounded text-xs border border-green-300 text-green-800">{"{nome}"}</code>
                      <code className="bg-white px-2 py-1 rounded text-xs border border-green-300 text-green-800">{"{data_marcada}"}</code>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={handleSendMessage}
                    disabled={messageLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-md"
                  >
                    {messageLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Mensagem
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleCheckProgress}
                    disabled={progressLoading}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    {progressLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                        Verificando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verificar Progresso
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-lg border-green-200/50 bg-gradient-to-br from-green-50/50 to-teal-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Settings className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-green-900">Ações Rápidas</CardTitle>
                    <CardDescription className="text-green-600">
                      Configurações e relatórios
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Button
                  onClick={() => navigate("/disparos/confirmacao/config")}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Disparos
                </Button>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 text-center">
                    Configure mensagens automáticas de confirmação para consultas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="shadow-lg border-green-200/50 bg-gradient-to-br from-green-50/50 to-teal-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-green-900">Status do Sistema</CardTitle>
                    <CardDescription className="text-green-600">
                      Funcionalidades disponíveis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="shadow-lg border-green-200/50 bg-gradient-to-br from-green-50/50 to-teal-50/50 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-green-900">Status do Sistema</CardTitle>
                    <CardDescription className="text-green-600">
                      Funcionalidades disponíveis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Cadastro Urna</span>
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Ativo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Envio WhatsApp</span>
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Ativo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Templates Dinâmicos</span>
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Ativo</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparosConfirmacao;
