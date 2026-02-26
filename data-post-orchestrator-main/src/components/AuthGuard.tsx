import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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
    const checkAuth = () => {
      console.log('[AuthGuard] Iniciando verificação de autenticação...');
      console.log('[AuthGuard] URL atual:', window.location.href);
      
      try {
        const usuarioStr = localStorage.getItem('usuario');
        console.log('[AuthGuard] Usuario do localStorage:', usuarioStr);
        
        if (!usuarioStr) {
          console.log('[AuthGuard] Nenhum usuário encontrado, redirecionando para login');
          navigate('/login');
          return;
        }

        const usuario: Usuario = JSON.parse(usuarioStr);
        console.log('[AuthGuard] Usuario parseado:', usuario);
        
        // Verificar se o usuário tem todos os campos necessários
        if (!usuario.id || !usuario.email || !usuario.nome) {
          console.log('[AuthGuard] Usuário incompleto, campos faltando:', {
            id: !!usuario.id,
            email: !!usuario.email,
            nome: !!usuario.nome
          });
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        console.log('[AuthGuard] Usuário válido, autenticado!');
        setAuthenticated(true);
      } catch (error) {
        console.error('[AuthGuard] Erro ao verificar autenticação:', error);
        localStorage.removeItem('usuario');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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
