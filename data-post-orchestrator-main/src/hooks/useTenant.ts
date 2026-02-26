import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface Usuario {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  tenant_id?: string;
  empresa?: string;
}

interface TenantContextType {
  usuario: Usuario | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUsuario: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsuario = () => {
    try {
      const usuarioStr = localStorage.getItem('usuario');
      if (usuarioStr) {
        const usuarioData = JSON.parse(usuarioStr);
        setUsuario(usuarioData);
      } else {
        setUsuario(null);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      setUsuario(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUsuario();
  }, []);

  const tenantId = usuario?.tenant_id || null;
  const isAuthenticated = !!usuario && !!tenantId;

  return (
    <TenantContext.Provider
      value={{
        usuario,
        tenantId,
        isLoading,
        isAuthenticated,
        refreshUsuario
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider');
  }
  return context;
}
