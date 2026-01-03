/**
 * Operation Logger - Auditoria mínima server-side
 * 
 * Logger padronizado para eventos críticos:
 * - Booking criado
 * - Purchase criado  
 * - Pagamento confirmado (webhook)
 * 
 * SOMENTE server-side, não expor para cliente.
 */

export type OperationType = 
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'PURCHASE_CREATED'
  | 'PURCHASE_CONFIRMED'
  | 'PAYMENT_WEBHOOK_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED';

export interface OperationLogData {
  operation: OperationType;
  targetId: string;
  userId?: string;
  email?: string;
  ip?: string;
  amount?: number;
  paymentMethod?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Formata timestamp ISO com timezone BR
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log padronizado para eventos críticos de operação.
 * Escreve em console.log com formato estruturado.
 * 
 * @example
 * logOperation({
 *   operation: 'BOOKING_CREATED',
 *   targetId: booking.id,
 *   userId: user.id,
 *   email: user.email,
 *   amount: 120.00,
 *   paymentMethod: 'PIX',
 * });
 */
export function logOperation(data: OperationLogData): void {
  const logEntry = {
    timestamp: formatTimestamp(),
    level: 'INFO',
    ...data,
  };
  
  // Log estruturado (JSON)
  console.log(`[OP] ${JSON.stringify(logEntry)}`);
}

/**
 * Log de erro em operação crítica.
 */
export function logOperationError(
  operation: OperationType,
  targetId: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const logEntry = {
    timestamp: formatTimestamp(),
    level: 'ERROR',
    operation,
    targetId,
    error: errorMessage,
    stack: errorStack,
    ...metadata,
  };
  
  console.error(`[OP_ERROR] ${JSON.stringify(logEntry)}`);
}

// ============================================================
// Helpers específicos para cada tipo de operação
// ============================================================

export function logBookingCreated(params: {
  bookingId: string;
  userId?: string;
  email?: string;
  ip?: string;
  amount: number;
  paymentMethod: string;
  roomId: string;
}): void {
  logOperation({
    operation: 'BOOKING_CREATED',
    targetId: params.bookingId,
    userId: params.userId,
    email: params.email,
    ip: params.ip,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    metadata: { roomId: params.roomId },
  });
}

export function logPurchaseCreated(params: {
  creditId: string;
  userId?: string;
  email?: string;
  ip?: string;
  amount: number;
  paymentMethod: string;
  hours: number;
  roomId: string;
}): void {
  logOperation({
    operation: 'PURCHASE_CREATED',
    targetId: params.creditId,
    userId: params.userId,
    email: params.email,
    ip: params.ip,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    metadata: { hours: params.hours, roomId: params.roomId },
  });
}

export function logPaymentConfirmed(params: {
  paymentId: string;
  externalId: string;
  amount: number;
  bookingId?: string;
  creditId?: string;
}): void {
  logOperation({
    operation: 'PAYMENT_CONFIRMED',
    targetId: params.paymentId,
    paymentId: params.externalId,
    amount: params.amount,
    metadata: { 
      bookingId: params.bookingId,
      creditId: params.creditId,
    },
  });
}

export function logWebhookReceived(params: {
  externalId: string;
  event: string;
  ip?: string;
}): void {
  logOperation({
    operation: 'PAYMENT_WEBHOOK_RECEIVED',
    targetId: params.externalId,
    ip: params.ip,
    metadata: { event: params.event },
  });
}
