// Função atual de formatação
function formatPhoneForSheets(phone) {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  if (!digits.startsWith('55')) {
    return `55${digits}`;
  }
  
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits.substring(0, 4) + digits.substring(5);
  }
  
  return digits;
}

// Função melhorada (sempre remover nono)
function formatPhoneForSheetsImproved(phone) {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  // Adiciona 55 se não tiver
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  
  // Remove o nono dígito se tiver 13 dígitos (55 + DD + 9 + 8)
  if (withDDI.length === 13) {
    return withDDI.substring(0, 4) + withDDI.substring(5);
  }
  
  // Se tiver 12 dígitos (55 + DD + 8), já está correto
  if (withDDI.length === 12) {
    return withDDI;
  }
  
  return withDDI;
}

// Testes comparativos
const testes = [
  '31988888888',      // 11 dígitos - sem nono
  '(31) 98888-8888',  // 11 dígitos - com nono na formatação
  '5531988888888',    // 13 dígitos - com nono
  '553188888888',     // 12 dígitos - sem nono (correto)
  '31993065999',      // 11 dígitos - exemplo real
  '(31) 99306-5999',  // 11 dígitos - formatado com nono
];

console.log('=== COMPARAÇÃO: ATUAL vs MELHORADO ===\n');

testes.forEach((telefone, index) => {
  const atual = formatPhoneForSheets(telefone);
  const melhorado = formatPhoneForSheetsImproved(telefone);
  const digits = telefone.replace(/\D/g, '');
  
  console.log(`Teste ${index + 1}: ${telefone}`);
  console.log(`  Digits: ${digits} (${digits.length})`);
  console.log(`  Atual: ${atual}`);
  console.log(`  Melhorado: ${melhorado}`);
  console.log(`  Diferente: ${atual !== melhorado ? '❌ SIM' : '✅ IGUAL'}`);
  console.log('');
});

console.log('=== RECOMENDAÇÃO ===');
console.log('Se o Sheets está recebendo com nono dígito, use a função melhorada.');
console.log('Ela remove o nono dígito em todos os casos onde existe.');
