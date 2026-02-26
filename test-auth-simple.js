// Script simples para testar autenticação via API direta
console.log("🔍 Teste Simples de Autenticação");

async function testAuth() {
  try {
    // Testar login direto na API Supabase
    console.log("🧪 Testando login...");
    
    const loginResponse = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZXNjYWxjbW1oaGx6c21nZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTgwMTIsImV4cCI6MjA4NzY5NDAxMn0.8Mi6u5wI9jbRIyxubba13JdTj8qCd2u48vLdA1SFSho'
      },
      body: JSON.stringify({
        email: 'admin@sistema.com',
        password: 'admin123'
      })
    });
    
    console.log(`📊 Status Login: ${loginResponse.status}`);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log("✅ Login bem-sucedido!");
      console.log("📋 Token:", loginData.access_token ? "Presente" : "Ausente");
      console.log("📋 User ID:", loginData.user?.id);
      console.log("📋 Email:", loginData.user?.email);
      
      // Agora testar a Edge Function com o token obtido
      console.log("\n🧪 Testando Edge Function com token...");
      
      const edgeResponse = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/uazapi-instance-config/instances', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📊 Status Edge Function: ${edgeResponse.status}`);
      
      if (edgeResponse.ok) {
        const edgeData = await edgeResponse.json();
        console.log("✅ Edge Function funcionou!");
        console.log("📋 Resposta:", edgeData);
      } else {
        const edgeError = await edgeResponse.text();
        console.log("❌ Edge Function falhou:");
        console.log("📋 Erro:", edgeError);
      }
      
    } else {
      const loginError = await loginResponse.text();
      console.log("❌ Login falhou:");
      console.log("📋 Erro:", loginError);
    }
    
  } catch (error) {
    console.error("💥 Erro no teste:", error);
  }
}

// Testar com diferentes usuários
async function testMultipleUsers() {
  const users = [
    { email: 'admin@sistema.com', password: 'admin123' },
    { email: 'lamoriaoficial@gmail.com', password: '123456' },
    { email: 'usuario2@sistema.com', password: '123456' }
  ];
  
  for (const user of users) {
    console.log(`\n🧪 Testando usuário: ${user.email}`);
    
    try {
      const response = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZXNjYWxjbW1oaGx6c21nZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTgwMTIsImV4cCI6MjA4NzY5NDAxMn0.8Mi6u5wI9jbRIyxubba13JdTj8qCd2u48vLdA1SFSho'
        },
        body: JSON.stringify(user)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${user.email}: Login OK`);
        
        // Testar Edge Function
        const edgeResponse = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/uazapi-instance-config/instances', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`📊 Edge Function: ${edgeResponse.status}`);
        
        if (edgeResponse.ok) {
          const edgeData = await edgeResponse.json();
          console.log(`✅ ${user.email}: Edge Function OK (${edgeData.instances?.length || 0} instâncias)`);
        } else {
          const edgeError = await edgeResponse.text();
          console.log(`❌ ${user.email}: Edge Function falhou - ${edgeError}`);
        }
      } else {
        const error = await response.text();
        console.log(`❌ ${user.email}: Login falhou - ${error}`);
      }
    } catch (error) {
      console.log(`💥 ${user.email}: Erro - ${error.message}`);
    }
  }
}

// Executar testes
console.log("🚀 Iniciando testes de autenticação...");
console.log("=" * 50);

testAuth().then(() => {
  console.log("\n" + "=" * 50);
  return testMultipleUsers();
}).then(() => {
  console.log("\n🏁 Testes concluídos!");
  console.log("\n📋 Diagnóstico:");
  console.log("1. Se login funcionar mas Edge Function falhou: problema na API");
  console.log("2. Se ambos falharem: problema de credenciais");
  console.log("3. Se ambos funcionarem: problema no frontend");
}).catch(console.error);
