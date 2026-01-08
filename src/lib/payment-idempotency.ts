// ===========================================================
// P-003: Helper de Idempotência para Pagamentos
// ===========================================================
// Gera chaves únicas para evitar cobranças duplicadas no Asaas
// Verifica se já existe Payment com a mesma chave antes de criar

import { prisma } from '@/lib/prisma';

/**
 * Gera idempotencyKey para um booking
 * Formato: booking:<bookingId>:<method>
 * 
 * @example generateBookingIdempotencyKey('abc123', 'PIX') => 'booking:abc123:PIX'
 */
export function generateBookingIdempotencyKey(bookingId: string, method: 'PIX' | 'CARD'): string {
  return `booking:${bookingId}:${method}`;
}

/**
 * Gera idempotencyKey para uma compra de crédito
 * Formato: purchase:<creditId>:<method>
 * 
 * @example generatePurchaseIdempotencyKey('xyz789', 'PIX') => 'purchase:xyz789:PIX'
 */
export function generatePurchaseIdempotencyKey(creditId: string, method: 'PIX' | 'CARD'): string {
  return `purchase:${creditId}:${method}`;
}

/**
 * Resultado da verificação de idempotência
 */
export interface IdempotencyCheckResult {
  /** True se já existe pagamento com essa chave */
  exists: boolean;
  /** Dados do pagamento existente (se exists = true) */
  existingPayment?: {
    id: string;
    externalId: string | null;
    externalUrl: string | null;
    status: string;
  };
}

/**
 * Verifica se já existe um Payment com a idempotencyKey fornecida
 * 
 * @param idempotencyKey - Chave de idempotência
 * @returns Resultado da verificação com dados do pagamento existente
 */
export async function checkPaymentIdempotency(idempotencyKey: string): Promise<IdempotencyCheckResult> {
  const existingPayment = await prisma.payment.findFirst({
    where: { idempotencyKey },
    select: {
      id: true,
      externalId: true,
      externalUrl: true,
      status: true,
    },
  });

  if (existingPayment) {
    return {
      exists: true,
      existingPayment: {
        id: existingPayment.id,
        externalId: existingPayment.externalId,
        externalUrl: existingPayment.externalUrl,
        status: existingPayment.status,
      },
    };
  }

  return { exists: false };
}

/**
 * Verifica se já existe pagamento ATIVO (PENDING/APPROVED/IN_PROCESS) para um booking
 * 
 * @param bookingId - ID do booking
 * @returns Resultado da verificação
 */
export async function checkBookingHasActivePayment(bookingId: string): Promise<IdempotencyCheckResult> {
  const existingPayment = await prisma.payment.findFirst({
    where: {
      bookingId,
      status: { in: ['PENDING', 'APPROVED', 'IN_PROCESS'] },
    },
    select: {
      id: true,
      externalId: true,
      externalUrl: true,
      status: true,
    },
  });

  if (existingPayment) {
    return {
      exists: true,
      existingPayment: {
        id: existingPayment.id,
        externalId: existingPayment.externalId,
        externalUrl: existingPayment.externalUrl,
        status: existingPayment.status,
      },
    };
  }

  return { exists: false };
}

/**
 * Verifica se já existe pagamento para uma compra de crédito (purchaseId = creditId)
 * 
 * @param purchaseId - ID do crédito
 * @returns Resultado da verificação
 */
export async function checkPurchaseHasPayment(purchaseId: string): Promise<IdempotencyCheckResult> {
  const existingPayment = await prisma.payment.findFirst({
    where: {
      purchaseId,
      status: { in: ['PENDING', 'APPROVED', 'IN_PROCESS'] },
    },
    select: {
      id: true,
      externalId: true,
      externalUrl: true,
      status: true,
    },
  });

  if (existingPayment) {
    return {
      exists: true,
      existingPayment: {
        id: existingPayment.id,
        externalId: existingPayment.externalId,
        externalUrl: existingPayment.externalUrl,
        status: existingPayment.status,
      },
    };
  }

  return { exists: false };
}
