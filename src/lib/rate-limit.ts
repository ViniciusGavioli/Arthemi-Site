import { prisma } from './prisma';
import { addMinutes } from 'date-fns';

interface RateLimitConfig {
  windowMinutes: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate limiting genérico baseado em identificador (IP, userId, etc)
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig = { windowMinutes: 60, maxRequests: 10 }
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = addMinutes(now, -config.windowMinutes);
  const key = `${action}:${identifier}`;

  // Busca rate limit existente
  const existing = await prisma.rateLimit.findUnique({
    where: { key },
  });

  // Se não existe ou janela expirou, cria novo
  if (!existing || existing.windowStart < windowStart) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        requests: 1,
        windowStart: now,
      },
      update: {
        requests: 1,
        windowStart: now,
      },
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: addMinutes(now, config.windowMinutes),
    };
  }

  // Verifica se atingiu limite
  if (existing.requests >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: addMinutes(existing.windowStart, config.windowMinutes),
    };
  }

  // Incrementa contador
  await prisma.rateLimit.update({
    where: { key },
    data: { requests: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: config.maxRequests - existing.requests - 1,
    resetAt: addMinutes(existing.windowStart, config.windowMinutes),
  };
}

/**
 * Limpa rate limits expirados (executar em cron job)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: {
      windowStart: { lt: addMinutes(new Date(), -120) }, // Limpa > 2h
    },
  });
  return result.count;
}