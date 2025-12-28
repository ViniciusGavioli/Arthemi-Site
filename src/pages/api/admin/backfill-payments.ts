import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getPayment, isPaymentStatusConfirmed, realToCents } from '@/lib/asaas';

/**
 * API para reprocessar pagamentos pendentes
 * 
 * Útil para:
 * - Recuperar pagamentos que não foram processados pelo webhook
 * - Sincronizar status de pagamento com a Asaas
 * 
 * GET: Retorna estatísticas das reservas que precisam de backfill
 * POST: Executa o backfill
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Autenticação básica (pode melhorar depois)
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

/**
 * GET - Retorna estatísticas
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const pendingBookings = await prisma.booking.findMany({
    where: {
      paymentId: { not: null },
      OR: [
        { status: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { amountPaid: 0 },
      ],
    },
    select: {
      id: true,
      paymentId: true,
      status: true,
      paymentStatus: true,
      amountPaid: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return res.status(200).json({
    count: pendingBookings.length,
    bookings: pendingBookings,
    message: `${pendingBookings.length} reservas precisam de backfill`,
  });
}

/**
 * Converte status Asaas para PaymentStatus do Prisma
 */
function mapAsaasStatusToPaymentStatus(asaasStatus: string): 'PENDING' | 'APPROVED' | 'REFUNDED' | 'REJECTED' {
  switch (asaasStatus) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'APPROVED';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return 'REFUNDED';
    case 'OVERDUE':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
      return 'REJECTED';
    default:
      return 'PENDING';
  }
}

/**
 * POST - Executa o backfill
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { bookingIds } = req.body as { bookingIds?: string[] };

  // Se bookingIds não for fornecido, processa todos os pendentes
  const whereClause = bookingIds?.length
    ? {
        id: { in: bookingIds },
        paymentId: { not: null },
      }
    : {
        paymentId: { not: null },
        OR: [
          { status: 'PENDING' as const },
          { paymentStatus: 'PENDING' as const },
          { amountPaid: 0 },
        ],
      };

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    select: {
      id: true,
      paymentId: true,
      status: true,
      paymentStatus: true,
      amountPaid: true,
    },
  });

  const results = {
    total: bookings.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    totalRevenue: 0,
    details: [] as Array<{
      bookingId: string;
      status: 'updated' | 'skipped' | 'error';
      message: string;
    }>,
  };

  for (const booking of bookings) {
    if (!booking.paymentId) {
      results.skipped++;
      results.details.push({
        bookingId: booking.id,
        status: 'skipped',
        message: 'Sem paymentId',
      });
      continue;
    }

    try {
      // Busca na Asaas
      const asaasPayment = await getPayment(booking.paymentId);

      if (!asaasPayment) {
        results.skipped++;
        results.details.push({
          bookingId: booking.id,
          status: 'skipped',
          message: 'Pagamento não encontrado na Asaas',
        });
        continue;
      }

      const newPaymentStatus = mapAsaasStatusToPaymentStatus(asaasPayment.status);
      const isConfirmed = isPaymentStatusConfirmed(asaasPayment.status);
      const needsUpdate = newPaymentStatus !== booking.paymentStatus || 
        (isConfirmed && booking.amountPaid === 0);

      if (!needsUpdate) {
        results.skipped++;
        results.details.push({
          bookingId: booking.id,
          status: 'skipped',
          message: `Sem alterações (Asaas: ${asaasPayment.status})`,
        });
        continue;
      }

      // Prepara atualização
      const updateData: {
        paymentStatus: 'PENDING' | 'APPROVED' | 'REFUNDED' | 'REJECTED';
        amountPaid?: number;
        status?: 'CONFIRMED';
      } = {
        paymentStatus: newPaymentStatus,
      };

      if (isConfirmed) {
        updateData.amountPaid = realToCents(asaasPayment.value);
        if (booking.status === 'PENDING') {
          updateData.status = 'CONFIRMED';
        }
      }

      // Atualiza
      await prisma.booking.update({
        where: { id: booking.id },
        data: updateData,
      });

      results.updated++;
      if (isConfirmed) {
        results.totalRevenue += asaasPayment.value;
      }
      results.details.push({
        bookingId: booking.id,
        status: 'updated',
        message: `Atualizado: ${asaasPayment.status} → ${newPaymentStatus} (R$ ${asaasPayment.value.toFixed(2)})`,
      });

      // Rate limit - aguarda 500ms entre requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      results.errors++;
      results.details.push({
        bookingId: booking.id,
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return res.status(200).json({
    success: true,
    results,
    message: `Backfill concluído: ${results.updated} atualizadas, ${results.skipped} ignoradas, ${results.errors} erros. Receita recuperada: R$ ${results.totalRevenue.toFixed(2)}`,
  });
}
