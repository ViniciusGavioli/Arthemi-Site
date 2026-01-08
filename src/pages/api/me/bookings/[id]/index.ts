// ===========================================================
// API: GET /api/me/bookings/[id] - Detalhes de Reserva
// ===========================================================
// P-004: Proteger com autenticação JWT + ownership check
// Retorna detalhes da reserva sem expor PII de outros usuários

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

interface BookingDetail {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  financialStatus: string;
  bookingType: string;
  amountPaid: number;
  creditsUsed: number;
  createdAt: string;
  canCancel: boolean;
  hoursUntilStart: number;
  notes?: string | null;
}

interface ApiResponse {
  ok: boolean;
  booking?: BookingDetail;
  error?: string;
}

// Constante: mínimo de horas para cancelamento
const MIN_HOURS_TO_CANCEL = 48;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // P-004: Exigir autenticação JWT
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  // ID da reserva
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'ID da reserva é obrigatório' });
  }

  try {
    // Buscar reserva
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Verificar se existe
    if (!booking) {
      return res.status(404).json({ ok: false, error: 'Reserva não encontrada' });
    }

    // P-004: Verificar ownership - usuário só pode ver suas próprias reservas
    // Admin (via JWT role) pode ver qualquer reserva
    if (booking.userId !== auth.userId && auth.role !== 'ADMIN') {
      return res.status(403).json({ ok: false, error: 'Acesso não autorizado' });
    }

    // Calcular campos derivados
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isPast = startTime < now;

    const canCancel = 
      !isPast && 
      booking.status !== 'CANCELLED' &&
      hoursUntilStart >= MIN_HOURS_TO_CANCEL;

    // P-004: Retornar dados SEM expor PII (email, phone, cpf de outros usuários)
    const response: BookingDetail = {
      id: booking.id,
      roomId: booking.roomId,
      roomName: booking.room.name,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      financialStatus: booking.financialStatus,
      bookingType: booking.bookingType,
      amountPaid: booking.amountPaid,
      creditsUsed: booking.creditsUsed,
      createdAt: booking.createdAt.toISOString(),
      canCancel,
      hoursUntilStart: Math.max(0, Math.floor(hoursUntilStart)),
      notes: booking.notes,
    };

    return res.status(200).json({ ok: true, booking: response });

  } catch (error) {
    console.error('[GET /api/me/bookings/[id]] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
}
