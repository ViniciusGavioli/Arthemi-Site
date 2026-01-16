// ===========================================================
// API: POST /api/bookings/[id]/cancel-pending
// ===========================================================
// Cancela reserva PENDING (aguardando pagamento) com:
// - Liberação imediata do horário
// - Cancelamento da cobrança no Asaas
// - Reversão de créditos consumidos
// - Restauração de cupom (se COUPONS_ENABLED e cupom comercial usado)

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { getAdminAuth } from '@/lib/admin-auth';
import { deletePayment } from '@/lib/asaas';
import { restoreCreditsFromCancelledBooking } from '@/lib/credits';
import { restoreCouponUsage, areCouponsEnabled } from '@/lib/coupons';
import { TEST_OVERRIDE_CODE } from '@/lib/test-override';
import { logUserAction } from '@/lib/audit';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { respondError } from '@/lib/errors';

interface ApiResponse {
  success: boolean;
  message?: string;
  bookingId?: string;
  creditsRestored?: number;
  couponRestored?: boolean;
  asaasCancelled?: boolean;
  error?: string;
  code?: string;
}

// Status que permitem cancelamento pelo usuário
const CANCELLABLE_STATUSES = ['PENDING'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const requestId = generateRequestId();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ID da reserva é obrigatório',
      code: 'MISSING_BOOKING_ID',
    });
  }

  // Verificar autenticação
  const userAuth = getAuthFromRequest(req);
  const isAdmin = getAdminAuth(req);

  if (!userAuth && !isAdmin) {
    return res.status(401).json({
      success: false,
      error: 'Não autenticado',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Buscar booking
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        room: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Verificar ownership (apenas owner ou admin)
    const isOwner = userAuth && booking.userId === userAuth.userId;
    if (!isOwner && !isAdmin) {
      console.log(`[CANCEL_PENDING] ${requestId} | FORBIDDEN | userId=${userAuth?.userId} | bookingOwner=${booking.userId}`);
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para cancelar esta reserva',
        code: 'NOT_OWNER',
      });
    }

    // Verificar se status permite cancelamento
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      console.log(`[CANCEL_PENDING] ${requestId} | NOT_CANCELLABLE | status=${booking.status}`);
      return res.status(400).json({
        success: false,
        error: `Reserva com status "${booking.status}" não pode ser cancelada. Apenas reservas pendentes podem ser canceladas.`,
        code: 'BOOKING_NOT_PENDING',
      });
    }

    // IDEMPOTÊNCIA: Se já está cancelada, retorna sucesso
    if (booking.status === 'CANCELLED') {
      console.log(`[CANCEL_PENDING] ${requestId} | IDEMPOTENT | already cancelled`);
      return res.status(200).json({
        success: true,
        message: 'Reserva já estava cancelada',
        bookingId: booking.id,
      });
    }

    console.log(`[CANCEL_PENDING] ${requestId} | START | bookingId=${id} | status=${booking.status} | creditsUsed=${booking.creditsUsed} | paymentId=${booking.paymentId}`);

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      let asaasCancelled = false;
      let creditsRestored = 0;
      let couponRestored = false;

      // 1. Cancelar cobrança no Asaas (se existir)
      if (booking.paymentId) {
        try {
          const cancelled = await deletePayment(booking.paymentId);
          asaasCancelled = cancelled;
          console.log(`[CANCEL_PENDING] ${requestId} | ASAAS | paymentId=${booking.paymentId} | cancelled=${cancelled}`);
        } catch (asaasError) {
          // Log mas não falha a operação - cobrança pode já estar cancelada/expirada
          console.warn(`[CANCEL_PENDING] ${requestId} | ASAAS_WARN | error=${asaasError}`);
        }
      }

      // 2. Reverter créditos consumidos (se existirem)
      if (booking.creditsUsed && booking.creditsUsed > 0 && booking.creditIds && booking.creditIds.length > 0) {
        try {
          creditsRestored = await restoreCreditsFromCancelledBooking(
            tx,
            booking.creditIds,
            booking.creditsUsed
          );
          console.log(`[CANCEL_PENDING] ${requestId} | CREDITS | restored=${creditsRestored} | creditIds=${booking.creditIds.length}`);
        } catch (creditError) {
          // Log mas não falha - créditos podem já ter sido restaurados
          console.warn(`[CANCEL_PENDING] ${requestId} | CREDITS_WARN | error=${creditError}`);
        }
      }

      // 3. Restaurar cupom (se COUPONS_ENABLED e cupom comercial usado)
      // NÃO restaurar override de teste (não consome nada)
      if (booking.couponCode && areCouponsEnabled() && booking.couponCode !== TEST_OVERRIDE_CODE) {
        try {
          const restoreResult = await restoreCouponUsage(tx, booking.id, undefined, false);
          couponRestored = restoreResult.restored;
          if (couponRestored) {
            console.log(`[CANCEL_PENDING] ${requestId} | COUPON | restored=${booking.couponCode}`);
          }
        } catch (couponError) {
          // Log mas não falha - cupom pode já ter sido restaurado
          console.warn(`[CANCEL_PENDING] ${requestId} | COUPON_WARN | error=${couponError}`);
        }
      }

      // 4. Atualizar booking para CANCELLED
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelReason: 'Cancelado pelo usuário (reserva pendente)',
          cancelledAt: new Date(),
          // Não alterar financialStatus - booking PENDING não foi pago
        },
      });

      // 4. Cancelar registro de Payment (se existir)
      if (booking.paymentId) {
        await tx.payment.updateMany({
          where: { 
            bookingId: booking.id,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED', // Mais próximo de cancelado no enum
          },
        });
      }

      return { updatedBooking, asaasCancelled, creditsRestored, couponRestored };
    });

    // Audit log (fora da transação)
    await logUserAction(
      'BOOKING_CANCELLED',
      booking.user.email || 'unknown',
      'Booking',
      booking.id,
      {
        roomId: booking.roomId,
        roomName: booking.room?.name,
        creditsRestored: result.creditsRestored,
        couponRestored: result.couponRestored,
        asaasCancelled: result.asaasCancelled,
        cancelledBy: isAdmin ? 'admin' : 'user',
        cancelType: 'pending_cancellation',
      },
      req
    );

    console.log(`[CANCEL_PENDING] ${requestId} | SUCCESS | bookingId=${id} | creditsRestored=${result.creditsRestored} | couponRestored=${result.couponRestored} | asaasCancelled=${result.asaasCancelled}`);

    return res.status(200).json({
      success: true,
      message: 'Reserva cancelada com sucesso. O horário foi liberado.',
      bookingId: booking.id,
      creditsRestored: result.creditsRestored,
      couponRestored: result.couponRestored,
      asaasCancelled: result.asaasCancelled,
    });

  } catch (error) {
    console.error(`[CANCEL_PENDING] ${requestId} | ERROR:`, error);
    return respondError(res, error, requestId);
  }
}
