import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint para processar pagamentos mock (apenas para testes)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar se está em modo mock
  if (process.env.MOCK_PAYMENTS !== 'true' && process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(403).json({ 
      error: 'Mock payments não habilitado em ambiente de produção' 
    });
  }

  try {
    const { bookingId, paymentId, status, method } = req.body;

    if (!bookingId || !status) {
      return res.status(400).json({ error: 'bookingId e status são obrigatórios' });
    }

    // Mapear status para booking
    const bookingStatus = status === 'approved' 
      ? 'CONFIRMED' 
      : status === 'rejected' 
        ? 'CANCELLED' 
        : 'PENDING';

    // Atualizar payment se existir
    if (paymentId) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status,
          method: method || 'mock',
          paidAt: status === 'APPROVED' ? new Date() : null,
        },
      });
    } else {
      // Criar payment associado ao booking
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      
      if (booking) {
        await prisma.payment.create({
          data: {
            userId: booking.userId,
            bookingId,
            externalId: `mock_${Date.now()}`,
            status,
            amount: booking.amountPaid || 0,
            method: method || 'mock',
            paidAt: status === 'APPROVED' ? new Date() : null,
          },
        });
      }
    }

    // Atualizar booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: bookingStatus,
        paymentStatus: status,
      },
    });

    // Se aprovado, criar UserPackage se for pacote
    if (status === 'APPROVED') {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { product: true },
      });

      if (booking?.product && booking.product.type !== 'HOURLY_RATE') {
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

    console.log(`[MOCK] Payment processed: booking ${bookingId} -> ${status}`);

    return res.status(200).json({ 
      success: true, 
      bookingId, 
      status,
      bookingStatus,
    });
  } catch (error) {
    console.error('Mock payment error:', error);
    return res.status(500).json({ error: 'Erro ao processar pagamento mock' });
  }
}

function calculateExpiry(productType: string): Date {
  const now = new Date();
  
  switch (productType) {
    case 'PACKAGE_10H':
    case 'PACKAGE_20H':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case 'PACKAGE_40H':
    case 'SHIFT_FIXED':
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    case 'DAY_PASS':
    case 'SATURDAY_PASS':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

function getPackageHours(productType: string): number {
  switch (productType) {
    case 'PACKAGE_10H': return 10;
    case 'PACKAGE_20H': return 20;
    case 'PACKAGE_40H': return 40;
    case 'SHIFT_FIXED': return 16;
    case 'DAY_PASS':
    case 'SATURDAY_PASS': return 10;
    default: return 1;
  }
}

function mapProductTypeToPackageType(productType: string): 'HOURS_4' | 'HOURS_8' {
  // Map para os tipos de pacote existentes
  if (productType === 'PACKAGE_10H' || productType === 'PACKAGE_20H') {
    return 'HOURS_4';
  }
  return 'HOURS_8';
}
