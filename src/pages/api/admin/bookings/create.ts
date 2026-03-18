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
import { respondError, type ErrorResponse } from '@/lib/errors';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { 
  SHIFT_HOURS,
  getCreditBalanceForRoom,
  consumeCreditsForBooking,
} from '@/lib/business-rules';
import { getBookingTotalCentsByDate } from '@/lib/pricing';
import { createDateInBrazilTimezone, isBookingWithinBusinessHours } from '@/lib/business-hours';
import { brazilianPhone } from '@/lib/validations';

const createManualBookingSchema = z.object({
  userId: z.string().optional(),
  userPhone: brazilianPhone.optional(),
  userName: z.string().optional(),
  userEmail: z.string().email().optional(),
  professionalRegister: z.string().optional(),
  roomId: z.string().min(1, 'roomId é obrigatório'),
  date: z.string().datetime({ message: 'Data inválida' }),
  bookingType: z.enum(['HOURLY', 'SHIFT']).default('HOURLY'), // DAY_PASS descontinuado
  shiftType: z.enum(['MORNING', 'AFTERNOON']).optional(), // Para turno
  startHour: z.number().min(0).max(23).optional(), // Para HOURLY
  endHour: z.number().min(0).max(23).optional(), // Para HOURLY
  useCredits: z.boolean().default(true),
  amount: z.number().int().min(0).default(0), // Valor em centavos (pode ser 0 para cálculo automático/cortesia)
  notes: z.string().optional(),
  // Novos campos obrigatórios para controle financeiro
  origin: z.enum(['COMMERCIAL', 'ADMIN_COURTESY']).default('COMMERCIAL'),
  courtesyReason: z.string().optional(),
});

// Tipo de resposta: sucesso OU erro padronizado
type ApiResponse = {
  success: true;
  bookingId: string;
} | ErrorResponse | { success: false; error: string; details?: unknown };

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

  // Gerar requestId no início
  const requestId = generateRequestId();
  res.setHeader(REQUEST_ID_HEADER, requestId);

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

    // Verificar sala por ID; fallback por slug para compatibilidade
    let room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });
    if (!room) {
      room = await prisma.room.findUnique({
        where: { slug: data.roomId },
      });
    }

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa',
      });
    }
    const realRoomId = room.id;

    // Buscar ou criar usuário (resolve por email > phone)
    let user;
    if (data.userId) {
      user = await prisma.user.findUnique({ where: { id: data.userId } });
    } else if (data.userPhone) {
      const resolved = await resolveOrCreateUser(prisma, {
        name: data.userName || 'Sem nome',
        email: data.userEmail,
        phone: data.userPhone,
        professionalRegister: data.professionalRegister,
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
      if (data.startHour === undefined || data.endHour === undefined) {
        return res.status(400).json({
          success: false,
          error: 'startHour e endHour são obrigatórios para reservas por hora',
        });
      }
      if (data.endHour <= data.startHour) {
        return res.status(400).json({
          success: false,
          error: 'Horário de término deve ser maior que o horário de início',
        });
      }
      // P-010: Criar datas no timezone correto de São Paulo
      startTime = createDateInBrazilTimezone(data.date, data.startHour);
      endTime = createDateInBrazilTimezone(data.date, data.endHour);
    }

    // Validar horário de funcionamento (mesma regra do usuário)
    // Seg-Sex: 08h-20h, Sáb: 08h-12h, Dom: fechado
    if (!isBookingWithinBusinessHours(startTime, endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Horário fora do expediente. Seg-Sex: 08h-20h, Sáb: 08h-12h, Dom: fechado.',
      });
    }

    // Verificar disponibilidade
    const available = await isAvailable({
      roomId: realRoomId,
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
    let calculatedAmountCents: number;
    
    if (data.amount > 0) {
      // Valor informado manualmente (já em centavos)
      calculatedAmountCents = data.amount;
    } else {
      // Calcular usando helper PRICES_V3 (respeita sábado), retornando CENTAVOS
      try {
        calculatedAmountCents = getBookingTotalCentsByDate(realRoomId, startTime, hours, room.slug);
      } catch (err) {
        console.error('[ADMIN] Erro ao calcular preço:', err);
        return res.status(400).json({
          success: false,
          error: `Erro ao calcular o preço da reserva: ${err instanceof Error ? err.message : 'Desconhecido'}`,
        });
      }
    }

    // Verificar saldo disponível antes da transação
    // P-008/P-011: Passar startTime/endTime para validar usageType
    const availableCreditsCents = await getCreditBalanceForRoom(user.id, realRoomId, startTime, startTime, endTime);

    // VALIDAÇÃO prévia
    if (data.origin === 'COMMERCIAL') {
      if (data.useCredits && availableCreditsCents > 0 && availableCreditsCents < calculatedAmountCents) {
        // Crédito parcial não permitido para admin
        return res.status(402).json({
          success: false,
          error: `Crédito insuficiente. Disponível: R$ ${(availableCreditsCents / 100).toFixed(2)}, Necessário: R$ ${(calculatedAmountCents / 100).toFixed(2)}. Use cortesia ou adicione créditos.`,
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
        // COMMERCIAL: Pode usar créditos (opcional) ou marcar como PENDING_PAYMENT
        if (data.useCredits && availableCreditsCents >= calculatedAmountCents) {
          // Tem crédito: debitar imediatamente (dentro da transação)
          // P-008/P-011: Passar startTime/endTime para validar usageType
          const consumeResult = await consumeCreditsForBooking(
            user.id,
            realRoomId,
            calculatedAmountCents,
            startTime,
            startTime, // startTime - validação de usageType
            endTime,   // endTime - validação de usageType
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
          roomId: realRoomId,
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
        roomIdResolved: realRoomId,
        bookingType: data.bookingType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        amount: calculatedAmountCents,
        useCredits: data.useCredits,
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
    // Handler centralizado: converte QUALQUER erro em resposta padronizada
    return respondError(res, error, requestId, {
      endpoint: '/api/admin/bookings/create',
      method: 'POST',
    });
  }
}
