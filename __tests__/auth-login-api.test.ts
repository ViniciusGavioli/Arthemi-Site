// ===========================================================
// Testes: POST /api/auth/login
// ===========================================================

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

const mockProcessLogin = jest.fn();
const mockSignSessionToken = jest.fn();
const mockSetAuthCookie = jest.fn();
const mockLogAudit = jest.fn();
const mockCheckApiRateLimit = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/auth', () => ({
  processLogin: (...args: unknown[]) => mockProcessLogin(...args),
  signSessionToken: (...args: unknown[]) => mockSignSessionToken(...args),
  setAuthCookie: (...args: unknown[]) => mockSetAuthCookie(...args),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

jest.mock('@/lib/api-rate-limit', () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  getRateLimitMessage: jest.fn().mockImplementation((seconds?: number) =>
    seconds ? `Muitas tentativas. Tente novamente em ${seconds} segundos.` : 'Muitas tentativas. Aguarde um momento antes de tentar novamente.'
  ),
}));

describe('POST /api/auth/login', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('@/pages/api/auth/login');
    handler = mod.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckApiRateLimit.mockReturnValue({
      allowed: true,
      remaining: 14,
      resetAt: new Date(Date.now() + 60_000),
    });
    mockProcessLogin.mockResolvedValue({
      success: true,
      statusCode: 200,
      role: 'CUSTOMER',
    });
    mockSignSessionToken.mockReturnValue('mock-jwt-token');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'CUSTOMER',
    });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it('deve retornar 405 para método inválido', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData().error).toContain('Método');
  });

  it('deve retornar 429 quando rate limit bloqueia', async () => {
    mockCheckApiRateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
      retryAfterSeconds: 30,
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'user@test.com', password: 'senha' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(429);
    expect(res._getJSONData().error).toContain('Muitas tentativas');
  });

  it('deve retornar 400 para body inválido', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'invalido', password: '' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toContain('obrigatórios');
  });

  it('deve retornar erro de credenciais quando processLogin falha', async () => {
    mockProcessLogin.mockResolvedValueOnce({
      success: false,
      statusCode: 401,
      error: 'Email ou senha inválidos.',
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'user@test.com', password: 'senha-errada' },
      headers: { 'user-agent': 'jest-test' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData().error).toBe('Email ou senha inválidos.');
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
  });

  it('deve retornar 200 e setar cookie quando login for válido', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'user@test.com', password: 'SenhaValida123!' },
      headers: { 'user-agent': 'jest-test' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ ok: true, role: 'CUSTOMER' });
    expect(mockSignSessionToken).toHaveBeenCalled();
    expect(mockSetAuthCookie).toHaveBeenCalled();
  });
});
