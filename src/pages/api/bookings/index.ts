// ===========================================================
// API: POST /api/bookings - Criar reserva
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { createBookingPayment } from '@/lib/asaas';
import { brazilianPhone } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { 
  getAvailableCreditsForRoom, 
  consumeCreditsForBooking,
  getCreditBalanceForRoom,
} from '@/lib/business-rules';

// Schema de validação com Zod
const createBookingSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  userCpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'CPF deve conter apenas números'),
  productId: z.string().optional(),
  roomId: z.string().min(1, 'Sala é obrigatória'),
  startAt: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endAt: z.string().datetime({ message: 'Data/hora de término inválida' }),
  payNow: z.boolean().default(false),
  useCredits: z.boolean().default(false),
  couponCode: z.string().optional(),
  notes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
});


// Cupons válidos (hardcoded por simplicidade)
const VALID_COUPONS: Record<string, { discountType: 'fixed' | 'percent'; value: number; description: string }> = {
  'TESTE50': { discountType: 'fixed', value: -1, description: 'Cupom de teste - R$ 5,00' }, // -1 = preço fixo de R$ 5,00 (mínimo Asaas)
};

type CreateBookingInput = z.infer<typeof createBookingSchema>;

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  paymentUrl?: string;
  creditsUsed?: number;
  amountToPay?: number;
  error?: string;
  details?: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    // 1. Validar body com Zod
    const validation = createBookingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data: CreateBookingInput = validation.data;

    // RATE LIMITING - Por IP e por telefone
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     (req.headers['x-real-ip'] as string) || 
                     'unknown';

    const ipRateLimit = await checkRateLimit(clientIp, 'create-booking', {
      windowMinutes: 60,
      maxRequests: 20, // 20 tentativas por hora por IP
    });

    if (!ipRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Muitas tentativas. Tente novamente após ${ipRateLimit.resetAt.toLocaleTimeString('pt-BR')}.`,
      });
    }

    const phoneRateLimit = await checkRateLimit(data.userPhone, 'create-booking', {
      windowMinutes: 60,
      maxRequests: 5, // 5 reservas por hora por telefone
    });

    if (!phoneRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Muitas reservas recentes. Tente novamente após ${phoneRateLimit.resetAt.toLocaleTimeString('pt-BR')}.`,
      });
    }

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);

    // 2. Validar que endAt > startAt
    if (endAt <= startAt) {
      return res.status(400).json({
        success: false,
        error: 'Horário de término deve ser após o início',
      });
    }

    // 3. Verificar se sala existe
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa',
      });
    }

    // TRANSACTION ATÔMICA - Previne race condition
    const result = await prisma.$transaction(async (tx) => {
      // 4. Verificar disponibilidade com lock (FOR UPDATE)
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          roomId: data.roomId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            { startTime: { lt: endAt, gte: startAt } },
            { endTime: { gt: startAt, lte: endAt } },
            { AND: [{ startTime: { lte: startAt } }, { endTime: { gte: endAt } }] },
          ],
        },
      });

      if (conflictingBooking) {
        throw new Error('CONFLICT');
      }

      // 5. Buscar ou criar usuário
      let user = await tx.user.findUnique({
        where: { phone: data.userPhone },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            name: data.userName,
            phone: data.userPhone,
            email: data.userEmail || `${data.userPhone}@temp.arthemi.com.br`,
            role: 'CUSTOMER',
          },
        });
      }

      // 6. Calcular valor usando hourlyRate V3
      const hours = Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60));
      let amount = room.hourlyRate * hours;

      // Se tem productId, busca preço do produto
      if (data.productId) {
        const product = await tx.product.findUnique({
          where: { id: data.productId },
        });
        if (product) {
          amount = product.price;
        }
      }

      // 6.0.1 Aplicar cupom de desconto se fornecido
      let couponApplied: string | null = null;
      if (data.couponCode) {
        const couponKey = data.couponCode.toUpperCase().trim();
        const coupon = VALID_COUPONS[couponKey];
        
        if (coupon) {
          if (coupon.discountType === 'fixed' && coupon.value === -1) {
            amount = 500;
          } else if (coupon.discountType === 'fixed') {
            amount = Math.max(0, amount - coupon.value);
          } else if (coupon.discountType === 'percent') {
            amount = Math.round(amount * (1 - coupon.value / 100));
          }
          couponApplied = couponKey;
        }
      }

      // 6.1 Verificar e aplicar créditos se solicitado
      let creditsUsed = 0;
      let creditIds: string[] = [];
      let amountToPay = amount;

      if (data.useCredits) {
        const availableCredits = await getCreditBalanceForRoom(user.id, data.roomId, startAt);
        
        if (availableCredits > 0) {
          const creditsToUse = Math.min(availableCredits, amount);
          amountToPay = amount - creditsToUse;
          
          const consumeResult = await consumeCreditsForBooking(
            user.id,
            data.roomId,
            creditsToUse,
            startAt
          );
          
          creditsUsed = consumeResult.totalConsumed;
          creditIds = consumeResult.creditIds;
        }
      }

      // 7. Criar booking
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          roomId: data.roomId,
          startTime: startAt,
          endTime: endAt,
          status: amountToPay > 0 ? 'PENDING' : 'CONFIRMED',
          paymentStatus: amountToPay > 0 ? 'PENDING' : 'APPROVED',
          amountPaid: creditsUsed,
          bookingType: 'HOURLY',
          notes: data.notes || null,
          creditsUsed,
          creditIds,
        },
      });

      return { booking, user, amount, amountToPay, creditsUsed, hours };
    });

    await logUserAction(
      'BOOKING_CREATED',
      data.userEmail || data.userPhone,
      'Booking',
      result.booking.id,
      {
        roomId: data.roomId,
        roomName: room.name,
        startAt: data.startAt,
        endAt: data.endAt,
        amount: result.amount,
        amountToPay: result.amountToPay,
        creditsUsed: result.creditsUsed,
        hours: result.hours,
        // ❌ NÃO incluir dados sensíveis (CPF, telefone completo)
      },
      req
    );

    // Se pagou 100% com créditos
    if (result.amountToPay <= 0) {
      return res.status(201).json({
        success: true,
        bookingId: result.booking.id,
        creditsUsed: result.creditsUsed,
        amountToPay: 0,
      });
    }

    // 8. Criar pagamento se necessário
    let paymentUrl: string | undefined;

    if (data.payNow && result.amountToPay > 0) {
      try {
        const paymentResult = await createBookingPayment({
          bookingId: result.booking.id,
          customerName: data.userName,
          customerEmail: data.userEmail || `${data.userPhone}@placeholder.com`,
          customerPhone: data.userPhone,
          customerCpf: data.userCpf,
          value: result.amountToPay,
          description: `Reserva ${room.name} - ${result.hours}h${result.creditsUsed > 0 ? ` (R$ ${(result.creditsUsed/100).toFixed(2)} em créditos)` : ''}`,
        });

        paymentUrl = paymentResult.invoiceUrl;

        await prisma.booking.update({
          where: { id: result.booking.id },
          data: { paymentId: paymentResult.paymentId },
        });

        await prisma.payment.create({
          data: {
            bookingId: result.booking.id,
            userId: result.user.id,
            amount: result.amountToPay,
            status: 'PENDING',
            externalId: paymentResult.paymentId,
            externalUrl: paymentResult.invoiceUrl,
          },
        });
      } catch (paymentError) {
        console.error('❌ Erro ao criar cobrança Asaas');
        
        await prisma.booking.update({
          where: { id: result.booking.id },
          data: { status: 'CANCELLED' },
        });
        
        return res.status(500).json({
          success: false,
          error: 'Erro ao gerar pagamento. Tente novamente.',
        });
      }
    }

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
      paymentUrl,
      creditsUsed: result.creditsUsed,
      amountToPay: result.amountToPay,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Já existe uma reserva neste período.',
      });
    }

    console.error('❌ [/api/bookings] ERRO:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      roomId: req.body.roomId,
    });
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar reserva. Tente novamente.',
    });
  }
}
