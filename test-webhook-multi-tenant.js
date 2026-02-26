// Test script para webhook UAZAPI multi-tenant
// Substitua SEU_PROJECT_ID pelo ID real do seu projeto Supabase

const webhookUrl = "https://SEU_PROJECT_ID.supabase.co/functions/v1/uazapi-chat";

// Metadata rico simulando webhook real UAZAPI
const testPayload = {
  id: "553172435580:A57B26816C2FAF98E8E8CAF300A03DBF",
  chat: {
    id: "refb893c034e582",
    name: "Vani Alves",
    image: "",
    owner: "553172435580",
    phone: "+55 31 9652-9826",  // 🎯 Telefone principal
    wa_name: "Vani Alves",
    wa_label: [
      "553172435580:30",
      "553172435580:27",
      "553172435580:8"
    ],
    lead_name: "",
    lead_tags: [],
    wa_chatid: "553196529826@s.whatsapp.net",  // 🎯 Fonte alternativa
    wa_fastid: "553172435580:553196529826",  // 🎯 Fonte alternativa
    wa_isGroup: false,
    wa_archived: false,
    wa_isPinned: false,
    wa_unreadCount: 2,
    wa_lastMessageType: "ContactMessage",
    wa_lastMessageText: "Oraldents Brumadinho",
    wa_isBlocked: false
  },
  text: "Olá! Gostaria de agendar uma consulta.",
  type: "text",
  fromMe: false,  // 🎯 Direção: inbound
  messageid: "A57B26816C2FAF98E8E8CAF300A03DBF",
  messageType: "text",
  senderName: "Vani Alves",
  phone: "+55 31 9652-9826",  // 🎯 Telefone repetido
  timestamp: new Date().toISOString(),
  wasSentByApi: false
};

// Teste de mensagem outbound
const outboundPayload = {
  id: "553172435580:B57B26816C2FAF98E8E8CAF300A03DBF",
  chat: {
    id: "refb893c034e582",
    name: "João Silva",
    phone: "+55 31 9876-5432",
    wa_chatid: "553198765432@s.whatsapp.net",
    wa_fastid: "553172435580:553198765432",
    wa_isGroup: false
  },
  text: "Sua consulta foi confirmada para amanhã às 14h.",
  type: "text",
  fromMe: true,  // 🎯 Direção: outbound
  messageid: "B57B26816C2FAF98E8E8CAF300A03DBF",
  messageType: "text",
  senderName: "Oral Dents de Brumadinho",
  phone: "+55 31 9876-5432",
  timestamp: new Date().toISOString(),
  wasSentByApi: true
};

// Função para testar webhook
async function testWebhook(payload, description) {
  console.log(`\n🧪 Testando: ${description}`);
  console.log("📤 Payload:", JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'uazapiGO-Webhook/1.0'  // 🎯 Simular webhook UAZAPI
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log("✅ Sucesso!");
    } else {
      console.log("❌ Erro:", response.status);
    }
    
    return result;
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return null;
  }
}

// Testar CRM send action
async function testCrmSend() {
  console.log("\n🧪 Testando: CRM Send Action");
  
  const crmPayload = {
    action: "send",
    leadId: "lead-id-existente",  // Substitua por um lead ID real
    message: "Mensagem de teste via CRM",
    tempId: "temp-" + Date.now()
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer SEU_ANON_KEY'  // Substitua por chave real
      },
      body: JSON.stringify(crmPayload)
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error("💥 Erro na requisição CRM:", error);
    return null;
  }
}

// Executar testes
async function runTests() {
  console.log("🚀 Iniciando testes do webhook multi-tenant UAZAPI");
  
  // Teste 1: Mensagem inbound
  await testWebhook(testPayload, "Mensagem Inbound (Cliente → Empresa)");
  
  // Teste 2: Mensagem outbound  
  await testWebhook(outboundPayload, "Mensagem Outbound (Empresa → Cliente)");
  
  // Teste 3: CRM Send
  await testCrmSend();
  
  console.log("\n🏁 Testes concluídos!");
  console.log("\n📋 Verificações manuais:");
  console.log("1. Verifique se as mensagens aparecem na tabela uazapi_chat_messages");
  console.log("2. Confirme se tenant_id foi preenchido corretamente");
  console.log("3. Verifique se o cache está funcionando (mensagens repetidas)");
  console.log("4. Teste com telefones que não existem no sistema");
  console.log("5. Monitore os logs da Edge Function");
}

// Executar
runTests().catch(console.error);
