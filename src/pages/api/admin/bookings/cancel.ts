// ===========================================================
// API: POST /api/admin/bookings/cancel - Cancelar reserva
// ===========================================================
// P0-4: Cancelamento admin com refundType (CREDITS/MONEY/NONE)
// - >= 48h: admin escolhe entre CREDITS ou MONEY
// - < 48h: NONE (sem devolução) ou admin pode forçar
// - Persiste cancelSource=ADMIN, refundType, cancelledAt
// - MONEY cria RefundRequest para processamento manual
// 
// REGRAS IMPORTANTES (AUDITORIA):
// - Reembolso SEMPRE = NET (valor pago após desconto) + créditos usados
// - NUNCA devolver GROSS (valor cheio antes do desconto)
// - Cupom NÃO volta após cancelamento (fica "burned")
// - $transaction garante atomicidade e idempotência via Refund record

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

    // Proteção 2: Verificar se já existe Refund (idempotência)
    const existingRefund = await prisma.refund.findUnique({
      where: { bookingId },
    });
    if (existingRefund) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um reembolso processado para esta reserva',
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
    // 4. CALCULAR ANTECEDÊNCIA E VALOR (REGRA: sempre NET, nunca GROSS)
    // ================================================================
    const now = new Date();
    const hoursUntilStart = differenceInHours(booking.startTime, now);
    const canRefundByPolicy = hoursUntilStart >= MIN_CANCELLATION_HOURS;

    // AUDITORIA: Usar netAmount se disponível, senão fallback para amountPaid
    // creditsUsed já é o valor líquido (créditos consumidos)
    const creditsUsed = booking.creditsUsed || 0;
    
    // netAmount = valor líquido pago (após desconto de cupom)
    // amountPaid = fallback para bookings antigos sem netAmount
    // NUNCA usar grossAmount para reembolso!
    const moneyPaid = booking.netAmount ?? booking.amountPaid ?? 0;
    
    // Total a devolver = créditos usados + valor pago (NET)
    const totalRefundValue = creditsUsed + moneyPaid;

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
      finalRefundType = (canRefundByPolicy && totalRefundValue > 0) ? 'CREDITS' : 'NONE';
    }

    // ================================================================
    // 6. PROCESSAR DEVOLUÇÃO COM $transaction (ATÔMICO + IDEMPOTENTE)
    // ================================================================
    // Tudo dentro de uma transação para garantir consistência
    // O registro Refund garante idempotência (UNIQUE bookingId)

    const result = await prisma.$transaction(async (tx) => {
      let creditId: string | null = null;
      let refundRequestId: string | null = null;
      let creditsReturned = 0;
      let moneyReturned = 0;

      if (finalRefundType === 'CREDITS' && totalRefundValue > 0) {
        // DEVOLUÇÃO EM CRÉDITOS
        creditsReturned = totalRefundValue;

        const expiresAt = addMonths(now, CREDIT_VALIDITY_MONTHS);

        const credit = await tx.credit.create({
          data: {
            userId: booking.userId,
            roomId: booking.roomId,
            amount: creditsReturned,
            remainingAmount: creditsReturned,
            type: 'CANCELLATION',
            status: 'CONFIRMED',
            sourceBookingId: bookingId,
            referenceMonth: now.getMonth() + 1,
            referenceYear: now.getFullYear(),
            expiresAt,
          },
        });

        creditId = credit.id;

      } else if (finalRefundType === 'MONEY' && totalRefundValue > 0) {
        // DEVOLUÇÃO EM DINHEIRO - CRIAR REFUND REQUEST
        moneyReturned = totalRefundValue;

        const refundRequest = await tx.refundRequest.create({
          data: {
            bookingId,
            userId: booking.userId,
            amount: totalRefundValue,
            pixKeyType: pixKeyType!,
            pixKey: pixKey!,
            status: 'APPROVED', // Já aprovado pelo admin
            reason: reason || 'Cancelamento administrativo',
          },
        });

        refundRequestId = refundRequest.id;
      }

      // ================================================================
      // 6.1. CRIAR REFUND RECORD (IDEMPOTÊNCIA)
      // ================================================================
      // UNIQUE(bookingId) garante que não pode haver duplicatas
      await tx.refund.create({
        data: {
          bookingId,
          userId: booking.userId,
          creditsReturned,
          moneyReturned,
          totalRefunded: creditsReturned + moneyReturned,
          gateway: finalRefundType === 'MONEY' ? 'MANUAL' : 'MANUAL',
          status: 'COMPLETED',
          reason: reason || 'Cancelamento administrativo',
          processedAt: now,
        },
      });

      // ================================================================
      // 7. CANCELAR BOOKING COM CAMPOS P0-4
      // ================================================================
      const cancelNote = finalRefundType === 'CREDITS'
        ? `[CANCELADO - CRÉDITO: R$ ${(creditsReturned / 100).toFixed(2)}] ${reason || ''}`
        : finalRefundType === 'MONEY'
          ? `[CANCELADO - ESTORNO PIX: R$ ${(moneyReturned / 100).toFixed(2)}] ${reason || ''}`
          : `[CANCELADO - SEM DEVOLUÇÃO] ${reason || ''}`;

      await tx.booking.update({
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

      return { creditId, refundRequestId, creditsReturned, moneyReturned };
    });

    const totalRefunded = result.creditsReturned + result.moneyReturned;

    // ================================================================
    // 8. LOG DE AUDITORIA (fora da transação - best effort)
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
        creditId: result.creditId,
        refundRequestId: result.refundRequestId,
        creditsReturned: result.creditsReturned,
        moneyReturned: result.moneyReturned,
        totalRefunded,
        reason,
        // AUDITORIA: Registrar valores originais para investigação
        bookingGrossAmount: booking.grossAmount,
        bookingDiscountAmount: booking.discountAmount,
        bookingNetAmount: booking.netAmount,
        bookingCreditsUsed: creditsUsed,
        bookingCouponCode: booking.couponCode,
      },
      req
    );

    // ================================================================
    // 9. RESPOSTA
    // ================================================================
    let message: string;
    if (finalRefundType === 'CREDITS' && result.creditsReturned > 0) {
      message = `Reserva cancelada. Crédito de R$ ${(result.creditsReturned / 100).toFixed(2)} devolvido.`;
    } else if (finalRefundType === 'MONEY' && result.moneyReturned > 0) {
      message = `Reserva cancelada. Estorno de R$ ${(result.moneyReturned / 100).toFixed(2)} em processamento (PIX).`;
    } else {
      message = 'Reserva cancelada (sem devolução).';
    }

    return res.status(200).json({
      success: true,
      creditId: result.creditId,
      refundRequestId: result.refundRequestId,
      creditAmount: totalRefunded,
      refundPercentage: totalRefunded > 0 ? 100 : 0,
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
