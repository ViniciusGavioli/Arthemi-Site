/**
 * Audit Log - Sistema de Rastreabilidade
 * 
 * Registra ações críticas do sistema para auditoria:
 * - Criação de reservas
 * - Confirmação de pagamentos
 * - Cancelamentos
 * - Ações de admin
 * 
 * Logs são append-only (nunca editados ou deletados)
 */

import { prisma } from './prisma';
import type { NextApiRequest } from 'next';

// Tipos definidos localmente (compatíveis com Prisma)
export type AuditAction = 
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_EXPIRED'
  | 'BOOKING_CANCELLED_EXPIRED'
  | 'BOOKING_MANUAL_CREATED'
  | 'BOOKING_COURTESY_CREATED'
  | 'BOOKING_CANCELLED_AUTO'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_BACKFILL'
  | 'PAYMENT_REFUNDED'
  | 'CREDIT_CREATED'
  | 'CREDIT_CONFIRMED'
  | 'CREDIT_USED'
  | 'CREDIT_EXPIRED'
  | 'CREDIT_REFUNDED'
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT'
  | 'ADMIN_BOOKING_VIEW'
  | 'ADMIN_BOOKING_UPDATE'
  | 'ADMIN_BACKFILL_EXECUTED'
  | 'ALERT_PAYMENT_NOT_CONFIRMED'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'USER_REGISTER'
  | 'USER_PROFILE_UPDATE'
  | 'USER_MAGIC_LINK_REQUESTED'
  | 'USER_MAGIC_LINK_RATE_LIMITED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  // Refund workflow
  | 'REFUND_REQUESTED'
  | 'REFUND_REVIEWING'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUND_PAID';

export type AuditSource = 'USER' | 'ADMIN' | 'SYSTEM';

// Tipos para parâmetros de log
export interface AuditLogParams {
  action: AuditAction;
  source: AuditSource;
  actorId?: string | null;
  actorEmail?: string | null;
  actorIp?: string | null;
  userAgent?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  // Dados de request (opcional)
  req?: NextApiRequest;
}

/**
 * Registra uma ação no log de auditoria
 * 
 * @example
 * // Registrar criação de reserva
 * await logAudit({
 *   action: 'BOOKING_CREATED',
 *   source: 'USER',
 *   actorEmail: 'cliente@email.com',
 *   targetType: 'Booking',
 *   targetId: booking.id,
 *   metadata: { roomId: 1, date: '2024-03-15' },
 *   req
 * });
 */
export async function logAudit({
  action,
  source,
  actorId = null,
  actorEmail = null,
  actorIp: providedActorIp = null,
  userAgent: providedUserAgent = null,
  targetType = null,
  targetId = null,
  metadata = null,
  req
}: AuditLogParams): Promise<void> {
  try {
    // Extrair IP e User-Agent da request (se disponível) ou usar valores fornecidos
    let actorIp: string | null = providedActorIp;
    let userAgent: string | null = providedUserAgent;
    
    if (req && !actorIp) {
      // IP: tentar headers de proxy primeiro
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        actorIp = forwarded.split(',')[0]?.trim() || null;
      } else if (Array.isArray(forwarded)) {
        actorIp = forwarded[0] || null;
      } else {
        // Fallback para socket
        actorIp = req.socket?.remoteAddress || null;
      }
    }
    
    if (req && !userAgent) {
      // User-Agent
      const ua = req.headers['user-agent'];
      if (typeof ua === 'string') {
        // Limitar tamanho para não poluir o banco
        userAgent = ua.substring(0, 500);
      }
    }
    
    await (prisma as any).auditLog.create({
      data: {
        action,
        source,
        actorId,
        actorEmail,
        actorIp,
        userAgent,
        targetType,
        targetId,
        metadata: metadata as object | null
      }
    });
    
    // Log no console também para debug
    console.log(`[AUDIT] ${action} by ${source}${actorEmail ? ` (${actorEmail})` : ''} on ${targetType}:${targetId}`);
    
  } catch (error) {
    // Nunca deixar falha de log quebrar a operação principal
    console.error('[AUDIT ERROR] Falha ao registrar log:', error);
  }
}

/**
 * Helper para logs de sistema (webhooks, crons)
 */
export async function logSystemAction(
  action: AuditAction,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return logAudit({
    action,
    source: 'SYSTEM',
    targetType,
    targetId,
    metadata
  });
}

/**
 * Helper para logs de usuário/cliente
 */
export async function logUserAction(
  action: AuditAction,
  email: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
  req?: NextApiRequest
): Promise<void> {
  return logAudit({
    action,
    source: 'USER',
    actorEmail: email,
    targetType,
    targetId,
    metadata,
    req
  });
}

/**
 * Helper para logs de admin
 * Aceita assinatura flexível para facilitar uso
 */
export async function logAdminAction(
  action: AuditAction,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
  req?: NextApiRequest
): Promise<void> {
  return logAudit({
    action,
    source: 'ADMIN',
    actorId: null,
    actorEmail: 'admin',
    targetType,
    targetId,
    metadata,
    req
  });
}
