// Script para debug da autenticação
console.log("🔍 Debug da Autenticação");

// Verificar se há sessão no localStorage
if (typeof window !== 'undefined') {
  console.log("📱 Ambiente: Browser");
  
  // Verificar localStorage
  const supabaseAuth = localStorage.getItem('supabase.auth.token');
  console.log("🔑 Token no localStorage:", supabaseAuth ? "Presente" : "Ausente");
  
  if (supabaseAuth) {
    try {
      const tokenData = JSON.parse(supabaseAuth);
      console.log("📋 Dados do Token:", {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        hasUser: !!tokenData.user,
        userId: tokenData.user?.id,
        userEmail: tokenData.user?.email
      });
      
      // Verificar se o token é válido (decode sem segredo)
      if (tokenData.access_token) {
        const parts = tokenData.access_token.split('.');
        if (parts.length === 3) {
          const header = JSON.parse(atob(parts[0]));
          const payload = JSON.parse(atob(parts[1]));
          console.log("🔓 Header JWT:", header);
          console.log("📦 Payload JWT:", {
            sub: payload.sub,
            email: payload.email,
            role: payload.role,
            exp: new Date(payload.exp * 1000).toISOString(),
            iat: new Date(payload.iat * 1000).toISOString(),
            iss: payload.iss
          });
          
          // Verificar expiração
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp < now) {
            console.log("⚠️ Token EXPIRADO!");
          } else {
            console.log("✅ Token válido");
          }
        } else {
          console.log("❌ Token JWT inválido (formato)");
        }
      }
    } catch (error) {
      console.error("❌ Erro ao parsear token:", error);
    }
  }
  
  // Verificar outras chaves
  console.log("🔑 Outras chaves no localStorage:");
  Object.keys(localStorage).forEach(key => {
    if (key.includes('supabase') || key.includes('auth')) {
      console.log(`  - ${key}: ${localStorage.getItem(key) ? "Presente" : "Ausente"}`);
    }
  });
  
} else {
  console.log("🖥️ Ambiente: Node.js");
}

// Testar requisição direta para debug
async function testAuthRequest() {
  console.log("\n🧪 Testando requisição com auth...");
  
  try {
    // Simular requisição como seria feita pelo hook
    const response = await fetch('https://itescalcmmhhlzsmgdfv.supabase.co/functions/v1/uazapi-instance-config/instances', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    const result = await response.text();
    console.log("📋 Resposta:", result);
    
  } catch (error) {
    console.error("💥 Erro na requisição:", error);
  }
}

// Testar se o usuário está logado no Supabase
async function testSupabaseAuth() {
  console.log("\n🧪 Testando auth do Supabase...");
  
  // Criar cliente Supabase
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    'https://itescalcmmhhlzsmgdfv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts'
  );
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("❌ Erro ao obter sessão:", error);
    } else if (session) {
      console.log("✅ Sessão encontrada:");
      console.log("  - User ID:", session.user?.id);
      console.log("  - Email:", session.user?.email);
      console.log("  - Access Token:", session.access_token ? "Presente" : "Ausente");
      console.log("  - Expires At:", new Date(session.expires_at * 1000).toISOString());
    } else {
      console.log("⚠️ Nenhuma sessão ativa");
    }
    
    // Tentar obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("❌ Erro ao obter usuário:", userError);
    } else if (user) {
      console.log("✅ Usuário autenticado:");
      console.log("  - ID:", user.id);
      console.log("  - Email:", user.email);
      console.log("  - Role:", user.role);
    } else {
      console.log("⚠️ Nenhum usuário autenticado");
    }
    
  } catch (error) {
    console.error("💥 Erro no teste Supabase:", error);
  }
}

// Executar testes
if (typeof window !== 'undefined') {
  // Browser
  testAuthRequest();
} else {
  // Node.js
  testSupabaseAuth();
}

console.log("\n📋 Resumo do Debug:");
console.log("1. Verifique se o usuário está logado");
console.log("2. Verifique se o token JWT é válido");
console.log("3. Verifique se o token não expirou");
console.log("4. Verifique se o token está sendo enviado corretamente");
