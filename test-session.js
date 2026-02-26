// Teste para verificar se a sessão está persistindo
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://itescalcmmhhlzsmgdfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZXNjYWxjbW1oaGx6c21nZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTgwMTIsImV4cCI6MjA3ODcyNjg0MX0.8Mi6u5wI9jbRIyxubba13JdTj8qCd2u48vLdA1SFSho';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSession() {
  console.log('🔍 Testando persistência de sessão...');
  
  try {
    // 1. Verificar sessão atual
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erro ao verificar sessão:', error.message);
      return;
    }
    
    if (session) {
      console.log('✅ Sessão encontrada:');
      console.log('   User ID:', session.user.id);
      console.log('   Email:', session.user.email);
      console.log('   Expires at:', new Date(session.expires_at * 1000).toLocaleString());
      console.log('   Access Token (primeiros 20 chars):', session.access_token.substring(0, 20) + '...');
    } else {
      console.log('❌ Nenhuma sessão ativa encontrada');
      console.log('💡 Dica: Faça login primeiro para testar a persistência');
    }
    
    // 2. Testar listener de mudanças
    console.log('\n👂 Configurando listener para mudanças de auth...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`🔄 Auth state changed: ${event}`);
        if (session) {
          console.log(`   User: ${session.user.email}`);
        } else {
          console.log('   No session');
        }
      }
    );
    
    // 3. Esperar um pouco para ver se há eventos
    console.log('\n⏳ Aguardando eventos por 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    subscription.unsubscribe();
    console.log('👋 Listener removido');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Testar login
async function testLogin() {
  console.log('🔐 Testando login...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123'
    });
    
    if (error) {
      console.error('❌ Erro no login:', error.message);
      return;
    }
    
    console.log('✅ Login successful!');
    console.log('   User:', data.user.email);
    console.log('   Session:', data.session ? 'Created' : 'Not created');
    
    // Salvar no localStorage para compatibilidade
    if (typeof window !== 'undefined') {
      localStorage.setItem('usuario', JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        nome: 'Administrador',
        cargo: 'admin'
      }));
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de login:', error.message);
  }
}

// Menu interativo
async function main() {
  console.log('🚀 Teste de Sessão Supabase');
  console.log('==========================');
  console.log('1. Testar sessão atual');
  console.log('2. Fazer login');
  console.log('3. Sair');
  
  // Para teste automático, vamos testar a sessão atual
  await testSession();
}

if (require.main === module) {
  main();
}

module.exports = { testSession, testLogin };
