import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bookings/[id] - Busca detalhes de uma reserva específica
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            description: true,
            hourlyRate: true,
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
            type: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    return res.status(200).json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    return res.status(500).json({ error: 'Erro ao buscar reserva' });
  }
}
