import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = () => {
      console.log('Logout: Iniciando processo de logout');
      
      // Limpar dados do usuário do localStorage
      const usuario = localStorage.getItem('usuario');
      console.log('Logout: Usuário encontrado:', usuario);
      localStorage.removeItem('usuario');
      
      // Redirecionar para a página de login
      console.log('Logout: Redirecionando para /login');
      navigate('/login');
    };

    // Pequeno delay para mostrar a tela de carregamento
    const timer = setTimeout(performLogout, 1000);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-slate-600">Saindo do sistema...</p>
      </div>
    </div>
  );
}
