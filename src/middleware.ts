// ===========================================================
// Middleware - Proteção de Rotas (Admin + Cliente)
// ===========================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookies de sessão
const USER_SESSION_COOKIE = 'user_session'; // Legado (magic-link)
const AUTH_COOKIE_NAME = 'arthemi_session'; // Novo (JWT)

// Rotas admin que NÃO precisam de autenticação
const publicAdminRoutes = ['/admin/login'];

// Rotas de cliente que NÃO precisam de autenticação (legado - mantido por compatibilidade)
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
  if (publicAdminRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  const adminToken = request.cookies.get('admin_token')?.value;

  if (!adminToken) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// ============================================================
// HANDLER CLIENTE
// ============================================================
function handleClientRoutes(request: NextRequest, pathname: string): NextResponse {
  // Verifica cookie JWT (novo sistema - prioridade)
  const jwtToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  
  // Fallback: cookie legado (magic-link)
  const sessionToken = request.cookies.get(USER_SESSION_COOKIE)?.value;

  // Se não tem nenhum cookie, redireciona para /login
  if (!jwtToken && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Se tem JWT, valida formato básico
  if (jwtToken) {
    // JWT tem 3 partes separadas por ponto
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      // Token inválido, limpa e redireciona
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    // JWT válido - continua
    return NextResponse.next();
  }

  // Se só tem cookie legado, valida formato e redireciona para /login
  // (magic-link desativado - usuário precisa fazer login com senha)
  if (sessionToken) {
    if (!isValidSessionTokenFormat(sessionToken)) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(USER_SESSION_COOKIE);
      return response;
    }
    
    // Cookie legado válido mas magic-link desativado
    // Usuário ainda tem sessão válida por compatibilidade
    // Renova cookie e permite acesso
    const response = NextResponse.next();
    response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  }

  return NextResponse.next();
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
