// ===========================================================
// API: POST /api/payments/create
// ===========================================================
// Cria cobrança PIX no Asaas para uma reserva

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createBookingPayment, isMockMode, PixQrCode } from '@/lib/asaas';

const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
});

interface PaymentResponse {
  success: boolean;
  type: 'asaas' | 'mock';
  paymentId?: string;
  invoiceUrl?: string;
  pixQrCode?: PixQrCode;
  pixCopyPaste?: string;
  amount?: number;
  error?: string;
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

    const { bookingId } = validation.data;

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
      totalAmount = booking.room.hourlyRate * hours;
      description = `${hours}h em ${booking.room.name}`;
    }

    // 4. Modo mock
    if (isMockMode()) {
      console.log('🎭 [MOCK] Pagamento simulado para booking:', bookingId);
      
      const mockUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mock-payment?bookingId=${bookingId}&amount=${totalAmount}`;
      
      return res.status(200).json({
        success: true,
        type: 'mock',
        invoiceUrl: mockUrl,
        pixCopyPaste: `00020126580014br.gov.bcb.pix0136mock-${bookingId}520400005303986540${(totalAmount / 100).toFixed(2)}5802BR6009SAO PAULO62070503***6304MOCK`,
        amount: totalAmount,
      });
    }

    // 5. Criar cobrança PIX no Asaas
    const result = await createBookingPayment({
      bookingId: booking.id,
      customerName: booking.user.name,
      customerEmail: booking.user.email,
      customerPhone: booking.user.phone || '',
      customerCpf: booking.user.cpf || '',
      value: totalAmount, // Em centavos
      description: `Reserva Espaço Arthemi - ${description}`,
    });

    console.log('💳 [Asaas] Cobrança criada:', result.paymentId);

    // 6. Atualizar booking com ID do pagamento
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentId: result.paymentId,
        paymentStatus: 'PENDING',
      },
    });

    // 7. Retornar dados do pagamento
    return res.status(200).json({
      success: true,
      type: 'asaas',
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
