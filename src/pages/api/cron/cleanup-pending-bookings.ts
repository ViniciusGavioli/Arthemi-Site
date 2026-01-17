// ===========================================================
// API: POST /api/cron/cleanup-pending-bookings
// ===========================================================
// Cleanup automático de bookings PENDING expirados
// - Cancela bookings com expiresAt < now()
// - Restaura cupons associados
// - Idempotente: rodar 2x não duplica restore
// Executado via Vercel Cron
//
// ⚠️  DOCUMENTAÇÃO OBRIGATÓRIA: docs/CRITICAL-FIXES-OPERATIONS.md
//     Antes de alterar este arquivo, leia as regras de operação.

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { restoreCouponUsage, areCouponsEnabled } from '@/lib/coupons';

// Limite de bookings por execução (para não travar)
const BATCH_SIZE = 100;

interface CleanupResult {
  success: boolean;
  processed: number;
  cancelled: number;
  couponsRestored: number;
  errors: number;
  bookings?: Array<{
    id: string;
    couponRestored: boolean;
    error?: string;
  }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CleanupResult>
) {
  // ================================================================
  // 1. APENAS POST
  // ================================================================
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      processed: 0,
      cancelled: 0,
      couponsRestored: 0,
      errors: 0,
      error: `Método ${req.method} não permitido`,
    });
  }

  // ================================================================
  // 2. VALIDAR CRON_SECRET
  // ================================================================
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  // Vercel Cron envia: Authorization: Bearer <CRON_SECRET>
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (!cronSecret || providedSecret !== cronSecret) {
    console.warn('⚠️ [cleanup-pending] Tentativa de acesso não autorizado');
    return res.status(401).json({
      success: false,
      processed: 0,
      cancelled: 0,
      couponsRestored: 0,
      errors: 0,
      error: 'Não autorizado',
    });
  }

  try {
    const now = new Date();
    console.log(`🔄 [cleanup-pending] Executando em ${now.toISOString()}`);

    // ================================================================
    // 3. BUSCAR BOOKINGS EXPIRADOS
    // ================================================================
    // Critérios:
    // - status = PENDING (não confirmado)
    // - expiresAt não nulo E expiresAt < now (expirado)
    // - OU expiresAt é null mas createdAt < now - 24h (fallback para bookings antigos sem expiresAt)
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        // Garantir que não reprocessa bookings já tratados (segurança extra)
        cancelReason: null,
        OR: [
          // Bookings com expiresAt definido e expirado
          {
            expiresAt: {
              not: null,
              lt: now,
            },
          },
          // Fallback: bookings antigos sem expiresAt, criados há mais de 24h
          {
            expiresAt: null,
            createdAt: {
              lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24h atrás
            },
          },
        ],
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        roomId: true,
        startTime: true,
        expiresAt: true,
        createdAt: true,
        couponCode: true,
        status: true,
        notes: true,
      },
    });

    console.log(`🔄 [cleanup-pending] Encontrados ${expiredBookings.length} bookings expirados`);

    if (expiredBookings.length === 0) {
      return res.status(200).json({
        success: true,
        processed: 0,
        cancelled: 0,
        couponsRestored: 0,
        errors: 0,
      });
    }

    // ================================================================
    // 4. PROCESSAR CADA BOOKING
    // ================================================================
    const results: Array<{
      id: string;
      couponRestored: boolean;
      error?: string;
    }> = [];

    let cancelled = 0;
    let couponsRestored = 0;
    let errors = 0;

    for (const booking of expiredBookings) {
      try {
        // Proteção extra: verificar se já está cancelado (race condition)
        if (booking.status === 'CANCELLED') {
          console.log(`⏭️ [cleanup-pending] Booking ${booking.id} já cancelado, pulando`);
          continue;
        }

        // Processar em transação por booking
        const result = await prisma.$transaction(async (tx) => {
          let couponRestored = false;

          // Restaurar cupom APENAS se cupoms estão habilitados
          // wasPaid=false pois cleanup só processa bookings PENDING (não pagos)
          // NÃO restaura cupom em operações de override (TESTE5) pois não registra CouponUsage
          if (areCouponsEnabled() && booking.couponCode && !booking.couponCode.startsWith('TESTE')) {
            const restoreResult = await restoreCouponUsage(tx, booking.id, undefined, false);
            couponRestored = restoreResult.restored;
            if (couponRestored) {
              console.log(`♻️ [cleanup-pending] Cupom ${booking.couponCode} restaurado para booking ${booking.id}`);
            }
          }

          // Cancelar booking com status final que impede reprocessamento
          // Nota: Usamos 'CANCELLED' pois é o único status de cancelamento no enum
          // O campo cancelReason='EXPIRED_NO_PAYMENT' serve como flag para não reprocessar
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CANCELLED',
              paymentStatus: 'REJECTED',
              cancelSource: 'SYSTEM',
              cancelledAt: now,
              cancelReason: 'EXPIRED_NO_PAYMENT', // Flag para identificar cancelamento por expiração
              notes: booking.notes
                ? `${booking.notes}\n[EXPIRADO] Cancelado automaticamente em ${now.toISOString()} por falta de pagamento`
                : `[EXPIRADO] Cancelado automaticamente em ${now.toISOString()} por falta de pagamento`,
            },
          });

          return { couponRestored };
        });

        // Log de auditoria (fora da transação)
        await logAudit({
          action: 'BOOKING_CANCELLED_EXPIRED',
          source: 'SYSTEM',
          targetType: 'Booking',
          targetId: booking.id,
          metadata: {
            bookingId: booking.id,
            startTime: booking.startTime.toISOString(),
            expiresAt: (booking.expiresAt as Date | null)?.toISOString() ?? null,
            couponCode: booking.couponCode ?? null,
            couponRestored: result.couponRestored,
            reason: 'Booking expirado - pagamento não confirmado',
          },
        });

        results.push({
          id: booking.id,
          couponRestored: result.couponRestored,
        });

        cancelled++;
        if (result.couponRestored) {
          couponsRestored++;
        }

        console.log(`✅ [cleanup-pending] Booking ${booking.id} cancelado`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`❌ [cleanup-pending] Erro ao processar booking ${booking.id}:`, errorMsg);
        results.push({
          id: booking.id,
          couponRestored: false,
          error: errorMsg,
        });
        errors++;
      }
    }

    // ================================================================
    // 5. RESPOSTA
    // ================================================================
    console.log(`🔄 [cleanup-pending] Concluído: ${cancelled} cancelados, ${couponsRestored} cupons restaurados, ${errors} erros`);

    return res.status(200).json({
      success: true,
      processed: expiredBookings.length,
      cancelled,
      couponsRestored,
      errors,
      bookings: results,
    });

  } catch (error) {
    console.error('❌ [cleanup-pending] Erro geral:', error);
    return res.status(500).json({
      success: false,
      processed: 0,
      cancelled: 0,
      couponsRestored: 0,
      errors: 1,
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}
