// ===========================================================
// API: POST /api/admin/auth/logout
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

interface LogoutResponse {
  success: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse>
) {
  // Aceita POST e GET para facilitar
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ success: false });
  }

  // Remove cookie (expira imediatamente)
  const cookie = serialize('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expira imediatamente
  });

  res.setHeader('Set-Cookie', cookie);
  
  // Se for GET, redireciona para login
  if (req.method === 'GET') {
    res.writeHead(302, { Location: '/admin/login' });
    res.end();
    return;
  }

  return res.status(200).json({ success: true });
}
