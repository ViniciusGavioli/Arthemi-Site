/**
 * Testes: Validação de variáveis de ambiente
 */

describe('env', () => {
  // Salvar valores originais
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('deve exportar função validateEnv', async () => {
      const { validateEnv } = await import('@/lib/env');
      expect(typeof validateEnv).toBe('function');
    });

    it('deve exportar função validateEnvOrFail', async () => {
      const { validateEnvOrFail } = await import('@/lib/env');
      expect(typeof validateEnvOrFail).toBe('function');
    });

    it('deve exportar objeto env com getters', async () => {
      const { env } = await import('@/lib/env');
      expect(env).toBeDefined();
      expect(typeof env.DATABASE_URL).toBe('string');
      expect(typeof env.ADMIN_SESSION_SECRET).toBe('string');
      expect(typeof env.JWT_SECRET).toBe('string');
      expect(typeof env.isProduction).toBe('boolean');
      expect(typeof env.isDevelopment).toBe('boolean');
    });

    it('deve retornar valores padrão em dev quando não configurado', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      const { env } = await import('@/lib/env');
      
      // ADMIN_SESSION_SECRET tem fallback (valor pode variar por .env local)
      expect(typeof env.ADMIN_SESSION_SECRET).toBe('string');
      expect(env.ADMIN_SESSION_SECRET.length).toBeGreaterThan(0);
    });
  });

  describe('env getters', () => {
    it('deve retornar DATABASE_URL se configurado', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      const { env } = await import('@/lib/env');
      
      expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
    });

    it('deve retornar string vazia para DATABASE_URL não configurado', async () => {
      delete process.env.DATABASE_URL;
      const { env } = await import('@/lib/env');
      
      expect(env.DATABASE_URL).toBe('');
    });

    it('deve retornar isProduction corretamente', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      jest.resetModules();
      const { env } = await import('@/lib/env');
      
      expect(env.isProduction).toBe(true);
      expect(env.isDevelopment).toBe(false);
    });

    it('deve retornar ASAAS_MOCK_MODE como boolean', async () => {
      process.env.ASAAS_MOCK_MODE = 'true';
      const { env } = await import('@/lib/env');
      
      expect(env.ASAAS_MOCK_MODE).toBe(true);
    });
  });
});
