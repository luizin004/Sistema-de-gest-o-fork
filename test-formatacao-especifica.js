// Função de formatação de telefone para Google Sheets
function formatPhoneForSheets(phone) {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Se não começar com 55, adiciona
  if (!digits.startsWith('55')) {
    return `55${digits}`;
  }
  
  // Remove o nono dígito (formato antigo: 55 + DD + 8 dígitos)
  // Formato esperado: 5531XXXXXXXX (sem o 9)
  if (digits.length === 13 && digits.startsWith('55')) {
    // Formato com nono dígito: 55 + DD + 9 + 8 dígitos = 13 dígitos
    return digits.substring(0, 4) + digits.substring(5); // Remove o nono dígito
  }
  
  return digits;
}

// Teste específico com o número solicitado
const telefoneTeste = '5531988888888';
const formatado = formatPhoneForSheets(telefoneTeste);

console.log('=== TESTE ESPECÍFICO ===');
console.log(`Telefone Original: ${telefoneTeste}`);
console.log(`Telefone Formatado: ${formatado}`);
console.log('');

// Análise detalhada
const digits = telefoneTeste.replace(/\D/g, '');
console.log('=== ANÁLISE DETALHADA ===');
console.log(`Número de dígitos: ${digits.length}`);
console.log(`Começa com 55: ${digits.startsWith('55')}`);
console.log(`Tem 13 dígitos: ${digits.length === 13}`);

if (digits.length === 13 && digits.startsWith('55')) {
  console.log('✅ Entrou na condição de remover nono dígito');
  const semNono = digits.substring(0, 4) + digits.substring(5);
  console.log(`Resultado sem nono dígito: ${semNono}`);
  console.log(`Posição 0-4: ${digits.substring(0, 4)} (55 + DD)`);
  console.log(`Posição 5+: ${digits.substring(5)} (8 dígitos)`);
} else {
  console.log('❌ Não entrou na condição de remover nono dígito');
}

console.log('');
console.log('=== RESULTADO FINAL ===');
console.log(`Banco de Dados: ${telefoneTeste}`);
console.log(`Google Sheets: ${formatado}`);
console.log(`WhatsApp: ${formatado}`);
