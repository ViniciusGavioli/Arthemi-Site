// ===========================================================
// API: GET /api/auth/me
// ===========================================================
// Retorna dados do usuário logado via JWT (arthemi_session)
// Usado pelo frontend para verificar autenticação

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthFromRequest } from '@/lib/auth';

interface MeResponse {
  ok: boolean;
  userId?: string;
  role?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MeResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  try {
    // Extrai auth do cookie JWT
    const auth = getAuthFromRequest(req);

    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Não autenticado' });
    }

    return res.status(200).json({
      ok: true,
      userId: auth.userId,
      role: auth.role,
    });

  } catch (error) {
    console.error('[AUTH /me] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
