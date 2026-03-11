import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, Plus, Edit, Trash2, Search, Building2, Mail, UserCircle, Shield, Smartphone, Copy, LogOut } from 'lucide-react';
import { supabaseUntyped } from '@/integrations/supabase/client';
import { UsuarioInstanceManager } from '@/components/UsuarioInstanceManager';

type PermissionState = {
  allow_consultorios: boolean;
  allow_crm_agendamentos: boolean;
  allow_disparos_whatsapp: boolean;
  allow_disparos_limpeza: boolean;
  allow_disparos_clareamento: boolean;
  allow_disparos_confirmacao: boolean;
  allow_disparos_aniversario: boolean;
  allow_disparos_campanha: boolean;
  allow_disparos_manual: boolean;
  allow_chatbot: boolean;
};

type PermissionKey = keyof PermissionState;

const createDefaultPermissions = (): PermissionState => ({
  allow_consultorios: true,
  allow_crm_agendamentos: true,
  allow_disparos_whatsapp: true,
  allow_disparos_limpeza: true,
  allow_disparos_clareamento: true,
  allow_disparos_confirmacao: true,
  allow_disparos_aniversario: true,
  allow_disparos_campanha: true,
  allow_disparos_manual: true,
  allow_chatbot: false,
});

const permissionOptions: { key: PermissionKey; label: string; description: string }[] = [
  {
    key: 'allow_crm_agendamentos',
    label: 'CRM & Agendamentos',
    description: 'Funil completo e agenda de consultas.',
  },
  {
    key: 'allow_consultorios',
    label: 'Consultórios',
    description: 'Gestão de salas, escalas e equipes.',
  },
  {
    key: 'allow_disparos_whatsapp',
    label: 'Painel Disparos WhatsApp',
    description: 'Dashboard geral dos disparos.',
  },
  {
    key: 'allow_disparos_limpeza',
    label: 'Disparos Limpeza',
    description: 'Campanhas automatizadas de limpeza.',
  },
  {
    key: 'allow_disparos_clareamento',
    label: 'Disparos Clareamento',
    description: 'Campanhas de clareamento dental.',
  },
  {
    key: 'allow_disparos_confirmacao',
    label: 'Disparos Confirmação',
    description: 'Confirmação automática de consultas.',
  },
  {
    key: 'allow_disparos_aniversario',
    label: 'Disparos Aniversário',
    description: 'Lembretes e mensagens de aniversário.',
  },
  {
    key: 'allow_disparos_campanha',
    label: 'Disparos Campanhas',
    description: 'Campanhas customizadas e métricas.',
  },
  {
    key: 'allow_disparos_manual',
    label: 'Disparos Manuais',
    description: 'Envio manual de mensagens pelo time.',
  },
  {
    key: 'allow_chatbot',
    label: 'Chatbot IA',
    description: 'Acesso ao agente conversacional WhatsApp e configurações.',
  },
];

interface Usuario {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  empresa: string;
  tenant_id: string;
  ativo: boolean;
  created_at: string;
  ultimo_login?: string;
  allow_consultorios?: boolean;
  allow_crm_agendamentos?: boolean;
  allow_disparos_whatsapp?: boolean;
  allow_disparos_limpeza?: boolean;
  allow_disparos_clareamento?: boolean;
  allow_disparos_confirmacao?: boolean;
  allow_disparos_aniversario?: boolean;
  allow_disparos_campanha?: boolean;
  allow_disparos_manual?: boolean;
  allow_chatbot?: boolean;
}

