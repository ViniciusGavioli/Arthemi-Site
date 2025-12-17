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

  // TODO: Adicionar autenticação admin
  // const session = await getSession({ req });
  // if (!session || session.user.role !== 'ADMIN') {
  //   return res.status(401).json({ error: 'Não autorizado' });
  // }

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

    // Buscar reservas
    const bookings = await prisma.booking.findMany({
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
    });

    // Calcular estatísticas
    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
      pending: bookings.filter(b => b.status === 'PENDING').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      revenue: bookings
        .filter(b => b.status === 'CONFIRMED' && b.paymentStatus === 'APPROVED')
        .reduce((sum, b) => sum + (b.amountPaid || 0), 0),
    };

    return res.status(200).json({ bookings, stats });
  } catch (error) {
    console.error('Admin bookings error:', error);
    return res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
}
