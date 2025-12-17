import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getPaymentInfo } from '@/lib/mercadopago';

/**
 * Webhook do MercadoPago - recebe notificações de pagamento
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;

    // MercadoPago envia diferentes tipos de notificações
    if (type !== 'payment') {
      // Ignorar outros tipos (merchant_order, etc)
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID não encontrado' });
    }

    // Buscar informações do pagamento no MercadoPago
    const paymentInfo = await getPaymentInfo(paymentId);
    
    if (!paymentInfo) {
      console.error('Payment info not found:', paymentId);
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    // external_reference contém o bookingId
    const bookingId = paymentInfo.external_reference;
    
    if (!bookingId) {
      console.error('Booking ID not in external_reference');
      return res.status(400).json({ error: 'Referência não encontrada' });
    }

    // Mapear status do MercadoPago para nosso sistema
    const statusMap: Record<string, string> = {
      approved: 'approved',
      pending: 'pending',
      authorized: 'pending',
      in_process: 'pending',
      in_mediation: 'pending',
      rejected: 'rejected',
      cancelled: 'REJECTED',
      refunded: 'REFUNDED',
      charged_back: 'REFUNDED',
    };

    const newStatus = statusMap[paymentInfo.status] || 'PENDING';

    // Atualizar payment no banco
    await prisma.payment.updateMany({
      where: { bookingId },
      data: {
        externalId: paymentId.toString(),
        status: newStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'IN_PROCESS',
        method: paymentInfo.payment_method_id || 'mercadopago',
        paidAt: newStatus === 'APPROVED' ? new Date() : null,
      },
    });

    // Atualizar status do booking baseado no pagamento
    const bookingStatus = newStatus === 'APPROVED' 
      ? 'CONFIRMED' 
      : newStatus === 'REJECTED' 
        ? 'CANCELLED' 
        : 'PENDING';

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: bookingStatus },
    });

    // Se pagamento aprovado, criar créditos se for pacote
    if (newStatus === 'APPROVED') {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { product: true, user: true },
      });

      if (booking?.product && booking.product.type !== 'HOURLY_RATE') {
        // Criar UserPackage para rastrear uso
        await prisma.userPackage.create({
          data: {
            userId: booking.userId,
            type: mapProductTypeToPackageType(booking.product.type),
            totalHours: getPackageHours(booking.product.type),
            remainingHours: getPackageHours(booking.product.type),
            expiresAt: calculateExpiry(booking.product.type),
            paymentStatus: 'APPROVED',
            amountPaid: booking.product.price,
          },
        });
      }
    }

    console.log(`Webhook processed: booking ${bookingId} -> ${bookingStatus}`);

    return res.status(200).json({ 
      received: true, 
      bookingId, 
      status: newStatus 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Retornar 200 mesmo em erro para evitar retentativas infinitas
    return res.status(200).json({ 
      received: true, 
      error: 'Internal processing error' 
    });
  }
}

function calculateExpiry(productType: string): Date {
  const now = new Date();
  
  switch (productType) {
    case 'PACKAGE_10H':
    case 'PACKAGE_20H':
      // Pacotes menores: 90 dias
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case 'PACKAGE_40H':
    case 'SHIFT_FIXED':
      // Pacotes maiores: 180 dias
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    case 'DAY_PASS':
    case 'SATURDAY_PASS':
      // Passes: válido no dia
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    default:
      // Default: 30 dias
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

function getPackageHours(productType: string): number {
  switch (productType) {
    case 'PACKAGE_10H':
      return 10;
    case 'PACKAGE_20H':
      return 20;
    case 'PACKAGE_40H':
      return 40;
    case 'SHIFT_FIXED':
      return 16; // 4 horas/semana x 4 semanas
    case 'DAY_PASS':
    case 'SATURDAY_PASS':
      return 10;
    default:
      return 1;
  }
}

function mapProductTypeToPackageType(productType: string): 'HOURS_4' | 'HOURS_8' {
  if (productType === 'PACKAGE_10H' || productType === 'PACKAGE_20H') {
    return 'HOURS_4';
  }
  return 'HOURS_8';
}
