// ===========================================================
// TESTES: MVP Hotfix - Cupons desabilitados + Override de teste
// ===========================================================

import {
  parseTestOverride,
  validateTestOverrideAccess,
  processTestOverride,
  isTestOverrideEnabled,
  TEST_OVERRIDE_CODE,
  TEST_OVERRIDE_AMOUNT_CENTS,
  TestOverrideAccessError,
} from '@/lib/test-override';
import { areCouponsEnabled } from '@/lib/coupons';

describe('MVP Hotfix: Test Override', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('parseTestOverride', () => {
    it('deve retornar isOverride=true para código TESTE5', () => {
      const result = parseTestOverride('TESTE5');
      expect(result.isOverride).toBe(true);
      expect(result.code).toBe(TEST_OVERRIDE_CODE);
    });

    it('deve retornar isOverride=true para código teste5 (lowercase)', () => {
      const result = parseTestOverride('teste5');
      expect(result.isOverride).toBe(true);
      expect(result.code).toBe(TEST_OVERRIDE_CODE);
    });

    it('deve retornar isOverride=false para cupom comercial', () => {
      const result = parseTestOverride('ARTHEMI10');
      expect(result.isOverride).toBe(false);
      expect(result.code).toBeNull();
    });

    it('deve retornar isOverride=false para undefined', () => {
      const result = parseTestOverride(undefined);
      expect(result.isOverride).toBe(false);
    });

    it('deve retornar isOverride=false para string vazia', () => {
      const result = parseTestOverride('');
      expect(result.isOverride).toBe(false);
    });
  });

  describe('validateTestOverrideAccess', () => {
    it('deve lançar erro quando ENABLE_TEST_OVERRIDE=false', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'false';
      
      expect(() => {
        validateTestOverrideAccess('admin@test.com', false, 'req-123');
      }).toThrow(TestOverrideAccessError);
    });

    it('deve lançar erro quando ENABLE_TEST_OVERRIDE não está definido', () => {
      delete process.env.ENABLE_TEST_OVERRIDE;
      
      expect(() => {
        validateTestOverrideAccess('admin@test.com', false, 'req-123');
      }).toThrow(TestOverrideAccessError);
    });

    it('deve lançar erro quando não há sessão (email=null)', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      
      expect(() => {
        validateTestOverrideAccess(null, false, 'req-123');
      }).toThrow(TestOverrideAccessError);
    });

    it('deve permitir quando isAdmin=true', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      
      expect(() => {
        validateTestOverrideAccess('qualquer@email.com', true, 'req-123');
      }).not.toThrow();
    });

    it('deve permitir quando email está na whitelist', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      process.env.TEST_OVERRIDE_ADMIN_EMAILS = 'dev@test.com,admin@test.com';
      
      expect(() => {
        validateTestOverrideAccess('dev@test.com', false, 'req-123');
      }).not.toThrow();
    });

    it('deve lançar erro quando email não está na whitelist', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      process.env.TEST_OVERRIDE_ADMIN_EMAILS = 'dev@test.com';
      
      expect(() => {
        validateTestOverrideAccess('usuario@comum.com', false, 'req-123');
      }).toThrow(TestOverrideAccessError);
    });
  });

  describe('processTestOverride', () => {
    it('deve retornar enabled=false para cupom comercial', () => {
      const result = processTestOverride('ARTHEMI10', 'user@test.com', false, 'req-123');
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('NOT_OVERRIDE_CODE');
    });

    it('deve retornar enabled=true e R$5 quando autorizado', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      
      const result = processTestOverride('TESTE5', 'user@test.com', true, 'req-123');
      expect(result.enabled).toBe(true);
      expect(result.finalPayableCents).toBe(TEST_OVERRIDE_AMOUNT_CENTS);
      expect(result.finalPayableCents).toBe(500); // R$5,00
    });

    it('deve lançar erro quando não autorizado', () => {
      process.env.ENABLE_TEST_OVERRIDE = 'true';
      process.env.TEST_OVERRIDE_ADMIN_EMAILS = 'admin@test.com';
      
      expect(() => {
        processTestOverride('TESTE5', 'usuario@comum.com', false, 'req-123');
      }).toThrow(TestOverrideAccessError);
    });
  });
});

describe('MVP Hotfix: Coupons Flag', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('areCouponsEnabled', () => {
    it('deve retornar false por padrão (MVP)', () => {
      delete process.env.COUPONS_ENABLED;
      
      // Reimportar para pegar novo valor
      jest.isolateModules(() => {
        const { areCouponsEnabled: freshAreCouponsEnabled } = require('@/lib/coupons');
        expect(freshAreCouponsEnabled()).toBe(false);
      });
    });

    it('deve retornar true quando COUPONS_ENABLED=true', () => {
      process.env.COUPONS_ENABLED = 'true';
      
      jest.isolateModules(() => {
        const { areCouponsEnabled: freshAreCouponsEnabled } = require('@/lib/coupons');
        expect(freshAreCouponsEnabled()).toBe(true);
      });
    });

    it('deve retornar false quando COUPONS_ENABLED=false', () => {
      process.env.COUPONS_ENABLED = 'false';
      
      jest.isolateModules(() => {
        const { areCouponsEnabled: freshAreCouponsEnabled } = require('@/lib/coupons');
        expect(freshAreCouponsEnabled()).toBe(false);
      });
    });
  });
});

describe('MVP Hotfix: TestOverrideAccessError', () => {
  it('deve ter statusCode=403', () => {
    const error = new TestOverrideAccessError('Mensagem', 'TEST_CODE');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Mensagem');
  });

  it('deve ser instanceof Error', () => {
    const error = new TestOverrideAccessError('Mensagem', 'TEST_CODE');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof TestOverrideAccessError).toBe(true);
  });
});
