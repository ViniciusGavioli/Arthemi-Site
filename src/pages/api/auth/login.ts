// ===========================================================
// API: POST /api/auth/login
// ===========================================================
// Login com email + senha, retorna JWT em cookie HttpOnly
// 
// Input: { email, password }
// Output: { ok: true, role } ou { error: string }
// 
// Rate limiting:
// - Após 5 tentativas falhas: bloqueio de 30 minutos
// - Login OK: zera contadores

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { 
  processLogin, 
  signSessionToken, 
  setAuthCookie 
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const LoginSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
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
    const parseResult = LoginSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }

    const { email, password } = parseResult.data;

    // Processar login com rate limiting
    const result = await processLogin(email, password);

    if (!result.success) {
      // Log tentativa falha (não pode derrubar a rota)
      try {
        const failedUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        await logAudit({
          action: 'USER_LOGIN_FAILED',
          source: 'USER',
          actorId: failedUser?.id,
          actorIp: getClientIp(req),
          userAgent: req.headers['user-agent'] as string,
          metadata: { 
            email,
            reason: result.error,
            statusCode: result.statusCode,
          },
        });
      } catch (auditError) {
        console.error('❌ [LOGIN] Erro ao gravar audit (não bloqueia):', auditError);
      }

      return res.status(result.statusCode).json({ 
        error: result.error 
      });
    }

    // Buscar user para gerar JWT
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (!user) {
      // Não deveria acontecer, mas por segurança
      return res.status(500).json({ error: 'Erro interno' });
    }

    // Gerar JWT
    const token = signSessionToken({
      userId: user.id,
      role: user.role as 'CUSTOMER' | 'ADMIN',
    });

    // Setar cookie HttpOnly
    setAuthCookie(res, token);

    // Log de sucesso (não pode derrubar a rota)
    try {
      await logAudit({
        action: 'USER_LOGIN',
        source: 'USER',
        actorId: user.id,
        actorIp: getClientIp(req),
        userAgent: req.headers['user-agent'] as string,
      });
    } catch (auditError) {
      console.error('❌ [LOGIN] Erro ao gravar audit (não bloqueia):', auditError);
    }

    console.log(`✅ [LOGIN] Usuário logado: ${email} (${user.role})`);

    return res.status(200).json({ 
      ok: true, 
      role: user.role 
    });

  } catch (error) {
    console.error('❌ [LOGIN] Erro:', error);
    return res.status(500).json({ 
      error: 'Erro interno. Tente novamente.' 
    });
  }
}
