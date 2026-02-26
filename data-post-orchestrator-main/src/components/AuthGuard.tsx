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
      console.log('AuthGuard: Verificando autenticação');
      try {
        const usuarioStr = localStorage.getItem('usuario');
        console.log('AuthGuard: Usuario no localStorage:', usuarioStr);
        
        if (!usuarioStr) {
          console.log('AuthGuard: Nenhum usuário encontrado, redirecionando para /login');
          navigate('/login');
          return;
        }

        const usuario: Usuario = JSON.parse(usuarioStr);
        console.log('AuthGuard: Usuário parseado:', usuario);
        
        // Verificar se o usuário tem todos os campos necessários
        if (!usuario.id || !usuario.email || !usuario.nome) {
          console.log('AuthGuard: Usuário incompleto, removendo e redirecionando');
          localStorage.removeItem('usuario');
          navigate('/login');
          return;
        }

        console.log('AuthGuard: Usuário válido, autenticação confirmada');
        setAuthenticated(true);
      } catch (error) {
        console.error('AuthGuard: Erro ao verificar autenticação:', error);
        console.log('AuthGuard: Erro detectado, limpando localStorage e redirecionando');
        localStorage.removeItem('usuario');
        navigate('/login');
      } finally {
        console.log('AuthGuard: Finalizando verificação, loading:', loading);
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
