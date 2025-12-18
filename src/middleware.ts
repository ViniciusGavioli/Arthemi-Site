// ===========================================================
// Middleware - Proteção de Rotas Admin
// ===========================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que NÃO precisam de autenticação
const publicAdminRoutes = ['/admin/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Só protege rotas /admin/*
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Permite acesso à página de login
  if (publicAdminRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Verifica cookie de autenticação
  const adminToken = request.cookies.get('admin_token')?.value;

  if (!adminToken) {
    // Redireciona para login
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valida o token (hash simples da senha + secret)
  const expectedToken = generateToken();
  
  if (adminToken !== expectedToken) {
    // Token inválido - limpa cookie e redireciona
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete('admin_token');
    return response;
  }

  return NextResponse.next();
}

// Gera token esperado (mesmo algoritmo usado no login)
function generateToken(): string {
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  
  // Hash simples para MVP (em produção usar JWT)
  const combined = `${password}:${secret}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `admin_${Math.abs(hash).toString(36)}`;
}

export const config = {
  matcher: ['/admin/:path*'],
};
