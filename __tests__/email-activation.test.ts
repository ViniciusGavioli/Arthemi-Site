// ===========================================================
// Testes: Email Activation (Ativação de Conta)
// ===========================================================
// Valida:
// - Guest checkout dispara email de ativação
// - verify-email: token válido/inválido/expirado/usado
// - set-password: token válido/inválido, senha salva, sessão criada
// - Best-effort: falha no email não quebra checkout

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// ===========================================================
// MOCKS
// ===========================================================

// Prisma mock
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  emailActivationToken: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  signSessionToken: jest.fn().mockReturnValue('mock-jwt-token'),
  setAuthCookie: jest.fn(),
}));

jest.mock('@/lib/api-rate-limit', () => ({
  checkApiRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 5, resetAt: new Date() }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMIT_MESSAGE: 'Muitas tentativas.',
}));

jest.mock('@/lib/mailer', () => ({
  sendAccountActivationEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
}));

// Import mocked modules
import prisma from '@/lib/prisma';
import { hashPassword, signSessionToken, setAuthCookie } from '@/lib/auth';
import { checkApiRateLimit } from '@/lib/api-rate-limit';
import { sendAccountActivationEmail } from '@/lib/mailer';

// Import functions to test
import { generateActivationToken, hashActivationToken } from '@/lib/email-activation';

// ===========================================================
// TESTES: email-activation.ts (funções de token)
// ===========================================================

