import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface UazapiInstanceData {
  instance: {
    id: string;
    token: string;
    status: string;
    paircode: string;
    qrcode: string;
    name: string;
    profileName: string;
    profilePicUrl: string;
    isBusiness: boolean;
    plataform: string;
    systemName: string;
    owner: string;
    current_presence: string;
    lastDisconnect: string;
    lastDisconnectReason: string;
    adminField01: string;
    adminField02: string;
    openai_apikey: string;
    chatbot_enabled: boolean;
    chatbot_ignoreGroups: boolean;
    chatbot_stopConversation: string;
    chatbot_stopMinutes: number;
    chatbot_stopWhenYouSendMsg: number;
    created: string;
    updated: string;
    currentTime: string;
    msg_delay_min: number;
    msg_delay_max: number;
  };
  status: {
    connected: boolean;
    jid: string;
    loggedIn: boolean;
  };
}

interface UazapiInstance {
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

// Criar cliente Supabase com permissões de serviço
function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Validar token com API UAZAPI
async function validateTokenWithUazapi(token: string): Promise<UazapiInstanceData> {
  console.log("[UAZAPI-INSTANCE-CONFIG] Validating token with UAZAPI API");
  
  const response = await fetch('https://oralaligner.uazapi.com/instance/status', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'token': token
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[UAZAPI-INSTANCE-CONFIG] Token validation failed: ${response.status} - ${errorText}`);
    throw new Error(`Invalid token: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log("[UAZAPI-INSTANCE-CONFIG] Token validated successfully");
  return data;
}

// Salvar instância no banco
async function saveInstance(supabase: ReturnType<typeof createClient>, instanceData: UazapiInstanceData, tenantId: string): Promise<UazapiInstance> {
  console.log(`[UAZAPI-INSTANCE-CONFIG] Saving instance ${instanceData.instance.id} for tenant ${tenantId}`);
  
  const instance = {
    tenant_id: tenantId,
    instance_id: instanceData.instance.id,
    token: instanceData.instance.token,
    name: instanceData.instance.name,
    profile_name: instanceData.instance.profileName,
    profile_pic_url: instanceData.instance.profilePicUrl,
    owner_phone: instanceData.instance.owner,
    status: instanceData.instance.status,
    is_business: instanceData.instance.isBusiness,
    platform: instanceData.instance.plataform,
    system_name: instanceData.instance.systemName,
    current_presence: instanceData.instance.current_presence,
    connected: instanceData.status.connected,
    jid: instanceData.status.jid,
    logged_in: instanceData.status.loggedIn,
    last_disconnect: instanceData.instance.lastDisconnect || null,
    last_disconnect_reason: instanceData.instance.lastDisconnectReason || null,
    msg_delay_min: instanceData.instance.msg_delay_min,
    msg_delay_max: instanceData.instance.msg_delay_max,
    last_status_check: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('uazapi_instances')
    .upsert(instance, {
      onConflict: 'tenant_id,instance_id',
      returning: '*'
    })
    .select()
    .single();
  
  if (error) {
    console.error("[UAZAPI-INSTANCE-CONFIG] Error saving instance:", error);
    throw new Error(`Failed to save instance: ${error.message}`);
  }
  
  console.log(`[UAZAPI-INSTANCE-CONFIG] Instance saved successfully: ${data.id}`);
  return data;
}

// Configurar nova instância
async function configureInstance(token: string, tenantId: string): Promise<UazapiInstance> {
  console.log(`[UAZAPI-INSTANCE-CONFIG] Configuring instance for tenant ${tenantId}`);
  
  try {
    // 1. Validar token com UAZAPI
    const instanceData = await validateTokenWithUazapi(token);
    
    // 2. Salvar no banco
    const supabase = createServiceClient();
    const instance = await saveInstance(supabase, instanceData, tenantId);
    
    return instance;
  } catch (error) {
    console.error("[UAZAPI-INSTANCE-CONFIG] Failed to configure instance:", error);
    throw error;
  }
}

// Buscar instâncias do tenant
async function getInstances(tenantId: string): Promise<UazapiInstance[]> {
  console.log(`[UAZAPI-INSTANCE-CONFIG] Fetching instances for tenant ${tenantId}`);
  
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('uazapi_instances')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("[UAZAPI-INSTANCE-CONFIG] Error fetching instances:", error);
    throw new Error(`Failed to fetch instances: ${error.message}`);
  }
  
  return data || [];
}

// Atualizar status da instância
async function refreshInstanceStatus(instanceId: string, tenantId: string): Promise<UazapiInstance> {
  console.log(`[UAZAPI-INSTANCE-CONFIG] Refreshing status for instance ${instanceId}`);
  
  const supabase = createServiceClient();
  
  // 1. Buscar instância atual
  const { data: currentInstance, error: fetchError } = await supabase
    .from('uazapi_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .single();
  
  if (fetchError || !currentInstance) {
    throw new Error('Instance not found');
  }
  
  // 2. Validar token e buscar status atual
  const instanceData = await validateTokenWithUazapi(currentInstance.token);
  
  // 3. Atualizar no banco
  const updatedInstance = await saveInstance(supabase, instanceData, tenantId);
  
  return updatedInstance;
}

// Remover instância
async function removeInstance(instanceId: string, tenantId: string): Promise<void> {
  console.log(`[UAZAPI-INSTANCE-CONFIG] Removing instance ${instanceId}`);
  
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('uazapi_instances')
    .delete()
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);
  
  if (error) {
    console.error("[UAZAPI-INSTANCE-CONFIG] Error removing instance:", error);
    throw new Error(`Failed to remove instance: ${error.message}`);
  }
  
  console.log(`[UAZAPI-INSTANCE-CONFIG] Instance removed successfully`);
}

// Obter tenant_id do usuário a partir do JWT
async function getTenantFromRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = createServiceClient();
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid user token');
  }
  
