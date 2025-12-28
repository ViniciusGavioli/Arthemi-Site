import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logUserAction } from '@/lib/audit';
import { MIN_CANCELLATION_HOURS } from '@/lib/business-rules';
import { getPaymentByExternalReference, isPaymentStatusConfirmed } from '@/lib/asaas';

/**
 * API /api/bookings/[id]
 * GET - Busca detalhes de uma reserva específica
 * PATCH - Atualiza status da reserva (cancelamento público)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  // ========================================================
  // GET - Buscar reserva
  // ========================================================
  if (req.method === 'GET') {
    // ======================================================
    // CACHE CONTROL: Dados transacionais NUNCA devem ser cacheados
    // O status da reserva muda via webhook (PENDING → CONFIRMED)
    // e o cliente precisa receber dados frescos em cada polling.
    // ======================================================
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

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

      getPaymentByExternalReference(booking.id).then(payment => {
        if (payment) {
          const isConfirmed = isPaymentStatusConfirmed(payment.status);
          console.log(`🔄 [BOOKING] Verificando pagamento da reserva ${booking.id}: status pagamento = ${payment.status}, confirmado = ${isConfirmed}`);
          console.log('booking.status=', booking.status);
          
          // atualizar o status da reserva se necessário
          if (isConfirmed && booking.status !== 'CONFIRMED') {
            // atualizar o payment status
            console.log(`✅ [BOOKING] Atualizando status da reserva ${booking.id} para CONFIRMED`);
            prisma.booking.update({
              where: { id: booking.id },
              data: { status: 'CONFIRMED' },
            });
         
          } else if (!isConfirmed && booking.status !== 'PENDING') {
            prisma.booking.update({
              where: { id: booking.id },
              data: { status: 'PENDING' },
            });
          }
        } else {
          console.log(`⚠️ [BOOKING] Nenhum pagamento encontrado para a reserva ${booking.id}`);
          console.log(`Detalhes da requisição:`, payment);
        }
      });

      return res.status(200).json(booking);
    } catch (error) {
      console.error('Get booking error:', error);
      return res.status(500).json({ error: 'Erro ao buscar reserva' });
    }
  }

  // ========================================================
  // PATCH - Cancelar reserva (público)
  // ========================================================
  if (req.method === 'PATCH') {
    try {
      const { action } = req.body;

      // Apenas ação de cancelamento permitida publicamente
      if (action !== 'cancel') {
        return res.status(400).json({ 
          error: 'Ação inválida. Use action: "cancel"' 
        });
      }

      // Buscar reserva atual
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          startTime: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      // ====================================================
      // REGRAS DE CANCELAMENTO
      // ====================================================
      
      // 1. Não pode cancelar se já está cancelada
      if (booking.status === 'CANCELLED') {
        return res.status(400).json({ 
          error: 'Esta reserva já foi cancelada',
          code: 'ALREADY_CANCELLED'
        });
      }

      // 2. Não pode cancelar se horário já iniciou
      const now = new Date();
      const startTime = new Date(booking.startTime);
      
      if (startTime <= now) {
        return res.status(400).json({ 
          error: 'Não é possível cancelar uma reserva que já iniciou ou passou',
          code: 'ALREADY_STARTED'
        });
      }

      // 3. OBRIGATÓRIO: mínimo de 48 horas de antecedência
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilStart < MIN_CANCELLATION_HOURS) {
        return res.status(400).json({ 
          error: `Cancelamentos só são permitidos com no mínimo ${MIN_CANCELLATION_HOURS} horas de antecedência.`,
          code: 'TOO_LATE',
          hoursRemaining: Math.floor(hoursUntilStart),
          minHoursRequired: MIN_CANCELLATION_HOURS
        });
      }

      // ====================================================
      // EXECUTAR CANCELAMENTO
      // ====================================================
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: { 
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
        include: {
          room: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      });

      console.log(`🚫 [BOOKING] Cancelada pelo cliente: ${id}`);

      // ✅ LOG DE AUDITORIA - Reserva cancelada
      await logUserAction(
        'BOOKING_CANCELLED',
        updatedBooking.user.email || 'unknown',
        'Booking',
        id,
        {
          roomName: updatedBooking.room.name,
          cancelledBy: 'client',
          hoursBeforeStart: Math.floor(hoursUntilStart),
        },
        req
      );

      return res.status(200).json({
        success: true,
        message: 'Reserva cancelada com sucesso',
        booking: {
          id: updatedBooking.id,
          status: updatedBooking.status,
          roomName: updatedBooking.room.name,
        }
      });

    } catch (error) {
      console.error('Cancel booking error:', error);
      return res.status(500).json({ error: 'Erro ao cancelar reserva' });
    }
  }

  // Método não permitido
  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: `Método ${req.method} não permitido` });
}
