import type { NextApiResponse } from 'next';

/**
 * API Rate Limit - Em memória (Map)
 * 
 * Rate limit por IP + endpoint sem dependência externa.
 * Padrão: 15 requisições por minuto por IP por endpoint.
 * Backoff progressivo: 10s, 20s, 40s, 80s, até 120s (2min)
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface BlockEntry {
  blockCount: number;      // Quantas vezes foi bloqueado
  blockedUntil: number;    // Timestamp até quando está bloqueado
  lastBlockTime: number;   // Quando foi o último bloqueio
}

// Estrutura: Map<"endpoint:ip", RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>();

// Estrutura para backoff progressivo: Map<"endpoint:ip", BlockEntry>
const blockStore = new Map<string, BlockEntry>();

// Limpeza automática a cada 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 min
let cleanupTimer: NodeJS.Timeout | null = null;

// Configurações de backoff
const BACKOFF_BASE_SECONDS = 10;     // 10 segundos inicial
const BACKOFF_MAX_SECONDS = 120;     // 2 minutos máximo
const BACKOFF_RESET_AFTER_MS = 10 * 60 * 1000; // Reset contador após 10min sem bloqueios

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const expiredRate: string[] = [];
    const expiredBlock: string[] = [];
    
    // Limpar rate limit entries antigas
    rateLimitStore.forEach((entry, key) => {
      if (now - entry.windowStart > 2 * 60 * 1000) {
        expiredRate.push(key);
      }
    });
    expiredRate.forEach((k) => rateLimitStore.delete(k));
    
    // Limpar block entries antigas (após 30min do último bloqueio)
    blockStore.forEach((entry, key) => {
      if (now - entry.lastBlockTime > BACKOFF_RESET_AFTER_MS) {
        expiredBlock.push(key);
      }
    });
    expiredBlock.forEach((k) => blockStore.delete(k));
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
  retryAfterSeconds?: number;  // Segundos até poder tentar novamente (quando bloqueado)
}

// Configuração padrão: 15 req / 60s
const DEFAULT_CONFIG: ApiRateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minuto
  maxRequests: 15,       // 15 tentativas
};

/**
 * Calcula o tempo de bloqueio baseado no número de bloqueios anteriores.
 * Backoff exponencial: 10s, 20s, 40s, 80s, 120s (teto)
 */
function calculateBackoffSeconds(blockCount: number): number {
  const seconds = BACKOFF_BASE_SECONDS * Math.pow(2, blockCount - 1);
  return Math.min(seconds, BACKOFF_MAX_SECONDS);
}

/**
 * Verifica rate limit por IP + endpoint (em memória).
 * Inclui backoff progressivo para bloqueios repetidos.
 * 
 * @param endpoint Identificador do endpoint (ex: 'bookings', 'credits/purchase', 'auth/login')
 * @param ip IP do cliente
 * @param config Configuração opcional
 * @returns Resultado com allowed, remaining, resetAt, retryAfterSeconds
 */
export function checkApiRateLimit(
  endpoint: string,
  ip: string,
  config: ApiRateLimitConfig = DEFAULT_CONFIG
): ApiRateLimitResult {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  
  // Primeiro verificar se está em período de bloqueio (backoff)
  const blockEntry = blockStore.get(key);
  if (blockEntry && now < blockEntry.blockedUntil) {
    const retryAfterSeconds = Math.ceil((blockEntry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(blockEntry.blockedUntil),
      retryAfterSeconds,
    };
  }
  
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
    // Aplicar backoff progressivo
    const currentBlockEntry = blockStore.get(key);
    let newBlockCount = 1;
    
    // Se já foi bloqueado antes e não passou muito tempo, incrementa
    if (currentBlockEntry && now - currentBlockEntry.lastBlockTime < BACKOFF_RESET_AFTER_MS) {
      newBlockCount = currentBlockEntry.blockCount + 1;
    }
    
    const backoffSeconds = calculateBackoffSeconds(newBlockCount);
    const blockedUntil = now + (backoffSeconds * 1000);
    
    blockStore.set(key, {
      blockCount: newBlockCount,
      blockedUntil,
      lastBlockTime: now,
    });
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(blockedUntil),
      retryAfterSeconds: backoffSeconds,
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
 * Gera mensagem amigável com tempo de espera.
 * @param retryAfterSeconds Segundos até poder tentar novamente
 */
export function getRateLimitMessage(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds) {
    return RATE_LIMIT_MESSAGE;
  }
  
  if (retryAfterSeconds < 60) {
    return `Muitas tentativas. Tente novamente em ${retryAfterSeconds} segundos.`;
  }
  
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes > 1 ? 's' : ''}.`;
}

/**
 * Limpa o store de rate limit (útil para testes).
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
  blockStore.clear();
}

/**
 * Retorna o tamanho do store (útil para testes).
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/**
 * Retorna o tamanho do blockStore (útil para testes).
 */
export function getBlockStoreSize(): number {
  return blockStore.size;
}

/**
 * Exporta constantes de backoff para testes.
 */
export const BACKOFF_CONFIG = {
  baseSeconds: BACKOFF_BASE_SECONDS,
  maxSeconds: BACKOFF_MAX_SECONDS,
  resetAfterMs: BACKOFF_RESET_AFTER_MS,
};

/**
 * Helper para retornar resposta 429 com headers corretos.
 * Deve ser usado em todas as APIs que usam rate limit.
 * 
 * @param res - Response do Next.js
 * @param result - Resultado do checkApiRateLimit
 * @param customMessage - Mensagem customizada (opcional)
 */
export function sendRateLimitResponse<T>(
  res: NextApiResponse<T>,
  result: ApiRateLimitResult,
  customMessage?: string
): void {
  const retryAfter = result.retryAfterSeconds || 60;
  
  res.setHeader('Retry-After', retryAfter);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
  
  res.status(429).json({
    success: false,
    error: customMessage || getRateLimitMessage(result.retryAfterSeconds),
  } as T);
}
