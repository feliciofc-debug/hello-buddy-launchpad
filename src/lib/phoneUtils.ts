/**
 * Normaliza números de telefone brasileiros para o formato padrão: 55 + DDD + número
 * 
 * Regras:
 * - Remove tudo que não for dígito
 * - 8 dígitos (local sem DDD): adiciona 55 + dddPadrao
 * - 9 dígitos (celular sem DDD): adiciona 55 + dddPadrao
 * - 10 dígitos (DDD + 8 dígitos): adiciona 55
 * - 11 dígitos (DDD + 9 dígitos): adiciona 55
 * - 12 dígitos (55 + DDD + 8): mantém
 * - 13 dígitos (55 + DDD + 9): mantém
 */
export function normalizePhoneNumber(phone: string, dddPadrao: string = "21"): string {
  if (!phone) return "";

  // Remove tudo que não é dígito
  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 0) return "";

  // Se começa com 0, remover (ex: 021...)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Classificar pelo tamanho
  if (cleaned.length === 8) {
    // Número local sem DDD (fixo)
    return `55${dddPadrao}${cleaned}`;
  }
  
  if (cleaned.length === 9) {
    // Celular sem DDD
    return `55${dddPadrao}${cleaned}`;
  }
  
  if (cleaned.length === 10) {
    // DDD + 8 dígitos (fixo)
    return `55${cleaned}`;
  }
  
  if (cleaned.length === 11) {
    // DDD + 9 dígitos (celular)
    return `55${cleaned}`;
  }
  
  if (cleaned.length === 12 || cleaned.length === 13) {
    // Já tem código do país
    if (cleaned.startsWith("55")) {
      return cleaned;
    }
    // Se não começa com 55, pode ser outro formato - adiciona 55
    return `55${cleaned}`;
  }

  // Para números maiores que 13 ou menores que 8, retorna com 55 como fallback
  if (cleaned.length >= 8) {
    if (cleaned.startsWith("55")) {
      return cleaned;
    }
    return `55${cleaned}`;
  }

  // Número muito curto, retorna como está
  return cleaned;
}

/**
 * Verifica se uma string parece ser um número de telefone
 */
export function isPhoneValue(val: string): boolean {
  const digits = val.replace(/[\s\-\(\)\+\.\/]/g, '');
  return /^\d{8,15}$/.test(digits);
}
