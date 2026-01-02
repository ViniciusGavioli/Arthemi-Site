// ===========================================================
// API: POST /api/auth/reset-password
// ===========================================================
// Redefine senha usando token de reset
// 
// Input: { email, token, newPassword }
// Output: { ok: true } ou { error: string }
// 
// Validações:
// - Token deve ser válido (SHA-256 match)
// - Token não pode estar expirado
// - Nova senha mínimo 8 caracteres

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, hashResetToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const ResetPasswordSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.toLowerCase().trim()),
  token: z
    .string()
    .min(1, 'Token é obrigatório'),
  newPassword: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(100, 'Senha muito longa'),
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
    const parseResult = ResetPasswordSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message);
      return res.status(400).json({ 
        error: errors[0],
        errors,
      });
    }

    const { email, token, newPassword } = parseResult.data;

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        resetToken: true,
        resetTokenExpiry: true,
        isActive: true,
      },
    });

    // Mensagem genérica para todos os erros de token
    const genericError = 'Token inválido ou expirado. Solicite um novo link.';

    // Verificar se user existe
    if (!user) {
      console.log(`⚠️ [RESET-PASSWORD] Email não encontrado: ${email}`);
      return res.status(400).json({ error: genericError });
    }

    // Verificar se conta está ativa
    if (!user.isActive) {
      console.log(`⚠️ [RESET-PASSWORD] Conta inativa: ${email}`);
      return res.status(400).json({ error: genericError });
    }

    // Verificar se tem token de reset
    if (!user.resetToken || !user.resetTokenExpiry) {
      console.log(`⚠️ [RESET-PASSWORD] Sem token de reset: ${email}`);
      return res.status(400).json({ error: genericError });
    }

    // Verificar se token expirou
    if (user.resetTokenExpiry < new Date()) {
      console.log(`⚠️ [RESET-PASSWORD] Token expirado: ${email}`);
      
      // Limpar token expirado
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
      
      return res.status(400).json({ error: genericError });
    }

    // Verificar token (comparar SHA-256)
    const hashedToken = hashResetToken(token);
    
    if (hashedToken !== user.resetToken) {
      console.log(`⚠️ [RESET-PASSWORD] Token inválido: ${email}`);
      return res.status(400).json({ error: genericError });
    }

    // Token válido! Atualizar senha
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log de auditoria
    await logAudit({
      action: 'PASSWORD_RESET_COMPLETED',
      source: 'USER',
      actorId: user.id,
      actorIp: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      metadata: { email },
    });

    console.log(`✅ [RESET-PASSWORD] Senha redefinida para: ${email}`);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ [RESET-PASSWORD] Erro:', error);
    return res.status(500).json({ 
      error: 'Erro interno. Tente novamente.' 
    });
  }
}
