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
} from '@/lib/business-rules';

// Schema de validação com Zod
const createBookingSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  productId: z.string().optional(),
  roomId: z.string().min(1, 'Sala é obrigatória'),
  startAt: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endAt: z.string().datetime({ message: 'Data/hora de término inválida' }),
  payNow: z.boolean().default(false),
  useCredits: z.boolean().default(false), // Usar créditos disponíveis
  notes: z.string().optional(),
});

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
        console.error('Erro ao criar cobrança Asaas:', paymentError);
        // Booking foi criado, mas sem link de pagamento
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
    console.error('Erro ao criar reserva:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar reserva',
    });
  }
}
