// ===========================================================
// ERROR HANDLER - Conversão e resposta padronizada de erros
// ===========================================================

import type { NextApiResponse } from 'next';
import { BusinessError, isBusinessError } from './business-error';
import { BusinessErrorCode, ErrorCodeToStatus, DefaultErrorMessages } from './error-codes';
import { prismaErrorToBusinessError, isPrismaError } from './prisma-errors';

/**
 * Payload padronizado de resposta de erro
 */
export interface ErrorResponse {
  success: false;
  code: BusinessErrorCode;
  error: string;
  requestId: string;
  details?: Record<string, unknown>;
}

/**
 * Resultado do parsing de erro
 */
export interface ParsedError {
  status: number;
  code: BusinessErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Contexto para logging estruturado
 */
export interface LogContext {
  endpoint: string;
  method?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

// ============================================================
// LEGACY ERROR PARSING - Para compatibilidade com código existente
// ============================================================

/**
 * Padrões de erro legado que precisam ser migrados
 * Estes são throws antigos com formato "CODE:details" ou "CODE: message"
 */
const LEGACY_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: BusinessErrorCode;
  parseMessage: (match: RegExpMatchArray, original: string) => string;
  parseDetails?: (match: RegExpMatchArray) => Record<string, unknown> | undefined;
}> = [
  {
    pattern: /^CUPOM_INVALIDO:\s*(.+)$/,
    code: 'COUPON_INVALID',
    parseMessage: (match) => match[1],
  },
  {
    pattern: /^COUPON_ALREADY_USED:(.+)$/,
    code: 'COUPON_ALREADY_USED',
    parseMessage: () => DefaultErrorMessages.COUPON_ALREADY_USED,
    parseDetails: (match) => ({ couponCode: match[1] }),
  },
  {
    pattern: /^INSUFFICIENT_CREDITS:(\d+):(\d+)$/,
    code: 'INSUFFICIENT_CREDITS',
    parseMessage: (match) => {
      const available = parseInt(match[1]) / 100;
      const required = parseInt(match[2]) / 100;
      return `Saldo de créditos insuficiente. Disponível: R$ ${available.toFixed(2)}, Necessário: R$ ${required.toFixed(2)}.`;
    },
    parseDetails: (match) => ({
      availableCents: parseInt(match[1]),
      requiredCents: parseInt(match[2]),
    }),
  },
  {
    pattern: /^CREDIT_CONSUMED_BY_ANOTHER:(.+)$/,
    code: 'CREDIT_CONSUMED_BY_ANOTHER',
    parseMessage: () => DefaultErrorMessages.CREDIT_CONSUMED_BY_ANOTHER,
    parseDetails: (match) => ({ creditId: match[1] }),
  },
  {
    pattern: /^PRICING_ERROR:\s*(.+)$/,
    code: 'PRICING_ERROR',
    parseMessage: (match) => match[1],
  },
  {
    pattern: /^CONFLICT$/,
    code: 'BOOKING_CONFLICT',
    parseMessage: () => DefaultErrorMessages.BOOKING_CONFLICT,
  },
  {
    pattern: /^TEMPO_INSUFICIENTE$/,
    code: 'INSUFFICIENT_TIME',
    parseMessage: () => 'Reservas sem crédito precisam ser feitas com pelo menos 30 minutos de antecedência.',
  },
  {
    pattern: /^EMAIL_NOT_VERIFIED$/,
    code: 'EMAIL_NOT_VERIFIED',
    parseMessage: () => DefaultErrorMessages.EMAIL_NOT_VERIFIED,
  },
];

/**
 * Tenta parsear um erro legado (string com prefixo)
 */
function parseLegacyError(message: string): ParsedError | null {
  for (const { pattern, code, parseMessage, parseDetails } of LEGACY_ERROR_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        status: ErrorCodeToStatus[code],
        code,
        message: parseMessage(match, message),
        details: parseDetails?.(match),
      };
    }
  }
  return null;
}

// ============================================================
// MAIN ERROR HANDLER
// ============================================================

