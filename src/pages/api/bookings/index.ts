// ===========================================================
// API: POST /api/bookings - Criar reserva
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { isAvailable } from '@/lib/availability';
import { createBookingPayment } from '@/lib/asaas';
import { brazilianPhone } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { 
  getAvailableCreditsForRoom, 
  consumeCreditsForBooking,
  getCreditBalanceForRoom,
  validateBookingWindow,
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
  notes: z.string().optional(),
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

    // 4. Verificar disponibilidade (usando lib/availability.ts)
    const available = await isAvailable({
      roomId: data.roomId,
      startAt,
      endAt,
    });

    if (!available) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Já existe uma reserva neste período.',
      });
    }

    // 4.1 Validar janela de reserva (30 dias para horas/pacotes)
    // Se tem productId, busca o tipo do produto para validar
    let productType: string | null = null;
    if (data.productId) {
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
        select: { type: true },
      });
      productType = product?.type || null;
    }

    // Valida se a data está dentro da janela permitida para o tipo de produto
    const windowValidation = validateBookingWindow(startAt, productType);
    if (!windowValidation.valid) {
      return res.status(400).json({
        success: false,
        error: windowValidation.error || 'Data de reserva inválida',
      });
    }

    // 5. Buscar ou criar usuário
    let user = await prisma.user.findUnique({
      where: { phone: data.userPhone },
    });

    if (!user) {
      user = await prisma.user.create({
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

    // Se tem productId, busca preço do produto (também V3)
    if (data.productId) {
      const product = await prisma.product.findUnique({
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
          // Cupom especial: preço fixo de R$ 5,00 (mínimo Asaas)
          amount = 500;
        } else if (coupon.discountType === 'fixed') {
          amount = Math.max(0, amount - coupon.value);
        } else if (coupon.discountType === 'percent') {
          amount = Math.round(amount * (1 - coupon.value / 100));
        }
        couponApplied = couponKey;
        console.log(`🎫 Cupom ${couponKey} aplicado: ${coupon.description}`);
      }
    }

    // 6.1 Verificar e aplicar créditos se solicitado
    let creditsUsed = 0;
    let creditIds: string[] = [];
    let amountToPay = amount;

    if (data.useCredits) {
      const availableCredits = await getCreditBalanceForRoom(user.id, data.roomId, startAt);
      
      if (availableCredits > 0) {
        // Calcular quanto pode usar de crédito
        const creditsToUse = Math.min(availableCredits, amount);
        amountToPay = amount - creditsToUse;
        
        // Consumir créditos (será feito após criar booking)
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

    // 7. Criar booking com status RESERVED
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        roomId: data.roomId,
        startTime: startAt,
        endTime: endAt,
        status: amountToPay > 0 ? 'PENDING' : 'CONFIRMED', // Confirmado se pago com créditos
        paymentStatus: amountToPay > 0 ? 'PENDING' : 'APPROVED',
        amountPaid: creditsUsed, // Valor "pago" via créditos
        bookingType: 'HOURLY',
        notes: data.notes || null,
        creditsUsed,
        creditIds,
      },
    });

    // 8. Se payNow=true, criar preferência de pagamento
    let paymentUrl: string | undefined;

    // ✅ LOG DE AUDITORIA - Reserva criada
    await logUserAction(
      'BOOKING_CREATED',
      data.userEmail || data.userPhone,
      'Booking',
      booking.id,
      {
        roomId: data.roomId,
        roomName: room.name,
        startAt: data.startAt,
        endAt: data.endAt,
        amount,
        amountToPay,
        creditsUsed,
        hours,
        payNow: data.payNow,
        useCredits: data.useCredits,
      },
      req
    );

    // Se pagou 100% com créditos, não precisa de pagamento
    if (amountToPay <= 0) {
      return res.status(201).json({
        success: true,
        bookingId: booking.id,
        creditsUsed,
        amountToPay: 0,
      });
    }

    if (data.payNow && amountToPay > 0) {
      try {
        const paymentResult = await createBookingPayment({
          bookingId: booking.id,
          customerName: data.userName,
          customerEmail: data.userEmail || `${data.userPhone}@placeholder.com`,
          customerPhone: data.userPhone,
          customerCpf: data.userCpf, // CPF para Asaas
          value: amountToPay, // Valor restante após créditos
          description: `Reserva ${room.name} - ${hours}h${creditsUsed > 0 ? ` (R$ ${(creditsUsed/100).toFixed(2)} em créditos)` : ''}`,
        });

        paymentUrl = paymentResult.invoiceUrl;

        // Atualizar booking com ID do pagamento
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentId: paymentResult.paymentId,
          },
        });

        // Criar registro de payment
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            userId: user.id,
            amount: amountToPay,
            status: 'PENDING',
            externalId: paymentResult.paymentId,
            externalUrl: paymentResult.invoiceUrl,
          },
        });
      } catch (paymentError) {
        console.error('❌ Erro ao criar cobrança Asaas:', paymentError);
        
        // CRÍTICO: Cancelar booking se não conseguiu criar pagamento
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' },
        });
        
        return res.status(500).json({
          success: false,
          error: 'Erro ao gerar pagamento. Tente novamente.',
          details: paymentError instanceof Error ? paymentError.message : 'Erro desconhecido',
        });
      }
    }

    // 9. Retornar sucesso
    return res.status(201).json({
      success: true,
      bookingId: booking.id,
      paymentUrl,
      creditsUsed,
      amountToPay,
    });
  } catch (error) {
    // LOG DETALHADO PARA DEBUG
    console.error('❌ [/api/bookings] ERRO CRÍTICO:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      body: req.body,
    });
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno ao criar reserva',
    });
  }
}