  // Buscar tenant_id do usuário
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  
  if (userError || !userData?.tenant_id) {
    throw new Error('User tenant not found');
  }
  
  return userData.tenant_id;
}

// Manipular requisições POST para configurar instância
async function handleConfigure(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { token } = body;
    
    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Token is required and must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const tenantId = await getTenantFromRequest(req);
    const instance = await configureInstance(token, tenantId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        instance: {
          id: instance.id,
          instance_id: instance.instance_id,
          name: instance.name,
          profile_name: instance.profile_name,
          status: instance.status,
          connected: instance.connected,
          owner_phone: instance.owner_phone,
          created_at: instance.created_at,
          updated_at: instance.updated_at
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UAZAPI-INSTANCE-CONFIG] Configure error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to configure instance' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Manipular requisições GET para listar instâncias
async function handleList(req: Request): Promise<Response> {
  try {
    const tenantId = await getTenantFromRequest(req);
    const instances = await getInstances(tenantId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        instances: instances.map(instance => ({
          id: instance.id,
          instance_id: instance.instance_id,
          name: instance.name,
          profile_name: instance.profile_name,
          status: instance.status,
          connected: instance.connected,
          owner_phone: instance.owner_phone,
          created_at: instance.created_at,
          updated_at: instance.updated_at,
          last_status_check: instance.last_status_check
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UAZAPI-INSTANCE-CONFIG] List error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to list instances' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Manipular requisições PUT para atualizar status
async function handleRefresh(req: Request, instanceId: string): Promise<Response> {
  try {
    const tenantId = await getTenantFromRequest(req);
    const instance = await refreshInstanceStatus(instanceId, tenantId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        instance: {
          id: instance.id,
          instance_id: instance.instance_id,
          name: instance.name,
          profile_name: instance.profile_name,
          status: instance.status,
          connected: instance.connected,
          owner_phone: instance.owner_phone,
          updated_at: instance.updated_at,
          last_status_check: instance.last_status_check
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UAZAPI-INSTANCE-CONFIG] Refresh error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to refresh instance' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Manipular requisições DELETE para remover instância
async function handleRemove(req: Request, instanceId: string): Promise<Response> {
  try {
    const tenantId = await getTenantFromRequest(req);
    await removeInstance(instanceId, tenantId);
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UAZAPI-INSTANCE-CONFIG] Remove error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to remove instance' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

serve(async (req: Request) => {
  // CORS - Lidar com requisições preflight primeiro
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  const url = new URL(req.url);
  const path = url.pathname;
  
  console.log(`[UAZAPI-INSTANCE-CONFIG] ${req.method} ${path}`);
  
  try {
    // Rotas da API
    if (req.method === 'POST' && path.endsWith('/configure')) {
      return await handleConfigure(req);
    }
    
    if (req.method === 'GET' && path.endsWith('/instances')) {
      return await handleList(req);
    }
    
    if (req.method === 'PUT' && path.match(/\/refresh\/[^\/]+$/)) {
      const instanceId = path.split('/refresh/')[1];
      return await handleRefresh(req, instanceId);
    }
    
    if (req.method === 'DELETE' && path.match(/\/[^\/]+$/)) {
      const instanceId = path.split('/').pop()!;
      return await handleRemove(req, instanceId);
    }
    
    // Rota não encontrada
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { 
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('[UAZAPI-INSTANCE-CONFIG] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
