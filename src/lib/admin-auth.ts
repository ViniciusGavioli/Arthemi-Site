// ===========================================================
// P-005: Admin Authentication Helper
// ===========================================================
// Substitui validação de admin_token estático por JWT assinado
// Centraliza autenticação de endpoints /api/admin/*

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { env } from '@/lib/env';

// Nome do cookie de admin
export const ADMIN_COOKIE_NAME = 'admin_token';

// Duração da sessão admin em segundos (7 dias)
export const ADMIN_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

// Payload do token admin
export interface AdminJWTPayload {
  type: 'admin';
  iat?: number;
  exp?: number;
}

/**
 * Obtém o secret para assinar tokens admin
 * Usa ADMIN_SESSION_SECRET ou fallback para JWT_SECRET
 */
function getAdminSecret(): string {
  // Prioridade: ADMIN_SESSION_SECRET > JWT_SECRET
  const adminSecret = env.ADMIN_SESSION_SECRET;
  if (adminSecret && adminSecret.length >= 32) {
    return adminSecret;
  }
  
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length >= 32) {
    return jwtSecret;
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ ADMIN_SESSION_SECRET ou JWT_SECRET não configurado em produção!');
  }
  
  // Em desenvolvimento, usa fallback (NÃO seguro para produção)
  console.warn('⚠️ [ADMIN AUTH] Usando secret de desenvolvimento');
  return 'dev-admin-secret-arthemi-2025-nao-usar-em-producao';
}

/**
 * Gera token JWT para sessão admin
 * Chamado após validação de senha no login
 */
export function signAdminToken(): string {
  const secret = getAdminSecret();
  
  return jwt.sign(
    { type: 'admin' },
    secret,
    { expiresIn: ADMIN_SESSION_DURATION_SECONDS }
  );
}

/**
 * Verifica e decodifica token JWT de admin
 * Retorna true se válido, false caso contrário
 */
export function verifyAdminToken(token: string): boolean {
  if (!token) return false;
  
  try {
    const secret = getAdminSecret();
    const decoded = jwt.verify(token, secret) as AdminJWTPayload;
    
    // Verificar se é token de admin
    if (decoded.type !== 'admin') {
      return false;
    }
    
    return true;
  } catch {
    // Token inválido ou expirado
    return false;
  }
}

/**
 * Middleware: Valida autenticação admin para API routes
 * Retorna true se autenticado, false e envia 401 caso contrário
 * 
 * @example
 * export default async function handler(req, res) {
 *   if (!requireAdminAuth(req, res)) return;
 *   // ... resto do handler
 * }
 */
export function requireAdminAuth(
  req: NextApiRequest,
  res: NextApiResponse
): boolean {
  const adminToken = req.cookies[ADMIN_COOKIE_NAME];
  
  if (!adminToken) {
    res.status(401).json({ error: 'Não autorizado' });
    return false;
  }
  
  if (!verifyAdminToken(adminToken)) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return false;
  }
  
  return true;
}

/**
 * Helper: Extrai e valida token admin de requisição
 * Retorna null se não autenticado ou token inválido
 * Não envia resposta - útil para verificação silenciosa
 */
export function getAdminAuth(req: NextApiRequest): boolean {
  const adminToken = req.cookies[ADMIN_COOKIE_NAME];
  
  if (!adminToken) {
    return false;
  }
  
  return verifyAdminToken(adminToken);
}
