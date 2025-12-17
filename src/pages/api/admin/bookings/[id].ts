import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
});

/**
 * PATCH /api/admin/bookings/[id] - Atualiza status de uma reserva
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // TODO: Adicionar autenticação admin

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  if (req.method === 'PATCH') {
    try {
      const { status } = updateSchema.parse(req.body);

      const booking = await prisma.booking.update({
        where: { id },
        data: { status },
        include: {
          room: true,
          user: true,
        },
      });

      // Se cancelado, atualizar paymentStatus também
      if (status === 'CANCELLED' && booking.paymentId) {
        await prisma.payment.update({
          where: { id: booking.paymentId },
          data: { status: 'REJECTED' },
        });
      }

      return res.status(200).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('Update booking error:', error);
      return res.status(500).json({ error: 'Erro ao atualizar reserva' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Soft delete - apenas marca como cancelado
      const booking = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return res.status(200).json(booking);
    } catch (error) {
      console.error('Delete booking error:', error);
      return res.status(500).json({ error: 'Erro ao deletar reserva' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
