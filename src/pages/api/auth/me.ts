// ===========================================================
// API: GET /api/auth/me
// ===========================================================
// Retorna dados do usuário logado (se sessão válida)
// Usado pelo frontend para verificar autenticação

import type { NextApiRequest, NextApiResponse } from 'next';
import { decodeSessionToken, getSessionUser, SESSION_DURATION_DAYS } from '@/lib/magic-link';
import { USER_SESSION_COOKIE } from './verify';
import { serialize } from 'cookie';

interface UserResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ authenticated: false });
  }

  try {
    const sessionToken = req.cookies[USER_SESSION_COOKIE];

    if (!sessionToken) {
      return res.status(200).json({ authenticated: false });
    }

    // Decodifica token
    const userId = decodeSessionToken(sessionToken);
    if (!userId) {
      return res.status(200).json({ authenticated: false });
    }

    // Busca usuário
    const user = await getSessionUser(userId);
    if (!user) {
      return res.status(200).json({ authenticated: false });
    }

    // RENOVAÇÃO DO COOKIE: Estende a sessão a cada acesso
    const newCookie = serialize(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // Renova para +7 dias
    });

    res.setHeader('Set-Cookie', newCookie);

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
      },
    });

  } catch (error) {
    console.error('[AUTH] Erro ao verificar sessão:', error);
    return res.status(200).json({ authenticated: false });
  }
}
