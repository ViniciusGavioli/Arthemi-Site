// ===========================================================
// API: POST /api/admin/bookings/cancel - Cancelar reserva
// ===========================================================
// ETAPA 4: Cancelamento com regras de devolução de crédito
// - >= 48h: devolve 100% do crédito consumido
// - < 48h: não devolve crédito
// - Bloqueia cancelamento de reservas já CANCELLED
// - Reservas COURTESY podem ser canceladas sem impacto financeiro

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { MIN_CANCELLATION_HOURS } from '@/lib/business-rules';
import { logAdminAction } from '@/lib/audit';
import { differenceInHours, addMonths } from 'date-fns';

const CREDIT_VALIDITY_MONTHS = 6;

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
  reason: z.string().optional(),
});

interface ApiResponse {
  success: boolean;
  creditId?: string | null;
  creditAmount?: number;
  refundPercentage?: number;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

  try {
    const validation = cancelBookingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
      });
    }

    const { bookingId, reason } = validation.data;

    // ================================================================
    // 1. BUSCAR BOOKING
    // ================================================================
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada',
      });
    }

    // ================================================================
    // 2. PROTEÇÕES
    // ================================================================
    
    // Proteção 1: Já cancelada (idempotência)
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Reserva já está cancelada',
      });
    }

    // ================================================================
    // 3. CASO ESPECIAL: COURTESY
    // ================================================================
    // Reservas de cortesia podem ser canceladas sem impacto financeiro
    if (booking.financialStatus === 'COURTESY') {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'CANCELLED',
          notes: booking.notes 
            ? `${booking.notes}\n[CANCELADO - CORTESIA] ${reason || 'Sem motivo informado'}`
            : `[CANCELADO - CORTESIA] ${reason || 'Sem motivo informado'}`,
        },
      });

      await logAdminAction(
        'BOOKING_CANCELLED',
        'Booking',
        bookingId,
        {
          userId: booking.userId,
          roomId: booking.roomId,
          financialStatus: 'COURTESY',
          reason,
          message: 'Reserva de cortesia cancelada sem impacto financeiro',
        },
        req
      );

      return res.status(200).json({
        success: true,
        creditId: null,
        creditAmount: 0,
        refundPercentage: 0,
        message: 'Reserva de cortesia cancelada (sem impacto financeiro).',
      });
    }

    // ================================================================
    // 4. CALCULAR ANTECEDÊNCIA
    // ================================================================
    const now = new Date();
    const hoursUntilStart = differenceInHours(booking.startTime, now);
    const canRefund = hoursUntilStart >= MIN_CANCELLATION_HOURS;

    // ================================================================
    // 5. CALCULAR VALOR A DEVOLVER
    // ================================================================
    const creditsUsed = booking.creditsUsed || 0;
    const amountPaid = booking.amountPaid || 0;
    const totalValue = creditsUsed + amountPaid;

    let creditId: string | null = null;
    let creditAmount = 0;
    let refundPercentage = 0;

    // ================================================================
    // 6. PROCESSAR DEVOLUÇÃO (SE APLICÁVEL)
    // ================================================================
    if (canRefund && totalValue > 0) {
      // >= 48h: devolve 100%
      refundPercentage = 100;
      creditAmount = totalValue;

      const expiresAt = addMonths(now, CREDIT_VALIDITY_MONTHS);

      // Criar crédito de devolução
      const credit = await prisma.credit.create({
        data: {
          userId: booking.userId,
          roomId: booking.roomId,
          amount: creditAmount,
          remainingAmount: creditAmount,
          type: 'CANCELLATION',
          status: 'CONFIRMED',
          sourceBookingId: bookingId,
          referenceMonth: now.getMonth() + 1,
          referenceYear: now.getFullYear(),
          expiresAt,
        },
      });

      creditId = credit.id;

      // Log de devolução de crédito
      await logAdminAction(
        'CREDIT_REFUNDED',
        'Credit',
        credit.id,
        {
          bookingId,
          userId: booking.userId,
          roomId: booking.roomId,
          amount: creditAmount,
          refundPercentage,
          hoursUntilStart,
          originalCreditsUsed: creditsUsed,
          originalAmountPaid: amountPaid,
          expiresAt: expiresAt.toISOString(),
        },
        req
      );
    }

    // ================================================================
    // 7. CANCELAR BOOKING
    // ================================================================
    const cancelNote = canRefund
      ? `[CANCELADO - CRÉDITO DEVOLVIDO: R$ ${(creditAmount / 100).toFixed(2)}] ${reason || ''}`
      : `[CANCELADO - SEM DEVOLUÇÃO (< 48h)] ${reason || ''}`;

    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CANCELLED',
        notes: booking.notes 
          ? `${booking.notes}\n${cancelNote}`
          : cancelNote,
      },
    });

    // ================================================================
    // 8. LOG DE AUDITORIA
    // ================================================================
    await logAdminAction(
      'BOOKING_CANCELLED',
      'Booking',
      bookingId,
      {
        userId: booking.userId,
        roomId: booking.roomId,
        financialStatus: booking.financialStatus,
        hoursUntilStart,
        canRefund,
        creditId,
        creditAmount,
        refundPercentage,
        reason,
        originalCreditsUsed: creditsUsed,
        originalAmountPaid: amountPaid,
      },
      req
    );

    // ================================================================
    // 9. RESPOSTA
    // ================================================================
    const message = canRefund && creditAmount > 0
      ? `Reserva cancelada. Crédito de R$ ${(creditAmount / 100).toFixed(2)} devolvido (100%).`
      : totalValue > 0
        ? `Reserva cancelada. Sem devolução (cancelamento com menos de ${MIN_CANCELLATION_HOURS}h de antecedência).`
        : 'Reserva cancelada.';

    return res.status(200).json({
      success: true,
      creditId,
      creditAmount,
      refundPercentage,
      message,
    });

  } catch (error) {
    console.error('❌ [cancel] Erro ao cancelar reserva:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao cancelar reserva',
    });
  }
}
