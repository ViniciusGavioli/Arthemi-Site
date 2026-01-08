// ===========================================================
// API: POST /api/payments/create
// ===========================================================
// Cria cobrança PIX ou CARTÃO no Asaas para uma reserva
// paymentMethod: 'PIX' (default) ou 'CARD'
// P-003: Idempotência - não cria cobrança duplicada

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { 
  createBookingPayment, 
  createBookingCardPayment,
  isMockMode, 
  PixQrCode 
} from '@/lib/asaas';
import { getBookingTotalCentsByDate } from '@/lib/pricing';
import { 
  generateBookingIdempotencyKey, 
  checkPaymentIdempotency,
  checkBookingHasActivePayment,
} from '@/lib/payment-idempotency';

const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
  paymentMethod: z.enum(['PIX', 'CARD']).optional().default('PIX'),
  installmentCount: z.number().min(1).max(12).optional(),
});

interface PaymentResponse {
  success: boolean;
  type: 'asaas' | 'mock';
  paymentMethod?: 'PIX' | 'CARD';
  paymentId?: string;
  invoiceUrl?: string;
  pixQrCode?: PixQrCode;
  pixCopyPaste?: string;
  amount?: number;
  installmentCount?: number;
  installmentValue?: number;
  error?: string;
  /** P-003: True se retornou pagamento existente (idempotência) */
  cached?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PaymentResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      type: 'asaas',
      error: 'Método não permitido' 
    });
  }

  try {
    // 1. Validar input
    const validation = createPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        type: 'asaas',
        error: validation.error.errors[0].message 
      });
    }

    const { bookingId, paymentMethod, installmentCount } = validation.data;

    // P-003: Verificar idempotência ANTES de buscar booking
    const idempotencyKey = generateBookingIdempotencyKey(bookingId, paymentMethod);
    const idempotencyCheck = await checkPaymentIdempotency(idempotencyKey);
    
    if (idempotencyCheck.exists && idempotencyCheck.existingPayment) {
      console.log(`♻️ [PAYMENTS] Pagamento já existe (idempotência): ${idempotencyCheck.existingPayment.id}`);
      return res.status(200).json({
        success: true,
        type: 'asaas',
        paymentMethod: paymentMethod,
        paymentId: idempotencyCheck.existingPayment.externalId || undefined,
        invoiceUrl: idempotencyCheck.existingPayment.externalUrl || undefined,
        cached: true,
      });
    }

    // P-003: Verificar se booking já tem pagamento ativo
    const activePaymentCheck = await checkBookingHasActivePayment(bookingId);
    if (activePaymentCheck.exists && activePaymentCheck.existingPayment) {
      console.log(`♻️ [PAYMENTS] Booking já tem pagamento ativo: ${activePaymentCheck.existingPayment.id}`);
      return res.status(200).json({
        success: true,
        type: 'asaas',
        paymentMethod: paymentMethod,
        paymentId: activePaymentCheck.existingPayment.externalId || undefined,
        invoiceUrl: activePaymentCheck.existingPayment.externalUrl || undefined,
        cached: true,
      });
    }

    // 2. Buscar booking com dados relacionados
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        user: true,
        product: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        type: 'asaas',
        error: 'Reserva não encontrada' 
      });
    }

    if (booking.status === 'CONFIRMED') {
      return res.status(400).json({ 
        success: false, 
        type: 'asaas',
        error: 'Reserva já foi confirmada' 
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false, 
        type: 'asaas',
        error: 'Reserva foi cancelada' 
      });
    }

    // 3. Calcular valor e descrição
    const hours = Math.ceil(
      (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
    );
    
    let totalAmount: number;
    let description: string;
    
    if (booking.product) {
      totalAmount = booking.product.price;
      description = booking.product.name;
    } else {
      // Usar helper PRICES_V3 para calcular preço (respeita sábado)
      try {
        totalAmount = getBookingTotalCentsByDate(booking.roomId, booking.startTime, hours, booking.room.slug);
      } catch (err) {
        console.error('[PAYMENTS] Erro ao calcular preço:', err);
        throw new Error(`Erro ao calcular o preço da reserva: ${err instanceof Error ? err.message : 'Desconhecido'}`);
      }
      description = `${hours}h em ${booking.room.name}`;
    }

    // 4. Modo mock
    if (isMockMode()) {
      console.log('🎭 [MOCK] Pagamento simulado para booking:', bookingId, { paymentMethod });
      
      const mockUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mock-payment?bookingId=${bookingId}&amount=${totalAmount}&method=${paymentMethod}`;
      
      return res.status(200).json({
        success: true,
        type: 'mock',
        paymentMethod,
        invoiceUrl: mockUrl,
        pixCopyPaste: paymentMethod === 'PIX' 
          ? `00020126580014br.gov.bcb.pix0136mock-${bookingId}520400005303986540${(totalAmount / 100).toFixed(2)}5802BR6009SAO PAULO62070503***6304MOCK`
          : undefined,
        amount: totalAmount,
        installmentCount: paymentMethod === 'CARD' && installmentCount ? installmentCount : undefined,
      });
    }

    // 5. Criar cobrança no Asaas (PIX ou CARTÃO)
    const basePaymentInput = {
      bookingId: booking.id,
      customerName: booking.user.name,
      customerEmail: booking.user.email,
      customerPhone: booking.user.phone || '',
      customerCpf: booking.user.cpf || '',
      value: totalAmount, // Em centavos
      description: `Reserva Espaço Arthemi - ${description}`,
    };

    if (paymentMethod === 'CARD') {
      // Pagamento por CARTÃO DE CRÉDITO
      const result = await createBookingCardPayment({
        ...basePaymentInput,
        installmentCount: installmentCount || 1,
      });

      console.log('💳 [Asaas] Cobrança CARTÃO criada:', result.paymentId);

      // Atualizar booking
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentId: result.paymentId,
          paymentStatus: 'PENDING',
          paymentMethod: 'CREDIT_CARD',
        },
      });

      // P-003: Criar registro de Payment com idempotencyKey
      await prisma.payment.create({
        data: {
          bookingId: bookingId,
          userId: booking.userId,
          amount: totalAmount,
          status: 'PENDING',
          method: 'CREDIT_CARD',
          externalId: result.paymentId,
          externalUrl: result.invoiceUrl,
          idempotencyKey,
        },
      });

      return res.status(200).json({
        success: true,
        type: 'asaas',
        paymentMethod: 'CARD',
        paymentId: result.paymentId,
        invoiceUrl: result.invoiceUrl,
        amount: totalAmount,
        installmentCount: result.installmentCount,
        installmentValue: result.installmentValue ? Math.round(result.installmentValue * 100) : undefined,
      });
    }

    // Pagamento por PIX (default)
    const result = await createBookingPayment(basePaymentInput);

    console.log('💳 [Asaas] Cobrança PIX criada:', result.paymentId);

    // 6. Atualizar booking com ID do pagamento
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentId: result.paymentId,
        paymentStatus: 'PENDING',
        paymentMethod: 'PIX',
      },
    });

    // P-003: Criar registro de Payment com idempotencyKey
    await prisma.payment.create({
      data: {
        bookingId: bookingId,
        userId: booking.userId,
        amount: totalAmount,
        status: 'PENDING',
        method: 'PIX',
        externalId: result.paymentId,
        externalUrl: result.invoiceUrl,
        idempotencyKey,
      },
    });

    // 7. Retornar dados do pagamento (PIX)
    return res.status(200).json({
      success: true,
      type: 'asaas',
      paymentMethod: 'PIX',
      paymentId: result.paymentId,
      invoiceUrl: result.invoiceUrl,
      pixQrCode: result.pixQrCode,
      pixCopyPaste: result.pixQrCode?.payload,
      amount: totalAmount,
    });

  } catch (error) {
    console.error('❌ Erro ao criar pagamento:', error);
    
    return res.status(500).json({ 
      success: false, 
      type: 'asaas',
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}
