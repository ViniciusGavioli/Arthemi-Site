// ===========================================================
// Utilitários de Formatação
// ===========================================================

/**
 * Formata valor em centavos para moeda BRL
 * @param cents Valor em centavos
 * @returns String formatada (ex: "R$ 70,00")
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Formata data para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "17/12/2025")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

/**
 * Formata data e hora para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "17/12/2025 às 14:00")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Formata hora para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "14:00")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Calcula diferença em horas entre duas datas
 */
export function getHoursDiff(start: Date, end: Date): number {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Gera slug a partir de string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ===========================================================
// Telefone - Máscara e Validação
// ===========================================================

/**
 * Aplica máscara de telefone brasileiro
 * Formatos aceitos:
 * - (XX) 9XXXX-XXXX (celular)
 * - (XX) XXXX-XXXX (fixo)
 * 
 * @param value Valor digitado
 * @returns String com máscara aplicada
 */
export function maskPhone(value: string): string {
  // Remove tudo que não é dígito
  let digits = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos (DDD + 9 dígitos celular)
  digits = digits.slice(0, 11);
  
  // Aplica máscara progressivamente
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Celular: (XX) 9XXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Remove máscara do telefone, retornando apenas dígitos
 * @param phone Telefone formatado
 * @returns Apenas dígitos
 */
export function unmaskPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Valida telefone brasileiro
 * Aceita fixo (10 dígitos) ou celular (11 dígitos começando com 9)
 * 
 * @param phone Telefone (com ou sem máscara)
 * @returns true se válido
 */
export function isValidPhone(phone: string): boolean {
  const digits = unmaskPhone(phone);
  
  // Deve ter 10 (fixo) ou 11 (celular) dígitos
  if (digits.length < 10 || digits.length > 11) return false;
  
  // DDD válido (11-99)
  const ddd = parseInt(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  
  // Se tem 11 dígitos, o terceiro deve ser 9 (celular)
  if (digits.length === 11 && digits[2] !== '9') return false;
  
  return true;
}

/**
 * Retorna mensagem de erro de validação de telefone
 * @param phone Telefone a validar
 * @returns Mensagem de erro ou null se válido
 */
export function getPhoneError(phone: string): string | null {
  const digits = unmaskPhone(phone);
  
  if (digits.length === 0) {
    return 'Telefone é obrigatório';
  }
  
  if (digits.length < 10) {
    return 'Telefone incompleto';
  }
  
  if (digits.length > 11) {
    return 'Telefone muito longo';
  }
  
  const ddd = parseInt(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return 'DDD inválido';
  }
  
  if (digits.length === 11 && digits[2] !== '9') {
    return 'Celular deve começar com 9';
  }
  
  return null;
}
