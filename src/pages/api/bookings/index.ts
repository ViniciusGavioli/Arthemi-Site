// ===========================================================
// API: POST /api/bookings - Criar reserva
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { createBookingPayment } from '@/lib/asaas';
import { brazilianPhone, validateCPF } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { 
  getAvailableCreditsForRoom, 
  consumeCreditsForBooking,
  getCreditBalanceForRoom,
  validateBookingWindow,
} from '@/lib/business-rules';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';

// Schema de validação com Zod
// Suporta tanto o formato antigo (startAt/endAt) quanto o novo (slots[])
const slotSchema = z.object({
  startAt: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endAt: z.string().datetime({ message: 'Data/hora de término inválida' }),
});

const createBookingSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  userCpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'CPF deve conter apenas números'),
  productId: z.string().optional(),
  roomId: z.string().min(1, 'Consultório é obrigatório'),
  // Formato novo: array de slots (múltipla seleção de 1h cada)
  slots: z.array(slotSchema).optional(),
  // Formato antigo (retrocompatibilidade)
  startAt: z.string().datetime({ message: 'Data/hora de início inválida' }).optional(),
  endAt: z.string().datetime({ message: 'Data/hora de término inválida' }).optional(),
  payNow: z.boolean().default(false),
  useCredits: z.boolean().default(false),
  couponCode: z.string().optional(),
  notes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
}).refine(
  (data) => (data.slots && data.slots.length > 0) || (data.startAt && data.endAt),
  { message: 'É necessário fornecer slots ou startAt/endAt' }
);


// Cupons válidos (hardcoded por simplicidade)
const VALID_COUPONS: Record<string, { discountType: 'fixed' | 'percent'; value: number; description: string }> = {
  'TESTE50': { discountType: 'fixed', value: -1, description: 'Cupom de teste - R$ 5,00' }, // -1 = preço fixo de R$ 5,00 (mínimo Asaas)
};

