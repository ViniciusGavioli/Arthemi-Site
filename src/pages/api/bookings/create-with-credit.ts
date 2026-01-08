// ===========================================================
// API: POST /api/bookings/create-with-credit
// ===========================================================
// Cria reserva consumindo créditos do usuário
// Requer autenticação via JWT (cookie arthemi_session)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { 
  consumeCreditsForBooking, 
  getCreditBalanceForRoom,
  isBookingWithinBusinessHours,
  validateUniversalBookingWindow,
} from '@/lib/business-rules';
import { logAudit } from '@/lib/audit';
import { differenceInHours, isBefore } from 'date-fns';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';
import { 
  shouldBlockHourlyPurchase,
  TURNO_PROTECTION_ERROR_CODE,
} from '@/lib/turno-protection';
import { requireEmailVerifiedForBooking } from '@/lib/email-verification';
import { getBookingTotalCentsByDate } from '@/lib/pricing';

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  creditsUsed?: number;
  emailSent?: boolean;
  error?: string;
  code?: string; // Código de erro para tratamento no frontend
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    // Verifica autenticação JWT
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const userId = auth.userId;

    // Verifica se o email foi verificado (bloqueio de agendamento)
    const emailCheck = await requireEmailVerifiedForBooking(userId);
    if (!emailCheck.canBook) {
      return res.status(emailCheck.response!.status).json({
        success: false,
        error: emailCheck.response!.body.message,
        code: emailCheck.response!.body.code,
      });
    }

    // Busca usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
    }

    // Extrai dados da requisição
    const { roomId, startTime, endTime } = req.body;

    if (!roomId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'roomId, startTime e endTime são obrigatórios',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    // Validações básicas
    if (isBefore(start, now)) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível agendar no passado',
      });
    }

    if (isBefore(end, start)) {
      return res.status(400).json({
        success: false,
        error: 'Horário de fim deve ser após o início',
      });
    }

    // Validar horário de funcionamento
    if (!isBookingWithinBusinessHours(start, end)) {
      return res.status(400).json({
        success: false,
        error: 'Horário fora do expediente. Seg-Sex: 08h-20h, Sáb: 08h-12h, Dom: fechado.',
        code: 'OUT_OF_BUSINESS_HOURS',
      });
    }

    // VALIDAÇÃO UNIVERSAL: Reservas limitadas a 30 dias a partir de hoje
    const windowValidation = validateUniversalBookingWindow(start);
    if (!windowValidation.valid) {
      return res.status(400).json({
        success: false,
        error: windowValidation.error || 'Data fora da janela de reserva permitida.',
      });
    }

    // REGRA ANTI-CANIBALIZAÇÃO: Proteção de Turnos
    // Horas avulsas/pacotes não podem ser agendados > 30 dias em dias de TURNO
    const turnoCheck = shouldBlockHourlyPurchase(start, 'HOURLY_RATE');
    if (turnoCheck.blocked) {
      return res.status(400).json({
        success: false,
        error: turnoCheck.reason || 'Data não permitida para agendamento de horas avulsas',
        code: turnoCheck.code || TURNO_PROTECTION_ERROR_CODE,
      });
    }

    // Busca sala
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala não encontrada' });
    }

    // Calcula duração e valor
    const hours = differenceInHours(end, start);
    if (hours < 1 || hours > 8) {
      return res.status(400).json({
        success: false,
        error: 'Duração deve ser entre 1 e 8 horas',
      });
    }

    // Calcular valor total usando helper unificado (weekday vs saturday)
    let totalAmount: number;
    try {
      totalAmount = getBookingTotalCentsByDate(roomId, start, hours, room.slug);
    } catch (err) {
      console.error('[BOOKING] Erro ao calcular preço:', err);
      return res.status(400).json({
        success: false,
        error: 'Erro ao calcular o preço da reserva. Tente novamente.',
      });
    }

    // Verifica saldo de créditos disponíveis para este horário específico
    // Passa start/end para validar usageType dos créditos
    const availableCredits = await getCreditBalanceForRoom(userId, roomId, start, start, end);
    
    if (availableCredits < totalAmount) {
      return res.status(402).json({
        success: false,
        error: `Saldo insuficiente. Disponível: R$ ${(availableCredits / 100).toFixed(2)}, Necessário: R$ ${(totalAmount / 100).toFixed(2)}`,
      });
    }

    // Verifica conflito de horários
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          {
            startTime: { lt: end },
            endTime: { gt: start },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Conflito com outra reserva.',
      });
    }

    // TRANSAÇÃO: Cria reserva + consome créditos
    const result = await prisma.$transaction(async (tx) => {
      // P-002: Consome créditos dentro da transação (passa tx)
      const { creditIds, totalConsumed } = await consumeCreditsForBooking(
        userId,
        roomId,
        totalAmount,
        start,
        start,
        end,
        tx // P-002: Passar transação
      );

      // Cria reserva com financialStatus = PAID
      const booking = await tx.booking.create({
        data: {
          roomId,
          userId,
          startTime: start,
          endTime: end,
          status: 'CONFIRMED', // Já confirmado (pago via crédito)
          paymentStatus: 'APPROVED',
          bookingType: 'HOURLY',
          creditsUsed: totalConsumed,
          creditIds,
          amountPaid: 0, // Não houve pagamento em dinheiro
          origin: 'COMMERCIAL',
          financialStatus: 'PAID', // Pago via crédito
        },
      });

      return { booking, creditIds, totalConsumed };
    });

    // Log de auditoria
    await logAudit({
      action: 'BOOKING_CREATED',
      source: 'USER',
      actorId: userId,
      actorEmail: user.email,
      targetType: 'Booking',
      targetId: result.booking.id,
      metadata: {
        roomId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        creditsUsed: result.totalConsumed,
        creditIds: result.creditIds,
      },
    });

    await logAudit({
      action: 'CREDIT_USED',
      source: 'USER',
      actorId: userId,
      actorEmail: user.email,
      targetType: 'Booking',
      targetId: result.booking.id,
      metadata: {
        amount: result.totalConsumed,
        creditIds: result.creditIds,
      },
    });

    // Enviar email de confirmação para reserva paga com créditos
    let emailSent = false;
    try {
      const emailSuccess = await sendBookingConfirmationNotification(result.booking.id);
      if (emailSuccess) {
        await prisma.booking.update({
          where: { id: result.booking.id },
          data: { emailSentAt: new Date() },
        });
        emailSent = true;
        console.log(`📧 [BOOKING] Email de confirmação enviado para reserva com créditos ${result.booking.id}`);
      } else {
        console.warn(`⚠️ [BOOKING] Falha ao enviar email para reserva com créditos ${result.booking.id}`);
      }
    } catch (emailError) {
      console.error('⚠️ [BOOKING] Erro no envio de email (créditos):', emailError);
      // Não falha a requisição por erro de email
    }

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
      creditsUsed: result.totalConsumed,
      emailSent,
    });

  } catch (error) {
    console.error('[BOOKING] Erro ao criar reserva com crédito:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar reserva',
    });
  }
}
