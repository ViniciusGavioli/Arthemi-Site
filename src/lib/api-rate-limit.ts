/**
 * API Rate Limit - Em memória (Map)
 * 
 * Rate limit por IP + endpoint sem dependência externa.
 * Padrão: 3 requisições por minuto por IP por endpoint.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Estrutura: Map<"endpoint:ip", RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpeza automática a cada 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 min
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const expired: string[] = [];
    rateLimitStore.forEach((entry, key) => {
      if (now - entry.windowStart > 2 * 60 * 1000) {
        expired.push(key);
      }
    });
    expired.forEach((k) => rateLimitStore.delete(k));
  }, CLEANUP_INTERVAL);
  // Não bloquear o processo
  if (cleanupTimer.unref) cleanupTimer.unref();
}

startCleanup();

export interface ApiRateLimitConfig {
  windowMs: number;    // Janela em milissegundos
  maxRequests: number; // Máximo de requisições na janela
}

export interface ApiRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// Configuração padrão: 3 req / 60s
const DEFAULT_CONFIG: ApiRateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minuto
  maxRequests: 3,
};

/**
 * Verifica rate limit por IP + endpoint (em memória).
 * @param endpoint Identificador do endpoint (ex: 'bookings', 'credits/purchase', 'auth/login')
 * @param ip IP do cliente
 * @param config Configuração opcional
 * @returns Resultado com allowed, remaining, resetAt
 */
export function checkApiRateLimit(
  endpoint: string,
  ip: string,
  config: ApiRateLimitConfig = DEFAULT_CONFIG
): ApiRateLimitResult {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Se não existe ou janela expirou, cria novo
  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now + config.windowMs),
    };
  }

  // Verifica se atingiu limite
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.windowStart + config.windowMs),
    };
  }

  // Incrementa contador
  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: new Date(entry.windowStart + config.windowMs),
  };
}

/**
 * Extrai IP do cliente da requisição Next.js
 */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Mensagem segura para retornar ao cliente quando rate limited.
 */
export const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';

/**
 * Limpa o store de rate limit (útil para testes).
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Retorna o tamanho do store (útil para testes).
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}
