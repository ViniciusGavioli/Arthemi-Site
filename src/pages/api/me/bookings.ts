// ===========================================================
// API: GET /api/me/bookings - Reservas do Usuário Logado
// ===========================================================
// Usa autenticação JWT (cookie arthemi_session)
// Retorna reservas com informações do consultório

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

interface BookingItem {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  bookingType: string;
  amountPaid: number;
  creditsUsed: number;
  createdAt: string;
  canCancel: boolean;        // Se pode cancelar (>= 48h)
  hoursUntilStart: number;   // Horas até o início
}

interface ApiResponse {
  ok: boolean;
  bookings?: {
    upcoming: BookingItem[];
    past: BookingItem[];
  };
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

  // Autenticação JWT
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  try {
    const now = new Date();

    // Buscar todas as reservas do usuário
    const bookings = await prisma.booking.findMany({
      where: {
        userId: auth.userId,
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    // Separar em próximas e passadas
    const upcoming: BookingItem[] = [];
    const past: BookingItem[] = [];

    for (const booking of bookings) {
      const startTime = new Date(booking.startTime);
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isPast = startTime < now;
      
      // Pode cancelar se:
      // - Não é passado
      // - Status não é CANCELLED
      // - Faltam pelo menos 48h
      const canCancel = 
        !isPast && 
        booking.status !== 'CANCELLED' &&
        hoursUntilStart >= MIN_HOURS_TO_CANCEL;

      const item: BookingItem = {
        id: booking.id,
        roomId: booking.roomId,
        roomName: booking.room.name,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingType: booking.bookingType,
        amountPaid: booking.amountPaid,
        creditsUsed: booking.creditsUsed,
        createdAt: booking.createdAt.toISOString(),
        canCancel,
        hoursUntilStart: Math.max(0, Math.floor(hoursUntilStart)),
      };

      if (isPast || booking.status === 'CANCELLED') {
        past.push(item);
      } else {
        upcoming.push(item);
      }
    }

    // Ordenar: próximas por data crescente, passadas por data decrescente
    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return res.status(200).json({
      ok: true,
      bookings: {
        upcoming,
        past,
      },
    });

  } catch (error) {
    console.error('❌ [API /me/bookings] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
