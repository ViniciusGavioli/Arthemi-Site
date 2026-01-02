// ===========================================================
// lib/auth.ts - Sistema de Autenticação JWT + Cookies HttpOnly
// ===========================================================
// PASSO 2: Login via email+senha com JWT em cookie seguro
// 
// Decisões técnicas:
// - JWT assinado com HS256 (jsonwebtoken)
// - Sessão: 7 dias em cookie HttpOnly
// - Rate limit: 5 tentativas, bloqueio 30 min
// - Mensagens genéricas (não revelar se email existe)

import { NextApiRequest, NextApiResponse } from 'next';
import type { GetServerSidePropsContext } from 'next';
import { serialize, parse } from 'cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';

// ============================================================
// CONSTANTES
// ============================================================

/** Nome do cookie de sessão */
export const AUTH_COOKIE_NAME = 'arthemi_session';

/** Duração da sessão em segundos (7 dias) */
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

/** Custo do bcrypt (12 rounds) */
export const BCRYPT_ROUNDS = 12;

/** Máximo de tentativas de login antes do bloqueio */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Duração do bloqueio em minutos */
export const LOCKOUT_DURATION_MINUTES = 30;

/** Duração do token de reset em horas */
export const RESET_TOKEN_EXPIRY_HOURS = 1;

// ============================================================
// TIPOS
// ============================================================

export interface JWTPayload {
  userId: string;
  role: 'CUSTOMER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  role: 'CUSTOMER' | 'ADMIN';
}

export interface LoginResult {
  success: boolean;
  error?: string;
  statusCode: number;
  role?: 'CUSTOMER' | 'ADMIN';
}

// ============================================================
// JWT SECRET
// ============================================================

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('❌ JWT_SECRET não configurado em produção!');
    }
    // Em desenvolvimento, usa um fallback (NÃO seguro para produção)
    console.warn('⚠️ [AUTH] JWT_SECRET não configurado - usando fallback DEV');
    return 'dev-secret-arthemi-2025-nao-usar-em-producao';
  }
  
  return secret;
}

// ============================================================
// JWT FUNCTIONS
// ============================================================

/**
 * Assina um token JWT com payload mínimo
 */
export function signSessionToken(payload: { userId: string; role: 'CUSTOMER' | 'ADMIN' }): string {
  const secret = getJWTSecret();
  
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    secret,
    { expiresIn: SESSION_DURATION_SECONDS }
  );
}

/**
 * Verifica e decodifica um token JWT
 * Retorna null se inválido ou expirado
 */
export function verifySessionToken(token: string): JWTPayload | null {
  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    if (!decoded.userId || !decoded.role) {
      return null;
    }
    
    return decoded;
  } catch {
    return null;
  }
}

// ============================================================
// COOKIE FUNCTIONS
// ============================================================

/**
 * Define o cookie de autenticação na resposta
 */
export function setAuthCookie(res: NextApiResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookie = serialize(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
  
  res.setHeader('Set-Cookie', cookie);
}

/**
 * Limpa o cookie de autenticação
 */
export function clearAuthCookie(res: NextApiResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookie = serialize(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expira imediatamente
  });
  
  res.setHeader('Set-Cookie', cookie);
}

/**
 * Extrai e valida autenticação de uma requisição
 * Retorna null se não autenticado ou token inválido
 */
export function getAuthFromRequest(req: NextApiRequest): AuthUser | null {
  // Parse cookies
  const cookies = req.cookies || parse(req.headers.cookie || '');
  const token = cookies[AUTH_COOKIE_NAME];
  
  if (!token) {
    return null;
  }
  
  const payload = verifySessionToken(token);
  
  if (!payload) {
    return null;
  }
  
  return {
    userId: payload.userId,
    role: payload.role,
  };
}

/**
 * Middleware helper: Exige autenticação
 * Retorna o usuário autenticado ou envia 401
 */
export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): AuthUser | null {
  const auth = getAuthFromRequest(req);
  
  if (!auth) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }
  
  return auth;
}

/**
 * Middleware helper: Exige role específica
 * Retorna o usuário autenticado ou envia 401/403
 */
export function requireRole(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredRole: 'ADMIN' | 'CUSTOMER'
): AuthUser | null {
  const auth = requireAuth(req, res);
  
  if (!auth) {
    return null; // 401 já foi enviado
  }
  
  // ADMIN pode tudo, CUSTOMER só acessa se role == CUSTOMER
  if (requiredRole === 'ADMIN' && auth.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso não autorizado' });
    return null;
  }
  
  return auth;
}

// ============================================================
// PASSWORD FUNCTIONS
// ============================================================

