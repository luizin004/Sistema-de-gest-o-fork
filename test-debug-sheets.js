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

// Testes específicos para o problema
const testes = [
  '31988888888',      // Sem DDI, sem nono
  '(31) 98888-8888',  // Com formatação, com nono
  '+55 31 98888-8888', // Com +55, com nono
  '5531988888888',    // Com 55 e nono
  '553188888888',     // Com 55, sem nono (formato correto)
];

console.log('=== DEBUG FORMATAÇÃO PARA SHEETS ===\n');

testes.forEach((telefone, index) => {
  const formatado = formatPhoneForSheets(telefone);
  const digits = telefone.replace(/\D/g, '');
  
  console.log(`Teste ${index + 1}:`);
  console.log(`  Original: ${telefone}`);
  console.log(`  Digits: ${digits} (${digits.length} dígitos)`);
  console.log(`  Formatado: ${formatado}`);
  console.log(`  Começa com 55: ${digits.startsWith('55')}`);
  console.log(`  Tem 13 dígitos: ${digits.length === 13}`);
  
  if (digits.length === 13 && digits.startsWith('55')) {
    const semNono = digits.substring(0, 4) + digits.substring(5);
    console.log(`  ✅ Removeu nono: ${semNono}`);
  } else {
    console.log(`  ❌ Não removeu nono`);
  }
  console.log('');
});

// Simulação do payload enviado para Sheets
console.log('=== SIMULAÇÃO PAYLOAD SHEETS ===');
const payloadTeste = {
  nome: 'Teste Debug',
  telefone: formatPhoneForSheets('31988888888'),
  datamarcada: '2026-02-18T00:00:00',
  tratamento: 'Consulta Debug',
  dentista: 'Dr. Debug'
};

console.log('Payload enviado para Google Sheets:');
console.log(JSON.stringify(payloadTeste, null, 2));

// Verificação específica do problema
console.log('\n=== ANÁLISE DO PROBLEMA ===');
console.log('Se o Sheets está recebendo com nono dígito, possíveis causas:');
console.log('1. A formatação não está sendo aplicada');
console.log('2. Outra parte do código está sobrescrevendo');
console.log('3. O Google Apps Script está adicionando o nono');
console.log('4. A URL do Sheets está incorreta');
