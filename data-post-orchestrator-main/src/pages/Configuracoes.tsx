import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User, Smartphone, Plus, RefreshCw, Trash2, Wifi, WifiOff,
  QrCode, Loader2, Copy, Check, Save, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FUNCTIONS_URL = "https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1";

interface InstanceRow {
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
}

export default function Configuracoes() {
  const navigate = useNavigate();

  // User profile
  const [userId, setUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Instances
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [addingInstance, setAddingInstance] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectPhone, setConnectPhone] = useState("");
  const [connectResult, setConnectResult] = useState<{
    type: "qr" | "code";
    value: string;
    instanceId: string;
  } | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load user data
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }

      const { data: profile } = await (supabase as any)
        .from("usuarios")
        .select("id, nome, email, tenant_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserId(profile.id);
        setTenantId(profile.tenant_id);
        setUserName(profile.nome || "");
        setOriginalName(profile.nome || "");
        setUserEmail(profile.email || user.email || "");
      }
    };
    load();
  }, [navigate]);

  // Save username
  const handleSaveName = async () => {
    if (!userId || !userName.trim() || userName === originalName) return;
    setSavingName(true);
    try {
      const { error } = await (supabase as any)
        .from("usuarios")
        .update({ nome: userName.trim() })
        .eq("id", userId);
      if (error) throw error;

      // Update localStorage too
      try {
        const stored = JSON.parse(localStorage.getItem("usuario") || "{}");
        stored.nome = userName.trim();
        localStorage.setItem("usuario", JSON.stringify(stored));
      } catch {}

      setOriginalName(userName.trim());
      toast.success("Nome atualizado com sucesso!");
    } catch (err) {
      console.error("Error saving name:", err);
      toast.error("Erro ao salvar nome");
    } finally {
      setSavingName(false);
    }
  };

  // Fetch instances
  const fetchInstances = useCallback(async () => {
    if (!tenantId) return;
    setLoadingInstances(true);
    const { data } = await (supabase as any)
      .from("uazapi_instances")
      .select("id, instance_id, token, api_url, name, profile_name, owner_phone, status, connected, last_status_check")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setInstances(data || []);
    setLoadingInstances(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchInstances();
  }, [tenantId, fetchInstances]);

  // Add instance by token
  const handleAddInstance = async () => {
    if (!newToken.trim()) return;
    setAddingInstance(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); setAddingInstance(false); return; }

      const res = await fetch(`${FUNCTIONS_URL}/uazapi-instance-config/configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token: newToken.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao configurar instância");
        setAddingInstance(false);
        return;
      }

      const result = await res.json();
      if (result.instance?.id) {
        // Auto-configure webhook
        await fetch(`${FUNCTIONS_URL}/uazapi-set-webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ instance_id: result.instance.id }),
        });
        toast.success("Instância cadastrada e webhook ativado!");
        setNewToken("");
        await fetchInstances();
      }
    } catch {
      toast.error("Erro ao configurar instância");
    } finally {
      setAddingInstance(false);
    }
  };

  // Connect instance via UAZAPI /instance/connect
  const handleConnect = async (instance: InstanceRow) => {
    setConnectingId(instance.id);
    setConnectResult(null);
    try {
      const apiUrl = instance.api_url || "https://oralaligner.uazapi.com";
      const body: any = {};
      if (connectPhone.trim()) {
        body.phone = connectPhone.trim().replace(/\D/g, "");
      }

      const res = await fetch(`${apiUrl}/instance/connect`, {
        method: "POST",
        headers: { token: instance.token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || "Erro ao conectar");
        setConnectingId(null);
        return;
      }

      if (data.qrcode || data.qr) {
        setConnectResult({ type: "qr", value: data.qrcode || data.qr, instanceId: instance.id });
        toast.success("QR Code gerado! Escaneie no WhatsApp.");
      } else if (data.code || data.pairingCode) {
        setConnectResult({ type: "code", value: data.code || data.pairingCode, instanceId: instance.id });
        toast.success("Código de pareamento gerado!");
      } else {
        toast.info("Conexão iniciada. Verifique o status.");
      }
    } catch {
      toast.error("Erro de rede ao conectar");
    } finally {
      setConnectingId(null);
    }
  };

  // Refresh instance status
  const handleRefresh = async (instance: InstanceRow) => {
    setRefreshingId(instance.id);
    try {
      const apiUrl = instance.api_url || "https://oralaligner.uazapi.com";
      const res = await fetch(`${apiUrl}/instance/status`, {
        method: "GET",
        headers: { token: instance.token },
      });
      const data = await res.json();

      await (supabase as any)
        .from("uazapi_instances")
        .update({
          connected: data.connected ?? data.status === "connected",
          status: data.status || (data.connected ? "connected" : "disconnected"),
          last_status_check: new Date().toISOString(),
          ...(data.profileName || data.profile_name ? { profile_name: data.profileName || data.profile_name } : {}),
          ...(data.ownerPhone || data.owner_phone ? { owner_phone: data.ownerPhone || data.owner_phone } : {}),
        })
        .eq("id", instance.id);

      await fetchInstances();
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao verificar status");
    } finally {
      setRefreshingId(null);
    }
  };

  // Remove instance
  const handleRemove = async (instance: InstanceRow) => {
    if (!confirm(`Remover "${instance.name || instance.instance_id}"?`)) return;
    setRemovingId(instance.id);
    try {
      await (supabase as any).from("uazapi_instances").delete().eq("id", instance.id);
      toast.success("Instância removida");
      await fetchInstances();
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setRemovingId(null);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nameChanged = userName.trim() !== originalName && userName.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>
            <p className="text-sm text-slate-500">Gerencie seu perfil e instâncias WhatsApp</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        </div>

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" /> Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nome de usuário</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Seu nome"
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveName}
                  disabled={!nameChanged || savingName}
                  size="sm"
                >
                  {savingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-1" /> Salvar</>
                  )}
                </Button>
              </div>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-slate-700">E-mail</label>
              <p className="text-sm text-slate-500 mt-1">{userEmail}</p>
            </div>
          </CardContent>
        </Card>

        {/* Add Instance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Cadastrar Instância WhatsApp
            </CardTitle>
            <CardDescription>
              Cole o token da UAZAPI para cadastrar uma nova instância
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="Token UAZAPI..."
                disabled={addingInstance}
                className="flex-1"
              />
              <Button onClick={handleAddInstance} disabled={addingInstance || !newToken.trim()}>
                {addingInstance ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Cadastrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Connect Result */}
        {connectResult && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900 text-base">
                <QrCode className="w-4 h-4" />
                {connectResult.type === "qr" ? "Escaneie o QR Code" : "Codigo de Pareamento"}
              </CardTitle>
              <CardDescription className="text-green-700">
                {connectResult.type === "qr"
                  ? "WhatsApp > Dispositivos Vinculados > Vincular dispositivo > Escaneie"
                  : "WhatsApp > Dispositivos Vinculados > Vincular por numero > Digite o codigo"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {connectResult.type === "qr" ? (
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <img
                    src={connectResult.value.startsWith("data:") ? connectResult.value : `data:image/png;base64,${connectResult.value}`}
                    alt="QR Code"
                    className="w-56 h-56"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-sm">
                  <span className="text-2xl font-mono font-bold tracking-[0.3em] text-slate-900">
                    {connectResult.value}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => copyCode(connectResult.value)}>
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConnectResult(null)}>Fechar</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const inst = instances.find(i => i.id === connectResult.instanceId);
                  if (inst) handleRefresh(inst);
                  setConnectResult(null);
                }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Verificar Conexao
                </Button>
              </div>
              <p className="text-xs text-green-700">
                {connectResult.type === "qr" ? "Expira em 2 minutos." : "Expira em 5 minutos."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instance List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="w-4 h-4" />
                Instancias ({instances.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchInstances} disabled={loadingInstances}>
                <RefreshCw className={`w-4 h-4 ${loadingInstances ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingInstances && instances.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Carregando...
              </div>
            ) : instances.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>Nenhuma instancia cadastrada</p>
                <p className="text-xs mt-1">Cadastre acima usando o token UAZAPI.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => (
                  <div key={inst.id} className="border rounded-lg p-4 bg-white space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {inst.name || inst.profile_name || inst.instance_id}
                          </span>
                          <Badge
                            variant={inst.connected ? "default" : "destructive"}
                            className={`text-xs shrink-0 ${inst.connected ? "bg-green-100 text-green-800 border-green-200" : ""}`}
                          >
                            {inst.connected ? <><Wifi className="w-3 h-3 mr-1" />Conectado</> : <><WifiOff className="w-3 h-3 mr-1" />Desconectado</>}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                          {inst.owner_phone && <p>Tel: {inst.owner_phone}</p>}
                          <p>ID: {inst.instance_id}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleRefresh(inst)} disabled={refreshingId === inst.id} title="Atualizar status">
                          <RefreshCw className={`w-3 h-3 ${refreshingId === inst.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleRemove(inst)} disabled={removingId === inst.id} title="Remover">
                          {removingId === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Connect row for disconnected */}
                    {!inst.connected && (
                      <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <Input
                          value={connectingId === inst.id ? connectPhone : ""}
                          onChange={(e) => setConnectPhone(e.target.value)}
                          placeholder="5511999... (opcional, gera codigo)"
                          className="flex-1 h-8 text-xs"
                          disabled={connectingId !== null && connectingId !== inst.id}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleConnect(inst)}
                          disabled={connectingId !== null}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {connectingId === inst.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <><QrCode className="w-3 h-3 mr-1" /> Conectar</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
