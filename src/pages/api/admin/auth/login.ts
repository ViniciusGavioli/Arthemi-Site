// ===========================================================
// API: POST /api/admin/auth/login
// ===========================================================
// P-005: Usa JWT assinado em vez de token estático

import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { serialize } from 'cookie';
import { logAdminAction } from '@/lib/audit';
import { signAdminToken, ADMIN_COOKIE_NAME, ADMIN_SESSION_DURATION_SECONDS } from '@/lib/admin-auth';

interface LoginResponse {
  success: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const { password } = req.body;

  // Valida se senha foi enviada
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Senha é obrigatória' });
  }

  // Verifica senha (validada no boot via env.ts)
  const adminPassword = env.ADMIN_PASSWORD;

  if (password !== adminPassword) {
    // Delay para evitar brute force
    await new Promise(resolve => setTimeout(resolve, 1000));
    return res.status(401).json({ success: false, error: 'Senha incorreta'});
  }

  // P-005: Gera token JWT assinado em vez de hash estático
  const token = signAdminToken();

  // Define cookie httpOnly (7 dias)
  const cookie = serialize(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });

  res.setHeader('Set-Cookie', cookie);
  
  // ✅ LOG DE AUDITORIA - Admin login
  await logAdminAction(
    'ADMIN_LOGIN',
    'Admin',
    'session',
    { loginMethod: 'password', email: 'admin@arthemi.com.br' },
    req
  );
  
  return res.status(200).json({ success: true });
}
