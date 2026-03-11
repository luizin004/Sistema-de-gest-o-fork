import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTenantId } from "@/utils/tenantUtils";
import { supabaseConfig, getFunctionUrl, getDefaultHeaders } from "@/config/supabase";

export interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  feedback: string | null;
  campanha_id: number | null;
  campanha_nome: string | null;
  agendamento_id: string | null;
  ultima_mensagem_at: string | null;
  nao_respondeu: boolean | null;
  tenant_id: string | null;
  bot_paused: boolean | null;
  bot_pause_reason: string | null;
}

export interface Arquivado {
  id: string;
  original_id: string;
  nome: string;
  status: string | null;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  feedback: string | null;
  campanha_id: number | null;
  campanha_nome: string | null;
  agendamento_id: string | null;
  ultima_mensagem_at: string | null;
  nao_respondeu: boolean | null;
  archived_at: string;
  archived_by: string | null;
  tenant_id: string | null;
}

export interface Agendamento {
  id: string;
  nome: string;
  horario: string | null;
  telefone: string | null;
  dentista: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  data: string | null;
  data_marcada: string | null;
  presenca: string | null;
  confirmado: boolean | null;
  source: string | null;
  tratamento: string | null;
  tenant_id: string | null;
}

export interface UazapiChatMessage {
  id: string;
  lead_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string | null;
  provider_id: string | null;
  message_type: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
}

export interface UazapiConfig {
  token: string | null;
  instance_id: string | null;
  phone_number: string | null;
}

export interface UazapiInstance {
  id: string;
  tenant_id: string;
  instance_id: string;
  token: string;
  name: string;
  profile_name: string;
  profile_pic_url: string;
  owner_phone: string;
  status: string;
  is_business: boolean;
  platform: string;
  system_name: string;
  current_presence: string;
  connected: boolean;
  jid: string;
  logged_in: boolean;
  last_disconnect: string;
  last_disconnect_reason: string;
  msg_delay_min: number;
  msg_delay_max: number;
  created_at: string;
  updated_at: string;
  last_status_check: string;
}