export default function Usuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showInstanceDialog, setShowInstanceDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [copiedTenantId, setCopiedTenantId] = useState<string | null>(null);
  const [newUsuario, setNewUsuario] = useState({
    email: '',
    nome: '',
    cargo: 'usuario',
    empresa: '',
    senha: ''
  });
  const [permissionState, setPermissionState] = useState<PermissionState>(createDefaultPermissions());

  // Obter usuário atual
  const usuarioAtual = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('usuario') || '{}') 
    : {};

  // Verificar se é admin
  const isAdmin = usuarioAtual?.cargo === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: 'Acesso Negado',
        description: 'Apenas administradores podem acessar esta página',
        variant: 'destructive'
      });
      navigate('/home');
      return;
    }
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabaseUntyped
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const salvarUsuario = async () => {
    try {
      if (editingUsuario) {
        // Atualizar usuário
        const updates: any = {
          nome: newUsuario.nome,
          cargo: newUsuario.cargo,
          empresa: newUsuario.empresa,
          ...permissionState,
        };

        if (newUsuario.senha) {
          updates.senha_hash = newUsuario.senha;
        }

        const { error } = await supabaseUntyped
          .from('usuarios')
          .update(updates)
          .eq('id', editingUsuario.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso' });
      } else {
        // Criar novo usuário
        const { error } = await supabaseUntyped
          .from('usuarios')
          .insert([{
            email: newUsuario.email,
            senha_hash: newUsuario.senha,
            nome: newUsuario.nome,
            cargo: newUsuario.cargo,
            empresa: newUsuario.empresa,
            tenant_id: genRandomUUID(),
            ativo: true,
            ...permissionState,
          }]);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso' });
      }

      setShowDialog(false);
      setEditingUsuario(null);
      setNewUsuario({ email: '', nome: '', cargo: 'usuario', empresa: '', senha: '' });
      setPermissionState(createDefaultPermissions());
      carregarUsuarios();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o usuário',
        variant: 'destructive'
      });
    }
  };

  const excluirUsuario = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { error } = await supabaseUntyped
        .from('usuarios')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso' });
      carregarUsuarios();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o usuário',
        variant: 'destructive'
      });
    }
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    const nome = (usuario.nome || "").toLowerCase();
    const email = (usuario.email || "").toLowerCase();
    const empresa = (usuario.empresa || "").toLowerCase();
    const termo = searchTerm.toLowerCase();

    return nome.includes(termo) || email.includes(termo) || empresa.includes(termo);
  });

  const handleCopyTenantId = async (tenantId: string) => {
    try {
      await navigator.clipboard.writeText(tenantId);
      setCopiedTenantId(tenantId);
      toast({ title: 'Tenant copiado', description: 'ID copiado para a área de transferência' });
      setTimeout(() => setCopiedTenantId(null), 2000);
    } catch (error) {
      console.error('Erro ao copiar tenant_id:', error);
      toast({ title: 'Erro', description: 'Não foi possível copiar o tenant_id', variant: 'destructive' });
    }
  };

  const mapPermissionsFromUsuario = (usuario?: Partial<Usuario> | null): PermissionState => ({
    allow_consultorios: usuario?.allow_consultorios ?? true,
    allow_crm_agendamentos: usuario?.allow_crm_agendamentos ?? true,
    allow_disparos_whatsapp: usuario?.allow_disparos_whatsapp ?? true,
    allow_disparos_limpeza: usuario?.allow_disparos_limpeza ?? true,
    allow_disparos_clareamento: usuario?.allow_disparos_clareamento ?? true,
    allow_disparos_confirmacao: usuario?.allow_disparos_confirmacao ?? true,
    allow_disparos_aniversario: usuario?.allow_disparos_aniversario ?? true,
    allow_disparos_campanha: usuario?.allow_disparos_campanha ?? true,
    allow_disparos_manual: usuario?.allow_disparos_manual ?? true,
    allow_chatbot: usuario?.allow_chatbot ?? false,
  });

  const openNewUserDialog = () => {
    setEditingUsuario(null);
    setNewUsuario({ email: '', nome: '', cargo: 'usuario', empresa: '', senha: '' });
    setPermissionState(createDefaultPermissions());
    setShowDialog(true);
  };

  const openEditDialog = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setNewUsuario({
      email: usuario.email,
      nome: usuario.nome,
      cargo: usuario.cargo,
      empresa: usuario.empresa,
      senha: ''
    });
    setPermissionState(mapPermissionsFromUsuario(usuario));
    setShowDialog(true);
  };

  const handleTogglePermission = (key: PermissionKey, value: boolean) => {
    setPermissionState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const restrictedCount = Object.values(permissionState).filter((value) => !value).length;
  const restrictedLabels = permissionOptions
    .filter((option) => !permissionState[option.key])
    .map((option) => option.label);

  // Gerador UUID simples
  const genRandomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Usuários</p>
            <p className="text-slate-500">Controle quem tem acesso ao sistema</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={openNewUserDialog}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
            <Button
              onClick={() => navigate('/logout')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Busca */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="grid gap-4">
          {usuariosFiltrados.map((usuario) => {
            const userPermissions = mapPermissionsFromUsuario(usuario);
            const userRestrictedCount = Object.values(userPermissions).filter((value) => !value).length;
            const userRestrictedLabels = permissionOptions
              .filter((option) => !userPermissions[option.key])
              .map((option) => option.label);

            return (
              <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <UserCircle className="w-8 h-8 text-slate-400" />
                        <div>
                          <h3 className="font-semibold text-slate-900">{usuario.nome}</h3>
                          <p className="text-sm text-slate-600">{usuario.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant={usuario.cargo === 'admin' ? 'default' : 'secondary'}>
                          <Shield className="w-3 h-3 mr-1" />
                          {usuario.cargo === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                        <Badge variant="outline">
                          <Building2 className="w-3 h-3 mr-1" />
                          {usuario.empresa}
                        </Badge>
                        <Badge variant={usuario.ativo ? 'default' : 'destructive'}>
                          {usuario.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 mb-3">
                        <p className="font-semibold">Restrições de acesso:</p>
                        {userRestrictedCount === 0 ? (
                          <p>Acesso completo a todos os módulos.</p>
                        ) : (
                          <div>
                            <p>{`Bloqueado em ${userRestrictedCount} módulo(s).`}</p>
                            <p className="text-[11px] text-slate-400">
                              {userRestrictedLabels.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-500">
                        <p>Criado em: {new Date(usuario.created_at).toLocaleDateString('pt-BR')}</p>
                        {usuario.ultimo_login && (
                          <p>Último acesso: {new Date(usuario.ultimo_login).toLocaleDateString('pt-BR')}</p>
                        )}
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-500">Tenant ID</p>
                        <div className="flex items-center gap-2 text-sm">
                          <code className="px-2 py-1 rounded bg-slate-100 text-slate-700 break-all">
                            {usuario.tenant_id}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopyTenantId(usuario.tenant_id)}
                          >
                            <Copy className={`h-4 w-4 ${copiedTenantId === usuario.tenant_id ? 'text-green-600' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => openEditDialog(usuario)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingUsuario(usuario);
                          setShowInstanceDialog(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Smartphone className="w-4 h-4" />
                        Instâncias
                      </Button>
                      {usuario.id !== usuarioAtual?.id && (
                        <Button
                          onClick={() => excluirUsuario(usuario.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Dialog de Usuário */}
        <Dialog
          open={showDialog}
          onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              setShowPermissionsDialog(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
              </DialogTitle>
              <DialogDescription>
                {editingUsuario 
                  ? 'Edite as informações do usuário.' 
                  : 'Crie um novo usuário para o sistema.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={newUsuario.nome}
                  onChange={(e) => setNewUsuario({ ...newUsuario, nome: e.target.value })}
                  placeholder="Nome do usuário"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUsuario.email}
                  onChange={(e) => setNewUsuario({ ...newUsuario, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  disabled={!!editingUsuario}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={newUsuario.empresa}
                  onChange={(e) => setNewUsuario({ ...newUsuario, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Select
                  value={newUsuario.cargo}
                  onValueChange={(value) => setNewUsuario({ ...newUsuario, cargo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="senha">
                  {editingUsuario ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                </Label>
                <Input
                  id="senha"
                  type="password"
                  value={newUsuario.senha}
                  onChange={(e) => setNewUsuario({ ...newUsuario, senha: e.target.value })}
                  placeholder={editingUsuario ? "••••••••" : "Digite a senha"}
                />
              </div>

              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Permissões de acesso</p>
                    <p className="text-xs text-slate-500">
                      {restrictedCount === 0
                        ? 'Usuário com acesso completo.'
                        : `Bloqueado em ${restrictedCount} módulo(s).`}
                    </p>
                    {restrictedLabels.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {restrictedLabels.join(', ')}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowPermissionsDialog(true)}>
                    Configurar
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarUsuario}>
                {editingUsuario ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
          <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Permissões por funcionalidade</DialogTitle>
              <DialogDescription>
                Defina quais módulos este usuário pode acessar. Desmarcar remove o acesso imediato.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {permissionOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white/60 p-3"
                >
                  <Checkbox
                    checked={permissionState[option.key]}
                    onCheckedChange={(checked) =>
                      handleTogglePermission(option.key, checked === true)
                    }
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p className="text-xs text-slate-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Instâncias UAZAPI */}
        <UsuarioInstanceManager
          tenantId={editingUsuario?.tenant_id || ''}
          isOpen={showInstanceDialog}
          onClose={() => {
            setShowInstanceDialog(false);
            setEditingUsuario(null);
          }}
        />
      </div>
    </div>
  );
}
