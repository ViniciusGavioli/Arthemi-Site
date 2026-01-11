// ===========================================================
// API: GET /api/admin/refunds/pending - Listar refunds pendentes/parciais
// ===========================================================
// Retorna refunds com status=PENDING ou isPartial=true
// Usado para revisão manual de refunds parciais do gateway

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

interface PendingRefundItem {
  id: string;
  bookingId: string;
  userId: string;
  userName: string;
  userEmail: string;
  roomName: string;
  bookingDate: string;
  expectedAmount: number;
  refundedAmount: number;
  creditsReturned: number;
  moneyReturned: number;
  totalRefunded: number;
  isPartial: boolean;
  status: string;
  gateway: string;
  externalRefundId: string | null;
  reason: string | null;
  createdAt: string;
}

interface ApiResponse {
  ok: boolean;
  refunds?: PendingRefundItem[];
  total?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Autenticação JWT + role ADMIN
  const auth = requireRole(req, res, 'ADMIN');
  if (!auth) return; // 401/403 já enviado

  try {
    // Buscar refunds pendentes ou parciais
    const refunds = await prisma.refund.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { isPartial: true },
        ],
      },
      include: {
        booking: {
          include: {
            room: {
              select: { name: true },
            },
          },
        },
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Formatar resposta
    const formattedRefunds: PendingRefundItem[] = refunds.map((refund) => ({
      id: refund.id,
      bookingId: refund.bookingId,
      userId: refund.userId,
      userName: refund.user.name,
      userEmail: refund.user.email,
      roomName: refund.booking.room.name,
      bookingDate: refund.booking.startTime.toISOString(),
      expectedAmount: refund.expectedAmount || 0,
      refundedAmount: refund.refundedAmount || 0,
      creditsReturned: refund.creditsReturned,
      moneyReturned: refund.moneyReturned,
      totalRefunded: refund.totalRefunded,
      isPartial: refund.isPartial,
      status: refund.status,
      gateway: refund.gateway,
      externalRefundId: refund.externalRefundId,
      reason: refund.reason,
      createdAt: refund.createdAt.toISOString(),
    }));

    return res.status(200).json({
      ok: true,
      refunds: formattedRefunds,
      total: formattedRefunds.length,
    });

  } catch (error) {
    console.error('❌ [admin/refunds/pending] Erro:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro ao buscar refunds pendentes',
    });
  }
}