/**
 * Converte qualquer erro em um ParsedError padronizado
 * 
 * Ordem de precedência:
 * 1. BusinessError (classe nova)
 * 2. Erro legado com prefixo (CUPOM_INVALIDO:, etc.)
 * 3. Erro do Prisma mapeável (P2002, P2025, etc.)
 * 4. Erro genérico → 500
 * 
 * @param error Qualquer erro capturado
 * @returns ParsedError com status, code, message e details opcionais
 */
export function errorToHttpResponse(error: unknown): ParsedError {
  // 1. BusinessError (classe nova) - prioridade máxima
  if (isBusinessError(error)) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // 2. Erro legado com prefixo (compatibilidade)
  if (error instanceof Error) {
    const legacyParsed = parseLegacyError(error.message);
    if (legacyParsed) {
      return legacyParsed;
    }
  }

  // 3. Erro do Prisma mapeável
  const prismaError = prismaErrorToBusinessError(error);
  if (prismaError) {
    return {
      status: prismaError.status,
      code: prismaError.code,
      message: prismaError.message,
      details: prismaError.details,
    };
  }

  // 4. Erro genérico → 500 (sem vazar stack)
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: DefaultErrorMessages.INTERNAL_ERROR,
  };
}

/**
 * Responde com erro padronizado e loga de forma estruturada
 * 
 * @param res NextApiResponse
 * @param error Qualquer erro capturado
 * @param requestId ID único da requisição (OBRIGATÓRIO)
 * @param context Contexto para logging
 * @returns void (resposta já enviada)
 * 
 * @example
 * ```ts
 * try {
 *   // ... código
 * } catch (error) {
 *   return respondError(res, error, requestId, { endpoint: '/api/bookings' });
 * }
 * ```
 */
export function respondError(
  res: NextApiResponse,
  error: unknown,
  requestId: string,
  context?: LogContext
): void {
  const parsed = errorToHttpResponse(error);
  const duration = context?.extra?.startTime 
    ? Date.now() - (context.extra.startTime as number) 
    : undefined;

  // Log estruturado
  const logPayload = {
    requestId,
    endpoint: context?.endpoint,
    method: context?.method,
    statusCode: parsed.status,
    code: parsed.code,
    message: parsed.message,
    duration,
    userId: context?.userId,
    // Stack apenas em log, NUNCA no response
    ...(parsed.status >= 500 && error instanceof Error && { stack: error.stack }),
  };

  // Log com nível apropriado
  if (parsed.status >= 500) {
    console.error(`❌ [API] ERROR`, JSON.stringify(logPayload));
  } else {
    console.log(`⚠️ [API] BUSINESS_ERROR`, JSON.stringify(logPayload));
  }

  // Resposta padronizada com requestId NO BODY
  const response: ErrorResponse = {
    success: false,
    code: parsed.code,
    error: parsed.message,
    requestId,
    ...(parsed.details && { details: parsed.details }),
  };

  res.status(parsed.status).json(response);
}

/**
 * Wrapper para uso dentro de $transaction que garante BusinessError
 * 
 * Uso: quando você quer lançar um erro de negócio dentro de uma transaction
 * sem risco de virar 500 ou causar 25P02
 * 
 * @example
 * ```ts
 * await prisma.$transaction(async (tx) => {
 *   const check = await checkCouponUsage(...);
 *   if (!check.canUse) {
 *     throw businessError.couponInvalid(check.reason);
 *   }
 * });
 * ```
 */
export const businessError = {
  couponInvalid: BusinessError.couponInvalid,
  couponAlreadyUsed: BusinessError.couponAlreadyUsed,
  insufficientCredits: BusinessError.insufficientCredits,
  creditConsumedByAnother: BusinessError.creditConsumedByAnother,
  bookingConflict: BusinessError.bookingConflict,
  insufficientTime: BusinessError.insufficientTime,
  emailNotVerified: BusinessError.emailNotVerified,
  pricingError: BusinessError.pricingError,
  paymentMinAmount: BusinessError.paymentMinAmount,
  notFound: BusinessError.notFound,
  validationError: BusinessError.validationError,
  rateLimited: BusinessError.rateLimited,
  conflict: BusinessError.conflict,
  duplicateEntry: BusinessError.duplicateEntry,
};
