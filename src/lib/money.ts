// ===========================================================
// lib/money.ts - Helpers para manipulação de valores monetários
// ===========================================================
// REGRA: Todo cálculo financeiro no backend usa INTEIRO em CENTAVOS.
// Proibido float para valores monetários internos.

/**
 * Converte valor em REAIS para CENTAVOS (inteiro)
 * @param reais Valor em reais (ex: 39.99)
 * @returns Valor em centavos (ex: 3999)
 * @example toCents(39.99) → 3999
 */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Converte valor em CENTAVOS para REAIS
 * @param cents Valor em centavos (ex: 3999)
 * @returns Valor em reais (ex: 39.99)
 * @example fromCents(3999) → 39.99
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Valida que um valor em centavos é inteiro.
 * Lança erro se não for.
 * @param cents Valor a validar
 * @param label Nome do campo (para mensagem de erro)
 * @throws Error se cents não for inteiro
 */
export function assertIntegerCents(cents: number, label: string): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`[MONEY] ${label} deve ser inteiro (centavos). Recebido: ${cents}`);
  }
}

/**
 * Formata valor em centavos para exibição em BRL
 * @param cents Valor em centavos
 * @returns String formatada (ex: "R$ 39,99")
 */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(fromCents(cents));
}
