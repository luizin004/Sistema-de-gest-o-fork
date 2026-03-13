import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Settings, ArrowRight, Eye, Smartphone, Plus, RefreshCw, Trash2, Wifi, WifiOff, QrCode, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UsuarioLocal {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  empresa?: string;
  tenant_id?: string;
}

interface UazapiInstanceRow {
  id: string;
  instance_id: string;
  token: string;
  api_url: string | null;
  name: string;
  profile_name: string | null;
  owner_phone: string | null;
  status: string | null;
  connected: boolean;
  last_status_check: string | null;
  chatbot_config_id: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<UsuarioLocal | null>(null);
  const [activeTab, setActiveTab] = useState<"actions" | "instances">("actions");

  // Instance management state
  const [instances, setInstances] = useState<UazapiInstanceRow[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [addingInstance, setAddingInstance] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectPhone, setConnectPhone] = useState("");
  const [connectResult, setConnectResult] = useState<{ type: "qr" | "code"; value: string; instanceId: string } | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
      navigate("/login", { replace: true });
      return;
    }
    const parsed: UsuarioLocal = JSON.parse(usuarioStr);
    setUsuario(parsed);
    if (parsed.cargo !== "admin") {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  // Fetch instances from DB
  const fetchInstances = useCallback(async () => {
    if (!usuario?.tenant_id) {
      // Try to get tenant_id from usuarios table
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await (supabase as any).from("usuarios").select("tenant_id").eq("id", user.id).single();
      if (!profile?.tenant_id) return;
      usuario!.tenant_id = profile.tenant_id;
    }
    setLoadingInstances(true);
    const { data, error } = await (supabase as any)
      .from("uazapi_instances")
      .select("id, instance_id, token, api_url, name, profile_name, owner_phone, status, connected, last_status_check, chatbot_config_id")
      .eq("tenant_id", usuario!.tenant_id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching instances:", error);
    }
    setInstances(data || []);
    setLoadingInstances(false);
  }, [usuario]);

  useEffect(() => {
    if (usuario) fetchInstances();
  }, [usuario, fetchInstances]);

  // Add instance by token
  const handleAddInstance = async () => {
    if (!newToken.trim()) return;
    setAddingInstance(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const response = await fetch(
        `https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/uazapi-instance-config/configure`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token: newToken.trim() }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || "Erro ao configurar instância");
        return;
      }

      const result = await response.json();
      if (result.instance?.id) {
        // Auto-configure webhook
        await fetch(
          `https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/uazapi-set-webhook`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ instance_id: result.instance.id }),
          }
        );
        toast.success("Instância configurada e webhook ativado!");
        setNewToken("");
        await fetchInstances();
      }
    } catch (err) {
      console.error("Error adding instance:", err);
      toast.error("Erro ao configurar instância");
    } finally {
      setAddingInstance(false);
    }
  };

  // Connect instance to WhatsApp via UAZAPI /instance/connect
  const handleConnect = async (instance: UazapiInstanceRow) => {
    setConnectingId(instance.id);
    setConnectResult(null);
    try {
      const apiUrl = instance.api_url || "https://oralaligner.uazapi.com";
      const body: any = {};
      if (connectPhone.trim()) {
        body.phone = connectPhone.trim().replace(/\D/g, "");
      }

      const response = await fetch(`${apiUrl}/instance/connect`, {
        method: "POST",
        headers: {
          "token": instance.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || data.message || "Erro ao conectar instância");
        setConnectingId(null);
        return;
      }

      // UAZAPI returns QR code (base64) or pairing code
      if (data.qrcode || data.qr) {
        setConnectResult({
          type: "qr",
          value: data.qrcode || data.qr,
          instanceId: instance.id,
        });
        toast.success("QR Code gerado! Escaneie no WhatsApp do celular.");
      } else if (data.code || data.pairingCode) {
        setConnectResult({
          type: "code",
          value: data.code || data.pairingCode,
          instanceId: instance.id,
        });
        toast.success("Código de pareamento gerado!");
      } else {
        toast.info("Conexão iniciada. Verifique o status.");
      }
    } catch (err) {
      console.error("Error connecting instance:", err);
      toast.error("Erro de rede ao conectar instância");
    } finally {
      setConnectingId(null);
    }
  };

  // Refresh instance status via UAZAPI
  const handleRefreshStatus = async (instance: UazapiInstanceRow) => {
    setRefreshingId(instance.id);
    try {
      const apiUrl = instance.api_url || "https://oralaligner.uazapi.com";
      const response = await fetch(`${apiUrl}/instance/status`, {
        method: "GET",
        headers: { "token": instance.token },
      });
      const data = await response.json();

      // Update in DB
      await (supabase as any)
        .from("uazapi_instances")
        .update({
          connected: data.connected ?? data.status === "connected",
          status: data.status || (data.connected ? "connected" : "disconnected"),
          last_status_check: new Date().toISOString(),
          profile_name: data.profileName || data.profile_name || undefined,
          owner_phone: data.ownerPhone || data.owner_phone || undefined,
        })
        .eq("id", instance.id);

      await fetchInstances();
      toast.success("Status atualizado");
    } catch (err) {
      console.error("Error refreshing status:", err);
      toast.error("Erro ao verificar status");
    } finally {
      setRefreshingId(null);
    }
  };

  // Remove instance
  const handleRemoveInstance = async (instance: UazapiInstanceRow) => {
    if (!confirm(`Remover a instância "${instance.name || instance.instance_id}"?`)) return;
    setRemovingId(instance.id);
    try {
      await (supabase as any).from("uazapi_instances").delete().eq("id", instance.id);
      toast.success("Instância removida");
      await fetchInstances();
    } catch (err) {
      console.error("Error removing instance:", err);
      toast.error("Erro ao remover instância");
    } finally {
      setRemovingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickActions = useMemo(
    () => [
      {
        title: "Usuários",
        description: "Gerencie contas, permissões e status dos colaboradores",
        icon: Users,
        action: () => navigate("/usuarios"),
        accent: "from-blue-500/20 via-blue-500/5 to-transparent",
        buttonLabel: "Gerenciar usuários",
      },
      {
        title: "Monitor de Conversas",
        description: "Acompanhe em tempo real todas as conversas do bot com os leads",
        icon: Eye,
        action: () => navigate("/admin/chat-monitor"),
        accent: "from-amber-500/20 via-amber-500/5 to-transparent",
        buttonLabel: "Monitorar conversas",
      },
      {
        title: "Instâncias WhatsApp",
        description: "Cadastre e gerencie suas instâncias de números WhatsApp",
        icon: Smartphone,
        action: () => setActiveTab("instances"),
        accent: "from-green-500/20 via-green-500/5 to-transparent",
        buttonLabel: "Gerenciar instâncias",
      },
      {
        title: "Permissões",
        description: "Configure cargos, acesso por módulos e políticas",
        icon: Shield,
        action: () => navigate("/usuarios"),
        accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
        buttonLabel: "Configurar permissões",
        disabled: true,
      },
    ],
    [navigate]
  );

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-sm text-slate-500">Área administrativa</p>
            <h1 className="text-3xl font-semibold text-slate-900">Configurações</h1>
            <p className="text-slate-500">{usuario.nome} · {usuario.email}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/home")}>Voltar ao painel</Button>
            <Button variant="outline" onClick={() => navigate("/logout")}>Sair</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab("actions")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "actions"
                ? "bg-white text-slate-900 border border-b-0 border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Settings className="inline w-4 h-4 mr-1.5" />
            Ações Rápidas
          </button>
          <button
            onClick={() => setActiveTab("instances")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "instances"
                ? "bg-white text-slate-900 border border-b-0 border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Smartphone className="inline w-4 h-4 mr-1.5" />
            Instâncias WhatsApp
            {instances.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{instances.length}</Badge>
            )}
          </button>
        </div>

        {/* Tab: Ações Rápidas */}
        {activeTab === "actions" && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Settings className="h-5 w-5" />
                Ações rápidas
              </CardTitle>
              <CardDescription>Escolha uma área para gerenciar</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map(({ title, description, icon: Icon, action, accent, buttonLabel, disabled }) => (
                <div key={title} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className={`absolute inset-px rounded-2xl bg-gradient-to-br ${accent} opacity-0 transition-opacity duration-500 hover:opacity-100`} />
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-900/5">
                        <Icon className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                        <p className="text-sm text-slate-500">{description}</p>
                      </div>
                    </div>
                    <Button onClick={action} disabled={disabled} className="w-full justify-between" variant={disabled ? "secondary" : "default"}>
                      {buttonLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    {disabled && <p className="text-xs text-slate-400">Em breve</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tab: Instâncias WhatsApp */}
        {activeTab === "instances" && (
          <div className="space-y-6">
            {/* Add new instance */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Plus className="h-5 w-5" />
                  Cadastrar Nova Instância
                </CardTitle>
                <CardDescription>
                  Cole o token da sua instância UAZAPI para cadastrá-la no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="Cole o token UAZAPI aqui..."
                    disabled={addingInstance}
                    className="flex-1"
                  />
                  <Button onClick={handleAddInstance} disabled={addingInstance || !newToken.trim()}>
                    {addingInstance ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Cadastrar
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  O token será validado e o webhook será configurado automaticamente.
                </p>
              </CardContent>
            </Card>

            {/* Connect result (QR Code or Pairing Code) */}
            {connectResult && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <QrCode className="h-5 w-5" />
                    {connectResult.type === "qr" ? "Escaneie o QR Code" : "Código de Pareamento"}
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    {connectResult.type === "qr"
                      ? "Abra o WhatsApp no celular → Menu → Dispositivos Vinculados → Vincular dispositivo → Escaneie o QR Code abaixo"
                      : "Abra o WhatsApp no celular → Menu → Dispositivos Vinculados → Vincular dispositivo → Vincular por número → Digite o código abaixo"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  {connectResult.type === "qr" ? (
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                      <img
                        src={connectResult.value.startsWith("data:") ? connectResult.value : `data:image/png;base64,${connectResult.value}`}
                        alt="QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-sm">
                      <span className="text-3xl font-mono font-bold tracking-[0.3em] text-slate-900">
                        {connectResult.value}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(connectResult.value)}>
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConnectResult(null)}>
                      Fechar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const inst = instances.find(i => i.id === connectResult.instanceId);
                      if (inst) handleRefreshStatus(inst);
                      setConnectResult(null);
                    }}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Verificar Conexão
                    </Button>
                  </div>
                  <p className="text-xs text-green-700">
                    {connectResult.type === "qr" ? "O QR Code expira em 2 minutos." : "O código expira em 5 minutos."}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Instance list */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-900">
                      <Smartphone className="h-5 w-5" />
                      Instâncias Cadastradas ({instances.length})
                    </CardTitle>
                    <CardDescription>Gerencie e conecte suas instâncias de WhatsApp</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchInstances} disabled={loadingInstances}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingInstances ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInstances && instances.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Carregando instâncias...
                  </div>
                ) : instances.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Smartphone className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">Nenhuma instância cadastrada</p>
                    <p className="text-sm mt-1">Cadastre sua primeira instância acima usando o token UAZAPI.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instances.map((instance) => (
                      <div key={instance.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {instance.name || instance.profile_name || instance.instance_id}
                              </h3>
                              <Badge variant={instance.connected ? "default" : "destructive"} className={`text-xs ${instance.connected ? "bg-green-100 text-green-800 border-green-200" : ""}`}>
                                {instance.connected ? (
                                  <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
                                ) : (
                                  <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
                                )}
                              </Badge>
                            </div>
                            <div className="mt-1 space-y-0.5 text-sm text-slate-500">
                              {instance.owner_phone && <p>Telefone: {instance.owner_phone}</p>}
                              <p>ID: {instance.instance_id}</p>
                              {instance.last_status_check && (
                                <p>Última verificação: {new Date(instance.last_status_check).toLocaleString("pt-BR")}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            {/* Connect button — only show for disconnected instances */}
                            {!instance.connected && (
                              <div className="flex gap-2">
                                <Input
                                  value={connectingId === instance.id ? connectPhone : ""}
                                  onChange={(e) => setConnectPhone(e.target.value)}
                                  placeholder="5511999... (opcional)"
                                  className="w-40 h-8 text-xs"
                                  disabled={connectingId !== null && connectingId !== instance.id}
                                />
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleConnect(instance)}
                                  disabled={connectingId !== null}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {connectingId === instance.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <><QrCode className="w-3 h-3 mr-1" /> Conectar</>
                                  )}
                                </Button>
                              </div>
                            )}
                            <div className="flex gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefreshStatus(instance)}
                                disabled={refreshingId === instance.id}
                              >
                                <RefreshCw className={`w-3 h-3 ${refreshingId === instance.id ? "animate-spin" : ""}`} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveInstance(instance)}
                                disabled={removingId === instance.id}
                              >
                                {removingId === instance.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help info */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <h4 className="font-semibold text-blue-900 mb-2">Como funciona</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Cadastre uma instância com o token fornecido pela UAZAPI</li>
                  <li>Clique em <strong>Conectar</strong> na instância desconectada</li>
                  <li>Se informar o número do telefone, recebe um <strong>código de pareamento</strong></li>
                  <li>Se não informar, recebe um <strong>QR Code</strong> para escanear</li>
                  <li>Escaneie o QR ou insira o código no WhatsApp do celular</li>
                  <li>Pronto! A instância estará conectada e pronta para uso</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
