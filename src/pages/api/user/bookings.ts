// ===========================================================
// API: GET /api/user/bookings - Reservas do usuário
// ===========================================================
// Suporta autenticação via cookie (sessão) OU via phone (legacy)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { decodeSessionToken } from '@/lib/magic-link';

// Nome do cookie de sessão
const USER_SESSION_COOKIE = 'user_session';

// Tipo estendido temporário até Prisma types atualizarem
interface ExtendedBooking {
  id: string;
  roomId: string;
  room: { id: string; name: string };
  startTime: Date;
  endTime: Date;
  status: string;
  paymentStatus: string;
  amountPaid: number;
  creditsUsed: number;
  bookingType: string;
  createdAt: Date;
}

interface BookingItem {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  amountPaid: number;
  creditsUsed: number;
  bookingType: string;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  bookings?: BookingItem[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    const { phone, status, upcoming, page = '1', limit = '10' } = req.query;

    let userId: string | null = null;

    // Primeiro tenta autenticação via cookie (nova forma)
    const sessionToken = req.cookies[USER_SESSION_COOKIE];
    if (sessionToken) {
      userId = decodeSessionToken(sessionToken);
    }

    // Fallback para phone (forma antiga, para compatibilidade)
    if (!userId && phone && typeof phone === 'string') {
      const user = await prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    // Construir filtros
    const where: Record<string, unknown> = { userId };

    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }

    if (upcoming === 'true') {
      where.startTime = { gt: new Date() };
      where.status = { in: ['PENDING', 'CONFIRMED'] };
    }

    // Paginação
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Buscar reservas
    const [bookingsRaw, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          room: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.booking.count({ where }),
    ]);

    // Cast para tipos estendidos (novos campos do Prisma)
    const bookings = bookingsRaw as unknown as ExtendedBooking[];

    return res.status(200).json({
      success: true,
      bookings: bookings.map((b: ExtendedBooking) => ({
        id: b.id,
        roomId: b.roomId,
        roomName: b.room.name,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        paymentStatus: b.paymentStatus,
        amountPaid: b.amountPaid,
        creditsUsed: b.creditsUsed ?? 0,
        bookingType: b.bookingType,
        createdAt: b.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno',
    });
  }
}
