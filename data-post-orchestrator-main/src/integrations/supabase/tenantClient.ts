import { supabase, supabaseUntyped } from './client';
import { useTenant } from '@/hooks/useTenant';

export function useTenantQuery() {
  const { tenantId, isAuthenticated } = useTenant();

  // Cliente Supabase com filtros de tenant para tabelas tipadas
  const tenantSupabase = {
    from: (table: string) => {
      const query = supabase.from(table as any);
      
      if (!isAuthenticated || !tenantId) {
        // Se não estiver autenticado, retorna query que não retornará dados
        return query.eq('tenant_id', 'invalid-tenant-id');
      }
      
      return query.eq('tenant_id', tenantId);
    }
  };

  // Cliente Supabase sem tipagem com filtros de tenant
  const tenantSupabaseUntyped = {
    from: (table: string) => {
      const query = supabaseUntyped.from(table);
      
      if (!isAuthenticated || !tenantId) {
        // Se não estiver autenticado, retorna query que não retornará dados
        return query.eq('tenant_id', 'invalid-tenant-id');
      }
      
      return query.eq('tenant_id', tenantId);
    }
  };

  return {
    tenantSupabase,
    tenantSupabaseUntyped,
    tenantId,
    isAuthenticated
  };
}
