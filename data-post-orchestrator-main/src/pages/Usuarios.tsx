import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, Plus, Edit, Trash2, Search, Building2, Mail, UserCircle, Shield } from 'lucide-react';
import { supabaseUntyped } from '@/integrations/supabase/client';

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
}

export default function Usuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [newUsuario, setNewUsuario] = useState({
    email: '',
    nome: '',
    cargo: 'usuario',
    empresa: '',
    senha: ''
  });

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
      navigate('/');
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
          empresa: newUsuario.empresa
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
            ativo: true
          }]);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso' });
      }

      setShowDialog(false);
      setEditingUsuario(null);
      setNewUsuario({ email: '', nome: '', cargo: 'usuario', empresa: '', senha: '' });
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

  const usuariosFiltrados = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEditDialog = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setNewUsuario({
      email: usuario.email,
      nome: usuario.nome,
      cargo: usuario.cargo,
      empresa: usuario.empresa,
      senha: ''
    });
    setShowDialog(true);
  };

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
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciamento de Usuários</h1>
            <p className="text-slate-600">Gerencie todos os usuários do sistema</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Início
            </Button>
            <Button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
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
          {usuariosFiltrados.map((usuario) => (
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

                    <div className="text-xs text-slate-500">
                      <p>Criado em: {new Date(usuario.created_at).toLocaleDateString('pt-BR')}</p>
                      {usuario.ultimo_login && (
                        <p>Último acesso: {new Date(usuario.ultimo_login).toLocaleDateString('pt-BR')}</p>
                      )}
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
          ))}
        </div>

        {/* Dialog de Usuário */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
      </div>
    </div>
  );
}
