import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabaseUntyped } from '@/integrations/supabase/client';

interface Usuario {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  tenant_id?: string;
  empresa?: string;
  allow_consultorios?: boolean;
  allow_crm_agendamentos?: boolean;
  allow_disparos_whatsapp?: boolean;
  allow_disparos_limpeza?: boolean;
  allow_disparos_clareamento?: boolean;
  allow_disparos_confirmacao?: boolean;
  allow_disparos_aniversario?: boolean;
  allow_disparos_campanha?: boolean;
  allow_disparos_manual?: boolean;
}

export interface TenantContextType {
  usuario: Usuario | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUsuario: () => void;
  permissions: {
    allowConsultorios: boolean;
    allowCrmAgendamentos: boolean;
    allowDisparosWhatsapp: boolean;
    allowDisparosLimpeza: boolean;
    allowDisparosClareamento: boolean;
    allowDisparosConfirmacao: boolean;
    allowDisparosAniversario: boolean;
    allowDisparosCampanha: boolean;
    allowDisparosManual: boolean;
  };
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sanitizeUsuario = (data: any): Usuario => ({
    id: data.id,
    email: data.email,
    nome: data.nome,
    cargo: data.cargo,
    tenant_id: data.tenant_id,
    empresa: data.empresa,
    allow_consultorios: data.allow_consultorios,
    allow_crm_agendamentos: data.allow_crm_agendamentos,
    allow_disparos_whatsapp: data.allow_disparos_whatsapp,
    allow_disparos_limpeza: data.allow_disparos_limpeza,
    allow_disparos_clareamento: data.allow_disparos_clareamento,
    allow_disparos_confirmacao: data.allow_disparos_confirmacao,
    allow_disparos_aniversario: data.allow_disparos_aniversario,
    allow_disparos_campanha: data.allow_disparos_campanha,
    allow_disparos_manual: data.allow_disparos_manual,
  });

  const refreshUsuario = useCallback(async () => {
    setIsLoading(true);
    try {
      const usuarioStr = localStorage.getItem('usuario');
      if (!usuarioStr) {
        setUsuario(null);
        return;
      }

      let usuarioData: Usuario = JSON.parse(usuarioStr);

      if (usuarioData?.id) {
        const { data, error } = await supabaseUntyped
          .from('usuarios')
          .select('*')
          .eq('id', usuarioData.id)
          .single();

        if (error) {
          console.error('Erro ao buscar usuário atualizado:', error);
        } else if (data) {
          usuarioData = sanitizeUsuario(data);
          localStorage.setItem('usuario', JSON.stringify(usuarioData));
        }
      }

      setUsuario(usuarioData);
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      setUsuario(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsuario();
  }, [refreshUsuario]);

  const tenantId = usuario?.tenant_id || null;
  const isAuthenticated = !!usuario && !!tenantId;
  const permissions = {
    allowConsultorios: usuario?.allow_consultorios ?? true,
    allowCrmAgendamentos: usuario?.allow_crm_agendamentos ?? true,
    allowDisparosWhatsapp: usuario?.allow_disparos_whatsapp ?? true,
    allowDisparosLimpeza: usuario?.allow_disparos_limpeza ?? true,
    allowDisparosClareamento: usuario?.allow_disparos_clareamento ?? true,
    allowDisparosConfirmacao: usuario?.allow_disparos_confirmacao ?? true,
    allowDisparosAniversario: usuario?.allow_disparos_aniversario ?? true,
    allowDisparosCampanha: usuario?.allow_disparos_campanha ?? true,
    allowDisparosManual: usuario?.allow_disparos_manual ?? true,
  };

  return (
    <TenantContext.Provider
      value={{
        usuario,
        tenantId,
        isLoading,
        isAuthenticated,
        refreshUsuario,
        permissions
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
