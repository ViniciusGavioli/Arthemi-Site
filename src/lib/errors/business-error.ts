// ===========================================================
// BUSINESS ERROR - Classe base para erros de negócio
// ===========================================================

import { 
  BusinessErrorCode, 
  ErrorCodeToStatus, 
  DefaultErrorMessages 
} from './error-codes';

/**
 * Detalhes adicionais do erro (sem PII)
 */
export interface ErrorDetails {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Classe base para erros de negócio
 * 
 * IMPORTANTE: Esta classe é SEGURA para uso dentro de $transaction Prisma.
 * Erros de negócio devem ser lançados como BusinessError para garantir
 * que sejam tratados como 4xx e não 500.
 * 
 * @example
 * ```ts
 * // Dentro de uma transaction
 * throw new BusinessError('COUPON_ALREADY_USED', 'Cupom já utilizado');
 * 
 * // Com detalhes
 * throw BusinessError.insufficientCredits(available, required);
 * ```
 */
export class BusinessError extends Error {
  public readonly code: BusinessErrorCode;
  public readonly status: number;
  public readonly details?: ErrorDetails;
  public readonly isBusinessError = true as const;

  constructor(
    code: BusinessErrorCode,
    message?: string,
    details?: ErrorDetails
  ) {
    const finalMessage = message || DefaultErrorMessages[code];
    super(finalMessage);
    
    this.name = 'BusinessError';
    this.code = code;
    this.status = ErrorCodeToStatus[code];
    this.details = details;
    
    // Manter prototype chain para instanceof funcionar
    Object.setPrototypeOf(this, BusinessError.prototype);
  }

  /**
   * Serializa para JSON (resposta da API)
   */
  toJSON(requestId?: string): object {
    return {
      success: false,
      code: this.code,
      error: this.message,
      ...(requestId && { requestId }),
      ...(this.details && { details: this.details }),
    };
  }

  // ============================================================
  // FACTORY METHODS - Erros comuns com tipagem forte
  // ============================================================

  static couponInvalid(reason?: string): BusinessError {
    return new BusinessError(
      'COUPON_INVALID',
      reason || DefaultErrorMessages.COUPON_INVALID
    );
  }

  static couponAlreadyUsed(couponCode?: string): BusinessError {
    return new BusinessError(
      'COUPON_ALREADY_USED',
      DefaultErrorMessages.COUPON_ALREADY_USED,
      couponCode ? { couponCode } : undefined
    );
  }

  static insufficientCredits(availableCents: number, requiredCents: number): BusinessError {
    const available = availableCents / 100;
    const required = requiredCents / 100;
    return new BusinessError(
      'INSUFFICIENT_CREDITS',
      `Saldo de créditos insuficiente. Disponível: R$ ${available.toFixed(2)}, Necessário: R$ ${required.toFixed(2)}.`,
      { availableCents, requiredCents }
    );
  }

  static creditConsumedByAnother(creditId?: string): BusinessError {
    return new BusinessError(
      'CREDIT_CONSUMED_BY_ANOTHER',
      'Seus créditos foram consumidos por outra reserva. Tente novamente.',
      creditId ? { creditId } : undefined
    );
  }

  static bookingConflict(): BusinessError {
    return new BusinessError('BOOKING_CONFLICT');
  }

  static insufficientTime(): BusinessError {
    return new BusinessError(
      'INSUFFICIENT_TIME',
      'Reservas sem crédito precisam ser feitas com pelo menos 30 minutos de antecedência.'
    );
  }

  static emailNotVerified(): BusinessError {
    return new BusinessError('EMAIL_NOT_VERIFIED');
  }

  static pricingError(reason?: string): BusinessError {
    return new BusinessError(
      'PRICING_ERROR',
      reason || DefaultErrorMessages.PRICING_ERROR
    );
  }

  static paymentMinAmount(minCents: number, actualCents: number, method: string): BusinessError {
    return new BusinessError(
      'PAYMENT_MIN_AMOUNT',
      `Valor após desconto (R$ ${(actualCents / 100).toFixed(2)}) abaixo do mínimo permitido para ${method} (R$ ${(minCents / 100).toFixed(2)}).`,
      { minAmountCents: minCents, actualAmountCents: actualCents, paymentMethod: method }
    );
  }

  static notFound(resource?: string): BusinessError {
    return new BusinessError(
      'NOT_FOUND',
      resource ? `${resource} não encontrado(a).` : DefaultErrorMessages.NOT_FOUND
    );
  }

  static validationError(message: string, details?: ErrorDetails): BusinessError {
    return new BusinessError('VALIDATION_ERROR', message, details);
  }

  static rateLimited(resetAt?: Date): BusinessError {
    const message = resetAt 
      ? `Muitas tentativas. Tente novamente após ${resetAt.toLocaleTimeString('pt-BR')}.`
      : DefaultErrorMessages.RATE_LIMITED;
    return new BusinessError('RATE_LIMITED', message);
  }

  static conflict(message?: string): BusinessError {
    return new BusinessError('CONFLICT', message);
  }

  static duplicateEntry(field?: string): BusinessError {
    return new BusinessError(
      'DUPLICATE_ENTRY',
      field ? `Já existe um registro com este ${field}.` : DefaultErrorMessages.DUPLICATE_ENTRY
    );
  }
}

/**
 * Type guard para verificar se é BusinessError
 */
export function isBusinessError(error: unknown): error is BusinessError {
  return (
    error instanceof BusinessError ||
    (error instanceof Error && 'isBusinessError' in error && error.isBusinessError === true)
  );
}
