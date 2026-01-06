// ===========================================================
// API: GET /api/auth/me
// ===========================================================
// Retorna dados do usuário logado via JWT (arthemi_session)
// Usado pelo frontend para verificar autenticação

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface MeResponse {
  ok: boolean;
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    emailVerified: boolean; // true se emailVerifiedAt não é null
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MeResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, authenticated: false, error: 'Método não permitido' });
  }

  try {
    // Extrai auth do cookie JWT
    const auth = getAuthFromRequest(req);

    if (!auth) {
      return res.status(200).json({ ok: true, authenticated: false });
    }

    // Busca dados completos do usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return res.status(200).json({ ok: true, authenticated: false });
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
      },
    });

  } catch (error) {
    console.error('[AUTH /me] Erro:', error);
    return res.status(500).json({ ok: false, authenticated: false, error: 'Erro interno' });
  }
}
