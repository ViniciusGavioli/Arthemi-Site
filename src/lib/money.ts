// ===========================================================
// lib/money.ts - Helpers para manipulação de valores monetários
// ===========================================================
// REGRA: Todo cálculo financeiro no backend usa INTEIRO em CENTAVOS.
// Proibido float para valores monetários internos.
// Conversão para REAIS apenas na hora de enviar para APIs externas (Asaas).

// ============================================================
// LIMITES DE SEGURANÇA
// ============================================================
const MIN_CENTS = 0;           // Mínimo: R$ 0,00
const MIN_PAYMENT_CENTS = 500; // Mínimo Asaas: R$ 5,00
const MAX_CENTS = 5_000_000;   // Máximo: R$ 50.000 (evitar bugs absurdos)

/**
 * Valida que um valor é um número inteiro >= 0 (centavos válidos).
 * Lança erro imediato se não for (fail-fast).
 * 
 * @param value Valor a validar
 * @param ctx Contexto para mensagem de erro (ex: "booking.amount")
 * @returns O valor validado como number
 * @throws Error se value não for inteiro >= 0
 * 
 * @example assertCents(4999, "booking.amount") → 4999
 * @example assertCents(49.99, "booking.amount") → ERRO (não é inteiro)
 * @example assertCents(-100, "booking.amount") → ERRO (negativo)
 */
export function assertCents(value: unknown, ctx: string): number {
  if (typeof value !== 'number') {
    throw new Error(`[money] ${ctx}: valueCents must be number (got ${typeof value}: ${value})`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`[money] ${ctx}: valueCents must be finite (got ${value})`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`[money] ${ctx}: valueCents must be integer (got ${value}) - você passou reais ao invés de centavos?`);
  }
  if (value < MIN_CENTS) {
    throw new Error(`[money] ${ctx}: valueCents must be >= 0 (got ${value})`);
  }
  return value;
}

/**
 * Valida que um valor em centavos está dentro dos limites para pagamento Asaas.
 * Lança erro se estiver fora dos limites.
 * 
 * @param valueCents Valor em centavos
 * @param ctx Contexto para mensagem de erro
 * @returns O valor validado
 * @throws Error se fora dos limites [500, 5_000_000]
 */
export function assertPaymentCents(valueCents: number, ctx: string): number {
  assertCents(valueCents, ctx);
  
  if (valueCents < MIN_PAYMENT_CENTS) {
    throw new Error(
      `[money] ${ctx}: valor R$ ${(valueCents/100).toFixed(2)} abaixo do mínimo Asaas (R$ 5,00). ` +
      `valueCents=${valueCents}`
    );
  }
  if (valueCents > MAX_CENTS) {
    throw new Error(
      `[money] ${ctx}: valor R$ ${(valueCents/100).toFixed(2)} acima do máximo permitido (R$ 50.000). ` +
      `Isso pode indicar que você passou reais ao invés de centavos. valueCents=${valueCents}`
    );
  }
  return valueCents;
}

/**
 * Converte centavos para reais para envio ao Asaas.
 * Garante precisão de 2 casas decimais.
 * 
 * @param valueCents Valor em centavos (inteiro)
 * @returns Valor em reais (ex: 49.99)
 * 
 * @example centsToReais(4999) → 49.99
 * @example centsToReais(10000) → 100.00
 */
export function centsToReais(valueCents: number): number {
  // Math.round para evitar floating point issues
  return Math.round(valueCents) / 100;
}

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
 * @deprecated Use centsToReais() para maior clareza
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
 * @deprecated Use assertCents() para validação mais robusta
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
  }).format(centsToReais(cents));
}
