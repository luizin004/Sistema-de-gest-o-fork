// Script para testar correção de CORS na Edge Function
const SUPABASE_URL = "https://itescalcmmhhlzsmgdfv.supabase.co";
const FUNCTION_NAME = "uazapi-instance-config";

async function testCORS() {
  console.log("🧪 Testando CORS para Edge Function...");
  
  try {
    // Test 1: Requisição OPTIONS (preflight)
    console.log("\n1. Testando requisição OPTIONS...");
    const optionsResponse = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}/instances`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8093',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization, content-type'
      }
    });
    
    console.log(`Status OPTIONS: ${optionsResponse.status}`);
    console.log("Headers OPTIONS:", Object.fromEntries(optionsResponse.headers.entries()));
    
    if (optionsResponse.ok) {
      console.log("✅ OPTIONS funcionando!");
    } else {
      console.log("❌ OPTIONS falhou");
      const errorText = await optionsResponse.text();
      console.log("Erro:", errorText);
      return;
    }
    
    // Test 2: Requisição GET real
    console.log("\n2. Testando requisição GET...");
    const getResponse = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}/instances`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status GET: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const result = await getResponse.json();
      console.log("✅ GET funcionando!");
      console.log("Resposta:", result);
    } else {
      console.log("❌ GET falhou");
      const errorText = await getResponse.text();
      console.log("Erro:", errorText);
    }
    
    // Test 3: Verificar headers CORS na resposta
    console.log("\n3. Verificando headers CORS na resposta GET...");
    const corsHeaders = {
      'access-control-allow-origin': getResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': getResponse.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': getResponse.headers.get('access-control-allow-headers')
    };
    
    console.log("Headers CORS:", corsHeaders);
    
    const hasCors = Object.values(corsHeaders).some(header => header !== null);
    if (hasCors) {
      console.log("✅ Headers CORS presentes!");
    } else {
      console.log("❌ Headers CORS ausentes!");
    }
    
  } catch (error) {
    console.error("💥 Erro no teste:", error);
  }
}

// Teste direto da API UAZAPI
async function testDirectAPI() {
  console.log("\n🧪 Testando API UAZAPI direta...");
  
  try {
    const response = await fetch('https://oralaligner.uazapi.com/instance/status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'token': 'test-token'
      }
    });
    
    console.log(`Status API UAZAPI: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log("✅ API UAZAPI respondendo!");
      console.log("Estrutura da resposta:", Object.keys(result));
    } else {
      console.log("❌ API UAZAPI não responde (esperado com token de teste)");
    }
  } catch (error) {
    console.log("⚠️ Erro na API UAZAPI (esperado):", error.message);
  }
}

// Executar testes
async function runTests() {
  console.log("🚀 Iniciando testes de CORS e API");
  console.log("=" * 50);
  
  await testCORS();
  await testDirectAPI();
  
  console.log("\n🏁 Testes concluídos!");
  console.log("\n📋 Próximos passos:");
  console.log("1. Se OPTIONS funcionou mas GET falhou: problema de autenticação");
  console.log("2. Se ambos falharam: problema de CORS ou deploy");
  console.log("3. Se ambos funcionaram: problema resolvido!");
}

runTests().catch(console.error);
