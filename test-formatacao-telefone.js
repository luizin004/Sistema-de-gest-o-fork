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

// Testes de formatação
const testes = [
  '31993065999',      // Sem DDI
  '(31) 99306-5999',  // Com formatação
  '+55 31 99306-5999', // Com +55
  '5531993065999',    // Com 55 mas com nono dígito
  '553193065999',     // Formato correto
  '11912345678',      // São Paulo
  '(11) 91234-5678',  // São Paulo formatado
];

console.log('=== TESTES DE FORMATAÇÃO PARA GOOGLE SHEETS ===\n');

testes.forEach(telefone => {
  const formatado = formatPhoneForSheets(telefone);
  console.log(`Original: ${telefone}`);
  console.log(`Formatado: ${formatado}`);
  console.log('---');
});

// Explicação
console.log('\n=== EXPLICAÇÃO DA FORMATAÇÃO ===');
console.log('1. Remove todos os caracteres não numéricos');
console.log('2. Se não começar com 55, adiciona o DDI');
console.log('3. Se tiver 13 dígitos (com nono dígito), remove o nono');
console.log('4. Resultado: sempre 55 + DD + 8 dígitos (sem o 9)');
