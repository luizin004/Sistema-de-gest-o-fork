import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Lock, Mail, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUntyped } from '@/integrations/supabase/client';

interface LoginFormData {
  email: string;
  senha: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    senha: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Buscar usuário no banco
      const { data: usuario, error: userError } = await supabaseUntyped
        .from('usuarios')
        .select('*')
        .eq('email', formData.email)
        .eq('ativo', true)
        .single();

      if (userError || !usuario) {
        setError('Email ou senha incorretos');
        return;
      }

      // Verificar senha (em produção, usar bcrypt)
      if (usuario.senha_hash !== formData.senha) {
        setError('Email ou senha incorretos');
        return;
      }

      // Atualizar último login
      await supabaseUntyped
        .from('usuarios')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', usuario.id);

      // Criar sessão Supabase Auth para persistência
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.senha
      });

      if (signInError) {
        console.warn('Erro ao criar sessão Supabase:', signInError);
        // Continuar mesmo sem sessão Supabase (fallback)
      }

      // Salvar dados do usuário no localStorage
      const usuarioData = {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        cargo: usuario.cargo,
        tenant_id: usuario.tenant_id,
        empresa: usuario.empresa
      };
      
      localStorage.setItem('usuario', JSON.stringify(usuarioData));

      toast({
        title: 'Login realizado com sucesso',
        description: `Bem-vindo(a), ${usuario.nome}!`
      });

      // Redirecionar para a página principal
      navigate('/home');

    } catch (error) {
      console.error('Erro no login:', error);
      setError('Ocorreu um erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sistema de Gestão</h1>
          <p className="text-slate-600">Faça login para acessar o sistema</p>
        </div>

        {/* Card de Login */}
        <Card className="shadow-xl border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-900">Login</CardTitle>
            <CardDescription className="text-center text-slate-600">
              Entre com suas credenciais para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-slate-700 font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="senha"
                    name="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.senha}
                    onChange={handleChange}
                    className="pl-10 pr-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Alerta de Erro */}
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700 text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Botão de Login */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-3 shadow-lg transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </form>

            {/* Informações de Acesso */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Para acesso ao sistema, entre em contato com o administrador
                </p>
                <div className="flex justify-center space-x-4 text-xs text-slate-400">
                  <span>• Use um email válido</span>
                  <span>• Senha confidencial</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-500">
          <p>Sistema de Gestão - 2026</p>
          <p className="mt-1">Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
