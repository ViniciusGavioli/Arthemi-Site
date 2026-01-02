// ===========================================================
// API: POST /api/auth/forgot-password
// ===========================================================
// Solicita reset de senha via email
// 
// Input: { email }
// Output: { ok: true } (sempre, para não revelar se email existe)
// 
// Segurança:
// - Sempre retorna 200 OK (não revela se email existe)
// - Token armazenado como SHA-256 no banco
// - Token expira em 1 hora

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateResetToken, hashResetToken, RESET_TOKEN_EXPIRY_HOURS } from '@/lib/auth';
import { sendResetPasswordEmail } from '@/lib/mailer';
import { logAudit } from '@/lib/audit';

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.toLowerCase().trim()),
});

// ============================================================
// HELPER: Obter IP do cliente
// ============================================================

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar input
    const parseResult = ForgotPasswordSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      // Mesmo com email inválido, retorna OK (segurança)
      return res.status(200).json({ ok: true });
    }

    const { email } = parseResult.data;

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    // SEMPRE retorna OK (não revelar se email existe)
    // Mas só processa se user existir e estiver ativo
    if (user && user.isActive) {
      // Gerar token aleatório
      const rawToken = generateResetToken();
      const hashedToken = hashResetToken(rawToken);
      
      // Definir expiração (1 hora)
      const resetTokenExpiry = new Date(
        Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );

      // Atualizar usuário com token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetTokenExpiry,
        },
      });

      // Enviar email (async, não bloqueia resposta)
      sendResetPasswordEmail(email, user.name, rawToken).catch((err) => {
        console.error('❌ [FORGOT-PASSWORD] Erro ao enviar email:', err);
      });

      // Log de auditoria
      await logAudit({
        action: 'PASSWORD_RESET_REQUESTED',
        source: 'USER',
        actorId: user.id,
        actorIp: getClientIp(req),
        userAgent: req.headers['user-agent'] as string,
        metadata: { email },
      });

      console.log(`📧 [FORGOT-PASSWORD] Token de reset gerado para: ${email}`);
    } else {
      // Log mesmo quando email não existe (para detectar enumeração)
      console.log(`⚠️ [FORGOT-PASSWORD] Tentativa para email inexistente/inativo: ${email}`);
    }

    // Sempre retorna OK
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ [FORGOT-PASSWORD] Erro:', error);
    // Mesmo com erro, retorna OK (segurança)
    return res.status(200).json({ ok: true });
  }
}
