import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuthGuardProps {
  children: React.ReactNode;
}

interface Usuario {
  id: string;
  email: string;
  nome: string;
  cargo: string;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar autenticação via Supabase Auth
    const checkAuth = async () => {
      try {
        // Primeiro verificar se há sessão do Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Se há sessão do Supabase, verificar se usuário existe no nosso banco
          const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, email, nome, cargo, tenant_id, empresa')
            .eq('id', session.user.id)
            .eq('ativo', true)
            .single();
          
          if (usuario && !error) {
            // Salvar dados atualizados no localStorage
            localStorage.setItem('usuario', JSON.stringify(usuario));
            setAuthenticated(true);
            return;
          }
        }
        
        // Se não há sessão Supabase, verificar localStorage (fallback)
        const usuarioStr = localStorage.getItem('usuario');
        
        if (!usuarioStr) {
          navigate('/login');
          return;
        }

        const usuario: Usuario = JSON.parse(usuarioStr);
        
        // Verificar se o usuário tem todos os campos necessários
        if (!usuario.id || !usuario.email || !usuario.nome) {
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        setAuthenticated(true);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('usuario');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    // Configurar listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        
        if (event === 'SIGNED_OUT') {
          // Limpar localStorage e redirecionar para login
          localStorage.removeItem('usuario');
          setAuthenticated(false);
          navigate('/login');
        } else if (event === 'SIGNED_IN' && session) {
          // Usuário fez login via Supabase
          const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, email, nome, cargo, tenant_id, empresa')
            .eq('id', session.user.id)
            .eq('ativo', true)
            .single();
          
          if (usuario && !error) {
            localStorage.setItem('usuario', JSON.stringify(usuario));
            setAuthenticated(true);
          }
        }
      }
    );

    checkAuth();

    // Limpar subscription quando componente desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Redirecionamento está acontecendo
  }

  return <>{children}</>;
}
