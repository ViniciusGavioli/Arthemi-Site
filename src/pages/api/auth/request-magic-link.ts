// ===========================================================
// API: POST /api/auth/request-magic-link
// ===========================================================
// DESATIVADO: Magic link substituido por login email+senha
// Codigo legado removido - consultar git history para rollback

import type { NextApiRequest, NextApiResponse } from 'next';

// ============================================================
// ENDPOINT DESATIVADO - Retorna 410 Gone
// ============================================================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 410 Gone - Recurso foi desativado permanentemente
  return res.status(410).json({
    ok: false,
    success: false,
    error: 'Magic link desativado. Use login com email e senha.',
    message: 'Magic link desativado. Use login com email e senha.',
    redirect: '/login',
  });
}
