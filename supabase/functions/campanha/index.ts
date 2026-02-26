import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações UAZAPI
const UAZAPI_CONFIG = {
  url: 'https://oralaligner.uazapi.com/send/text',
  token: 'fcd2612d-6b25-4c8f-aace-29df197301ff',
  delayBetweenMessages: 5000, // 5 segundos entre mensagens
  maxRetries: 3
}

// Função para enviar mensagem WhatsApp via UAZAPI
async function enviarMensagemWhatsApp(telefone: string, mensagem: string, retryCount = 0): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[${new Date().toISOString()}] [UAZAPI] 📱 Enviando mensagem para ${telefone} (tentativa ${retryCount + 1})`);
    
    // Limpar e formatar telefone - garantir DDI 55
    console.log(`[${new Date().toISOString()}] [UAZAPI] 📱 Telefone original: ${telefone}`);
    
    let telefoneLimpo = telefone.replace(/\D/g, ''); // Remove todos os não-dígitos
    
    // Remover zeros à esquerda (ex: 011, 021, etc)
    telefoneLimpo = telefoneLimpo.replace(/^0+/, '');
    
    // Garantir que comece com 55 (DDI Brasil)
    if (!telefoneLimpo.startsWith('55')) {
      telefoneLimpo = `55${telefoneLimpo}`;
    }
    
    // Validar formato brasileiro (55 + DDD + número)
    if (telefoneLimpo.length < 12) {
      console.warn(`[${new Date().toISOString()}] [UAZAPI] ⚠️ Telefone muito curto: ${telefoneLimpo}`);
    }
    
    const telefoneCompleto = telefoneLimpo;
    console.log(`[${new Date().toISOString()}] [UAZAPI] 📱 Telefone formatado: ${telefoneCompleto}`);
    
    // Preparar payload para UAZAPI (formato correto)
    const payload = {
      number: telefoneCompleto,
      text: mensagem
    };

    console.log(`[${new Date().toISOString()}] [UAZAPI] 📤 Payload:`, JSON.stringify(payload, null, 2));

    // Fazer requisição para UAZAPI com headers corretos
    const response = await fetch(UAZAPI_CONFIG.url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': UAZAPI_CONFIG.token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro UAZAPI: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log(`[${new Date().toISOString()}] [UAZAPI] ✅ Mensagem enviada com sucesso:`, JSON.stringify(result, null, 2));
    
    // Delay entre mensagens para evitar bloqueio
    if (retryCount === 0) {
      console.log(`[${new Date().toISOString()}] [UAZAPI] ⏱️ Aguardando ${UAZAPI_CONFIG.delayBetweenMessages}ms antes da próxima mensagem...`);
      await new Promise(resolve => setTimeout(resolve, UAZAPI_CONFIG.delayBetweenMessages));
    }

    return { success: true };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [UAZAPI] ❌ Erro ao enviar mensagem:`, (error as Error).message);
    
    // Retry logic
    if (retryCount < UAZAPI_CONFIG.maxRetries) {
      console.log(`[${new Date().toISOString()}] [UAZAPI] 🔄 Tentando novamente em ${(retryCount + 1) * 2000}ms...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return enviarMensagemWhatsApp(telefone, mensagem, retryCount + 1);
    }

    return { success: false, error: (error as Error).message };
  }
}

// Função para personalizar mensagem com dados do lead
function personalizarMensagem(template: string, lead: any): string {
  let mensagem = template;
  
  // Substituir variáveis
  mensagem = mensagem.replace(/{nome}/gi, lead.nome || 'Cliente');
  mensagem = mensagem.replace(/{telefone}/gi, lead.telefone || '');
  mensagem = mensagem.replace(/{idade}/gi, lead.idade?.toString() || '');
  mensagem = mensagem.replace(/{empresa}/gi, lead.empresa || '');
  mensagem = mensagem.replace(/{funcao}/gi, lead.funcao || '');
  mensagem = mensagem.replace(/{instagram}/gi, lead.instagram || '');
  
  // Substituir variáveis do extras
  if (lead.extras) {
    Object.keys(lead.extras).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'gi');
      mensagem = mensagem.replace(regex, lead.extras[key]?.toString() || '');
    });
  }
  
  return mensagem;
}

// Função para buscar campanha ativa pelo ID
async function buscarCampanhaAtiva(supabase: any, campaignId: string): Promise<{ id: string; nome: string; mensagem: string; status: string } | null> {
  try {
    console.log(`[${new Date().toISOString()}] [CAMPAIGN] 🔍 Buscando campanha ativa: ${campaignId}`);
    
    const { data: campanha, error } = await supabase
      .from('campanhas')
      .select('id, nome, mensagem, status')
      .eq('id', campaignId)
      .eq('status', 'ativa')
      .single();

    if (error) {
      console.log(`[${new Date().toISOString()}] [CAMPAIGN] ❌ Campanha não encontrada ou inativa: ${campaignId}`);
      return null;
    }

    console.log(`[${new Date().toISOString()}] [CAMPAIGN] ✅ Campanha encontrada:`, JSON.stringify(campanha, null, 2));
    return campanha;

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [CAMPAIGN] ❌ Erro ao buscar campanha:`, (error as Error).message);
    return null;
  }
}

