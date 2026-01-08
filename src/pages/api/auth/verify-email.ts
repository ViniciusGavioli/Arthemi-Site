// ===========================================================
// API: GET /api/auth/verify-email
// ===========================================================
// Verifica token de ativação e marca email como verificado
// Usado após checkout anônimo para ativar conta

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { hashActivationToken } from '@/lib/email-activation';
import { checkApiRateLimit, getClientIp, getRateLimitMessage } from '@/lib/api-rate-limit';

// ============================================================
// TIPOS
// ============================================================

interface SuccessResponse {
  ok: true;
  message: string;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      ok: false,
      error: 'Método não permitido',
    });
  }

  // Rate limit (10 req/min por IP)
  const clientIp = getClientIp(req);
  const rateLimit = checkApiRateLimit('verify-email', clientIp, { maxRequests: 10, windowMs: 60000 });
  
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfterSeconds || 60);
    return res.status(429).json({
      ok: false,
      error: getRateLimitMessage(rateLimit.retryAfterSeconds),
    });
  }

  try {
    // 1. Obter token da query
    const { token } = req.query;
    
    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({
        ok: false,
        error: 'Token inválido ou expirado',
      });
    }

    // 2. Hash do token
    const tokenHash = hashActivationToken(token);

    // 3. Buscar token no banco
    const tokenRecord = await prisma.emailActivationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    // 4. Validar token
    if (!tokenRecord) {
      return res.status(400).json({
        ok: false,
        error: 'Token inválido ou expirado',
      });
    }

    if (tokenRecord.usedAt) {
      return res.status(400).json({
        ok: false,
        error: 'Token já foi utilizado',
      });
    }

    if (tokenRecord.expiresAt < new Date()) {
      return res.status(400).json({
        ok: false,
        error: 'Token expirado',
      });
    }

    // 5. Atualizar usuário e token em transação
    await prisma.$transaction([
      // Marcar email como verificado (apenas se ainda não estava)
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          emailVerifiedAt: new Date(),
        },
      }),
      // Marcar token como usado
      prisma.emailActivationToken.update({
        where: { id: tokenRecord.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    console.log(`✅ [VERIFY-EMAIL] Email verificado para userId: ${tokenRecord.userId}`);

    return res.status(200).json({
      ok: true,
      message: 'Email verificado com sucesso!',
    });

  } catch (error) {
    console.error('❌ [VERIFY-EMAIL] Erro:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno. Tente novamente.',
    });
  }
}
