// Script de teste para API de configuração de instâncias UAZAPI
// Substitua as variáveis conforme necessário

const SUPABASE_URL = "https://itescalcmmhhlzsmgdfv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts";

// Token de teste (substitua por um token real)
const TEST_TOKEN = "489bc35a-9b93-4ad5-9137-c5bd7352be83";

// Função para configurar instância
async function testConfigureInstance() {
  console.log("🧪 Testando configuração de instância...");
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-instance-config/configure`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: TEST_TOKEN })
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok && result.instance) {
      console.log("✅ Instância configurada com sucesso!");
      return result.instance;
    } else {
      console.log("❌ Erro na configuração:", result.error);
      return null;
    }
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return null;
  }
}

// Função para listar instâncias
async function testListInstances() {
  console.log("\n🧪 Testando listagem de instâncias...");
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-instance-config/instances`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`✅ ${result.instances?.length || 0} instâncias encontradas!`);
      return result.instances || [];
    } else {
      console.log("❌ Erro na listagem:", result.error);
      return [];
    }
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return [];
  }
}

// Função para atualizar status da instância
async function testRefreshStatus(instanceId) {
  console.log(`\n🧪 Testando atualização de status da instância ${instanceId}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-instance-config/refresh/${instanceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok && result.instance) {
      console.log("✅ Status atualizado com sucesso!");
      return result.instance;
    } else {
      console.log("❌ Erro na atualização:", result.error);
      return null;
    }
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return null;
  }
}

// Função para remover instância
async function testRemoveInstance(instanceId) {
  console.log(`\n🧪 Testando remoção da instância ${instanceId}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-instance-config/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log("✅ Instância removida com sucesso!");
      return true;
    } else {
      console.log("❌ Erro na remoção:", result.error);
      return false;
    }
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return false;
  }
}

// Testar validação direta do token com UAZAPI
async function testDirectTokenValidation() {
  console.log("\n🧪 Testando validação direta do token com UAZAPI...");
  
  try {
    const response = await fetch('https://oralaligner.uazapi.com/instance/status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'token': TEST_TOKEN
      }
    });
    
    const result = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log("✅ Token válido!");
      console.log(`📱 Instância: ${result.instance.name} (${result.instance.id})`);
      console.log(`📊 Status: ${result.instance.status}`);
      console.log(`🔗 Conectado: ${result.status.connected ? 'Sim' : 'Não'}`);
      return result;
    } else {
      console.log("❌ Token inválido!");
      return null;
    }
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
    return null;
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log("🚀 Iniciando testes da API de configuração de instâncias UAZAPI");
  console.log("=" * 60);
  
  // Teste 1: Validação direta do token
  const directValidation = await testDirectTokenValidation();
  
  // Teste 2: Listar instâncias existentes
  const existingInstances = await testListInstances();
  
  // Teste 3: Configurar nova instância (se o token for válido)
  if (directValidation) {
    const newInstance = await testConfigureInstance();
    
    if (newInstance) {
      // Teste 4: Atualizar status da nova instância
      await testRefreshStatus(newInstance.id);
      
      // Teste 5: Listar novamente para verificar
      await testListInstances();
      
      // Opcional: Remover instância de teste (comente se quiser manter)
      // await testRemoveInstance(newInstance.id);
    }
  } else {
    console.log("\n⚠️ Pulando testes de configuração devido ao token inválido");
  }
  
  console.log("\n🏁 Testes concluídos!");
  console.log("\n📋 Verificações manuais:");
  console.log("1. Verifique se as instâncias aparecem na tabela uazapi_instances");
  console.log("2. Confirme se o tenant_id foi preenchido corretamente");
  console.log("3. Teste a interface frontend em /uazapi-config");
  console.log("4. Monitore os logs da Edge Function");
  console.log("5. Verifique o isolamento multi-tenant");
}

// Executar testes
runAllTests().catch(console.error);
