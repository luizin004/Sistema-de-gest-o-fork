// Função para obter tenant_id do localStorage
export const getTenantId = (): string => {
  const usuario = localStorage.getItem('usuario');
  if (usuario) {
    const user = JSON.parse(usuario);
    return user.tenant_id;
  }
  return '';
};

// Função para verificar se há um tenant ativo
export const hasActiveTenant = (): boolean => {
  return !!getTenantId();
};

// Função para obter informações do usuário atual
export const getCurrentUser = () => {
  const usuario = localStorage.getItem('usuario');
  if (usuario) {
    return JSON.parse(usuario);
  }
  return null;
};
