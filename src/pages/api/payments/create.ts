// ===========================================================
// API: POST /api/payments/create
// ===========================================================
// Cria preferência de pagamento no MercadoPago

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createPaymentPreference, isMockMode } from '@/lib/mercadopago';

const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
});

interface PaymentResponse {
  success: boolean;
  type: 'mercadopago' | 'mock';
  preferenceId?: string;
  initPoint?: string;
  sandboxInitPoint?: string;
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
      type: 'mercadopago',
      error: 'Método não permitido' 
    });
  }

  try {
    // 1. Validar input
    const validation = createPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        type: 'mercadopago',
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
        type: 'mercadopago',
        error: 'Reserva não encontrada' 
      });
    }

    if (booking.status === 'CONFIRMED') {
      return res.status(400).json({ 
        success: false, 
        type: 'mercadopago',
        error: 'Reserva já foi confirmada' 
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false, 
        type: 'mercadopago',
        error: 'Reserva foi cancelada' 
      });
    }

    // 3. Calcular valor
    const hours = Math.ceil(
      (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
    );
    
    // Se tem produto, usa preço do produto. Senão, calcula por hora
    let totalAmount: number;
    let description: string;
    
    if (booking.product) {
      totalAmount = booking.product.price;
      description = booking.product.name;
    } else {
      totalAmount = booking.room.hourlyRate * hours;
      description = `${hours}h em ${booking.room.name}`;
    }

    // 4. Verificar modo mock
    if (isMockMode()) {
      console.log('🎭 [MOCK] Pagamento simulado para booking:', bookingId);
      
      const mockUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mock-payment?bookingId=${bookingId}&amount=${totalAmount}`;
      
      return res.status(200).json({
        success: true,
        type: 'mock',
        initPoint: mockUrl,
        sandboxInitPoint: mockUrl,
        amount: totalAmount,
      });
    }

    // 5. Criar preferência no MercadoPago REAL
    const preference = await createPaymentPreference({
      bookingId: booking.id,
      title: `Reserva ${booking.room.name}`,
      description: description,
      unitPrice: totalAmount, // Já em centavos
      quantity: 1,
      buyerEmail: booking.user.email,
      buyerName: booking.user.name,
    });

    console.log('💳 [MercadoPago] Preferência criada:', preference.id);

    // 6. Atualizar booking com ID da preferência
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentId: preference.id,
        paymentStatus: 'PENDING',
      },
    });

    // 7. Retornar URLs de pagamento
    return res.status(200).json({
      success: true,
      type: 'mercadopago',
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      amount: totalAmount,
    });

  } catch (error) {
    console.error('❌ Erro ao criar pagamento:', error);
    
    return res.status(500).json({ 
      success: false, 
      type: 'mercadopago',
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}
