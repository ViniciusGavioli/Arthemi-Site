import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Unificada de Status de Pagamento Pendente
 * 
 * Suporta:
 * - GET /api/pending/status?type=booking&id=xxx
 * - GET /api/pending/status?type=credit&id=xxx
 * 
 * Retorna:
 * - { status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED', updatedAt: string }
 * 
 * Headers:
 * - x-request-id: ID único para rastreabilidade
 * - Cache-Control: no-store
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = uuidv4();
  res.setHeader('x-request-id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, id } = req.query;

  if (!type || !id || typeof type !== 'string' || typeof id !== 'string') {
    console.log(`[${requestId}] ❌ Missing or invalid params`, { type, id });
    return res.status(400).json({ error: 'Missing type or id parameter' });
  }

  if (type !== 'booking' && type !== 'credit') {
    console.log(`[${requestId}] ❌ Invalid type`, { type });
    return res.status(400).json({ error: 'Type must be "booking" or "credit"' });
  }

  try {
    if (type === 'booking') {
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      if (!booking) {
        console.log(`[${requestId}] ❌ Booking not found`, { id: id.slice(0, 8) });
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Mapear status da reserva para status simplificado
      const statusMap: Record<string, string> = {
        'PENDING': 'PENDING',
        'CONFIRMED': 'CONFIRMED',
        'CANCELLED': 'CANCELLED',
        'COMPLETED': 'CONFIRMED',
      };

      const status = statusMap[booking.status] || 'PENDING';
      
      console.log(`[${requestId}] 📊 Booking status`, { 
        id: id.slice(0, 8), 
        status,
        originalStatus: booking.status 
      });

      return res.status(200).json({
        status,
        updatedAt: booking.updatedAt.toISOString(),
        type: 'booking',
      });
    }

    if (type === 'credit') {
      const credit = await prisma.creditPurchase.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      if (!credit) {
        console.log(`[${requestId}] ❌ Credit not found`, { id: id.slice(0, 8) });
        return res.status(404).json({ error: 'Credit not found' });
      }

      // Mapear status do crédito para status simplificado
      const statusMap: Record<string, string> = {
        'PENDING': 'PENDING',
        'CONFIRMED': 'CONFIRMED',
        'CANCELLED': 'CANCELLED',
        'REFUNDED': 'REFUNDED',
      };

      const status = statusMap[credit.status] || 'PENDING';
      
      console.log(`[${requestId}] 📊 Credit status`, { 
        id: id.slice(0, 8), 
        status,
        originalStatus: credit.status 
      });

      return res.status(200).json({
        status,
        updatedAt: credit.updatedAt.toISOString(),
        type: 'credit',
      });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching status`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
