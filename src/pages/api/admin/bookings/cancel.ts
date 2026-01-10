// ===========================================================
// API: POST /api/admin/bookings/cancel - Cancelar reserva
// ===========================================================
// P0-4: Cancelamento admin com refundType (CREDITS/MONEY/NONE)
// - >= 48h: admin escolhe entre CREDITS ou MONEY
// - < 48h: NONE (sem devolução) ou admin pode forçar
// - Persiste cancelSource=ADMIN, refundType, cancelledAt
// - MONEY cria RefundRequest para processamento manual

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { MIN_CANCELLATION_HOURS } from '@/lib/business-rules';
import { logAdminAction } from '@/lib/audit';
import { differenceInHours, addMonths } from 'date-fns';

const CREDIT_VALIDITY_MONTHS = 6;

// P0-4: Schema atualizado com refundType
const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
  reason: z.string().optional(),
  refundType: z.enum(['CREDITS', 'MONEY', 'NONE']).optional(), // P0-4
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']).optional(), // Para MONEY
  pixKey: z.string().optional(), // Para MONEY
});

interface ApiResponse {
  success: boolean;
  creditId?: string | null;
  refundRequestId?: string | null;
  creditAmount?: number;
  refundPercentage?: number;
  refundType?: 'CREDITS' | 'MONEY' | 'NONE';
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

    const { bookingId, reason, refundType: requestedRefundType, pixKeyType, pixKey } = validation.data;

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
    // 4. CALCULAR ANTECEDÊNCIA E VALOR
    // ================================================================
    const now = new Date();
    const hoursUntilStart = differenceInHours(booking.startTime, now);
    const canRefundByPolicy = hoursUntilStart >= MIN_CANCELLATION_HOURS;

    const creditsUsed = booking.creditsUsed || 0;
    const amountPaid = booking.amountPaid || 0;
    const totalValue = creditsUsed + amountPaid;

    // ================================================================
    // 5. DETERMINAR REFUND TYPE
    // ================================================================
    // Se admin especificou, usar. Senão, calcular automaticamente.
    let finalRefundType: 'CREDITS' | 'MONEY' | 'NONE';
    
    if (requestedRefundType) {
      finalRefundType = requestedRefundType;
      
      // Validar: MONEY requer chave PIX
      if (finalRefundType === 'MONEY' && (!pixKeyType || !pixKey)) {
        return res.status(400).json({
          success: false,
          error: 'Para devolução em dinheiro, informe pixKeyType e pixKey',
        });
      }
    } else {
      // Comportamento automático: >= 48h = CREDITS, < 48h = NONE
      finalRefundType = (canRefundByPolicy && totalValue > 0) ? 'CREDITS' : 'NONE';
    }

    // ================================================================
    // 6. PROCESSAR DEVOLUÇÃO
    // ================================================================
    let creditId: string | null = null;
    let refundRequestId: string | null = null;
    let creditAmount = 0;
    let refundPercentage = 0;

    if (finalRefundType === 'CREDITS' && totalValue > 0) {
      // DEVOLUÇÃO EM CRÉDITOS
      refundPercentage = 100;
      creditAmount = totalValue;

      const expiresAt = addMonths(now, CREDIT_VALIDITY_MONTHS);

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

      await logAdminAction(
        'CREDIT_REFUNDED',
        'Credit',
        credit.id,
        {
          bookingId,
          userId: booking.userId,
          amount: creditAmount,
          refundType: 'CREDITS',
        },
        req
      );
    } else if (finalRefundType === 'MONEY' && totalValue > 0) {
      // DEVOLUÇÃO EM DINHEIRO - CRIAR REFUND REQUEST
      refundPercentage = 100;
      creditAmount = totalValue;

      const refundRequest = await prisma.refundRequest.create({
        data: {
          bookingId,
          userId: booking.userId,
          amount: totalValue,
          pixKeyType: pixKeyType!,
          pixKey: pixKey!,
          status: 'APPROVED', // Já aprovado pelo admin
          reason: reason || 'Cancelamento administrativo',
        },
      });

      refundRequestId = refundRequest.id;

      await logAdminAction(
        'REFUND_REQUESTED',
        'RefundRequest',
        refundRequest.id,
        {
          bookingId,
          userId: booking.userId,
          amount: totalValue,
          refundType: 'MONEY',
          pixKeyType,
        },
        req
      );
    }

    // ================================================================
    // 7. CANCELAR BOOKING COM CAMPOS P0-4
    // ================================================================
    const cancelNote = finalRefundType === 'CREDITS'
      ? `[CANCELADO - CRÉDITO: R$ ${(creditAmount / 100).toFixed(2)}] ${reason || ''}`
      : finalRefundType === 'MONEY'
        ? `[CANCELADO - ESTORNO PIX: R$ ${(creditAmount / 100).toFixed(2)}] ${reason || ''}`
        : `[CANCELADO - SEM DEVOLUÇÃO] ${reason || ''}`;

    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CANCELLED',
        cancelSource: 'ADMIN', // P0-4
        refundType: finalRefundType, // P0-4
        cancelledAt: now, // P0-4
        cancelReason: reason || null, // P0-4
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
        canRefundByPolicy,
        refundType: finalRefundType,
        creditId,
        refundRequestId,
        creditAmount,
        reason,
      },
      req
    );

    // ================================================================
    // 9. RESPOSTA
    // ================================================================
    let message: string;
    if (finalRefundType === 'CREDITS' && creditAmount > 0) {
      message = `Reserva cancelada. Crédito de R$ ${(creditAmount / 100).toFixed(2)} devolvido.`;
    } else if (finalRefundType === 'MONEY' && creditAmount > 0) {
      message = `Reserva cancelada. Estorno de R$ ${(creditAmount / 100).toFixed(2)} em processamento (PIX).`;
    } else {
      message = 'Reserva cancelada (sem devolução).';
    }

    return res.status(200).json({
      success: true,
      creditId,
      refundRequestId,
      creditAmount,
      refundPercentage,
      refundType: finalRefundType,
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
