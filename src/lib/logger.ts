// ===========================================================
// lib/logger.ts - Sistema de Logs Padronizados
// ===========================================================
// Logs estruturados para observabilidade
// NÃO loga dados sensíveis (CPF, email completo, tokens)

import prisma from './prisma';

// ============================================================
// TIPOS
// ============================================================

export type LogLevel = 'info' | 'warn' | 'error';

export type LogCategory = 
  | 'PAYMENT'
  | 'WEBHOOK'
  | 'BOOKING'
  | 'EMAIL'
  | 'AUTH'
  | 'SYSTEM';

interface LogContext {
  bookingId?: string;
  userId?: string;
  paymentId?: string;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface SystemEvent {
  category: LogCategory;
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
}

// ============================================================
// SANITIZAÇÃO (remove dados sensíveis)
// ============================================================

/**
 * Mascara dados sensíveis para logs seguros
 */
function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['cpf', 'token', 'password', 'secret', 'apiKey', 'authorization'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    // Mascarar campos sensíveis
    if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '***REDACTED***';
    } 
    // Mascarar email parcialmente
    else if (keyLower.includes('email') && typeof value === 'string') {
      const parts = value.split('@');
      if (parts.length === 2) {
        sanitized[key] = `${parts[0].slice(0, 2)}***@${parts[1]}`;
      } else {
        sanitized[key] = '***@***';
      }
    }
    // Mascarar telefone parcialmente
    else if (keyLower.includes('phone') && typeof value === 'string') {
      sanitized[key] = value.slice(0, 4) + '****' + value.slice(-2);
    }
    // Recursivo para objetos
    else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    }
    // Manter valor original
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================
// LOGGER PRINCIPAL
// ============================================================

/**
 * Log padronizado com estrutura consistente
 */
function log(event: SystemEvent): void {
  const { category, level, message, context, timestamp } = event;
  
  // Sanitizar contexto
  const safeContext = context ? sanitizeForLog(context as Record<string, unknown>) : {};
  
  // Formato estruturado
  const logEntry = {
    timestamp: timestamp.toISOString(),
    level: level.toUpperCase(),
    category,
    message,
    ...safeContext,
  };

  // Log no console (formato estruturado em produção)
  const logString = `[${category}] ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logString, safeContext);
      break;
    case 'warn':
      console.warn(logString, safeContext);
      break;
    default:
      console.log(logString, safeContext);
  }
}

// ============================================================
// HELPERS POR CATEGORIA
// ============================================================

export const logger = {
  // Pagamentos
  payment: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'PAYMENT', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'PAYMENT', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'PAYMENT', level: 'error', message, context, timestamp: new Date() }),
  },

  // Webhooks
  webhook: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'WEBHOOK', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'WEBHOOK', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'WEBHOOK', level: 'error', message, context, timestamp: new Date() }),
  },

  // Bookings
  booking: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'BOOKING', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'BOOKING', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'BOOKING', level: 'error', message, context, timestamp: new Date() }),
  },

  // Email
  email: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'EMAIL', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'EMAIL', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'EMAIL', level: 'error', message, context, timestamp: new Date() }),
  },

  // Autenticação
  auth: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'AUTH', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'AUTH', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'AUTH', level: 'error', message, context, timestamp: new Date() }),
  },

  // Sistema
  system: {
    info: (message: string, context?: LogContext) => 
      log({ category: 'SYSTEM', level: 'info', message, context, timestamp: new Date() }),
    warn: (message: string, context?: LogContext) => 
      log({ category: 'SYSTEM', level: 'warn', message, context, timestamp: new Date() }),
    error: (message: string, context?: LogContext) => 
      log({ category: 'SYSTEM', level: 'error', message, context, timestamp: new Date() }),
  },
};

// ============================================================
// MÉTRICAS (contadores simples)
// ============================================================

export type MetricName = 
  | 'payment_attempts'
  | 'payment_success'
  | 'payment_failure'
  | 'booking_created'
  | 'booking_cancelled'
  | 'email_sent'
  | 'email_failed'
  | 'webhook_received'
  | 'webhook_failed';

/**
 * Incrementa contador de métrica no banco
 * Agrupa por dia para facilitar consultas
 */
export async function incrementMetric(name: MetricName): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `metric:${name}:${today}`;

    await prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: '1',
        type: 'number',
        category: 'metrics',
        description: `Métrica: ${name}`,
        isActive: true,
      },
      update: {
        value: {
          increment: 1,
        } as any, // Prisma não suporta increment em string, vamos fazer diferente
      },
    });
  } catch (error) {
    // Fallback: incremento manual
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `metric:${name}:${today}`;
      
      const existing = await prisma.setting.findUnique({ where: { key } });
      const currentValue = existing ? parseInt(existing.value, 10) || 0 : 0;
      
      await prisma.setting.upsert({
        where: { key },
        create: {
          key,
          value: '1',
          type: 'number',
          category: 'metrics',
          description: `Métrica: ${name}`,
          isActive: true,
        },
        update: {
          value: String(currentValue + 1),
        },
      });
    } catch (innerError) {
      // Silencioso - métricas não podem quebrar o sistema
      console.warn('[METRICS] Falha ao incrementar métrica:', name);
    }
  }
}

/**
 * Obtém métricas de um período
 */
export async function getMetrics(days: number = 7): Promise<Record<string, number>> {
  try {
    const metrics = await prisma.setting.findMany({
      where: {
        category: 'metrics',
        key: { startsWith: 'metric:' },
      },
      orderBy: { key: 'desc' },
    });

    const result: Record<string, number> = {};
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const metric of metrics) {
      // Extrair nome e data do key: metric:payment_success:2025-12-27
      const parts = metric.key.split(':');
      if (parts.length >= 3) {
        const metricDate = parts[2];
        if (new Date(metricDate) >= cutoffDate) {
          const metricName = parts[1];
          result[metricName] = (result[metricName] || 0) + parseInt(metric.value, 10);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[METRICS] Erro ao buscar métricas:', error);
    return {};
  }
}

/**
 * Registra evento de erro para exibição no admin
 */
export async function logSystemError(
  category: LogCategory,
  message: string,
  errorCode?: string
): Promise<void> {
  try {
    const key = `error:last:${category.toLowerCase()}`;
    
    await prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify({
          message,
          errorCode,
          timestamp: new Date().toISOString(),
        }),
        type: 'json',
        category: 'errors',
        isActive: true,
      },
      update: {
        value: JSON.stringify({
          message,
          errorCode,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Também incrementar contador de erro
    await incrementMetric(`${category.toLowerCase()}_failed` as MetricName).catch(() => {});
  } catch (error) {
    console.warn('[METRICS] Falha ao registrar erro:', category);
  }
}

/**
 * Obtém últimos erros registrados
 */
export async function getLastErrors(): Promise<Record<string, { message: string; errorCode?: string; timestamp: string }>> {
  try {
    const errors = await prisma.setting.findMany({
      where: {
        category: 'errors',
        key: { startsWith: 'error:last:' },
      },
    });

    const result: Record<string, { message: string; errorCode?: string; timestamp: string }> = {};
    
    for (const error of errors) {
      const category = error.key.replace('error:last:', '').toUpperCase();
      try {
        result[category] = JSON.parse(error.value);
      } catch {
        result[category] = { message: error.value, timestamp: error.updatedAt.toISOString() };
      }
    }

    return result;
  } catch (error) {
    console.error('[METRICS] Erro ao buscar últimos erros:', error);
    return {};
  }
}
