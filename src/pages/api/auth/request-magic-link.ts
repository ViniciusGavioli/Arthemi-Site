// ===========================================================
// API: POST /api/auth/request-magic-link
// ===========================================================
// Gera e envia magic link para o email do cliente
// Rate limit: 3 por hora por email
// Sempre retorna sucesso (não revela se email existe)

import type { NextApiRequest, NextApiResponse } from 'next';
import { createMagicLink } from '@/lib/magic-link';
import { sendMagicLinkEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

interface ApiResponse {
  success: boolean;
  message: string;
  rateLimited?: boolean;
  retryAfter?: number; // segundos até poder tentar novamente
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
    });
  }

  try {
    const { email } = req.body;

    // Validação básica
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email é obrigatório',
      });
    }

    // Validação de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Cria magic link (inclui rate limit)
    const result = await createMagicLink(normalizedEmail);

    // Rate limited
    if (result.rateLimited) {
      const retryAfter = result.resetAt 
        ? Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
        : 3600;

      // Log de rate limit
      await logAudit({
        action: 'USER_MAGIC_LINK_RATE_LIMITED',
        source: 'USER',
        actorEmail: normalizedEmail,
        actorIp: getClientIp(req),
        userAgent: req.headers['user-agent'],
        metadata: { email: normalizedEmail },
      });

      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas. Aguarde alguns minutos.',
        rateLimited: true,
        retryAfter,
      });
    }

    // Se temos token, envia email
    if (result.token) {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, name: true },
      });

      if (user) {
        await sendMagicLinkEmail({
          userEmail: normalizedEmail,
          userName: user.name,
          token: result.token,
        });

        // Log de sucesso
        await logAudit({
          action: 'USER_MAGIC_LINK_REQUESTED',
          source: 'USER',
          actorId: user.id,
          actorEmail: normalizedEmail,
          actorIp: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });
      }
    }

    // SEMPRE retorna sucesso (não revela se email existe)
    return res.status(200).json({
      success: true,
      message: 'Se este email estiver cadastrado, você receberá um link de acesso.',
    });

  } catch (error) {
    console.error('[AUTH] Erro ao gerar magic link:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno. Tente novamente.',
    });
  }
}

/**
 * Extrai IP do cliente considerando proxies
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || 'unknown';
}
