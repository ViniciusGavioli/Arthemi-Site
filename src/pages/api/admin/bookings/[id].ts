// ===========================================================
// API: PATCH /api/admin/bookings/[id] - Editar reserva
// ===========================================================
// ETAPA 4: Edição com ajuste automático de crédito
// - Aumento de duração: debita crédito adicional
// - Redução de duração: devolve crédito proporcional
// - Bloqueia edição que gere saldo negativo
// - Bloqueia edição financeira de reservas COURTESY

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { z } from 'zod';
import { logAdminAction } from '@/lib/audit';
import { getCreditBalanceForRoom, consumeCreditsForBooking } from '@/lib/business-rules';
import { addMonths } from 'date-fns';
import { getBookingTotalByDate } from '@/lib/pricing';

const CREDIT_VALIDITY_MONTHS = 6;

const updateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * PATCH /api/admin/bookings/[id] - Atualiza reserva com ajuste de crédito
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  if (req.method === 'PATCH') {
    try {
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: validation.error.errors });
      }

      const { status, startTime, endTime, notes } = validation.data;

      // ================================================================
      // 1. BUSCAR BOOKING ATUAL
      // ================================================================
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { room: true, user: true },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      // ================================================================
      // 2. PROTEÇÕES
      // ================================================================
      
      // Proteção: Não editar reserva já cancelada
      if (booking.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Não é possível editar reserva cancelada' });
      }

      // ================================================================
      // P0-Alt: BLOQUEAR CANCELAMENTO VIA PATCH STATUS
      // ================================================================
      if (status === 'CANCELLED') {
        return res.status(400).json({ 
          error: 'Cancelamento de reserva deve ser feito via POST /api/admin/bookings/cancel para garantir trilha de auditoria e tratamento financeiro adequado.',
          code: 'USE_CANCEL_ENDPOINT',
        });
      }

      // ================================================================
      // 3. SE APENAS STATUS, PROCESSAR SIMPLES
      // ================================================================
      if (status && !startTime && !endTime) {
        const updatedBooking = await prisma.booking.update({
          where: { id },
          data: { status },
          include: { room: true, user: true },
        });

        await logAdminAction(
          'ADMIN_BOOKING_UPDATE',
          'Booking',
          id,
          { action: 'STATUS_CHANGE', previousStatus: booking.status, newStatus: status },
          req
        );

        return res.status(200).json(updatedBooking);
      }

      // ================================================================
      // 4. EDIÇÃO DE HORÁRIO - CALCULAR DIFERENÇA DE DURAÇÃO
      // ================================================================
      if (startTime || endTime) {
        const newStartTime = startTime ? new Date(startTime) : booking.startTime;
        const newEndTime = endTime ? new Date(endTime) : booking.endTime;

        // Validar horários
        if (newEndTime <= newStartTime) {
          return res.status(400).json({ error: 'Horário de término deve ser após o início' });
        }

        const oldDurationHours = Math.ceil(
          (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
        );
        const newDurationHours = Math.ceil(
          (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60)
        );
        const hoursDifference = newDurationHours - oldDurationHours;
        
        // Usar helper PRICES_V3 para calcular diferença de preço (respeita sábado)
        let oldValue: number;
        let newValue: number;
        try {
          oldValue = getBookingTotalByDate(booking.roomId, booking.startTime, oldDurationHours, booking.room?.slug);
          newValue = getBookingTotalByDate(booking.roomId, newStartTime, newDurationHours, booking.room?.slug);
        } catch (err) {
          console.error('[ADMIN] Erro ao calcular preço:', err);
          return res.status(400).json({ 
            error: `Erro ao calcular o preço: ${err instanceof Error ? err.message : 'Desconhecido'}` 
          });
        }
        const valueDifference = newValue - oldValue;

        let creditAdjustment = 0;
        let adjustmentType: 'INCREASE' | 'DECREASE' | 'NONE' = 'NONE';
        let creditId: string | null = null;

        // ================================================================
        // 4.1 PROTEÇÃO: COURTESY não pode ter impacto financeiro
        // ================================================================
        if (booking.financialStatus === 'COURTESY' && valueDifference !== 0) {
          // Courtesy pode ter horário alterado, mas sem debitar/creditar
          const updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
              startTime: newStartTime,
              endTime: newEndTime,
              notes: notes ?? booking.notes,
            },
            include: { room: true, user: true },
          });

          await logAdminAction(
            'ADMIN_BOOKING_UPDATE',
            'Booking',
            id,
            {
              action: 'TIME_CHANGE_COURTESY',
              financialStatus: 'COURTESY',
              oldDurationHours,
              newDurationHours,
              message: 'Horário alterado sem impacto financeiro (cortesia)',
            },
            req
          );

          return res.status(200).json({
            ...updatedBooking,
            _adjustment: {
              type: 'COURTESY_NO_IMPACT',
              message: 'Horário alterado sem impacto financeiro (cortesia)',
            },
          });
        }

        // ================================================================
        // 4.2 AUMENTO DE DURAÇÃO - DEBITAR CRÉDITO
        // ================================================================
        if (valueDifference > 0) {
          adjustmentType = 'INCREASE';
          
          // Verificar crédito disponível
          const availableCredit = await getCreditBalanceForRoom(
            booking.userId,
            booking.roomId,
            newStartTime
          );

          if (availableCredit < valueDifference) {
            return res.status(402).json({
              error: 'Crédito insuficiente para aumentar duração',
              required: valueDifference,
              available: availableCredit,
              hoursDifference,
            });
          }

          // P-002: Transação atômica para consumo + update
          const result = await prisma.$transaction(async (tx) => {
            // Consumir crédito adicional (dentro da transação)
            const consumeResult = await consumeCreditsForBooking(
              booking.userId,
              booking.roomId,
              valueDifference,
              newStartTime,
              undefined,
              undefined,
              tx // P-002: Passar transação
            );

            // Atualizar booking (dentro da transação)
            const updatedBooking = await tx.booking.update({
              where: { id },
              data: {
                startTime: newStartTime,
                endTime: newEndTime,
                creditsUsed: (booking.creditsUsed || 0) + consumeResult.totalConsumed,
                notes: notes ?? booking.notes,
              },
              include: { room: true, user: true },
            });

            return { updatedBooking, consumeResult };
          });

          creditAdjustment = result.consumeResult.totalConsumed;

          await logAdminAction(
            'CREDIT_USED',
            'Booking',
            id,
            {
              adjustmentType: 'INCREASE',
              oldDurationHours,
              newDurationHours,
              hoursDifference,
              creditDebited: creditAdjustment,
              creditIds: result.consumeResult.creditIds,
            },
            req
          );

          return res.status(200).json({
            ...result.updatedBooking,
            _adjustment: {
              type: 'CREDIT_DEBITED',
              amount: creditAdjustment,
              hoursDifference,
            },
          });
        }

        // ================================================================
        // 4.3 REDUÇÃO DE DURAÇÃO - DEVOLVER CRÉDITO
        // ================================================================
        if (valueDifference < 0) {
          adjustmentType = 'DECREASE';
          creditAdjustment = Math.abs(valueDifference);

          const now = new Date();
          const expiresAt = addMonths(now, CREDIT_VALIDITY_MONTHS);

          // Criar crédito de devolução
          const credit = await prisma.credit.create({
            data: {
              userId: booking.userId,
              roomId: booking.roomId,
              amount: creditAdjustment,
              remainingAmount: creditAdjustment,
              type: 'CANCELLATION', // Usando CANCELLATION para devoluções parciais também
              status: 'CONFIRMED',
              sourceBookingId: id,
              referenceMonth: now.getMonth() + 1,
              referenceYear: now.getFullYear(),
              expiresAt,
            },
          });

          creditId = credit.id;

          // Atualizar booking
          const updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
              startTime: newStartTime,
              endTime: newEndTime,
              creditsUsed: Math.max(0, (booking.creditsUsed || 0) - creditAdjustment),
              notes: notes ?? booking.notes,
            },
            include: { room: true, user: true },
          });

          await logAdminAction(
            'CREDIT_REFUNDED',
            'Credit',
            creditId,
            {
              adjustmentType: 'DECREASE',
              bookingId: id,
              oldDurationHours,
              newDurationHours,
              hoursDifference,
              creditRefunded: creditAdjustment,
              expiresAt: expiresAt.toISOString(),
            },
            req
          );

          return res.status(200).json({
            ...updatedBooking,
            _adjustment: {
              type: 'CREDIT_REFUNDED',
              amount: creditAdjustment,
              creditId,
              hoursDifference,
            },
          });
        }

        // ================================================================
        // 4.4 SEM MUDANÇA DE DURAÇÃO - APENAS REPOSICIONAMENTO
        // ================================================================
        const updatedBooking = await prisma.booking.update({
          where: { id },
          data: {
            startTime: newStartTime,
            endTime: newEndTime,
            notes: notes ?? booking.notes,
          },
          include: { room: true, user: true },
        });

        await logAdminAction(
          'ADMIN_BOOKING_UPDATE',
          'Booking',
          id,
          {
            action: 'TIME_REPOSITIONING',
            oldStartTime: booking.startTime,
            newStartTime,
            oldEndTime: booking.endTime,
            newEndTime,
            durationUnchanged: true,
          },
          req
        );

        return res.status(200).json(updatedBooking);
      }

      // ================================================================
      // 5. APENAS NOTES
      // ================================================================
      if (notes !== undefined) {
        const updatedBooking = await prisma.booking.update({
          where: { id },
          data: { notes },
          include: { room: true, user: true },
        });

        return res.status(200).json(updatedBooking);
      }

      return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('❌ [PATCH booking] Erro:', error);
      return res.status(500).json({ error: 'Erro ao atualizar reserva' });
    }
  }

  // P0-Alt: DELETE bloqueado - usar POST /api/admin/bookings/cancel
  if (req.method === 'DELETE') {
    return res.status(400).json({ 
      error: 'Exclusão de reserva não é permitida. Use POST /api/admin/bookings/cancel para cancelar com trilha de auditoria.',
      code: 'USE_CANCEL_ENDPOINT',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
