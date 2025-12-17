import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createPreference, isMockMode } from '@/lib/mercadopago';

const createPaymentSchema = z.object({
  bookingId: z.string().uuid(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId } = createPaymentSchema.parse(req.body);

    // Buscar booking com dados relacionados
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        user: true,
        product: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ error: 'Reserva já processada' });
    }

    // Calcular valor
    const hours = Math.ceil(
      (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
    );
    const unitPrice = booking.product?.price || booking.room.hourlyRate;
    const totalAmount = unitPrice * hours;

    // Se está em modo mock, redirecionar para página de mock
    if (isMockMode()) {
      // Criar payment pendente no banco
      const payment = await prisma.payment.create({
        data: {
          userId: booking.userId,
          bookingId: booking.id,
          externalId: `mock_${Date.now()}`,
          status: 'PENDING',
          amount: totalAmount,
          method: 'mock',
        },
      });

      const mockUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/mock-payment?bookingId=${bookingId}&paymentId=${payment.id}&amount=${totalAmount}`;
      
      return res.status(200).json({
        type: 'mock',
        paymentId: payment.id,
        redirectUrl: mockUrl,
        amount: totalAmount,
      });
    }

    // Modo real - criar preferência MercadoPago
    const preference = await createPreference({
      title: `Reserva ${booking.room.name} - ${booking.product?.name || 'Hora Avulsa'}`,
      description: `Reserva de ${hours}h em ${booking.room.name}`,
      quantity: 1,
      unit_price: totalAmount,
      bookingId: booking.id,
    });

    // Criar payment pendente
    const payment = await prisma.payment.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        externalId: preference.id,
        status: 'PENDING',
        amount: totalAmount,
        method: 'mercadopago',
      },
    });

    return res.status(200).json({
      type: 'mercadopago',
      paymentId: payment.id,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      amount: totalAmount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.errors 
      });
    }
    console.error('Create payment error:', error);
    return res.status(500).json({ error: 'Erro ao criar pagamento' });
  }
}
