// ===========================================================
// lib/email-activation.ts - Tokens de Ativação de Email
// ===========================================================
// Usado para: checkout anônimo -> ativação de conta -> definir senha
// Segurança: Token hash com PEPPER, expiração 12h

import { randomBytes, createHash } from 'crypto';

// ============================================================
// CONSTANTES
// ============================================================

const TOKEN_EXPIRY_HOURS = 12;
const TOKEN_BYTES = 32;

// PEPPER para hash de tokens (em produção, deve estar em env)
const EMAIL_TOKEN_PEPPER = process.env.EMAIL_TOKEN_PEPPER || 'arthemi-email-token-pepper-dev-2025';

// ============================================================
// GERAÇÃO DE TOKEN
// ============================================================

export interface ActivationToken {
  rawToken: string;    // Token para enviar no email (base64url)
  tokenHash: string;   // Hash para salvar no banco
  expiresAt: Date;     // Data de expiração
}

/**
 * Gera token de ativação de conta
 * - rawToken: enviado no email (nunca salvo no banco)
 * - tokenHash: SHA-256 + PEPPER (salvo no banco)
 */
export function generateActivationToken(): ActivationToken {
  // Gerar bytes aleatórios
  const buffer = randomBytes(TOKEN_BYTES);
  
  // Converter para base64url (URL-safe)
  const rawToken = buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Criar hash do token + pepper
  const tokenHash = hashActivationToken(rawToken);
  
  // Calcular expiração
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);
  
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Hash do token raw para verificação
 * SHA-256(rawToken + PEPPER)
 */
export function hashActivationToken(rawToken: string): string {
  return createHash('sha256')
    .update(rawToken + EMAIL_TOKEN_PEPPER)
    .digest('hex');
}

// ============================================================
// VALIDAÇÃO DE TOKEN
// ============================================================

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
  error?: 'INVALID' | 'EXPIRED' | 'USED';
}

/**
 * Valida token de ativação
 * Retorna userId se válido
 */
export async function validateActivationToken(
  rawToken: string,
  prisma: {
    emailActivationToken: {
      findUnique: (args: {
        where: { tokenHash: string };
        select: { id: true; userId: true; expiresAt: true; usedAt: true };
      }) => Promise<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null } | null>;
    };
  }
): Promise<TokenValidationResult> {
  if (!rawToken || rawToken.length < 20) {
    return { valid: false, error: 'INVALID' };
  }
  
  const tokenHash = hashActivationToken(rawToken);
  
  const tokenRecord = await prisma.emailActivationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  
  if (!tokenRecord) {
    return { valid: false, error: 'INVALID' };
  }
  
  if (tokenRecord.usedAt) {
    return { valid: false, error: 'USED' };
  }
  
  if (tokenRecord.expiresAt < new Date()) {
    return { valid: false, error: 'EXPIRED' };
  }
  
  return {
    valid: true,
    userId: tokenRecord.userId,
    tokenId: tokenRecord.id,
  };
}

// ============================================================
// CONSTRUÇÃO DE URL
// ============================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

/**
 * Monta URL de ativação para o email
 */
export function buildActivationUrl(rawToken: string): string {
  return `${APP_URL}/verificar-email?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Monta URL para criar senha (após verificação)
 */
export function buildSetPasswordUrl(rawToken: string): string {
  return `${APP_URL}/criar-senha?token=${encodeURIComponent(rawToken)}`;
}
