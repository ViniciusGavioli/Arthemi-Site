// ===========================================================
// Testes: POST /api/auth/resend-activation
// ===========================================================
// Valida:
// - 200: envio bem-sucedido
// - 200: email não existe (segurança - não revela)
// - 200: usuário já verificado (segurança)
// - 200: token recente já existe (throttle)
// - 400: email inválido
// - 429: rate limit por email
// - 429: rate limit por IP
// - 500: falha no envio do email (provider)

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// ===========================================================
// MOCKS
// ===========================================================

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  emailActivationToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockSendEmail = jest.fn();
jest.mock('@/lib/mailer', () => ({
  sendAccountActivationEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockCheckApiRateLimit = jest.fn();
jest.mock('@/lib/api-rate-limit', () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMIT_MESSAGE: 'Muitas tentativas. Aguarde.',
  getRateLimitMessage: jest.fn().mockImplementation((seconds?: number) => 
    seconds ? `Muitas tentativas. Tente novamente em ${seconds} segundos.` : 'Muitas tentativas.'
  ),
}));

jest.mock('@/lib/email-activation', () => ({
  generateActivationToken: jest.fn().mockReturnValue({
    rawToken: 'mock-raw-token-1234567890',
    tokenHash: 'mock-hash-abcdef',
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
  }),
  buildActivationUrl: jest.fn().mockReturnValue('https://arthemi.com.br/verificar-email?token=mock'),
}));

// ===========================================================
// TESTES
// ===========================================================

describe('POST /api/auth/resend-activation', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('@/pages/api/auth/resend-activation');
    handler = mod.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Defaults para rate limits
    mockCheckApiRateLimit.mockReturnValue({ allowed: true, remaining: 10 });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() });
    // Default para envio de email
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' });
    // Defaults para prisma
    mockPrisma.emailActivationToken.findFirst.mockResolvedValue(null);
    mockPrisma.emailActivationToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailActivationToken.create.mockResolvedValue({ id: 'token-1' });
  });

  // -----------------------------------------------------------
  // Método não permitido
  // -----------------------------------------------------------

  it('deve rejeitar método GET', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData().ok).toBe(false);
  });

  // -----------------------------------------------------------
  // Validação de email
  // -----------------------------------------------------------

  it('deve retornar 400 para email inválido', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'not-an-email' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().ok).toBe(false);
    expect(res._getJSONData().error).toContain('inválido');
  });

  it('deve retornar 400 para email ausente', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
  });

  // -----------------------------------------------------------
  // Rate limit por IP (memória)
  // -----------------------------------------------------------

  it('deve retornar 429 quando rate limit por IP é excedido', async () => {
    mockCheckApiRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(429);
    expect(res._getJSONData().ok).toBe(false);
  });

  // -----------------------------------------------------------
  // Rate limit por email (banco)
  // -----------------------------------------------------------

  it('deve retornar 429 quando rate limit por email é excedido', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      resetAt: new Date(Date.now() + 60000),
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(429);
    expect(res._getJSONData().ok).toBe(false);
    expect(res._getJSONData().resetAt).toBeDefined();
  });

  // -----------------------------------------------------------
  // Usuário não existe (segurança)
  // -----------------------------------------------------------

  it('deve retornar 200 quando email não existe (segurança)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'nonexistent@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    // Não deve tentar enviar email
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------
  // Usuário já verificado
  // -----------------------------------------------------------

  it('deve retornar 200 quando usuário já está verificado (segurança)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      emailVerifiedAt: new Date(),
      passwordHash: 'some-hash',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------
  // Token recente já existe (throttle)
  // -----------------------------------------------------------

  it('deve retornar 200 quando token recente existe (throttle)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      emailVerifiedAt: null,
      passwordHash: null,
    });
    mockPrisma.emailActivationToken.findFirst.mockResolvedValue({
      id: 'recent-token',
      createdAt: new Date(),
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    // Não deve criar novo token nem enviar email
    expect(mockPrisma.emailActivationToken.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------
  // Envio bem-sucedido
  // -----------------------------------------------------------

  it('deve retornar 200 e enviar email quando tudo ok', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      emailVerifiedAt: null,
      passwordHash: null,
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith(
      'test@test.com',
      'Test User',
      expect.stringContaining('verificar-email')
    );
    expect(mockPrisma.emailActivationToken.create).toHaveBeenCalled();
    expect(mockPrisma.emailActivationToken.updateMany).toHaveBeenCalled();
  });

  // -----------------------------------------------------------
  // Falha no envio do email (provider)
  // -----------------------------------------------------------

  it('deve retornar 500 quando envio de email falha', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      emailVerifiedAt: null,
      passwordHash: null,
    });
    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'SMTP connection failed',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().ok).toBe(false);
    expect(res._getJSONData().error).toContain('Não foi possível enviar');
  });

  // -----------------------------------------------------------
  // Erro inesperado (exception)
  // -----------------------------------------------------------

  it('deve retornar 500 quando ocorre exceção', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database down'));

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().ok).toBe(false);
    expect(res._getJSONData().error).toContain('Erro interno');
  });

  // -----------------------------------------------------------
  // Normalização de email
  // -----------------------------------------------------------

  it('deve normalizar email para lowercase', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'TEST@TEST.COM' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'test@test.com' },
      })
    );
  });
});
