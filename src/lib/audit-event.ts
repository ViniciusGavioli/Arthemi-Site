/**
 * Audit Event - Persistência de eventos de auditoria no banco
 * 
 * Grava eventos críticos para observabilidade (best-effort).
 * Falha de auditoria NÃO quebra o fluxo principal.
 */

import { prisma } from './prisma';

export type AuditEventType = 
  | 'BOOKING_CREATED'
  | 'PURCHASE_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'WEBHOOK_RECEIVED';

export interface AuditEventData {
  requestId?: string;
  type: AuditEventType;
  userId?: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

/**
 * Grava evento de auditoria no banco (best-effort).
 * Não lança exceção - apenas loga erro se falhar.
 */
export async function recordAuditEvent(data: AuditEventData): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        requestId: data.requestId || null,
        type: data.type,
        userId: data.userId || null,
        entityType: data.entityType,
        entityId: data.entityId,
        payloadJson: data.payload ? (data.payload as object) : undefined,
      },
    });
  } catch (error) {
    // Best-effort: não quebrar fluxo principal
    console.error('[AUDIT_EVENT] Falha ao gravar evento:', {
      type: data.type,
      entityType: data.entityType,
      entityId: data.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Helper para gravar evento de booking criado
 */
export function recordBookingCreated(params: {
  requestId?: string;
  userId?: string;
  bookingId: string;
  roomId: string;
  amount: number;
  paymentMethod: string;
}): void {
  recordAuditEvent({
    requestId: params.requestId,
    type: 'BOOKING_CREATED',
    userId: params.userId,
    entityType: 'Booking',
    entityId: params.bookingId,
    payload: {
      roomId: params.roomId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
    },
  }).catch(() => {}); // Fire and forget
}

/**
 * Helper para gravar evento de purchase criado
 */
export function recordPurchaseCreated(params: {
  requestId?: string;
  userId?: string;
  creditId: string;
  roomId: string;
  amount: number;
  hours: number;
  paymentMethod: string;
}): void {
  recordAuditEvent({
    requestId: params.requestId,
    type: 'PURCHASE_CREATED',
    userId: params.userId,
    entityType: 'Credit',
    entityId: params.creditId,
    payload: {
      roomId: params.roomId,
      amount: params.amount,
      hours: params.hours,
      paymentMethod: params.paymentMethod,
    },
  }).catch(() => {}); // Fire and forget
}

/**
 * Helper para gravar evento de pagamento confirmado
 */
export function recordPaymentConfirmed(params: {
  requestId?: string;
  paymentId: string;
  externalId: string;
  amount: number;
  bookingId?: string;
  creditId?: string;
}): void {
  recordAuditEvent({
    requestId: params.requestId,
    type: 'PAYMENT_CONFIRMED',
    entityType: 'Payment',
    entityId: params.paymentId,
    payload: {
      externalId: params.externalId,
      amount: params.amount,
      bookingId: params.bookingId,
      creditId: params.creditId,
    },
  }).catch(() => {}); // Fire and forget
}

/**
 * Helper para gravar evento de webhook recebido (opcional, usar com moderação)
 */
export function recordWebhookReceived(params: {
  requestId?: string;
  eventId: string;
  eventType: string;
  paymentId: string;
}): void {
  recordAuditEvent({
    requestId: params.requestId,
    type: 'WEBHOOK_RECEIVED',
    entityType: 'WebhookEvent',
    entityId: params.eventId,
    payload: {
      eventType: params.eventType,
      paymentId: params.paymentId,
    },
  }).catch(() => {}); // Fire and forget
}
