// ===========================================================
// API: POST /api/admin/auth/login
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { serialize } from 'cookie';
import { logAdminAction } from '@/lib/audit';

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

  // Gera token de sessão
  const token = generateToken();

  // Define cookie httpOnly (7 dias)
  const cookie = serialize('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
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

// Gera token (mesmo algoritmo do middleware)
function generateToken(): string {
  const password = env.ADMIN_PASSWORD;
  const secret = env.ADMIN_SESSION_SECRET;
  
  const combined = `${password}:${secret}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `admin_${Math.abs(hash).toString(36)}`;
}
