// ===========================================================
// API: POST /api/admin/bookings/cancel - Cancelar com crédito
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { convertCancellationToCredit, canCancelWithRefund } from '@/lib/business-rules';
import { logAdminAction } from '@/lib/audit';

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId é obrigatório'),
  generateCredit: z.boolean().default(true), // Gera crédito por padrão
  reason: z.string().optional(),
});

interface ApiResponse {
  success: boolean;
  creditId?: string | null;
  creditAmount?: number;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  // Verificar autenticação admin
  const adminToken = req.cookies.admin_token;
  if (!adminToken) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado',
    });
  }

  try {
    const validation = cancelBookingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
      });
    }

    const { bookingId, generateCredit, reason } = validation.data;

    // Buscar booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada',
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Reserva já está cancelada',
      });
    }

    let creditId: string | null = null;
    let creditAmount = 0;

    // Cast para acessar novos campos (creditsUsed pode não estar no tipo ainda)
    const bookingData = booking as typeof booking & { creditsUsed?: number };

    if (generateCredit) {
      // Verificar se tem valor para gerar crédito
      const valueToCredit = booking.amountPaid + (bookingData.creditsUsed || 0);
      
      if (valueToCredit > 0) {
        // Usa a função do business-rules que já faz tudo
        const credit = await convertCancellationToCredit(bookingId);
        
        if (credit) {
          creditId = credit.id;
          creditAmount = credit.amount;
        }
      } else {
        // Apenas cancela sem crédito
        await prisma.booking.update({
          where: { id: bookingId },
          data: { 
            status: 'CANCELLED',
            notes: booking.notes 
              ? `${booking.notes}\n[CANCELADO] ${reason || 'Sem motivo informado'}`
              : `[CANCELADO] ${reason || 'Sem motivo informado'}`,
          },
        });
      }
    } else {
      // Cancela sem gerar crédito
      await prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'CANCELLED',
          notes: booking.notes 
            ? `${booking.notes}\n[CANCELADO SEM CRÉDITO] ${reason || ''}`
            : `[CANCELADO SEM CRÉDITO] ${reason || ''}`,
        },
      });
    }

    // Log de auditoria
    await logAdminAction(
      'BOOKING_CANCELLED',
      'Booking',
      bookingId,
      {
        userId: booking.userId,
        roomId: booking.roomId,
        generateCredit,
        creditId,
        creditAmount,
        reason,
        originalAmount: booking.amountPaid,
        creditsUsed: bookingData.creditsUsed || 0,
      },
      req
    );

    return res.status(200).json({
      success: true,
      creditId,
      creditAmount,
      message: creditId 
        ? `Reserva cancelada. Crédito de R$ ${(creditAmount / 100).toFixed(2)} gerado.`
        : 'Reserva cancelada sem geração de crédito.',
    });
  } catch (error) {
    console.error('Erro ao cancelar reserva:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao cancelar reserva',
    });
  }
}
