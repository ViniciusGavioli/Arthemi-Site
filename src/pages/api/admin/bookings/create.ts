// ===========================================================
// API: POST /api/admin/bookings/create - Reserva manual (diária/turno)
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/admin-auth';
import { prisma, isOverbookingError, OVERBOOKING_ERROR_MESSAGE } from '@/lib/prisma';
import { isAvailable } from '@/lib/availability';
import { logAdminAction } from '@/lib/audit';
import { resolveOrCreateUser } from '@/lib/user-resolve';
import { 
  SHIFT_HOURS,
  getCreditBalanceForRoom,
  consumeCreditsForBooking,
} from '@/lib/business-rules';
import { getBookingTotalByDate } from '@/lib/pricing';
import { createDateInBrazilTimezone } from '@/lib/business-hours';

const createManualBookingSchema = z.object({
  userId: z.string().optional(),
  userPhone: z.string().optional(),
  userName: z.string().optional(),
  userEmail: z.string().email().optional(),
  roomId: z.string().min(1, 'roomId é obrigatório'),
  date: z.string().datetime({ message: 'Data inválida' }),
  bookingType: z.enum(['HOURLY', 'SHIFT']).default('HOURLY'), // DAY_PASS descontinuado
  shiftType: z.enum(['MORNING', 'AFTERNOON']).optional(), // Para turno
  startHour: z.number().min(0).max(23).optional(), // Para HOURLY
  endHour: z.number().min(0).max(23).optional(), // Para HOURLY
  amount: z.number().min(0).default(0), // Valor cobrado (pode ser 0 para cortesia)
  notes: z.string().optional(),
  // Novos campos obrigatórios para controle financeiro
  origin: z.enum(['COMMERCIAL', 'ADMIN_COURTESY']),
  courtesyReason: z.string().optional(),
});

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: unknown;
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
    const validation = createManualBookingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;

    // Verificar sala
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa',
      });
    }

    // Buscar ou criar usuário (resolve por email > phone)
    let user;
    if (data.userId) {
      user = await prisma.user.findUnique({ where: { id: data.userId } });
    } else if (data.userPhone) {
      const resolved = await resolveOrCreateUser(prisma, {
        name: data.userName || 'Sem nome',
        email: data.userEmail,
        phone: data.userPhone,
      });
      user = resolved.user;
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Usuário não encontrado. Informe userId, userPhone ou dados para criar.',
      });
    }

    // VALIDAÇÃO: Cortesia exige motivo
    if (data.origin === 'ADMIN_COURTESY' && !data.courtesyReason?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Motivo da cortesia é obrigatório para reservas de cortesia.',
      });
    }

    // P-010: Calcular horários baseado no tipo (usando timezone de São Paulo)
    let startTime: Date;
    let endTime: Date;

    if (data.bookingType === 'SHIFT' && data.shiftType) {
      const shift = SHIFT_HOURS[data.shiftType];
      // P-010: Criar datas no timezone correto de São Paulo
      startTime = createDateInBrazilTimezone(data.date, shift.start);
      endTime = createDateInBrazilTimezone(data.date, shift.end);
    } else {
      // HOURLY
      if (!data.startHour || !data.endHour) {
        return res.status(400).json({
          success: false,
          error: 'startHour e endHour são obrigatórios para reservas por hora',
        });
      }
      // P-010: Criar datas no timezone correto de São Paulo
      startTime = createDateInBrazilTimezone(data.date, data.startHour);
      endTime = createDateInBrazilTimezone(data.date, data.endHour);
    }

    // Verificar disponibilidade
    const available = await isAvailable({
      roomId: data.roomId,
      startAt: startTime,
      endAt: endTime,
    });

    if (!available) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Já existe uma reserva neste período.',
      });
    }

    // Calcular valor da reserva baseado no tipo
    const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    let calculatedAmount: number;
    
    if (data.amount > 0) {
      // Valor informado manualmente
      calculatedAmount = data.amount;
    } else {
      // Calcular usando helper PRICES_V3 (respeita sábado)
      try {
        calculatedAmount = getBookingTotalByDate(data.roomId, startTime, hours, room.slug);
      } catch (err) {
        console.error('[ADMIN] Erro ao calcular preço:', err);
        return res.status(400).json({
          success: false,
          error: `Erro ao calcular o preço da reserva: ${err instanceof Error ? err.message : 'Desconhecido'}`,
        });
      }
    }

    // Verificar saldo disponível antes da transação
    const availableCredits = await getCreditBalanceForRoom(user.id, data.roomId, startTime);

    // VALIDAÇÃO prévia
    if (data.origin === 'COMMERCIAL') {
      if (availableCredits > 0 && availableCredits < calculatedAmount) {
        // Crédito parcial não permitido para admin
        return res.status(402).json({
          success: false,
          error: `Crédito insuficiente. Disponível: R$ ${(availableCredits / 100).toFixed(2)}, Necessário: R$ ${(calculatedAmount / 100).toFixed(2)}. Use cortesia ou adicione créditos.`,
        });
      }
    }

    // P-002: Transação atômica para consumo de créditos + criação do booking
    const result = await prisma.$transaction(async (tx) => {
      let creditsUsed = 0;
      let creditIds: string[] = [];
      let financialStatus: 'PENDING_PAYMENT' | 'PAID' | 'COURTESY';
      let auditAction: 'BOOKING_MANUAL_CREATED' | 'BOOKING_COURTESY_CREATED';

      if (data.origin === 'ADMIN_COURTESY') {
        // CORTESIA: Não debita crédito, não exige pagamento
        financialStatus = 'COURTESY';
        auditAction = 'BOOKING_COURTESY_CREATED';
      } else {
        // COMMERCIAL: Exige crédito suficiente OU marca como PENDING_PAYMENT
        if (availableCredits >= calculatedAmount) {
          // Tem crédito: debitar imediatamente (dentro da transação)
          const consumeResult = await consumeCreditsForBooking(
            user.id,
            data.roomId,
            calculatedAmount,
            startTime,
            undefined,
            undefined,
            tx // P-002: Passar transação
          );
          creditsUsed = consumeResult.totalConsumed;
          creditIds = consumeResult.creditIds;
          financialStatus = 'PAID';
        } else {
          // Sem crédito: marcar como PENDING_PAYMENT (precisa pagar)
          financialStatus = 'PENDING_PAYMENT';
        }
        auditAction = 'BOOKING_MANUAL_CREATED';
      }

      // Criar booking manual (dentro da transação)
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          roomId: data.roomId,
          startTime,
          endTime,
          status: financialStatus === 'PENDING_PAYMENT' ? 'PENDING' : 'CONFIRMED',
          paymentStatus: financialStatus === 'PAID' ? 'APPROVED' : 'PENDING',
          amountPaid: creditsUsed,
          bookingType: data.bookingType,
          isManual: true,
          notes: data.notes || `Reserva manual - ${data.bookingType}`,
          creditsUsed,
          creditIds,
          origin: data.origin,
          financialStatus,
          courtesyReason: data.origin === 'ADMIN_COURTESY' ? data.courtesyReason : null,
        },
      });

      return { booking, creditsUsed, creditIds, auditAction };
    });

    // Log de auditoria (fora da transação - best effort)
    await logAdminAction(
      result.auditAction,
      'Booking',
      result.booking.id,
      {
        userId: user.id,
        roomId: data.roomId,
        bookingType: data.bookingType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        amount: calculatedAmount,
        origin: data.origin,
        financialStatus: result.booking.financialStatus,
        creditsUsed: result.creditsUsed,
        courtesyReason: data.courtesyReason || null,
      },
      req
    );

    // Log adicional se consumiu créditos
    if (result.creditsUsed > 0) {
      await logAdminAction(
        'CREDIT_USED' as any, // Type cast necessário
        'Booking',
        result.booking.id,
        {
          amount: result.creditsUsed,
          creditIds: result.creditIds,
          userId: user.id,
        },
        req
      );
    }

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
    });
  } catch (error) {
    // P-001: Detectar violação de constraint de overbooking
    if (isOverbookingError(error)) {
      console.error('[ADMIN] Overbooking detectado pelo constraint:', error);
      return res.status(409).json({
        success: false,
        error: OVERBOOKING_ERROR_MESSAGE,
      });
    }
    
    // P-002: Detectar erros de crédito insuficiente / double-spend
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_CREDITS:')) {
      const parts = error.message.split(':');
      const available = parseInt(parts[1]) / 100;
      const required = parseInt(parts[2]) / 100;
      return res.status(400).json({
        success: false,
        error: `Saldo de créditos insuficiente. Disponível: R$ ${available.toFixed(2)}, Necessário: R$ ${required.toFixed(2)}.`,
      });
    }
    
    if (error instanceof Error && error.message.startsWith('CREDIT_CONSUMED_BY_ANOTHER:')) {
      return res.status(409).json({
        success: false,
        error: 'Créditos foram consumidos por outra reserva. Tente novamente.',
      });
    }
    
    console.error('Erro ao criar reserva manual:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar reserva',
    });
  }
}
