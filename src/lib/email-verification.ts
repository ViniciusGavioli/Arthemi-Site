// ===========================================================
// Lib: Email Verification - Verificação de e-mail para agendamentos
// ===========================================================
// Bloqueia criação de bookings se o usuário não verificou o email
// Não bloqueia compra de créditos ou login

import { prisma } from '@/lib/prisma';

/**
 * Código de erro padronizado para email não verificado
 */
export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

/**
 * Mensagem de erro padronizada
 */
export const EMAIL_NOT_VERIFIED_MESSAGE = 'Você precisa verificar seu e-mail para agendar.';

/**
 * Resultado da verificação de email
 */
export interface EmailVerificationResult {
  verified: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Verifica se o usuário tem email verificado
 * @param userId ID do usuário
 * @returns Resultado da verificação
 */
export async function checkEmailVerified(userId: string): Promise<EmailVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });

  if (!user) {
    return {
      verified: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado',
      },
    };
  }

  if (!user.emailVerifiedAt) {
    return {
      verified: false,
      error: {
        code: EMAIL_NOT_VERIFIED_CODE,
        message: EMAIL_NOT_VERIFIED_MESSAGE,
      },
    };
  }

  return { verified: true };
}

/**
 * Verifica se o usuário pode agendar (email verificado)
 * Use em endpoints de criação de booking
 * @param userId ID do usuário
 * @returns { canBook: true } ou { canBook: false, response: {...} }
 */
export async function requireEmailVerifiedForBooking(userId: string): Promise<{
  canBook: boolean;
  response?: {
    status: number;
    body: {
      ok: false;
      code: string;
      message: string;
    };
  };
}> {
  const result = await checkEmailVerified(userId);

  if (!result.verified) {
    return {
      canBook: false,
      response: {
        status: 403,
        body: {
          ok: false,
          code: result.error?.code || EMAIL_NOT_VERIFIED_CODE,
          message: result.error?.message || EMAIL_NOT_VERIFIED_MESSAGE,
        },
      },
    };
  }

  return { canBook: true };
}
