// ===========================================================
// API: POST /api/auth/logout
// ===========================================================
// Encerra sessão do cliente (limpa cookie)

import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { USER_SESSION_COOKIE } from './verify';
import { decodeSessionToken } from '@/lib/magic-link';
import { logAudit } from '@/lib/audit';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Tenta extrair userId para log
    const sessionToken = req.cookies[USER_SESSION_COOKIE];
    if (sessionToken) {
      const userId = decodeSessionToken(sessionToken);
      if (userId) {
        await logAudit({
          action: 'USER_LOGOUT',
          source: 'USER',
          actorId: userId,
          actorIp: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });
      }
    }

    // Limpa cookie
    const cookie = serialize(USER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expira imediatamente
    });

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[AUTH] Erro ao fazer logout:', error);
    return res.status(500).json({ error: 'Erro interno' });
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
