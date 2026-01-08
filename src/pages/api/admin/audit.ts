// ===========================================================
// API: GET /api/admin/audit
// ===========================================================
// Endpoint read-only para visualizar logs de auditoria
// FASE 3.3: Logs de Auditoria

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import type { AuditAction, AuditSource } from '@/lib/audit';

// Valores válidos para validação
const VALID_ACTIONS: AuditAction[] = [
  'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_EXPIRED',
  'PAYMENT_RECEIVED', 'PAYMENT_FAILED',
  'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'ADMIN_BOOKING_VIEW', 'ADMIN_BOOKING_UPDATE'
];
const VALID_SOURCES: AuditSource[] = ['USER', 'ADMIN', 'SYSTEM'];

interface AuditLogEntry {
  id: string;
  action: AuditAction;
  source: AuditSource;
  actorId: string | null;
  actorEmail: string | null;
  actorIp: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AuditResponse {
  success: boolean;
  logs?: AuditLogEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuditResponse>
) {
  // Apenas GET permitido (read-only)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido' 
    });
  }

  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

  try {
    // ========================================================
    // PARÂMETROS DE CONSULTA
    // ========================================================
    const {
      page = '1',
      pageSize = '50',
      action,
      source,
      targetType,
      targetId,
      actorEmail,
      startDate,
      endDate,
    } = req.query;

    // Validar paginação
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize as string, 10) || 50));
    const skip = (pageNum - 1) * pageSizeNum;

    // ========================================================
    // CONSTRUIR FILTROS
    // ========================================================
    const where: {
      action?: AuditAction;
      source?: AuditSource;
      targetType?: string;
      targetId?: string;
      actorEmail?: { contains: string; mode: 'insensitive' };
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    // Filtro por action
    if (action && typeof action === 'string') {
      if (VALID_ACTIONS.includes(action as AuditAction)) {
        where.action = action as AuditAction;
      }
    }

    // Filtro por source
    if (source && typeof source === 'string') {
      if (VALID_SOURCES.includes(source as AuditSource)) {
        where.source = source as AuditSource;
      }
    }

    // Filtro por target
    if (targetType && typeof targetType === 'string') {
      where.targetType = targetType;
    }
    if (targetId && typeof targetId === 'string') {
      where.targetId = targetId;
    }

    // Filtro por ator
    if (actorEmail && typeof actorEmail === 'string') {
      where.actorEmail = { contains: actorEmail, mode: 'insensitive' };
    }

    // Filtro por data
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // ========================================================
    // BUSCAR LOGS
    // ========================================================
    const auditLogModel = (prisma as any).auditLog;
    
    const [logs, total] = await Promise.all([
      auditLogModel.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
        skip,
        take: pageSizeNum,
        select: {
          id: true,
          action: true,
          source: true,
          actorId: true,
          actorEmail: true,
          actorIp: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
          // Não incluir userAgent para reduzir payload
        },
      }),
      auditLogModel.count({ where }),
    ]);

    // Formatar resposta
    const formattedLogs: AuditLogEntry[] = logs.map((log: any) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      logs: formattedLogs,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
    });

  } catch (error) {
    console.error('[AUDIT API] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar logs de auditoria',
    });
  }
}