// Função para atualizar status de disparo no lead
async function atualizarStatusDisparo(supabase: any, leadId: number, sucesso: boolean): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [DATABASE] 📝 Atualizando status disparo do lead ${leadId} para ${sucesso}`);
    
    const { error } = await supabase
      .from('tabela_campanha')
      .update({ 
        disparo_feito: sucesso,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', leadId);

    if (error) {
      console.error(`[${new Date().toISOString()}] [DATABASE] ❌ Erro ao atualizar disparo:`, error);
    } else {
      console.log(`[${new Date().toISOString()}] [DATABASE] ✅ Status atualizado com sucesso`);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [DATABASE] ❌ Erro ao atualizar status:`, (error as Error).message);
  }
}

// Função para testar formatação de telefones
function testarFormatacaoTelefone() {
  console.log(`[${new Date().toISOString()}] [TESTE] 🧪 Testando formatação de telefones:`);
  
  const testes = [
    '31987654321',      // Apenas número
    '(31) 98765-4321',  // Com parênteses e hífen
    '31 98765 4321',    // Com espaços
    '+55 31 98765-4321', // Com DDI +
    '5531987654321',    // Com DDI sem +
    '031987654321',     // Com zero na frente
    '(031) 98765-4321', // Com zero e formatação
    '987654321',        // Apenas celular (sem DDD)
    '3198765432',       // Fixo
  ];
  
  testes.forEach(telefone => {
    let telefoneLimpo = telefone.replace(/\D/g, '');
    telefoneLimpo = telefoneLimpo.replace(/^0+/, '');
    
    if (!telefoneLimpo.startsWith('55')) {
      telefoneLimpo = `55${telefoneLimpo}`;
    }
    
    console.log(`  ${telefone} → ${telefoneLimpo}`);
  });
}