type CreateBookingInput = z.infer<typeof createBookingSchema>;

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  bookingIds?: string[]; // Para múltiplas reservas
  paymentUrl?: string;
  creditsUsed?: number;
  amountToPay?: number;
  emailSent?: boolean;
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

    // Normalizar slots (suporta formato novo e antigo)
    let bookingSlots: { startAt: Date; endAt: Date }[];
    if (data.slots && data.slots.length > 0) {
      // Formato novo: múltiplos slots de 1h
      bookingSlots = data.slots.map(slot => ({
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
      }));
    } else if (data.startAt && data.endAt) {
      // Formato antigo: startAt/endAt únicos
      bookingSlots = [{
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
      }];
    } else {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer horários para a reserva',
      });
    }

    // Validar todos os slots
    for (const slot of bookingSlots) {
      if (slot.endAt <= slot.startAt) {
        return res.status(400).json({
          success: false,
          error: 'Horário de término deve ser após o início',
        });
      }
      
      // Validar limite de horário conforme dia da semana
      // - Segunda a Sexta: até 18h
      // - Sábado: até 12h
      const isSaturday = slot.startAt.getDay() === 6;
      const maxEndHour = isSaturday ? 12 : 18;
      const endHour = slot.endAt.getHours();
      
      if (endHour > maxEndHour) {
        return res.status(400).json({
          success: false,
          error: isSaturday 
            ? 'Aos sábados o horário máximo de funcionamento é 12h' 
            : 'Horário máximo de funcionamento é 18h',
        });
      }
    }

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

    // VALIDAÇÃO REAL DE CPF - Backend é fonte da verdade
    if (!validateCPF(data.userCpf)) {
      console.error(`[BOOKING] CPF inválido rejeitado: ${data.userCpf.slice(0, 3)}***`);
      return res.status(400).json({
        success: false,
        error: 'CPF inválido. Verifique os dados e tente novamente.',
      });
    }

    // Usar o primeiro slot para referência (data da reserva)
    const firstSlot = bookingSlots[0];
    const startAt = firstSlot.startAt;
    const endAt = bookingSlots[bookingSlots.length - 1].endAt;

    // 3. Verificar se consultório existe
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Consultório não encontrado ou inativo',
      });
    }

    // Buffer de limpeza entre reservas: 40 minutos
    const CLEANING_BUFFER_MINUTES = 40;
    const CLEANING_BUFFER_MS = CLEANING_BUFFER_MINUTES * 60 * 1000;

    // TRANSACTION ATÔMICA - Previne race condition
    const result = await prisma.$transaction(async (tx) => {
      // 4. Verificar disponibilidade de TODOS os slots (com buffer de limpeza)
      for (const slot of bookingSlots) {
        // Expande o período de verificação para incluir o buffer de limpeza
        const checkStart = new Date(slot.startAt.getTime() - CLEANING_BUFFER_MS);
        const checkEnd = new Date(slot.endAt.getTime() + CLEANING_BUFFER_MS);
        
        const conflictingBooking = await tx.booking.findFirst({
          where: {
            roomId: data.roomId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            // Verifica se há reserva que conflita considerando o buffer
            AND: [
              { startTime: { lt: checkEnd } },
              { endTime: { gt: checkStart } },
            ],
          },
        });

        if (conflictingBooking) {
          throw new Error('CONFLICT');
        }
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

      // 6. Calcular valor total (1 hora por slot)
      const totalHours = bookingSlots.length;
      let amount = room.hourlyRate * totalHours;

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

      // 6.2 Validar prazo mínimo para reservas que precisam de pagamento
      // Reservas com pagamento pendente precisam ter início > 30 minutos
      if (amountToPay > 0) {
        const now = new Date();
        const minutesUntilStart = (startAt.getTime() - now.getTime()) / (1000 * 60);
        
        if (minutesUntilStart < 30) {
          throw new Error('TEMPO_INSUFICIENTE');
        }
      }

      // 7. Criar booking(s) - uma reserva para cada slot
      // Determinar financialStatus baseado no pagamento/créditos
      const financialStatus = amountToPay <= 0 ? 'PAID' : 'PENDING_PAYMENT';
      const bookingStatus = amountToPay > 0 ? 'PENDING' : 'CONFIRMED';
      const paymentStatus = amountToPay > 0 ? 'PENDING' : 'APPROVED';
      
      // Divide o valor proporcionalmente entre as reservas (para auditoria)
      const amountPerSlot = Math.floor(amount / bookingSlots.length);
      const creditsPerSlot = Math.floor(creditsUsed / bookingSlots.length);
      
      const bookings = [];
      for (let i = 0; i < bookingSlots.length; i++) {
        const slot = bookingSlots[i];
        const isFirst = i === 0;
        
        const booking = await tx.booking.create({
          data: {
            userId: user.id,
            roomId: data.roomId,
            startTime: slot.startAt,
            endTime: slot.endAt,
            status: bookingStatus,
            paymentStatus,
            amountPaid: isFirst ? creditsUsed : 0, // Créditos só na primeira
            bookingType: 'HOURLY',
            notes: isFirst ? data.notes || null : null, // Notas só na primeira
            creditsUsed: isFirst ? creditsUsed : 0,
            creditIds: isFirst ? creditIds : [],
            origin: 'COMMERCIAL',
            financialStatus,
          },
        });
        bookings.push(booking);
      }
      
      // Usa a primeira reserva como principal (para pagamento único)
      const primaryBooking = bookings[0];

      return { 
        booking: primaryBooking, 
        bookings, 
        user, 
        amount, 
        amountToPay, 
        creditsUsed, 
        hours: totalHours 
      };
    });

    const allBookingIds = result.bookings.map((b: { id: string }) => b.id);
    
    await logUserAction(
      'BOOKING_CREATED',
      data.userEmail || data.userPhone,
      'Booking',
      result.booking.id,
      {
        roomId: data.roomId,
        roomName: room.name,
        slots: bookingSlots.map(slot => ({ startAt: slot.startAt, endAt: slot.endAt })),
        amount: result.amount,
        amountToPay: result.amountToPay,
        creditsUsed: result.creditsUsed,
        hours: result.hours,
        bookingIds: allBookingIds,
        // ❌ NÃO incluir dados sensíveis (CPF, telefone completo)
      },
      req
    );

    // Se pagou 100% com créditos
    if (result.amountToPay <= 0) {
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
        bookingIds: allBookingIds,
        creditsUsed: result.creditsUsed,
        amountToPay: 0,
        emailSent,
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
        
        // Cancelar TODAS as reservas criadas
        await prisma.booking.updateMany({
          where: { id: { in: allBookingIds } },
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
      bookingIds: allBookingIds,
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

    if (error instanceof Error && error.message === 'TEMPO_INSUFICIENTE') {
      return res.status(400).json({
        success: false,
        error: 'Reservas sem crédito precisam ser feitas com pelo menos 30 minutos de antecedência.',
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
