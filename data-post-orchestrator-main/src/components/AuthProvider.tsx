import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseUntyped } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Sincronizar com localStorage para compatibilidade
        if (session?.user && event === 'SIGNED_IN') {
          try {
            // Buscar usuário diretamente com supabaseUntyped
            if (typeof supabaseUntyped !== 'undefined') {
              const { data: usuario } = await supabaseUntyped
                .from('usuarios')
                .select('id, email, nome, cargo, tenant_id, empresa')
                .eq('id', session.user.id)
                .eq('ativo', true)
                .single();
              
              if (usuario) {
                localStorage.setItem('usuario', JSON.stringify(usuario));
                console.log('Usuário sincronizado com localStorage:', usuario.email);
              }
            }
          } catch (error) {
            console.warn('Erro ao sincronizar usuário:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('usuario');
          console.log('localStorage limpo no logout');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('usuario');
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
