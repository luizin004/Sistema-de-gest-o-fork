import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Calendar, LayoutDashboard, Columns, Table, Home, HelpCircle, MessageSquare, Activity, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extrairTelefoneBase } from "@/lib/utils";
import { useCRMData, Post } from "@/hooks/useCRMData";

const meshBackground = {
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(56,189,248,0.35), transparent 45%),
    radial-gradient(circle at 80% 10%, rgba(59,130,246,0.3), transparent 50%),
    radial-gradient(circle at 40% 85%, rgba(14,165,233,0.25), transparent 55%),
    linear-gradient(120deg, #f5f9ff, #eef3ff, #f7fbff)
  `
};

export const CRMLayout = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { fetchPosts } = useCRMData();

  useEffect(() => {
    // Removida verificação de autenticação para permitir acesso direto ao CRM
    fetchPostsData();
    
    const channel = (supabase as any)
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchPostsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPostsData = async () => {
    try {
      setRefreshing(true);
      const data = await fetchPosts();

      // Adicionar telefone base para comparação (SEM MODIFICAR DADOS ORIGINAIS)
      const postsComTelefoneBase = data.map(post => ({
        ...post,
        telefone_base: extrairTelefoneBase(post.telefone || ''),
      }));

      // Detectar duplicados de telefone (SEM MODIFICAR DADOS ORIGINAIS)
      const telefones = postsComTelefoneBase.map(p => p.telefone_base).filter(Boolean);
      const contagemTelefones = telefones.reduce((acc, tel) => {
        acc[tel] = (acc[tel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const postsComDuplicados = postsComTelefoneBase.map(post => ({
        ...post,
        tem_duplicado: post.telefone_base ? contagemTelefones[post.telefone_base] > 1 : false,
      }));

      setPosts(postsComDuplicados);
    } catch (error) {
      console.error('Erro ao buscar posts:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      isActive(path)
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="font-['Myriad_Pro','Plus_Jakarta_Sans','Inter',sans-serif] relative min-h-screen overflow-hidden bg-[#050f24] text-slate-900">
      <div className="absolute inset-0" style={meshBackground} />
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516542076529-1ea3854896e1?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-[0.08]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/45 to-white/65 backdrop-blur-[4px]" />

      <div className="relative z-10 min-h-screen">
        <header className="sticky top-0 z-20 border-b border-white/30 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 shadow-[0_20px_60px_-40px_rgba(5,15,36,0.8)]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/home')}
                  className="rounded-2xl border-white/70 bg-white text-slate-700 hover:bg-white"
                  title="Voltar ao Menu Inicial"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-semibold text-slate-800">CRM · Leads</h1>
                  <p className="text-sm text-slate-500">Gerencie contatos e agendamentos</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInstructions(true)}
                  className="rounded-2xl border-white/60 bg-white text-slate-700 hover:bg-white"
                  title="Ver instruções de uso"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Instruções
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/agendamentos')}
                  className="rounded-2xl border-white/60 bg-white text-slate-700 hover:bg-white"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendamentos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPosts}
                  disabled={refreshing}
                  className="rounded-2xl border-white/60 bg-white text-slate-700 hover:bg-white"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="rounded-2xl border-white/60 bg-white text-red-500 hover:bg-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
          <div className="container mx-auto px-4">
            <nav className="flex gap-1 -mb-px pb-1 overflow-x-auto">
              <Link to="/crm/dashboard" className={navLinkClass('/crm/dashboard')}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link to="/crm/kanban-acao" className={navLinkClass('/crm/kanban-acao')}>
                <Activity className="h-4 w-4" />
                Kanban de Ação
              </Link>
              <Link to="/crm/kanban" className={navLinkClass('/crm/kanban')}>
                <Columns className="h-4 w-4" />
                Kanban Geral
              </Link>
              <Link to="/crm/agendar" className={navLinkClass('/crm/agendar')}>
                <CalendarDays className="h-4 w-4" />
                Agendar
              </Link>
              <Link to="/crm/tabela" className={navLinkClass('/crm/tabela')}>
                <Table className="h-4 w-4" />
                Tabela
              </Link>
              <Link to="/crm/chat-ao-vivo" className={navLinkClass('/crm/chat-ao-vivo')}>
                <MessageSquare className="h-4 w-4" />
                Chat ao vivo
              </Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Outlet context={{ posts, refreshPosts: fetchPosts }} />
        </main>
      </div>

      {/* Dialog de Instruções */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Instruções de Uso do CRM
            </DialogTitle>
            <DialogDescription>
              Guia completo para utilizar o sistema de gerenciamento de leads e agendamentos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 space-y-6">
            {/* Visão Geral */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">📋 Visão Geral</h3>
              <p className="text-sm text-slate-600">
                O sistema CRM da OralDents permite gerenciar leads desde o primeiro contato até o agendamento final. 
                Utilize as diferentes visualizações para acompanhar o progresso dos pacientes.
              </p>
            </div>

            {/* Kanban Board */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">📌 Kanban Board</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <p><strong>Colunas do Funil:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><span className="text-blue-600 font-medium">Interagiu:</span> Primeiro contato do paciente</li>
                  <li><span className="text-red-600 font-medium">Interessado em agendar:</span> Paciente deseja agendar consulta, necessita um ajuste manual do agendamento para avançar para as demais etapas</li>
                  <li><span className="text-emerald-600 font-medium">Agendou consulta:</span> Consulta marcada</li>
                  <li><span className="text-purple-600 font-medium">Reagendando:</span> Paciente reagendando</li>
                </ul>
                <p className="mt-2"><strong>Como usar:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Arraste os cards entre as colunas para atualizar o status</li>
                  <li>Clique nos cards para ver detalhes do paciente</li>
                  <li>Use o botão "Pacientes Arquivados" para ver pacientes perdidos</li>
                  <li>Os pontos vermelhos piscantes indicam ação necessária</li>
                </ul>
              </div>
            </div>

            {/* Agendamentos */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">📅 Agendamentos</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <p><strong>Visualizações disponíveis:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Tabela:</strong> Lista detalhada de todos os agendamentos</li>
                  <li><strong>Calendário Mensal:</strong> Visão mensal com resumo diário</li>
                  <li><strong>Calendário Semanal:</strong> Cards detalhados por dia da semana</li>
                </ul>
                <p className="mt-2"><strong>Funcionalidades:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Clique em datas para marcar/agendar horários</li>
                  <li>Arraste cards entre dias para reagendar</li>
                  <li>Clique nos cards para expandir informações</li>
                  <li>Filtre por status, dentista e período</li>
                </ul>
              </div>
            </div>

            {/* Dicas Rápidas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">💡 Dicas Rápidas</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Use o botão "Atualizar" para sincronizar dados em tempo real</li>
                  <li>Pacientes com ⚡ precisam de atenção imediata</li>
                  <li>Acesse "Pacientes Arquivados" para recuperar leads perdidos</li>
                  <li>Use a visualização em tabela para exportar dados</li>
                  <li>O calendário semanal é ideal para gestão diária</li>
                </ul>
              </div>
            </div>

            {/* Status e Cores */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">🎨 Cores e Status</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p><strong>Kanban:</strong></p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Interagiu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Interessado (urgente)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                      <span>Agendou consulta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded"></div>
                      <span>Reagendando</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p><strong>Agendamentos:</strong></p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span>Confirmado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span>Pendente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Não compareceu</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
