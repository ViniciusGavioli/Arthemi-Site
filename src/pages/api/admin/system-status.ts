// ===========================================================
// API: /api/admin/system-status
// ===========================================================
// Retorna status do sistema para página admin
// Inclui: status dos serviços, métricas, últimos erros

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getMetrics, getLastErrors } from '@/lib/logger';
import { getAllContingencyFlags, initializeContingencyFlags, setContingencyFlag, ContingencyFlagKey } from '@/lib/contingency';

// Verificação de autenticação admin
async function isAdminAuthenticated(req: NextApiRequest): Promise<boolean> {
  const adminToken = req.cookies.admin_token;
  if (!adminToken) return false;

  // Token existe = autenticado (validação já feita pelo middleware)
  return true;
}

// ============================================================
// VERIFICAÇÕES DE SAÚDE DOS SERVIÇOS
// ============================================================

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  message?: string;
}

async function checkDatabaseHealth(): Promise<ServiceStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      lastCheck: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkAsaasHealth(): Promise<ServiceStatus> {
  // Verificamos apenas se temos a API key configurada
  // Não fazemos chamada real para não gastar quota
  const hasApiKey = !!process.env.ASAAS_API_KEY;
  
  if (!hasApiKey) {
    return {
      status: 'down',
      lastCheck: new Date().toISOString(),
      message: 'ASAAS_API_KEY não configurada',
    };
  }

  // Verificar último erro de pagamento
  const lastErrors = await getLastErrors();
  const paymentError = lastErrors['PAYMENT'];
  
  if (paymentError) {
    const errorTime = new Date(paymentError.timestamp);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (errorTime > fiveMinutesAgo) {
      return {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        message: paymentError.message,
      };
    }
  }

  return {
    status: 'healthy',
    lastCheck: new Date().toISOString(),
  };
}

async function checkEmailHealth(): Promise<ServiceStatus> {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  
  if (!hasResendKey) {
    return {
      status: 'down',
      lastCheck: new Date().toISOString(),
      message: 'RESEND_API_KEY não configurada',
    };
  }

  // Verificar último erro de email
  const lastErrors = await getLastErrors();
  const emailError = lastErrors['EMAIL'];
  
  if (emailError) {
    const errorTime = new Date(emailError.timestamp);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (errorTime > fiveMinutesAgo) {
      return {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        message: emailError.message,
      };
    }
  }

  return {
    status: 'healthy',
    lastCheck: new Date().toISOString(),
  };
}

async function checkWebhookHealth(): Promise<ServiceStatus> {
  // Verificar último erro de webhook
  const lastErrors = await getLastErrors();
  const webhookError = lastErrors['WEBHOOK'];
  
  if (webhookError) {
    const errorTime = new Date(webhookError.timestamp);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    if (errorTime > tenMinutesAgo) {
      return {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        message: webhookError.message,
      };
    }
  }

  return {
    status: 'healthy',
    lastCheck: new Date().toISOString(),
  };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Autenticação
  if (!(await isAdminAuthenticated(req))) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // GET: Retorna status completo
  if (req.method === 'GET') {
    try {
      // Inicializar flags se necessário
      await initializeContingencyFlags();

      // Coletar status de todos os serviços em paralelo
      const [database, payment, email, webhook, contingencyFlags, metrics, lastErrors] = await Promise.all([
        checkDatabaseHealth(),
        checkAsaasHealth(),
        checkEmailHealth(),
        checkWebhookHealth(),
        getAllContingencyFlags(),
        getMetrics(7), // últimos 7 dias
        getLastErrors(),
      ]);

      // Contagem de reservas recentes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Início do mês atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const [recentBookings, pendingBookings, confirmedCount, revenueResult] = await Promise.all([
        // Reservas criadas hoje
        prisma.booking.count({
          where: {
            createdAt: { gte: today },
          },
        }),
        // Pendentes (global)
        prisma.booking.count({
          where: {
            status: 'PENDING',
          },
        }),
        // Confirmadas do mês
        prisma.booking.count({
          where: {
            startTime: { gte: startOfMonth },
            status: 'CONFIRMED',
          },
        }),
        // Receita do mês
        prisma.booking.aggregate({
          where: {
            startTime: { gte: startOfMonth },
            status: 'CONFIRMED',
            OR: [
              { paymentStatus: 'APPROVED' },
              { isManual: true },
            ],
          },
          _sum: { amountPaid: true },
        }),
      ]);

      return res.status(200).json({
        timestamp: new Date().toISOString(),
        services: {
          database,
          payment,
          email,
          webhook,
        },
        contingencyFlags,
        metrics,
        lastErrors,
        summary: {
          reservasHoje: recentBookings,
          reservasPendentes: pendingBookings,
          confirmadas: confirmedCount,
          receita: revenueResult._sum.amountPaid || 0,
        },
      });
    } catch (error) {
      console.error('[ADMIN] Erro ao buscar status:', error);
      return res.status(500).json({ error: 'Erro ao buscar status do sistema' });
    }
  }

  // PUT: Atualiza flag de contingência
  if (req.method === 'PUT') {
    try {
      const { flag, active } = req.body;

      if (!flag || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }

      await setContingencyFlag(flag as ContingencyFlagKey, active);

      return res.status(200).json({
        success: true,
        flag,
        active,
      });
    } catch (error) {
      console.error('[ADMIN] Erro ao atualizar flag:', error);
      return res.status(500).json({ error: 'Erro ao atualizar flag' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
