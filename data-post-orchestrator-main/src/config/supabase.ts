// Configuração do Supabase para uso no cliente
// Nota: Em ambiente de desenvolvimento, usamos valores estáticos
// Em produção, estas variáveis devem ser configuradas no build

export const supabaseConfig = {
  url: 'https://itescalcmmhhlzsmgdfv.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cWhwb3ZqbnRqYmpob2JxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts'
};

// Função helper para obter URLs das Edge Functions
export const getFunctionUrl = (functionName: string) => {
  return `${supabaseConfig.url}/functions/v1/${functionName}`;
};

// Headers padrão para requisições às Edge Functions
export const getDefaultHeaders = () => ({
  'Authorization': `Bearer ${supabaseConfig.anonKey}`,
  'Content-Type': 'application/json'
});
