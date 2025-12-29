// ===========================================================
// API: POST /api/bookings/create-with-credit
// ===========================================================
// Cria reserva consumindo créditos do usuário
// Requer autenticação via cookie de sessão

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { decodeSessionToken } from '@/lib/magic-link';
import { 
  consumeCreditsForBooking, 
  getCreditBalanceForRoom,
  canUseCredit,
} from '@/lib/business-rules';
import { logAudit } from '@/lib/audit';
import { differenceInHours, isBefore, addHours } from 'date-fns';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';

const USER_SESSION_COOKIE = 'user_session';

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  creditsUsed?: number;
  emailSent?: boolean;
  error?: string;
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
    // Verifica autenticação
    const sessionToken = req.cookies[USER_SESSION_COOKIE];
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const userId = decodeSessionToken(sessionToken);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Sessão inválida' });
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

    // Busca sala
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala não encontrada' });
    }

    // Calcula duração e valor
    const hours = differenceInHours(end, start);
    if (hours !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Cada reserva deve ter exatamente 1 hora. Para múltiplas horas, crie reservas separadas.',
      });
    }

    const totalAmount = hours * room.pricePerHour;

    // Verifica saldo de créditos
    const availableCredits = await getCreditBalanceForRoom(userId, roomId, start);
    
    if (availableCredits < totalAmount) {
      return res.status(402).json({
        success: false,
        error: `Saldo insuficiente. Disponível: R$ ${(availableCredits / 100).toFixed(2)}, Necessário: R$ ${(totalAmount / 100).toFixed(2)}`,
      });
    }

    // Buffer de limpeza entre reservas: 40 minutos
    const CLEANING_BUFFER_MINUTES = 40;
    const CLEANING_BUFFER_MS = CLEANING_BUFFER_MINUTES * 60 * 1000;

    // Verifica conflito de horários (com buffer de limpeza)
    const checkStart = new Date(start.getTime() - CLEANING_BUFFER_MS);
    const checkEnd = new Date(end.getTime() + CLEANING_BUFFER_MS);
    
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { startTime: { lt: checkEnd } },
          { endTime: { gt: checkStart } },
        ],
      },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. É necessário um intervalo de 40 minutos entre reservas para limpeza.',
      });
    }

    // TRANSAÇÃO: Cria reserva + consome créditos
    const result = await prisma.$transaction(async (tx) => {
      // Consome créditos
      const { creditIds, totalConsumed } = await consumeCreditsForBooking(
        userId,
        roomId,
        totalAmount,
        start
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