/**
 * Gera hash bcrypt de uma senha
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compara senha com hash bcrypt
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// RESET TOKEN FUNCTIONS
// ============================================================

/**
 * Gera um token de reset aleatório (URL-safe)
 */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Calcula hash SHA-256 de um token (para armazenar no banco)
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ============================================================
// LOGIN LOGIC
// ============================================================

/**
 * Processa tentativa de login com rate limiting
 * 
 * Regras:
 * - Se user não existe ou sem senha: 401 genérico
 * - Se isActive=false: 403 genérico
 * - Se lockedUntil > now: 429
 * - Se senha errada: incrementa failedAttempts, bloqueia se >= MAX
 * - Se ok: zera contadores, atualiza lastLoginAt
 */
export async function processLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      failedAttempts: true,
      lockedUntil: true,
    },
  });
  
  // User não existe ou não tem senha configurada
  if (!user || !user.passwordHash) {
    return {
      success: false,
      error: 'Credenciais inválidas',
      statusCode: 401,
    };
  }
  
  // Conta desativada
  if (!user.isActive) {
    return {
      success: false,
      error: 'Conta desativada. Entre em contato com o suporte.',
      statusCode: 403,
    };
  }
  
  // Verificar bloqueio temporário
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesRemaining = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
    );
    return {
      success: false,
      error: `Conta bloqueada. Tente novamente em ${minutesRemaining} minutos.`,
      statusCode: 429,
    };
  }
  
  // Verificar senha
  const passwordValid = await comparePassword(password, user.passwordHash);
  
  if (!passwordValid) {
    // Incrementar tentativas falhas
    const newFailedAttempts = (user.failedAttempts || 0) + 1;
    const shouldLock = newFailedAttempts >= MAX_LOGIN_ATTEMPTS;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: newFailedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
          : null,
      },
    });
    
    if (shouldLock) {
      return {
        success: false,
        error: `Muitas tentativas falhas. Conta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos.`,
        statusCode: 429,
      };
    }
    
    const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newFailedAttempts;
    return {
      success: false,
      error: `Credenciais inválidas. ${attemptsRemaining} tentativa(s) restante(s).`,
      statusCode: 401,
    };
  }
  
  // Login bem-sucedido: zerar contadores
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
  
  return {
    success: true,
    statusCode: 200,
    role: user.role as 'CUSTOMER' | 'ADMIN',
  };
}

/**
 * Obtém userId a partir de uma requisição autenticada
 * (para compatibilidade com código existente)
 */
export function getAuthUserId(req: NextApiRequest): string | null {
  const auth = getAuthFromRequest(req);
  return auth?.userId || null;
}

// ============================================================
// SSR HELPERS (para getServerSideProps)
// ============================================================

/**
 * Extrai autenticação do contexto SSR (GetServerSidePropsContext)
 * Compatível com getServerSideProps
 */
export function getAuthFromSSR(ctx: GetServerSidePropsContext): AuthUser | null {
  const { req } = ctx;
  
  // Parse cookies do header
  const cookieHeader = req.headers.cookie || '';
  const cookies = parse(cookieHeader);
  const token = cookies[AUTH_COOKIE_NAME];
  
  if (!token) {
    return null;
  }
  
  const payload = verifySessionToken(token);
  
  if (!payload) {
    return null;
  }
  
  return {
    userId: payload.userId,
    role: payload.role,
  };
}

/**
 * Helper: Protege página exigindo login
 * Retorna redirect para login se não autenticado
 */
export function requireAuthSSR(
  ctx: GetServerSidePropsContext,
  redirectTo = '/login'
): { redirect: { destination: string; permanent: false } } | { auth: AuthUser } {
  const auth = getAuthFromSSR(ctx);
  
  if (!auth) {
    const currentPath = ctx.resolvedUrl || ctx.req.url || '/';
    const destination = `${redirectTo}?next=${encodeURIComponent(currentPath)}`;
    
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }
  
  return { auth };
}

/**
 * Helper: Protege página exigindo role ADMIN
 * Retorna redirect se não autenticado ou não admin
 */
export function requireAdminSSR(
  ctx: GetServerSidePropsContext
): { redirect: { destination: string; permanent: false } } | { auth: AuthUser } {
  const result = requireAuthSSR(ctx, '/login');
  
  // Não autenticado
  if ('redirect' in result) {
    return result;
  }
  
  // Autenticado mas não é admin
  if (result.auth.role !== 'ADMIN') {
    return {
      redirect: {
        destination: '/account?error=unauthorized',
        permanent: false,
      },
    };
  }
  
  return result;
}
