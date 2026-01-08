// ===========================================================
// Testes: Sistema de Autenticação Admin (P-005)
// ===========================================================
// Testes unitários para admin-auth.ts com JWT
// 
// Execute: npm test -- admin-auth.test.ts

import {
  signAdminToken,
  verifyAdminToken,
  ADMIN_SESSION_DURATION_SECONDS,
  ADMIN_COOKIE_NAME,
} from '../src/lib/admin-auth';

// ============================================================
// TESTES: ADMIN JWT
// ============================================================

describe('Admin JWT Authentication (P-005)', () => {
  test('signAdminToken gera token válido', () => {
    const token = signAdminToken();
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes
  });

  test('verifyAdminToken retorna true para token válido', () => {
    const token = signAdminToken();
    const result = verifyAdminToken(token);
    
    expect(result).toBe(true);
  });

  test('verifyAdminToken retorna false para token inválido', () => {
    const result = verifyAdminToken('invalid.token.here');
    expect(result).toBe(false);
  });

  test('verifyAdminToken retorna false para token modificado', () => {
    const token = signAdminToken();
    // Modifica o token (muda o último caractere)
    const modifiedToken = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
    
    const result = verifyAdminToken(modifiedToken);
    expect(result).toBe(false);
  });

  test('verifyAdminToken retorna false para token de usuário normal', () => {
    // Cria um token manualmente com type diferente
    const jwt = require('jsonwebtoken');
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || 'dev-admin-secret-arthemi-2025-nao-usar-em-producao';
    const fakeToken = jwt.sign({ type: 'user' }, secret, { expiresIn: '1h' });
    
    const result = verifyAdminToken(fakeToken);
    expect(result).toBe(false);
  });

  test('verifyAdminToken retorna false para token vazio', () => {
    const result = verifyAdminToken('');
    expect(result).toBe(false);
  });

  test('constantes estão definidas corretamente', () => {
    expect(ADMIN_SESSION_DURATION_SECONDS).toBe(7 * 24 * 60 * 60); // 7 dias
    expect(ADMIN_COOKIE_NAME).toBe('admin_token');
  });
});

// ============================================================
// TESTES: PROTEÇÃO DE ENDPOINTS (mock)
// ============================================================

describe('Admin Endpoint Protection', () => {
  test('token válido deve permitir acesso', () => {
    const token = signAdminToken();
    const isAuthorized = verifyAdminToken(token);
    expect(isAuthorized).toBe(true);
  });

  test('token inválido deve bloquear acesso', () => {
    const isAuthorized = verifyAdminToken('invalid-token');
    expect(isAuthorized).toBe(false);
  });

  test('sem token deve bloquear acesso', () => {
    const isAuthorized = verifyAdminToken('');
    expect(isAuthorized).toBe(false);
  });
});
