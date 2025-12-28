import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/bookings - Lista reservas para o painel admin
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticação admin
  const adminToken = req.cookies.admin_token;
  if (!adminToken) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const { roomId, status, startDate, endDate } = req.query;

    // Construir filtros
    const where: Record<string, unknown> = {};
    
    if (roomId && roomId !== 'all') {
      where.roomId = roomId;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        (where.startTime as Record<string, Date>).gte = new Date(startDate as string);
      }
      if (endDate) {
        (where.startTime as Record<string, Date>).lte = new Date(endDate as string);
      }
    }

    // Stats globais: início do mês atual (UTC)
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    // Buscar reservas filtradas + stats globais em paralelo
    const [bookings, confirmedCount, revenueResult] = await Promise.all([
      // Reservas filtradas (para lista/calendário)
      prisma.booking.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      }),
      // Confirmadas do mês (global)
      prisma.booking.count({
        where: {
          startTime: { gte: startOfMonth },
          status: 'CONFIRMED',
        },
      }),
      // Receita do mês: CONFIRMED + (APPROVED ou manual)
      prisma.booking.aggregate({
        where: {
          startTime: { gte: startOfMonth },
          status: 'CONFIRMED',
          OR: [
            { paymentStatus: 'APPROVED' },
            { isManual: true },
          ],
        },
        _sum: { amountPaid: true },
      }),
    ]);

    // Calcular estatísticas
    const stats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'PENDING').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      confirmed: confirmedCount,
      revenue: revenueResult._sum.amountPaid || 0,
    };

    return res.status(200).json({ bookings, stats });
  } catch (error) {
    console.error('Admin bookings error:', error);
    return res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
}
