// ===========================================================
// PRISMA ERRORS - Handlers para erros do Prisma
// ===========================================================

import { BusinessError } from './business-error';
import { BusinessErrorCode } from './error-codes';

/**
 * Códigos de erro do Prisma que podem ser mapeados para erros de negócio
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference
 */
export const PrismaErrorCodes = {
  // Unique constraint violation
  P2002: 'P2002',
  // Foreign key constraint violation
  P2003: 'P2003',
  // Record not found
  P2025: 'P2025',
  // Transaction failed due to conflict or deadlock
  P2034: 'P2034',
} as const;

/**
 * Verifica se é um erro do Prisma
 */
export function isPrismaError(error: unknown): error is { code: string; meta?: { target?: string[] } } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  );
}

/**
 * Converte erros do Prisma em BusinessError quando aplicável
 * 
 * @returns BusinessError se o erro Prisma é mapeável, null caso contrário
 */
export function prismaErrorToBusinessError(error: unknown): BusinessError | null {
  if (!isPrismaError(error)) {
    return null;
  }

  const { code, meta } = error;
  const target = meta?.target?.[0];

  switch (code) {
    case PrismaErrorCodes.P2002:
      // Unique constraint violation
      // Tentar identificar o campo para mensagem mais específica
      if (target?.includes('coupon')) {
        return BusinessError.couponAlreadyUsed();
      }
      if (target?.includes('email')) {
        return BusinessError.duplicateEntry('e-mail');
      }
      if (target?.includes('cpf')) {
        return BusinessError.duplicateEntry('CPF');
      }
      if (target?.includes('phone')) {
        return BusinessError.duplicateEntry('telefone');
      }
      return BusinessError.duplicateEntry(target);

    case PrismaErrorCodes.P2003:
      // Foreign key constraint - geralmente recurso não encontrado
      return BusinessError.notFound();

    case PrismaErrorCodes.P2025:
      // Record not found
      return BusinessError.notFound();

    case PrismaErrorCodes.P2034:
      // Transaction conflict - geralmente race condition
      return BusinessError.conflict('Conflito de concorrência. Tente novamente.');

    default:
      return null;
  }
}

/**
 * Verifica se é erro de overbooking (constraint específico)
 * Usado pelo check existente em prisma.ts
 */
export function isOverbookingPrismaError(error: unknown): boolean {
  if (!isPrismaError(error)) {
    return false;
  }
  
  // Verificar se a mensagem menciona overbooking
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    error.code === PrismaErrorCodes.P2002 &&
    (errorMessage.includes('booking') || errorMessage.includes('overlap'))
  );
}
