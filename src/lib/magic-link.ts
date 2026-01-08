// ===========================================================
// lib/magic-link.ts - Sistema de Magic Link para autenticação do cliente
// ===========================================================
// Decisões fechadas:
// - Token expira em 12 horas
// - Sessão (cookie) dura 7 dias, renovável a cada acesso
// - Rate limit: 5 magic links por hora por email
// - Token hashado com SHA-256 no banco

import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';
import { addHours, addDays, isAfter, differenceInHours } from 'date-fns';

// ============================================================
// CONSTANTES
// ============================================================

/** Tempo de expiração do magic link em horas */
export const MAGIC_LINK_EXPIRY_HOURS = 12;

/** Tempo de duração da sessão em dias */
export const SESSION_DURATION_DAYS = 7;

/** Máximo de magic links por hora por email */
export const MAX_MAGIC_LINKS_PER_HOUR = 5;

/** Tamanho do token em bytes (256 bits de entropia) */
const TOKEN_BYTES = 32;

// ============================================================
// FUNÇÕES DE HASH E TOKEN
// ============================================================

/**
 * Gera um token aleatório URL-safe
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Calcula hash SHA-256 do token (para armazenar no banco)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Gera token de sessão para o cookie
 * Formato: base64url(userId:randomBytes:timestamp)
 */
export function generateSessionToken(userId: string): string {
  const random = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const payload = `${userId}:${random}:${timestamp}`;
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decodifica token de sessão para obter userId
 * Retorna null se inválido
 */
export function decodeSessionToken(sessionToken: string): string | null {
  try {
    const payload = Buffer.from(sessionToken, 'base64url').toString();
    const [userId] = payload.split(':');
    if (!userId || userId.length < 10) return null;
    return userId;
  } catch {
    return null;
  }
}

// ============================================================
// RATE LIMITING
// ============================================================

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: Date;
}

/**
 * Verifica e atualiza rate limit para magic links
 * Retorna se pode enviar e quantas tentativas restam
 */
export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const oneHourAgo = addHours(now, -1);

  // Busca rate limit existente
  const existing = await prisma.magicLinkRateLimit.findUnique({
    where: { email: normalizedEmail },
  });

  // Se não existe ou janela expirou, permite e reseta
  if (!existing || isAfter(oneHourAgo, existing.windowStart)) {
    await prisma.magicLinkRateLimit.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        attempts: 1,
        windowStart: now,
      },
      update: {
        attempts: 1,
        windowStart: now,
      },
    });

    return {
      allowed: true,
      remainingAttempts: MAX_MAGIC_LINKS_PER_HOUR - 1,
      resetAt: addHours(now, 1),
    };
  }

  // Verifica se atingiu limite
  if (existing.attempts >= MAX_MAGIC_LINKS_PER_HOUR) {
    const resetAt = addHours(existing.windowStart, 1);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetAt,
    };
  }

  // Incrementa tentativas
  await prisma.magicLinkRateLimit.update({
    where: { email: normalizedEmail },
    data: { attempts: { increment: 1 } },
  });

  return {
    allowed: true,
    remainingAttempts: MAX_MAGIC_LINKS_PER_HOUR - existing.attempts - 1,
    resetAt: addHours(existing.windowStart, 1),
  };
}

// ============================================================
// CRIAÇÃO E VALIDAÇÃO DE MAGIC LINK
// ============================================================

interface CreateMagicLinkResult {
  success: boolean;
  token?: string;
  error?: string;
  rateLimited?: boolean;
  resetAt?: Date;
  retryAfterSeconds?: number;
}

/**
 * Cria um novo magic link para o usuário
 * - Verifica rate limit
 * - Gera token aleatório
 * - Salva hash no banco
 * - Retorna token raw (para enviar por email)
 */
export async function createMagicLink(email: string): Promise<CreateMagicLinkResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Busca usuário
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // SEGURANÇA: Não revelar se email existe ou não
  // Sempre retorna sucesso para o cliente (silently fail)
  if (!user) {
    return { success: true }; // Simula sucesso
  }

  // Verifica rate limit
  const rateLimit = await checkRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      success: false,
      rateLimited: true,
      resetAt: rateLimit.resetAt,
      retryAfterSeconds,
      error: `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
    };
  }

  // Gera token e hash
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = addHours(new Date(), MAGIC_LINK_EXPIRY_HOURS);

  // Salva no banco
  await prisma.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    success: true,
    token,
  };
}

interface ValidateMagicLinkResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * Valida um magic link token
 * - Verifica se existe
 * - Verifica se não expirou
 * - Verifica se não foi usado
 * - Marca como usado
 */
export async function validateMagicLink(token: string): Promise<ValidateMagicLinkResult> {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Busca token
  const magicLink = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!magicLink) {
    return { valid: false, error: 'Link inválido ou expirado.' };
  }

  // Verifica expiração
  if (isAfter(now, magicLink.expiresAt)) {
    return { valid: false, error: 'Link expirado. Solicite um novo.' };
  }

  // Verifica se já foi usado
  if (magicLink.usedAt) {
    return { valid: false, error: 'Link já utilizado. Solicite um novo.' };
  }

  // Marca como usado
  await prisma.magicLinkToken.update({
    where: { tokenHash },
    data: { usedAt: now },
  });

  return {
    valid: true,
    userId: magicLink.userId,
  };
}

// ============================================================
// SESSÃO DO CLIENTE
// ============================================================

interface SessionData {
  userId: string;
  email: string;
  name: string;
}

/**
 * Busca dados do usuário pela sessão (userId do cookie)
 */
export async function getSessionUser(userId: string): Promise<SessionData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}

// ============================================================
// LIMPEZA DE TOKENS EXPIRADOS
// ============================================================

/**
 * Remove tokens expirados do banco
 * Deve ser executado periodicamente (cron/job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.magicLinkToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });

  return result.count;
}

/**
 * Limpa rate limits antigos (janelas expiradas)
 */
export async function cleanupOldRateLimits(): Promise<number> {
  const oneHourAgo = addHours(new Date(), -1);
  
  const result = await prisma.magicLinkRateLimit.deleteMany({
    where: {
      windowStart: { lt: oneHourAgo },
    },
  });

  return result.count;
}
