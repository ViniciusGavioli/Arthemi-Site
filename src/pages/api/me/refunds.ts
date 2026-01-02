// ===========================================================
// API: GET /api/me/refunds - Listar pedidos de estorno do usuário
// ===========================================================
// Usa autenticação JWT (cookie arthemi_session)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

interface RefundItem {
  id: string;
  bookingId: string;
  roomName: string;
  bookingStart: string;
  bookingEnd: string;
  amount: number;
  pixKeyType: string;
  pixKey: string;
  status: string;
  reason: string | null;
  rejectionReason: string | null;
  proofUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  ok: boolean;
  refunds?: RefundItem[];
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

  // Autenticação JWT
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  try {
    // Buscar pedidos de estorno do usuário
    const refunds = await prisma.refundRequest.findMany({
      where: { userId: auth.userId },
      include: {
        booking: {
          include: {
            room: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Formatar resposta
    const formattedRefunds: RefundItem[] = refunds.map((refund) => ({
      id: refund.id,
      bookingId: refund.bookingId,
      roomName: refund.booking.room.name,
      bookingStart: refund.booking.startTime.toISOString(),
      bookingEnd: refund.booking.endTime.toISOString(),
      amount: refund.amount,
      pixKeyType: refund.pixKeyType,
      pixKey: refund.pixKey,
      status: refund.status,
      reason: refund.reason,
      rejectionReason: refund.rejectionReason,
      proofUrl: refund.proofUrl,
      paidAt: refund.paidAt?.toISOString() || null,
      createdAt: refund.createdAt.toISOString(),
    }));

    return res.status(200).json({
      ok: true,
      refunds: formattedRefunds,
    });

  } catch (error) {
    console.error('❌ [API /me/refunds] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
