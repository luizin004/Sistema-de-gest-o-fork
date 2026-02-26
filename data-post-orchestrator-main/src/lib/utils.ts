import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =====================================================
// Função de Extração de Telefone Base (Versão Definitiva)
// =====================================================
export function extrairTelefoneBase(telefone: string): string | null {
  if (!telefone) return null;
  
  // 1. Limpar caracteres não numéricos
  let numeroLimpo = telefone.replace(/\D/g, '');
  
  // 2. Remover DDI 55 se houver (considerando que o número teria 12 ou 13 dígitos)
  if (numeroLimpo.length >= 12 && numeroLimpo.startsWith('55')) {
    numeroLimpo = numeroLimpo.substring(2);
  }
  
  // 3. Validar se tem o tamanho mínimo de um número brasileiro com DDD (10 ou 11 dígitos)
  // Se tiver menos que 10, não conseguimos identificar o DDD com segurança
  if (numeroLimpo.length < 10) return null;
  
  // 4. A MÁGICA: Pegar os 2 primeiros (DDD) e os 8 últimos (Número base)
  // Isso ignora o 9º dígito automaticamente, não importa se ele existe ou não
  const ddd = numeroLimpo.substring(0, 2);
  const ultimos8 = numeroLimpo.substring(numeroLimpo.length - 8);
  
  return ddd + ultimos8;
}

// Função para agrupar duplicados sem modificar dados originais
export function agruparLeadsPorTelefoneBase(posts: any[]) {
  const grupos = new Map<string, any[]>();
  
  posts.forEach(post => {
    const telefoneBase = extrairTelefoneBase(post.telefone || '');
    if (telefoneBase) {
      if (!grupos.has(telefoneBase)) {
        grupos.set(telefoneBase, []);
      }
      grupos.get(telefoneBase)!.push(post);
    } else {
      // Telefones que não puderam ser normalizados
      if (!grupos.has('invalid')) {
        grupos.set('invalid', []);
      }
      grupos.get('invalid')!.push(post);
    }
  });
  
  return grupos;
}

/**
 * Normaliza telefone brasileiro para o formato DDD + 8 dígitos (sem país, sem 9)
 * Exemplo: +5531912345678 -> 3112345678
 * Exemplo: 5531912345678 -> 3112345678
 * Exemplo: 31912345678 -> 3112345678
 * Exemplo: 3193065999 -> 3193065999 (já está correto)
 */
export function normalizePhoneForAgendamento(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é número
  let digits = phone.replace(/\D/g, '');
  
  // Remove código do país (55) se presente
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Se tem 11 dígitos (DDD + 9 + 8 dígitos), remove o 9
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(3); // pula o 9
    digits = ddd + number;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos), já está correto
  if (digits.length === 10) {
    return digits;
  }
  
  // Retorna o que temos (pode não estar no formato ideal mas é melhor que nada)
  return digits;
}
