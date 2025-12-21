// ===========================================================
// API: GET /api/auth/verify?token=xxx
// ===========================================================
// Valida magic link token e cria sessão do cliente
// Redireciona para /minha-conta após sucesso

import type { NextApiRequest, NextApiResponse } from 'next';
import { validateMagicLink, generateSessionToken, SESSION_DURATION_DAYS } from '@/lib/magic-link';
import { logAudit } from '@/lib/audit';
import { serialize } from 'cookie';

// Nome do cookie de sessão do cliente
export const USER_SESSION_COOKIE = 'user_session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { token, redirect } = req.query;

  // Token obrigatório
  if (!token || typeof token !== 'string') {
    return res.redirect('/auth/entrar?error=invalid');
  }

  try {
    // Valida o magic link
    const result = await validateMagicLink(token);

    if (!result.valid || !result.userId) {
      // Token inválido ou expirado
      return res.redirect('/auth/entrar?error=expired');
    }

    // Gera token de sessão
    const sessionToken = generateSessionToken(result.userId);

    // Configura cookie
    const cookie = serialize(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // 7 dias em segundos
    });

    res.setHeader('Set-Cookie', cookie);

    // Log de login
    await logAudit({
      action: 'USER_LOGIN',
      source: 'USER',
      actorId: result.userId,
      actorIp: getClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: { method: 'magic_link' },
    });

    // Redireciona para destino ou minha-conta
    const destination = typeof redirect === 'string' && redirect.startsWith('/minha-conta')
      ? redirect
      : '/minha-conta';

    return res.redirect(destination);

  } catch (error) {
    console.error('[AUTH] Erro ao validar magic link:', error);
    return res.redirect('/auth/entrar?error=server');
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