describe('email-activation', () => {
  describe('generateActivationToken', () => {
    it('deve gerar token raw, hash e expiração', () => {
      const result = generateActivationToken();
      
      expect(result.rawToken).toBeDefined();
      expect(result.rawToken.length).toBeGreaterThan(20);
      expect(result.tokenHash).toBeDefined();
      expect(result.tokenHash.length).toBe(64); // SHA-256 = 64 hex chars
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('deve gerar tokens únicos a cada chamada', () => {
      const token1 = generateActivationToken();
      const token2 = generateActivationToken();
      
      expect(token1.rawToken).not.toBe(token2.rawToken);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });
  });

  describe('hashActivationToken', () => {
    it('deve retornar hash consistente para mesmo token', () => {
      const rawToken = 'test-token-12345';
      const hash1 = hashActivationToken(rawToken);
      const hash2 = hashActivationToken(rawToken);
      
      expect(hash1).toBe(hash2);
    });

    it('deve retornar hashes diferentes para tokens diferentes', () => {
      const hash1 = hashActivationToken('token-a');
      const hash2 = hashActivationToken('token-b');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

// ===========================================================
// TESTES: GET /api/auth/verify-email
// ===========================================================

describe('GET /api/auth/verify-email', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('@/pages/api/auth/verify-email');
    handler = mod.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve rejeitar método não GET', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData().ok).toBe(false);
  });

  it('deve retornar 400 para token ausente', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {},
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('inválido');
  });

  it('deve retornar 400 para token inválido (não encontrado)', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'GET',
      query: { token: 'invalid-token-that-does-not-exist' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('inválido');
  });

  it('deve retornar 400 para token já usado', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3600000), // 1h no futuro
      usedAt: new Date(), // JÁ USADO
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { token: 'valid-but-used-token-12345678' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('utilizado');
  });

  it('deve retornar 400 para token expirado', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 3600000), // 1h no passado
      usedAt: null,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { token: 'expired-token-1234567890123' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('expirado');
  });

  it('deve retornar 200 e marcar email como verificado para token válido', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3600000), // 1h no futuro
      usedAt: null,
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const { req, res } = createMocks({
      method: 'GET',
      query: { token: 'valid-token-123456789012345678' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('deve respeitar rate limit', async () => {
    (checkApiRateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: new Date() });

    const { req, res } = createMocks({
      method: 'GET',
      query: { token: 'some-token-1234567890123456' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(429);
  });
});

// ===========================================================
// TESTES: POST /api/auth/set-password
// ===========================================================

describe('POST /api/auth/set-password', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('@/pages/api/auth/set-password');
    handler = mod.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve rejeitar método não POST', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(405);
  });

  it('deve retornar 400 para body inválido (senha curta)', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { token: 'valid-token-but-short-password', password: '123' }, // senha muito curta
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    // Validação Zod retorna erro de senha curta
    expect(res._getJSONData().error).toMatch(/8 caracteres|inválido/i);
  });

  it('deve retornar 400 para token inválido', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { token: 'invalid-token-1234567890123', password: 'senha12345' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('inválido');
  });

  it('deve retornar 400 se usuário já tem senha', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: {
        id: 'user-1',
        email: 'test@test.com',
        emailVerifiedAt: new Date(),
        passwordHash: 'existing-hash', // JÁ TEM SENHA
      },
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { token: 'valid-token-123456789012345678', password: 'newpassword123' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('já possui senha');
  });

  it('deve retornar 200, definir senha e criar sessão para token válido', async () => {
    mockPrisma.emailActivationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: {
        id: 'user-1',
        email: 'test@test.com',
        emailVerifiedAt: null, // Não verificado ainda
        passwordHash: null, // Sem senha
      },
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const { req, res } = createMocks({
      method: 'POST',
      body: { token: 'valid-token-123456789012345678', password: 'newpassword123' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith('newpassword123');
    expect(setAuthCookie).toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('deve respeitar rate limit', async () => {
    (checkApiRateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: new Date() });

    const { req, res } = createMocks({
      method: 'POST',
      body: { token: 'some-token-1234567890123456', password: 'password123' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(429);
  });
});

// ===========================================================
// TESTES: triggerAccountActivation (best-effort)
// ===========================================================

describe('triggerAccountActivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks para estado limpo
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: null });
    mockPrisma.emailActivationToken.findFirst.mockResolvedValue(null);
    mockPrisma.emailActivationToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailActivationToken.create.mockResolvedValue({ id: 'new-token' });
  });

  it('deve enviar email para usuário não verificado', async () => {
    const { triggerAccountActivation } = await import('@/lib/account-activation');

    const result = await triggerAccountActivation({
      userId: 'user-1',
      userEmail: 'test@test.com',
      userName: 'Test User',
    });

    expect(result.sent).toBe(true);
    expect(sendAccountActivationEmail).toHaveBeenCalled();
  });

  it('não deve enviar email para email temporário', async () => {
    const { triggerAccountActivation } = await import('@/lib/account-activation');

    const result = await triggerAccountActivation({
      userId: 'user-1',
      userEmail: '5531999999999@temp.arthemi.com.br',
      userName: 'Test User',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toContain('temporário');
  });

  it('não deve enviar email se usuário já verificado', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });

    const { triggerAccountActivation } = await import('@/lib/account-activation');

    const result = await triggerAccountActivation({
      userId: 'user-1',
      userEmail: 'test@test.com',
      userName: 'Test User',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toContain('verificado');
  });

  it('não deve enviar email se existe token recente', async () => {
    mockPrisma.emailActivationToken.findFirst.mockResolvedValue({
      id: 'recent-token',
      createdAt: new Date(),
    });

    const { triggerAccountActivation } = await import('@/lib/account-activation');

    const result = await triggerAccountActivation({
      userId: 'user-1',
      userEmail: 'test@test.com',
      userName: 'Test User',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toContain('recente');
  });

  it('deve continuar mesmo se envio de email falhar (best-effort)', async () => {
    (sendAccountActivationEmail as jest.Mock).mockResolvedValueOnce({ 
      success: false, 
      error: 'SMTP error' 
    });

    const { triggerAccountActivation } = await import('@/lib/account-activation');

    const result = await triggerAccountActivation({
      userId: 'user-1',
      userEmail: 'test@test.com',
      userName: 'Test User',
    });

    // Não propaga erro, apenas retorna sent: false
    expect(result.sent).toBe(false);
    expect(result.error).toBe('SMTP error');
  });
});
