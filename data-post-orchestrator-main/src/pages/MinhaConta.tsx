import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCRMData, UazapiInstance } from "@/hooks/useCRMData";
import { Loader2, RefreshCw, Smartphone, Wifi, WifiOff, ShieldCheck, Building, ArrowLeft } from "lucide-react";

const MinhaConta = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getInstances, refreshInstanceStatus, tenantId } = useCRMData();

  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const usuario = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("usuario");
    return raw ? JSON.parse(raw) : null;
  }, []);

  const loadInstances = async () => {
    setLoadingList(true);
    try {
      const data = await getInstances();
      setInstances(data);
    } catch (error) {
      console.error("[MinhaConta] Erro ao buscar instâncias", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as instâncias deste tenant.",
        variant: "destructive",
      });
    } finally {
      setLoadingList(false);
    }
  };

  const handleRefreshInstance = async (instanceId: string) => {
    setRefreshingId(instanceId);
    try {
      await refreshInstanceStatus(instanceId);
      await loadInstances();
      toast({ title: "Instância atualizada", description: "Status sincronizado com sucesso." });
    } catch (error) {
      console.error("[MinhaConta] Erro ao atualizar instância", error);
      toast({
        title: "Falha ao atualizar",
        description: "Não foi possível sincronizar a instância. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRefreshingId(null);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const renderStatusBadge = (connected: boolean) => (
    <Badge variant={connected ? "default" : "destructive"} className="flex items-center gap-1">
      {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {connected ? "Conectado" : "Desconectado"}
    </Badge>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Minha conta</p>
          <h1 className="text-3xl font-semibold text-slate-900">Detalhes do Tenant</h1>
          <p className="text-sm text-slate-500">Gerencie suas informações e instâncias disponíveis.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" onClick={loadInstances} disabled={loadingList} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Informações do usuário
            </CardTitle>
            <CardDescription>Dados básicos que identificam sua conta atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase text-slate-400">Nome</p>
              <p className="text-base font-medium text-slate-900">{usuario?.nome ?? "—"}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs uppercase text-slate-400">E-mail</p>
              <p className="text-base">{usuario?.email ?? "—"}</p>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-xs uppercase text-slate-400">Tenant ID</p>
                <p className="text-base font-mono text-slate-900">{usuario?.tenant_id ?? tenantId ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Cargo</p>
                <p className="text-base capitalize text-slate-800">{usuario?.cargo ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Building className="h-5 w-5 text-sky-500" />
              Resumo do Tenant
            </CardTitle>
            <CardDescription>Visualize quantas instâncias estão configuradas.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-slate-700">
            <div>
              <p className="text-4xl font-semibold text-slate-900">{instances.length}</p>
              <p className="text-sm text-slate-500">Instâncias registradas</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
              {instances.filter((item) => item.connected).length} conectada(s)
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/70 bg-white/95 shadow">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-500" />
              Instâncias disponíveis
            </CardTitle>
            <CardDescription>Lista de instâncias UAZAPI conectadas ao seu tenant.</CardDescription>
          </div>
          <div className="text-sm text-slate-500">Total: {instances.length}</div>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando instâncias...
            </div>
          ) : instances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
              Nenhuma instância configurada para este tenant.
              <p className="mt-2 text-sm text-slate-400">
                Configure instâncias em Usuários &gt; Gerenciar instâncias para habilitar disparos automáticos.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance) => (
                <div key={instance.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-slate-900">{instance.name || instance.profile_name}</p>
                        {renderStatusBadge(instance.connected)}
                      </div>
                      <p className="text-sm text-slate-500">ID: {instance.instance_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefreshInstance(instance.id)}
                        disabled={refreshingId === instance.id}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingId === instance.id ? "animate-spin" : ""}`} />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <p><span className="font-medium text-slate-500">Telefone:</span> {instance.owner_phone || "—"}</p>
                    <p><span className="font-medium text-slate-500">Plataforma:</span> {instance.platform}</p>
                    <p><span className="font-medium text-slate-500">Status:</span> {instance.status}</p>
                    <p><span className="font-medium text-slate-500">Última verificação:</span> {new Date(instance.last_status_check).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MinhaConta;
