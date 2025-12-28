import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

/**
 * API de Monitoramento Financeiro
 * 
 * Detecta:
 * - Pagamentos aprovados na Asaas que não foram confirmados no sistema
 * - Reservas pendentes há mais de X minutos após pagamento
 * 
 * GET: Retorna alertas ativos
 * POST: Executa verificação e gera alertas
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Autenticação
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
 * GET - Retorna alertas de pagamentos não confirmados
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const minutesThreshold = parseInt(req.query.minutes as string) || 5;
  const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);

  // Busca reservas com paymentId que ainda estão PENDING
  // e foram criadas há mais de X minutos
  const suspiciousBookings = await prisma.booking.findMany({
    where: {
      paymentId: { not: null },
      status: 'PENDING',
      paymentStatus: 'PENDING',
      createdAt: { lt: thresholdDate },
    },
    select: {
      id: true,
      paymentId: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      room: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Busca webhooks que falharam
  const failedWebhooks = await prisma.webhookEvent.findMany({
    where: {
      status: 'FAILED',
    },
    select: {
      eventId: true,
      eventType: true,
      paymentId: true,
      bookingId: true,
      processedAt: true,
    },
    orderBy: {
      processedAt: 'desc',
    },
    take: 10,
  });

  const alerts = {
    pendingPayments: {
      count: suspiciousBookings.length,
      threshold: `${minutesThreshold} minutos`,
      bookings: suspiciousBookings.map(b => ({
        id: b.id,
        paymentId: b.paymentId,
        createdAt: b.createdAt,
        ageMinutes: Math.round((Date.now() - b.createdAt.getTime()) / 60000),
        user: b.user?.name || 'N/A',
        room: b.room?.name || 'N/A',
      })),
    },
    failedWebhooks: {
      count: failedWebhooks.length,
      events: failedWebhooks,
    },
    status: suspiciousBookings.length > 0 || failedWebhooks.length > 0 ? 'WARNING' : 'OK',
    checkedAt: new Date().toISOString(),
  };

  return res.status(200).json(alerts);
}

/**
 * POST - Executa verificação e gera alertas de auditoria
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const minutesThreshold = parseInt(req.query.minutes as string) || 5;
  const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);

  const suspiciousBookings = await prisma.booking.findMany({
    where: {
      paymentId: { not: null },
      status: 'PENDING',
      paymentStatus: 'PENDING',
      createdAt: { lt: thresholdDate },
    },
    select: {
      id: true,
      paymentId: true,
      createdAt: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  // Gera alerta para cada booking suspeito
  const alertsGenerated = [];
  for (const booking of suspiciousBookings) {
    const ageMinutes = Math.round((Date.now() - booking.createdAt.getTime()) / 60000);
    
    await logAudit({
      action: 'ALERT_PAYMENT_NOT_CONFIRMED',
      source: 'SYSTEM',
      targetType: 'Booking',
      targetId: booking.id,
      metadata: {
        paymentId: booking.paymentId,
        ageMinutes,
        threshold: minutesThreshold,
        userEmail: booking.user?.email,
        detectedAt: new Date().toISOString(),
      },
    });

    alertsGenerated.push({
      bookingId: booking.id,
      paymentId: booking.paymentId,
      ageMinutes,
    });

    console.warn(`⚠️ [Alert] Pagamento não confirmado: ${booking.id} (${ageMinutes}min)`);
  }

  return res.status(200).json({
    alertsGenerated: alertsGenerated.length,
    alerts: alertsGenerated,
    checkedAt: new Date().toISOString(),
    message: alertsGenerated.length > 0 
      ? `${alertsGenerated.length} alertas gerados para pagamentos não confirmados`
      : 'Nenhum alerta - todos os pagamentos estão processados corretamente',
  });
}
