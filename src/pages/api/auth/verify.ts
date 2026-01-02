// ===========================================================
// API: GET /api/auth/verify?token=xxx
// ===========================================================
// DESATIVADO: Magic link substituido por login email+senha
// Codigo legado removido - consultar git history para rollback

import type { NextApiRequest, NextApiResponse } from 'next';

// Nome do cookie de sessao do cliente (exportado para compatibilidade com logout)
export const USER_SESSION_COOKIE = 'user_session';

// ============================================================
// ENDPOINT DESATIVADO - Redireciona para /login
// ============================================================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Se for request JSON (API), retorna 410 Gone
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('application/json')) {
    return res.status(410).json({
      ok: false,
      error: 'Magic link desativado. Use login com email e senha.',
      redirect: '/login',
    });
  }

  // Se for navegador, redireciona para /login com mensagem
  return res.redirect('/login?error=magic_link_disabled');
}