export const useCRMData = () => {
  const tenantId = getTenantId();
  
  // Função para obter o token JWT do usuário atual
  const getCurrentUserToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Erro ao obter token do usuário:', error);
      return null;
    }
  }, []);
  
  // Função para obter headers com autenticação
  const getAuthHeaders = useCallback(async () => {
    const token = await getCurrentUserToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } as Record<string, string>;
    }

    console.warn('[UAZAPI-INSTANCE-CONFIG] Nenhum token JWT disponível; usando cabeçalhos padrão (anon key)');
    const fallbackHeaders = { ...getDefaultHeaders() } as Record<string, string>;
    if (tenantId) {
      fallbackHeaders['x-tenant-id'] = tenantId;
    }
    return fallbackHeaders;
  }, [getCurrentUserToken, tenantId]);
  
  const fetchPosts = useCallback(async (): Promise<Post[]> => {
    if (!tenantId) return [];
    
    const { data, error } = await (supabase as any)
      .from('posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar posts:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const fetchArquivados = useCallback(async (): Promise<Arquivado[]> => {
    if (!tenantId) return [];
    
    const { data, error } = await (supabase as any)
      .from('arquivados')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('archived_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar arquivados:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const fetchAgendamentos = useCallback(async (): Promise<Agendamento[]> => {
    if (!tenantId) return [];
    
    const { data, error } = await (supabase as any)
      .from('agendamento')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const createPost = useCallback(async (post: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>): Promise<Post | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('posts')
      .insert({
        ...post,
        tenant_id: tenantId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar post:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const updatePost = useCallback(async (id: string, updates: Partial<Post>): Promise<Post | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar post:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const deletePost = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantId) return false;
    
    const { error } = await (supabase as any)
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    
    if (error) {
      console.error('Erro ao deletar post:', error);
      return false;
    }
    
    return true;
  }, [tenantId]);

  const createAgendamento = useCallback(async (agendamento: Omit<Agendamento, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>): Promise<Agendamento | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('agendamento')
      .insert({
        ...agendamento,
        tenant_id: tenantId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar agendamento:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const updateAgendamento = useCallback(async (id: string, updates: Partial<Agendamento>): Promise<Agendamento | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('agendamento')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar agendamento:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const archivePost = useCallback(async (post: Post, archivedBy: string): Promise<Arquivado | null> => {
    if (!tenantId) return null;
    
    // Criar entrada em arquivados
    const { data, error } = await (supabase as any)
      .from('arquivados')
      .insert({
        original_id: post.id,
        nome: post.nome,
        status: post.status,
        data: post.data,
        horario: post.horario,
        tratamento: post.tratamento,
        author_id: post.author_id,
        created_at: post.created_at,
        updated_at: post.updated_at,
        telefone: post.telefone,
        dentista: post.dentista,
        data_marcada: post.data_marcada,
        feedback: post.feedback,
        campanha_id: post.campanha_id,
        campanha_nome: post.campanha_nome,
        agendamento_id: post.agendamento_id,
        ultima_mensagem_at: post.ultima_mensagem_at,
        nao_respondeu: post.nao_respondeu,
        archived_by: archivedBy,
        tenant_id: tenantId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao arquivar post:', error);
      return null;
    }
    
    // Remover da tabela posts
    await deletePost(post.id);
    
    return data;
  }, [tenantId, deletePost]);

  // Funções UAZAPI multi-tenant
  const getUazapiConfig = useCallback(async (): Promise<UazapiConfig | null> => {
    if (!tenantId) return null;
    
    // Buscar configuração UAZAPI do usuário atual do tenant
    const { data: userData, error } = await (supabase as any)
      .from('usuarios')
      .select('uazapi_token, uazapi_instance_id, uazapi_phone_number')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .limit(1)
      .single();
    
    if (error || !userData) {
      console.error('Erro ao buscar configuração UAZAPI:', error);
      return null;
    }
    
    return {
      token: userData.uazapi_token,
      instance_id: userData.uazapi_instance_id,
      phone_number: userData.uazapi_phone_number
    };
  }, [tenantId]);

  const fetchMessages = useCallback(async (leadId?: string): Promise<UazapiChatMessage[]> => {
    if (!tenantId) return [];
    
    let query = (supabase as any)
      .from('uazapi_chat_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    
    if (leadId) {
      query = query.eq('lead_id', leadId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const fetchMessagesByPhone = useCallback(async (phoneNumber: string): Promise<UazapiChatMessage[]> => {
    if (!tenantId) return [];
    
    const { data, error } = await (supabase as any)
      .from('uazapi_chat_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar mensagens por telefone:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const fetchOutboundMessages = useCallback(async (
    startDate?: Date, 
    endDate?: Date
  ): Promise<UazapiChatMessage[]> => {
    if (!tenantId) return [];
    
    let query = (supabase as any)
      .from('uazapi_chat_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('direction', 'outbound')
      .eq('metadata->>wasSentByApi', 'false')
      .order('created_at', { ascending: true });
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar mensagens outbound:', error);
      return [];
    }
    
    return data || [];
  }, [tenantId]);

  const createMessage = useCallback(async (
    message: Omit<UazapiChatMessage, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>
  ): Promise<UazapiChatMessage | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('uazapi_chat_messages')
      .insert({
        ...message,
        tenant_id: tenantId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar mensagem:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const updateMessage = useCallback(async (
    id: string, 
    updates: Partial<UazapiChatMessage>
  ): Promise<UazapiChatMessage | null> => {
    if (!tenantId) return null;
    
    const { data, error } = await (supabase as any)
      .from('uazapi_chat_messages')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar mensagem:', error);
      return null;
    }
    
    return data;
  }, [tenantId]);

  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantId) return false;
    
    const { error } = await (supabase as any)
      .from('uazapi_chat_messages')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    
    if (error) {
      console.error('Erro ao deletar mensagem:', error);
      return false;
    }
    
    return true;
  }, [tenantId]);

  const sendMessage = useCallback(async (
    phoneNumber: string,
    content: string,
    messageType: string = 'text',
    mediaUrl?: string
  ): Promise<UazapiChatMessage | null> => {
    const config = await getUazapiConfig();
    if (!config || !config.token || !config.instance_id) {
      console.error('Configuração UAZAPI não encontrada');
      return null;
    }
    
    try {
      // Normalizar telefone
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const phoneWithDDI = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
      
      // Preparar payload para UAZAPI
      const payload = {
        phone_number: phoneWithDDI,
        message_type: messageType,
        content: content,
        media_url: mediaUrl || null
      };
      
      // Enviar para UAZAPI
      const response = await fetch(`https://api.uazapi.com/v1/${config.instance_id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Erro UAZAPI: ${response.status}`);
      }
      
      const uazapiResponse = await response.json();
      
      // Salvar mensagem no banco
      const message = await createMessage({
        lead_id: null,
        phone_number: phoneWithDDI,
        direction: 'outbound',
        content: content,
        media_url: mediaUrl,
        media_type: messageType === 'text' ? null : messageType,
        status: 'sent',
        provider_id: uazapiResponse.id || null,
        message_type: messageType,
        metadata: {
          wasSentByApi: true,
          uazapi_response: uazapiResponse,
          sent_at: new Date().toISOString()
        }
      });
      
      return message;
    } catch (error) {
      console.error('Erro ao enviar mensagem UAZAPI:', error);
      
      // Salvar mensagem com status de erro
      return await createMessage({
        lead_id: null,
        phone_number: phoneNumber,
        direction: 'outbound',
        content: content,
        media_url: mediaUrl,
        media_type: messageType === 'text' ? null : messageType,
        status: 'failed',
        provider_id: null,
        message_type: messageType,
        metadata: {
          wasSentByApi: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          failed_at: new Date().toISOString()
        }
      });
    }
  }, [getUazapiConfig, createMessage]);

  // Funções de configuração de instâncias UAZAPI
  const configureInstance = useCallback(async (token: string, targetTenantId?: string): Promise<UazapiInstance | null> => {
    const tenantToUse = targetTenantId || tenantId;
    if (!tenantToUse) return null;
    
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        console.warn('[UAZAPI-INSTANCE-CONFIG] Usuário não autenticado ao configurar instância');
        return null;
      }
      const response = await fetch(getFunctionUrl('uazapi-instance-config/configure'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, tenant_id: targetTenantId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Erro ao configurar instância:', error);
        return null;
      }
      
      const result = await response.json();
      return result.instance;
    } catch (error) {
      console.error('Erro ao configurar instância UAZAPI:', error);
      return null;
    }
  }, [tenantId, getAuthHeaders]);

  const getInstances = useCallback(async (targetTenantId?: string): Promise<UazapiInstance[]> => {
    const tenantToUse = targetTenantId || tenantId;
    if (!tenantToUse) return [];
    
    console.log(`[useCRMData] getInstances chamado com tenant: ${tenantToUse} (target: ${targetTenantId}, current: ${tenantId})`);
    
    try {
      const headers = await getAuthHeaders();
      // Se tiver um tenant específico, adiciona ao header
      if (targetTenantId) {
        headers['x-tenant-id'] = targetTenantId;
      }
      console.log(`[useCRMData] Headers:`, headers);
      const response = await fetch(getFunctionUrl('uazapi-instance-config/instances'), {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        // Se for 401, pode ser que não há instâncias ou usuário não autenticado
        if (response.status === 401) {
          console.log('[UAZAPI-INSTANCE-CONFIG] Nenhuma instância encontrada ou usuário não autenticado');
          return [];
        }
        
        const error = await response.json();
        console.error('Erro ao buscar instâncias:', error);
        return [];
      }
      
      const result = await response.json();
      const instances = result.instances || [];
      
      console.log(`[UAZAPI-INSTANCE-CONFIG] ${instances.length} instâncias encontradas para o tenant ${tenantToUse}`);
      console.log(`[UAZAPI-INSTANCE-CONFIG] Instâncias:`, instances);
      return instances;
    } catch (error) {
      console.error('Erro ao buscar instâncias UAZAPI:', error);
      return [];
    }
  }, [tenantId, getAuthHeaders]);

  const refreshInstanceStatus = useCallback(async (instanceId: string, targetTenantId?: string): Promise<UazapiInstance | null> => {
    const tenantToUse = targetTenantId || tenantId;
    if (!tenantToUse) return null;
    
    try {
      const headers = await getAuthHeaders();
      // Se tiver um tenant específico, adiciona ao header
      if (targetTenantId) {
        headers['x-tenant-id'] = targetTenantId;
      }
      if (!headers) {
        console.warn('[UAZAPI-INSTANCE-CONFIG] Usuário não autenticado ao atualizar instância');
        return null;
      }
      const response = await fetch(getFunctionUrl(`uazapi-instance-config/refresh/${instanceId}`), {
        method: 'PUT',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Erro ao atualizar status da instância:', error);
        return null;
      }
      
      const result = await response.json();
      return result.instance;
    } catch (error) {
      console.error('Erro ao atualizar status da instância UAZAPI:', error);
      return null;
    }
  }, [tenantId, getAuthHeaders]);

  const removeInstance = useCallback(async (instanceId: string, targetTenantId?: string): Promise<boolean> => {
    const tenantToUse = targetTenantId || tenantId;
    if (!tenantToUse) return false;
    
    try {
      const headers = await getAuthHeaders();
      // Se tiver um tenant específico, adiciona ao header
      if (targetTenantId) {
        headers['x-tenant-id'] = targetTenantId;
      }
      if (!headers) {
        console.warn('[UAZAPI-INSTANCE-CONFIG] Usuário não autenticado ao remover instância');
        return false;
      }
      const response = await fetch(getFunctionUrl(`uazapi-instance-config/${instanceId}`), {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Erro ao remover instância:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao remover instância UAZAPI:', error);
      return false;
    }
  }, [tenantId, getAuthHeaders]);
  
  return { 
    fetchPosts, 
    fetchArquivados, 
    fetchAgendamentos,
    createPost,
    updatePost,
    deletePost,
    createAgendamento,
    updateAgendamento,
    archivePost,
    // Funções UAZAPI
    getUazapiConfig,
    fetchMessages,
    fetchMessagesByPhone,
    fetchOutboundMessages,
    createMessage,
    updateMessage,
    deleteMessage,
    sendMessage,
    // Funções de configuração de instâncias
    configureInstance,
    getInstances,
    refreshInstanceStatus,
    removeInstance,
    tenantId 
  };
};
