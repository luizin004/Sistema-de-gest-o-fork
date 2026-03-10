/**
 * Detecta o delimitador do CSV (vírgula ou ponto-e-vírgula)
 */
function detectDelimiter(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Faz parsing de uma linha CSV respeitando aspas
 */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Faz parsing de texto CSV para array de objetos
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map(h =>
    h.replace(/^\uFEFF/, '').trim().toLowerCase()
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Encontra a coluna de telefone nos headers do CSV
 */
export function findPhoneColumn(headers: string[]): string | null {
  const phonePatterns = ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'];
  const lowerHeaders = headers.map(h => h.toLowerCase());
  for (const pattern of phonePatterns) {
    const found = lowerHeaders.find(h => h.includes(pattern));
    if (found) return found;
  }
  return null;
}

/**
 * Encontra a coluna de nome nos headers do CSV
 */
export function findNameColumn(headers: string[]): string | null {
  const namePatterns = ['nome', 'name', 'cliente', 'paciente'];
  const lowerHeaders = headers.map(h => h.toLowerCase());
  for (const pattern of namePatterns) {
    const found = lowerHeaders.find(h => h.includes(pattern));
    if (found) return found;
  }
  return null;
}

/**
 * Normaliza número de telefone para formato internacional BR
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

/**
 * Interpolação de template com dados do CSV
 * Ex: "Olá {nome}, tudo bem?" + { nome: "João" } → "Olá João, tudo bem?"
 */
export function interpolateTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const lowerKey = key.toLowerCase();
    // Busca case-insensitive
    const value = row[lowerKey] ?? row[key] ?? Object.entries(row).find(
      ([k]) => k.toLowerCase() === lowerKey
    )?.[1];
    return value ?? match;
  });
}

/**
 * Oculta parcialmente o telefone para exibição em logs
 * Ex: "5531999998888" → "5531***8888"
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone;
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}
