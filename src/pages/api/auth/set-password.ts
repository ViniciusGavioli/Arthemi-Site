// ===========================================================
// API: POST /api/auth/set-password
// ===========================================================
// Define senha para usuário com token de ativação válido
// Usado após checkout anônimo + verify-email

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { hashActivationToken } from '@/lib/email-activation';
import { hashPassword, signSessionToken, setAuthCookie } from '@/lib/auth';
import { checkApiRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/api-rate-limit';

// ============================================================
// VALIDAÇÃO
// ============================================================

const setPasswordSchema = z.object({
  token: z.string().min(20, 'Token inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

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
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      ok: false,
      error: 'Método não permitido',
    });
  }

  // Rate limit (5 req/min por IP)
  const clientIp = getClientIp(req);
  const rateLimit = checkApiRateLimit('set-password', clientIp, { maxRequests: 5, windowMs: 60000 });
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  }

  try {
    // 1. Validar body
    const validation = setPasswordSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        ok: false,
        error: validation.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    const { token, password } = validation.data;

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
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            passwordHash: true,
          },
        },
      },
    });

    // 4. Validar token
    if (!tokenRecord) {
      return res.status(400).json({
        ok: false,
        error: 'Token inválido ou expirado',
      });
    }

    if (tokenRecord.expiresAt < new Date()) {
      return res.status(400).json({
        ok: false,
        error: 'Token expirado',
      });
    }

    // 5. Verificar se email está verificado
    // Se não estiver, verificamos agora (tolerância para UX)
    const user = tokenRecord.user;
    
    if (!user) {
      return res.status(400).json({
        ok: false,
        error: 'Usuário não encontrado',
      });
    }

    // 6. Verificar se já tem senha (evita sobrescrever)
    if (user.passwordHash) {
      return res.status(400).json({
        ok: false,
        error: 'Conta já possui senha definida. Use "Esqueci minha senha" para redefinir.',
      });
    }

    // 7. Hash da nova senha
    const passwordHash = await hashPassword(password);

    // 8. Atualizar usuário e token em transação
    await prisma.$transaction([
      // Definir senha e marcar email como verificado
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
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

    // 9. Criar sessão automaticamente
    const sessionToken = signSessionToken({ userId: user.id, role: 'CUSTOMER' });
    setAuthCookie(res, sessionToken);

    console.log(`✅ [SET-PASSWORD] Senha definida para userId: ${user.id}`);

    return res.status(200).json({
      ok: true,
      message: 'Senha definida com sucesso! Você já está logado.',
    });

  } catch (error) {
    console.error('❌ [SET-PASSWORD] Erro:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno. Tente novamente.',
    });
  }
}
