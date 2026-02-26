import { supabaseUntyped } from '@/integrations/supabase/client';

export async function setupTenantData(tenantId: string) {
  try {
    // Verificar se já existem consultórios para este tenant
    const { data: existingConsultorios, error: consultoriosError } = await supabaseUntyped
      .from('consultorios')
      .select('*')
      .eq('tenant_id', tenantId);

    if (consultoriosError) throw consultoriosError;

    // Se não tiver consultórios, criar os padrões
    if (!existingConsultorios || existingConsultorios.length === 0) {
      const consultoriosPadrao = [
        { nome: 'Consultório Principal', tenant_id: tenantId },
        { nome: 'Consultório Secundário', tenant_id: tenantId },
        { nome: 'Consultório de Emergência', tenant_id: tenantId },
        { nome: 'Consultório Especializado', tenant_id: tenantId }
      ];

      const { error: insertError } = await supabaseUntyped
        .from('consultorios')
        .insert(consultoriosPadrao);

      if (insertError) throw insertError;
      console.log('Consultórios padrão criados para o tenant:', tenantId);
    }

    // Verificar se já existem dentistas para este tenant
    const { data: existingDentistas, error: dentistasError } = await supabaseUntyped
      .from('dentistas')
      .select('*')
      .eq('tenant_id', tenantId);

    if (dentistasError) throw dentistasError;

    // Se não tiver dentistas, criar alguns exemplos
    if (!existingDentistas || existingDentistas.length === 0) {
      const dentistasPadrao = [
        { nome: 'Dr. João Silva', especialidade: 'Clínico Geral', tenant_id: tenantId },
        { nome: 'Dra. Maria Santos', especialidade: 'Ortodontia', tenant_id: tenantId },
        { nome: 'Dr. Pedro Oliveira', especialidade: 'Implantodontia', tenant_id: tenantId }
      ];

      const { error: insertDentistasError } = await supabaseUntyped
        .from('dentistas')
        .insert(dentistasPadrao);

      if (insertDentistasError) throw insertDentistasError;
      console.log('Dentistas padrão criados para o tenant:', tenantId);
    }

    return true;
  } catch (error) {
    console.error('Erro ao configurar tenant:', error);
    return false;
  }
}
