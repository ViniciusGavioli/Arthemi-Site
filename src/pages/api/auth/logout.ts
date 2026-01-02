// ===========================================================
// API: POST /api/auth/logout
// ===========================================================
// Encerra sessão do cliente (limpa cookies de sessão)
// Suporta tanto o magic-link (legado) quanto o JWT (novo)

import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { USER_SESSION_COOKIE } from './verify';
import { decodeSessionToken } from '@/lib/magic-link';
import { 
  AUTH_COOKIE_NAME, 
  getAuthFromRequest, 
  clearAuthCookie 
} from '@/lib/auth';
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
    let loggedUserId: string | null = null;

    // Tenta extrair userId do novo sistema JWT
    const jwtAuth = getAuthFromRequest(req);
    if (jwtAuth) {
      loggedUserId = jwtAuth.userId;
    }

    // Fallback: tenta extrair do magic-link (legado)
    if (!loggedUserId) {
      const sessionToken = req.cookies[USER_SESSION_COOKIE];
      if (sessionToken) {
        loggedUserId = decodeSessionToken(sessionToken);
      }
    }

    // Log de auditoria
    if (loggedUserId) {
      await logAudit({
        action: 'USER_LOGOUT',
        source: 'USER',
        actorId: loggedUserId,
        actorIp: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
    }

    // Limpa AMBOS os cookies (legado + novo)
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Cookie legado (magic-link)
    const legacyCookie = serialize(USER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    // Cookie novo (JWT)
    const jwtCookie = serialize(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    res.setHeader('Set-Cookie', [legacyCookie, jwtCookie]);

    return res.status(200).json({ ok: true, success: true });

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
