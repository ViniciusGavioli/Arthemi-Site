// ===========================================================
// API: GET /api/admin/refunds - Listar pedidos de estorno (Admin)
// ===========================================================
// Requer autenticação JWT com role ADMIN

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import type { RefundStatus } from '@prisma/client';

interface RefundItem {
  id: string;
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  roomName: string;
  bookingStart: string;
  bookingEnd: string;
  amount: number;
  pixKeyType: string;
  pixKey: string;
  status: string;
  reason: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  proofUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  ok: boolean;
  refunds?: RefundItem[];
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
    // Filtro opcional por status
    const { status } = req.query;
    const whereClause: { status?: RefundStatus } = {};
    
    if (status && typeof status === 'string') {
      const validStatuses: RefundStatus[] = ['REQUESTED', 'REVIEWING', 'APPROVED', 'PAID', 'REJECTED'];
      if (validStatuses.includes(status as RefundStatus)) {
        whereClause.status = status as RefundStatus;
      }
    }

    // Buscar pedidos de estorno
    const refunds = await prisma.refundRequest.findMany({
      where: whereClause,
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
        reviewer: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Formatar resposta
    const formattedRefunds: RefundItem[] = refunds.map((refund) => ({
      id: refund.id,
      bookingId: refund.bookingId,
      userId: refund.userId,
      userEmail: refund.user.email,
      userName: refund.user.name,
      roomName: refund.booking.room.name,
      bookingStart: refund.booking.startTime.toISOString(),
      bookingEnd: refund.booking.endTime.toISOString(),
      amount: refund.amount,
      pixKeyType: refund.pixKeyType,
      pixKey: refund.pixKey,
      status: refund.status,
      reason: refund.reason,
      reviewNotes: refund.reviewNotes,
      rejectionReason: refund.rejectionReason,
      proofUrl: refund.proofUrl,
      reviewedBy: refund.reviewer?.email || null,
      reviewedAt: refund.reviewedAt?.toISOString() || null,
      paidAt: refund.paidAt?.toISOString() || null,
      createdAt: refund.createdAt.toISOString(),
    }));

    return res.status(200).json({
      ok: true,
      refunds: formattedRefunds,
      total: formattedRefunds.length,
    });

  } catch (error) {
    console.error('❌ [API /admin/refunds] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
