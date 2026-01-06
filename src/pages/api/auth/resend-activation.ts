// ===========================================================
// API: POST /api/auth/resend-activation
// ===========================================================
// Reenvia email de ativação de conta
// Rate limit: 3 tentativas por hora por email

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { generateActivationToken, buildActivationUrl } from '@/lib/email-activation';
import { sendAccountActivationEmail } from '@/lib/mailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkApiRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/api-rate-limit';

// Schema de validação
const resendActivationSchema = z.object({
  email: z.string().email('Email inválido'),
});

interface ApiResponse {
  ok: boolean;
  error?: string;
  resetAt?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  try {
    // Validar body
    const validation = resendActivationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        ok: false,
        error: 'Email inválido',
      });
    }

    const { email } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit em memória (barreira rápida)
    const clientIp = getClientIp(req);
    const memRateLimit = checkApiRateLimit('resend-activation', clientIp);
    if (!memRateLimit.allowed) {
      return res.status(429).json({
        ok: false,
        error: RATE_LIMIT_MESSAGE,
      });
    }

    // Rate limit por email (3 por hora)
    const emailRateLimit = await checkRateLimit(normalizedEmail, 'resend-activation', {
      windowMinutes: 60,
      maxRequests: 3,
    });

    if (!emailRateLimit.allowed) {
      return res.status(429).json({
        ok: false,
        error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
        resetAt: emailRateLimit.resetAt.toISOString(),
      });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        passwordHash: true,
      },
    });

    // SEGURANÇA: Não revelar se email existe ou não
    // Sempre retorna sucesso para o cliente
    if (!user) {
      console.log(`⏭️ [RESEND-ACTIVATION] Email não encontrado: ${normalizedEmail}`);
      return res.status(200).json({ ok: true });
    }

    // Se já verificado e tem senha, não precisa ativar
    if (user.emailVerifiedAt && user.passwordHash) {
      console.log(`⏭️ [RESEND-ACTIVATION] Usuário já ativo: ${normalizedEmail}`);
      return res.status(200).json({ ok: true });
    }

    // Verificar se já existe token ativo recente (evita spam)
    const recentToken = await prisma.emailActivationToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        // Token criado há menos de 2 minutos
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });

    if (recentToken) {
      console.log(`⏭️ [RESEND-ACTIVATION] Token recente já existe (menos de 2min)`);
      // Ainda retorna sucesso para não revelar existência
      return res.status(200).json({ ok: true });
    }

    // Invalidar tokens antigos
    await prisma.emailActivationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Marca como usado para invalidar
      },
    });

    // Gerar novo token
    const { rawToken, tokenHash, expiresAt } = generateActivationToken();

    // Salvar token no banco
    await prisma.emailActivationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Montar URL e enviar email
    const activationUrl = buildActivationUrl(rawToken);

    const emailResult = await sendAccountActivationEmail(
      user.email,
      user.name,
      activationUrl
    );

    if (!emailResult.success) {
      console.error(`❌ [RESEND-ACTIVATION] Falha ao enviar email: ${emailResult.error}`);
      // Não revelar erro específico ao usuário
      return res.status(200).json({ ok: true });
    }

    console.log(`✅ [RESEND-ACTIVATION] Email enviado para: ${normalizedEmail}`);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ [RESEND-ACTIVATION] Erro:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno. Tente novamente.',
    });
  }
}
