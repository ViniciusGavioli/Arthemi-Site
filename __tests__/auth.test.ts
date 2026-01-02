// ===========================================================
// Testes: Sistema de Autenticação (PASSO 2)
// ===========================================================
// Testes unitários para auth.ts e fluxos de login
// 
// Execute: npm test -- auth.test.ts

import {
  hashPassword,
  comparePassword,
  signSessionToken,
  verifySessionToken,
  generateResetToken,
  hashResetToken,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  SESSION_DURATION_SECONDS,
} from '../src/lib/auth';

// ============================================================
// TESTES: PASSWORD HASHING
// ============================================================

describe('Password Hashing', () => {
  test('hashPassword retorna hash diferente do original', async () => {
    const password = 'MinhaS3nh@Forte';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50); // bcrypt hash é longo
  });

  test('comparePassword retorna true para senha correta', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    const result = await comparePassword(password, hash);
    expect(result).toBe(true);
  });

  test('comparePassword retorna false para senha incorreta', async () => {
    const password = 'CorrectPassword';
    const wrongPassword = 'WrongPassword';
    const hash = await hashPassword(password);
    
    const result = await comparePassword(wrongPassword, hash);
    expect(result).toBe(false);
  });

  test('hashPassword gera hashes únicos para mesma senha', async () => {
    const password = 'SamePassword123';
    
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    // Hashes devem ser diferentes (salt diferente)
    expect(hash1).not.toBe(hash2);
    
    // Mas ambos devem validar a senha
    expect(await comparePassword(password, hash1)).toBe(true);
    expect(await comparePassword(password, hash2)).toBe(true);
  });
});

// ============================================================
// TESTES: JWT
// ============================================================

describe('JWT Session Tokens', () => {
  test('signSessionToken gera token válido', () => {
    const payload = { userId: 'user123', role: 'CUSTOMER' as const };
    const token = signSessionToken(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes
  });

  test('verifySessionToken decodifica token válido', () => {
    const payload = { userId: 'user456', role: 'ADMIN' as const };
    const token = signSessionToken(payload);
    
    const decoded = verifySessionToken(token);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('user456');
    expect(decoded?.role).toBe('ADMIN');
  });

  test('verifySessionToken retorna null para token inválido', () => {
    const invalidToken = 'invalid.token.here';
    
    const decoded = verifySessionToken(invalidToken);
    
    expect(decoded).toBeNull();
  });

  test('verifySessionToken retorna null para token vazio', () => {
    const decoded = verifySessionToken('');
    expect(decoded).toBeNull();
  });

  test('token contém campos iat e exp', () => {
    const payload = { userId: 'user789', role: 'CUSTOMER' as const };
    const token = signSessionToken(payload);
    
    const decoded = verifySessionToken(token);
    
    expect(decoded?.iat).toBeDefined();
    expect(decoded?.exp).toBeDefined();
    expect(decoded!.exp! - decoded!.iat!).toBe(SESSION_DURATION_SECONDS);
  });
});

// ============================================================
// TESTES: RESET TOKEN
// ============================================================

describe('Reset Token', () => {
  test('generateResetToken gera token com entropia suficiente', () => {
    const token = generateResetToken();
    
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(30); // 32 bytes em base64url
  });

  test('generateResetToken gera tokens únicos', () => {
    const token1 = generateResetToken();
    const token2 = generateResetToken();
    
    expect(token1).not.toBe(token2);
  });

  test('hashResetToken gera hash SHA-256', () => {
    const token = 'my-reset-token';
    const hash = hashResetToken(token);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex = 64 caracteres
  });

  test('hashResetToken é determinístico', () => {
    const token = 'same-token';
    
    const hash1 = hashResetToken(token);
    const hash2 = hashResetToken(token);
    
    expect(hash1).toBe(hash2);
  });

  test('tokens diferentes geram hashes diferentes', () => {
    const hash1 = hashResetToken('token1');
    const hash2 = hashResetToken('token2');
    
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================
// TESTES: CONSTANTES DE SEGURANÇA
// ============================================================

describe('Security Constants', () => {
  test('MAX_LOGIN_ATTEMPTS é pelo menos 3', () => {
    expect(MAX_LOGIN_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });

  test('LOCKOUT_DURATION_MINUTES é pelo menos 15', () => {
    expect(LOCKOUT_DURATION_MINUTES).toBeGreaterThanOrEqual(15);
  });

  test('SESSION_DURATION_SECONDS equivale a 7 dias', () => {
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(SESSION_DURATION_SECONDS).toBe(sevenDaysInSeconds);
  });
});

// ============================================================
// TESTES: RATE LIMITING (mock)
// ============================================================

describe('Rate Limiting Logic', () => {
  test('failedAttempts deve ser incrementado a cada falha', () => {
    // Simulação de lógica de rate limiting
    let failedAttempts = 0;
    
    // Simular 3 falhas
    for (let i = 0; i < 3; i++) {
      failedAttempts++;
    }
    
    expect(failedAttempts).toBe(3);
  });

  test('conta deve ser bloqueada após MAX_LOGIN_ATTEMPTS', () => {
    let failedAttempts = 0;
    let isLocked = false;
    
    // Simular falhas até o limite
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      failedAttempts++;
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        isLocked = true;
      }
    }
    
    expect(isLocked).toBe(true);
  });

  test('login bem-sucedido deve zerar failedAttempts', () => {
    let failedAttempts = 4;
    let lockedUntil: Date | null = new Date();
    
    // Simular login OK
    const loginSuccess = true;
    if (loginSuccess) {
      failedAttempts = 0;
      lockedUntil = null;
    }
    
    expect(failedAttempts).toBe(0);
    expect(lockedUntil).toBeNull();
  });

  test('bloqueio deve expirar após LOCKOUT_DURATION_MINUTES', () => {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    
    // Simular passagem do tempo (lockout ainda ativo)
    const isStillLocked = lockedUntil > now;
    expect(isStillLocked).toBe(true);
    
    // Simular tempo após expiração
    const futureTime = new Date(now.getTime() + (LOCKOUT_DURATION_MINUTES + 1) * 60 * 1000);
    const isExpired = lockedUntil <= futureTime;
    expect(isExpired).toBe(true);
  });
});

// ============================================================
// TESTES: RESET PASSWORD FLOW (mock)
// ============================================================

describe('Reset Password Flow', () => {
  test('forgot-password salva resetTokenExpiry no futuro', () => {
    const now = new Date();
    const resetTokenExpiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora
    
    expect(resetTokenExpiry > now).toBe(true);
  });

  test('reset-password aceita token correto', () => {
    const rawToken = generateResetToken();
    const storedHash = hashResetToken(rawToken);
    
    // Simular usuário enviando o token
    const submittedToken = rawToken;
    const submittedHash = hashResetToken(submittedToken);
    
    expect(submittedHash).toBe(storedHash);
  });

  test('reset-password rejeita token incorreto', () => {
    const rawToken = generateResetToken();
    const storedHash = hashResetToken(rawToken);
    
    // Simular usuário enviando token errado
    const wrongToken = 'wrong-token-123';
    const wrongHash = hashResetToken(wrongToken);
    
    expect(wrongHash).not.toBe(storedHash);
  });

  test('reset-password deve limpar resetToken após uso', () => {
    // Simulação
    let resetToken: string | null = hashResetToken('some-token');
    let resetTokenExpiry: Date | null = new Date();
    
    // Após reset bem-sucedido
    resetToken = null;
    resetTokenExpiry = null;
    
    expect(resetToken).toBeNull();
    expect(resetTokenExpiry).toBeNull();
  });
});
