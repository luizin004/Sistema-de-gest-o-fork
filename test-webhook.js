// Test script para webhook UAZAPI
// Substitua SEU_PROJECT_ID pelo ID real do seu projeto Supabase

const webhookUrl = "https://SEU_PROJECT_ID.supabase.co/functions/v1/uazapi-chat";

const testPayload = {
  from: "5531999999999",
  to: "553181036689", 
  message: "Mensagem de teste via webhook",
  messageId: "test_" + Date.now(),
  type: "text",
  wasSentByApi: false,
  timestamp: new Date().toISOString()
};

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload)
})
.then(response => response.json())
.then(data => {
  console.log('Webhook response:', data);
})
.catch(error => {
  console.error('Webhook error:', error);
});

// Para testar localmente:
// 1. Substitua SEU_PROJECT_ID
// 2. Execute: node test-webhook.js
// 3. Verifique se aparece na tabela uazapi_chat_messages
