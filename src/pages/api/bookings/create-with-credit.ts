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

const USER_SESSION_COOKIE = 'user_session';

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  creditsUsed?: number;
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
    if (hours < 1 || hours > 8) {
      return res.status(400).json({
        success: false,
        error: 'Duração deve ser entre 1 e 8 horas',
      });
    }

    const totalAmount = hours * room.pricePerHour;

    // Verifica saldo de créditos
    const availableCredits = await getCreditBalanceForRoom(userId, roomId, start);
    
    if (availableCredits < totalAmount) {
      return res.status(400).json({
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
      // Consome créditos
      const { creditIds, totalConsumed } = await consumeCreditsForBooking(
        userId,
        roomId,
        totalAmount,
        start
      );

      // Cria reserva
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

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
      creditsUsed: result.totalConsumed,
    });

  } catch (error) {
    console.error('[BOOKING] Erro ao criar reserva com crédito:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar reserva',
    });
  }
}