// Função principal de disparo automático
async function processarDisparoAutomatico(supabase: any, lead: any): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [DISPARO] 🚀 Iniciando processo de disparo para lead ${lead.id}`);
    
    // VERIFICAÇÃO DE DUPLICATA - Se o ID é null ou 0, pode ser problema de sequence
    if (!lead.id || lead.id === 0) {
      console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Lead com ID inválido: ${lead.id} - possível problema de sequence`);
      
      // Tentar buscar lead pelo telefone e campanha
      const { data: existingLead } = await supabase
        .from('tabela_campanha')
        .select('*')
        .eq('telefone', lead.telefone)
        .eq('ID_campanha', lead.ID_campanha)
        .single();
      
      if (existingLead) {
        console.log(`[${new Date().toISOString()}] [DISPARO] ✅ Lead já existe com ID ${existingLead.id} - usando registro existente`);
        lead = existingLead; // Usar o lead existente
      } else {
        console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Lead não encontrado e ID inválido - ignorando`);
        return;
      }
    }
    
    // 1. Verificar se já foi feito o disparo
    if (lead.disparo_feito === true) {
      console.log(`[${new Date().toISOString()}] [DISPARO] ✅ Disparo já realizado para lead ${lead.id} - ignorando`);
      return;
    }

    // 2. Verificar se tem ID_campanha
    if (!lead.ID_campanha) {
      console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Lead ${lead.id} não possui ID_campanha - ignorando`);
      return;
    }

    // 3. Verificar se tem telefone
    if (!lead.telefone) {
      console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Lead ${lead.id} não possui telefone - ignorando`);
      await atualizarStatusDisparo(supabase, lead.id, false);
      return;
    }

    // 4. Buscar campanha ativa
    const campanha = await buscarCampanhaAtiva(supabase, lead.ID_campanha);
    if (!campanha) {
      console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Campanha ${lead.ID_campanha} não encontrada ou inativa`);
      await atualizarStatusDisparo(supabase, lead.id, false);
      return;
    }

    // 5. Personalizar mensagem
    const mensagemPersonalizada = personalizarMensagem(campanha.mensagem, lead);
    console.log(`[${new Date().toISOString()}] [DISPARO] 📝 Mensagem personalizada:`, mensagemPersonalizada);

    // 6. Enviar mensagem WhatsApp
    const resultado = await enviarMensagemWhatsApp(lead.telefone, mensagemPersonalizada);
    
    if (resultado.success) {
      console.log(`[${new Date().toISOString()}] [DISPARO] 🎉 Disparo realizado com sucesso para lead ${lead.id}`);
      await atualizarStatusDisparo(supabase, lead.id, true);
    } else {
      console.log(`[${new Date().toISOString()}] [DISPARO] ❌ Falha no disparo para lead ${lead.id}:`, resultado.error);
      await atualizarStatusDisparo(supabase, lead.id, false);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [DISPARO] ❌ Erro no processo de disparo:`, (error as Error).message);
    // Tentar atualizar status se tiver ID válido
    if (lead && lead.id && lead.id > 0) {
      await atualizarStatusDisparo(supabase, lead.id, false);
    }
  }
}

serve(async (req) => {
  // Log inicial da requisição
  console.log(`[${new Date().toISOString()}] [campanha] Nova requisição recebida`);
  console.log(`[${new Date().toISOString()}] [campanha] Método: ${req.method}`);
  console.log(`[${new Date().toISOString()}] [campanha] URL: ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log(`[${new Date().toISOString()}] [campanha] Requisição OPTIONS - Retornando CORS`);
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { method } = req
    const url = new URL(req.url)

    // Processar webhook
    if (method === 'POST' && url.pathname === '/webhook') {
      console.log(`[${new Date().toISOString()}] [campanha] 🎯 WEBHOOK RECEBIDO - Processando...`);
      
      let body: any;
      try {
        const bodyRaw = await req.text();
        if (bodyRaw) {
          body = JSON.parse(bodyRaw);
          console.log(`[${new Date().toISOString()}] [campanha] Body parseado com sucesso:`, JSON.stringify(body, null, 2));
        }
      } catch (parseError) {
        console.log(`[${new Date().toISOString()}] [campanha] Erro ao fazer parse do body:`, (parseError as Error).message);
      }

      if (body && body.type === 'INSERT' && body.table === 'tabela_campanha') {
        const record = body.record;
        console.log(`[${new Date().toISOString()}] [campanha] ✨ NOVA LINHA ADICIONADA NA TABELA`);
        console.log(`[${new Date().toISOString()}] [campanha] 📋 Registro: ${record.nome || 'Sem nome'} (ID: ${record.id || 'Sem ID'})`);
        console.log(`[${new Date().toISOString()}] [campanha] 🎯 Campanha: ${record.ID_campanha || 'Sem campanha'}`);
        
        // INICIAR DISPARO AUTOMÁTICO
        console.log(`[${new Date().toISOString()}] [campanha] 🚀 INICIANDO DISPARO AUTOMÁTICO VIA UAZAPI`);
        
        // Processar disparo automático
        await processarDisparoAutomatico(supabase, record);
        
        console.log(`[${new Date().toISOString()}] [campanha] ✅ PROCESSO DE DISPARO CONCLUÍDO`);
      }

      const responseData = {
        success: true,
        message: "Webhook processado - Disparo automático via UAZAPI",
        receptor_info: {
          programa: "Edge Function Supabase com UAZAPI",
          status: "Processando webhook e realizando disparos automáticos",
          fluxo: "Banco → Webhook → Edge Function → UAZAPI → WhatsApp"
        }
      };

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Endpoint de teste
    if (method === 'GET' && url.pathname === '/test') {
      console.log(`[${new Date().toISOString()}] [campanha] 🧪 ENDPOINT DE TESTE ACIONADO`);
      
      const testPayload = {
        id: 999,
        nome: "Cliente Teste UAZAPI",
        telefone: "553181036689",
        instagram: "@cliente_teste",
        idade: 30,
        funcao: "Gerente",
        empresa: "Empresa Teste",
        ID_campanha: "empresas",
        disparo_feito: null,
        extras: {
          preferencias: ['email', 'whatsapp'],
          score: 85,
          tags: ['vip', 'prioritario'],
          observacoes: 'Cliente especial para teste UAZAPI'
        },
        criado_em: new Date().toISOString()
      };

      console.log(`[${new Date().toISOString()}] [campanha] 📤 ENVIANDO TESTE VIA UAZAPI...`);
      
      // Processar disparo automático
      await processarDisparoAutomatico(supabase, testPayload);

      const responseData = {
        success: true,
        message: "Teste de disparo UAZAPI processado",
        receptor_info: {
          programa: "Edge Function Supabase com UAZAPI",
          status: "Teste de disparo automático realizado",
          fluxo: "Teste → Edge Function → UAZAPI → WhatsApp"
        },
        test_info: {
          payload_enviado: testPayload,
          timestamp: new Date().toISOString()
        }
      };

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Endpoint para testar formatação de telefones
    if (url.pathname === '/test-phone') {
      console.log(`[${new Date().toISOString()}] [campanha] 🧪 TESTANDO FORMATAÇÃO DE TELEFONES...`);
      
      testarFormatacaoTelefone();
      
      const responseData = {
        success: true,
        message: "Teste de formatação de telefones realizado",
        test_results: {
          description: "Todos os formatos de telefone são convertidos para padrão +55 (DDI Brasil)",
          examples: [
            "31987654321 → 5531987654321",
            "(31) 98765-4321 → 5531987654321", 
            "+55 31 98765-4321 → 5531987654321",
            "031987654321 → 5531987654321",
            "987654321 → 55987654321"
          ],
          timestamp: new Date().toISOString()
        }
      };

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Endpoint padrão
    return new Response(JSON.stringify({ 
      message: "Webhook de campanha com UAZAPI ativo",
      endpoints: {
        webhook: "POST /webhook - Recebe dados da tabela_campanha",
        test: "GET /test - Testa disparo via UAZAPI",
        test_phone: "GET /test-phone - Testa formatação de telefones"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [campanha] ❌ ERRO FATAL:`, (error as Error).message);
    
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
      details: 'Erro interno no servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
