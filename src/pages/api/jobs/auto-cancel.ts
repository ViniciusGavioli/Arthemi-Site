// ===========================================================
// API: POST /api/jobs/auto-cancel - Auto-cancelamento de reservas
// ===========================================================
// ETAPA 5: Cancela automaticamente reservas não pagas
// - financialStatus = PENDING_PAYMENT
// - status = PENDING
// - startTime - now() <= 30 minutos
// Executado via Vercel Cron a cada 5 minutos

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { differenceInMinutes } from 'date-fns';

const AUTO_CANCEL_THRESHOLD_MINUTES = 30;

interface AutoCancelResult {
  success: boolean;
  cancelled: number;
  bookings?: Array<{
    id: string;
    startTime: string;
    minutesBefore: number;
  }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AutoCancelResult>
) {
  // ================================================================
  // 1. APENAS POST
  // ================================================================
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      cancelled: 0,
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
    console.warn('⚠️ [auto-cancel] Tentativa de acesso não autorizado');
    return res.status(401).json({
      success: false,
      cancelled: 0,
      error: 'Não autorizado',
    });
  }

  try {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + AUTO_CANCEL_THRESHOLD_MINUTES * 60 * 1000);

    console.log(`🔄 [auto-cancel] Executando em ${now.toISOString()}`);
    console.log(`🔄 [auto-cancel] Threshold: ${thresholdTime.toISOString()}`);

    // ================================================================
    // 3. BUSCAR RESERVAS PARA CANCELAR
    // ================================================================
    // Critérios:
    // - financialStatus = PENDING_PAYMENT
    // - status = PENDING
    // - startTime <= now + 30 minutos (ou seja, começa em até 30 min)
    const bookingsToCancel = await prisma.booking.findMany({
      where: {
        financialStatus: 'PENDING_PAYMENT',
        status: 'PENDING',
        startTime: {
          lte: thresholdTime,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        userId: true,
        roomId: true,
        status: true,
        financialStatus: true,
        notes: true,
        user: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, name: true } },
      },
    });

    console.log(`🔄 [auto-cancel] Encontradas ${bookingsToCancel.length} reservas para cancelar`);

    if (bookingsToCancel.length === 0) {
      return res.status(200).json({
        success: true,
        cancelled: 0,
      });
    }

    // ================================================================
    // 4. CANCELAR CADA RESERVA
    // ================================================================
    const cancelledBookings: Array<{
      id: string;
      startTime: string;
      minutesBefore: number;
    }> = [];

    for (const booking of bookingsToCancel) {
      const minutesBefore = differenceInMinutes(booking.startTime, now);

      // Proteção extra: não cancelar se já está cancelado
      if (booking.status === 'CANCELLED') {
        console.log(`⏭️ [auto-cancel] Booking ${booking.id} já cancelado, pulando`);
        continue;
      }

      // Cancelar
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          notes: booking.notes
            ? `${booking.notes}\n[AUTO-CANCELADO] Pagamento não confirmado até ${minutesBefore}min antes do início`
            : `[AUTO-CANCELADO] Pagamento não confirmado até ${minutesBefore}min antes do início`,
        },
      });

      // Log de auditoria
      await logAudit({
        action: 'BOOKING_CANCELLED_AUTO',
        source: 'SYSTEM',
        targetType: 'Booking',
        targetId: booking.id,
        metadata: {
          bookingId: booking.id,
          startTime: booking.startTime.toISOString(),
          minutesBefore,
          userId: booking.userId,
          userName: booking.user?.name,
          roomId: booking.roomId,
          roomName: booking.room?.name,
          financialStatus: booking.financialStatus,
          reason: 'Pagamento não confirmado dentro do prazo',
        },
      });

      cancelledBookings.push({
        id: booking.id,
        startTime: booking.startTime.toISOString(),
        minutesBefore,
      });

      console.log(`✅ [auto-cancel] Booking ${booking.id} cancelado (${minutesBefore}min antes)`);
    }

    // ================================================================
    // 5. RESPOSTA
    // ================================================================
    console.log(`🔄 [auto-cancel] Concluído: ${cancelledBookings.length} reservas canceladas`);

    return res.status(200).json({
      success: true,
      cancelled: cancelledBookings.length,
      bookings: cancelledBookings,
    });

  } catch (error) {
    console.error('❌ [auto-cancel] Erro:', error);
    return res.status(500).json({
      success: false,
      cancelled: 0,
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}
