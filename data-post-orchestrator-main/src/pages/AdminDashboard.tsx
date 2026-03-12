import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Settings, Database, ArrowRight, Eye } from "lucide-react";

interface UsuarioLocal {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  empresa?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<UsuarioLocal | null>(null);

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
        title: "Permissões",
        description: "Configure cargos, acesso por módulos e políticas",
        icon: Shield,
        action: () => navigate("/usuarios"),
        accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
        buttonLabel: "Configurar permissões",
        disabled: true,
      },
      {
        title: "Integrações",
        description: "Ajuste conexões externas, tokens e automatizações",
        icon: Database,
        action: () => navigate("/settings"),
        accent: "from-purple-500/20 via-purple-500/5 to-transparent",
        buttonLabel: "Configurar integrações",
        disabled: true,
      },
    ],
    [navigate]
  );

  if (!usuario) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-sm text-slate-500">Área administrativa</p>
            <h1 className="text-3xl font-semibold text-slate-900">Painel do Administrador</h1>
            <p className="text-slate-500">
              {usuario.nome} · {usuario.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/home")}>Experiência do usuário</Button>
            <Button variant="outline" onClick={() => navigate("/logout")}>Sair</Button>
          </div>
        </div>

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
              <div
                key={title}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
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
                  <Button
                    onClick={action}
                    disabled={disabled}
                    className="w-full justify-between"
                    variant={disabled ? "secondary" : "default"}
                  >
                    {buttonLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {disabled && (
                    <p className="text-xs text-slate-400">Em breve</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-400">
          <p>Sistema de Gestão · Área Administrativa</p>
          <p>Funcionalidades adicionais em breve</p>
        </div>
      </div>
    </div>
  );
}
