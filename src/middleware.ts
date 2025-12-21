// ===========================================================
// Middleware - Proteção de Rotas (Admin + Cliente)
// ===========================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Nome do cookie de sessão do cliente
const USER_SESSION_COOKIE = 'user_session';

// Rotas admin que NÃO precisam de autenticação
const publicAdminRoutes = ['/admin/login'];

// Rotas de cliente que NÃO precisam de autenticação
const publicClientRoutes = ['/auth/entrar', '/auth/verificar'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // PROTEÇÃO DE ROTAS /admin/*
  // ============================================================
  if (pathname.startsWith('/admin')) {
    return handleAdminRoutes(request, pathname);
  }

  // ============================================================
  // PROTEÇÃO DE ROTAS /minha-conta/*
  // ============================================================
  if (pathname.startsWith('/minha-conta')) {
    return handleClientRoutes(request, pathname);
  }

  return NextResponse.next();
}

// ============================================================
// HANDLER ADMIN
// ============================================================
function handleAdminRoutes(request: NextRequest, pathname: string): NextResponse {
  // Permite acesso à página de login
  if (publicAdminRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Verifica cookie de autenticação
  const adminToken = request.cookies.get('admin_token')?.value;

  if (!adminToken) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valida o token
  const expectedToken = generateAdminToken();
  
  if (adminToken !== expectedToken) {
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete('admin_token');
    return response;
  }

  return NextResponse.next();
}

// ============================================================
// HANDLER CLIENTE
// ============================================================
function handleClientRoutes(request: NextRequest, pathname: string): NextResponse {
  // Verifica cookie de sessão do cliente
  const sessionToken = request.cookies.get(USER_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    // Redireciona para login com destino salvo
    const loginUrl = new URL('/auth/entrar', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valida formato básico do token (não consulta banco no middleware)
  // A validação completa é feita na API /api/auth/me
  if (!isValidSessionTokenFormat(sessionToken)) {
    const response = NextResponse.redirect(new URL('/auth/entrar', request.url));
    response.cookies.delete(USER_SESSION_COOKIE);
    return response;
  }

  // Sessão válida - RENOVA COOKIE (7 dias a partir de agora)
  const response = NextResponse.next();
  response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 dias em segundos
  });

  return response;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Gera token esperado para admin (hash da senha + secret)
 */
function generateAdminToken(): string {
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  
  const combined = `${password}:${secret}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `admin_${Math.abs(hash).toString(36)}`;
}

/**
 * Valida formato básico do token de sessão do cliente
 * Formato esperado: base64url(userId:random:timestamp)
 */
function isValidSessionTokenFormat(token: string): boolean {
  try {
    // Decodifica base64url
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    
    // Deve ter 3 partes: userId, random, timestamp
    if (parts.length !== 3) return false;
    
    // userId deve ter pelo menos 10 caracteres (cuid)
    if (parts[0].length < 10) return false;
    
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/minha-conta/:path*'],
};
