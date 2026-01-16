// ===========================================================
// TESTES: Cupom de Desenvolvimento (DEV COUPON)
// ===========================================================
// Valida as regras:
// 1. Cupom DEV tem uso infinito (não consome)
// 2. Em produção: bloqueado para usuário comum
// 3. Em produção: permitido para admin (whitelist)
// 4. Cupom normal continua funcionando igual

import {
  isValidCoupon,
  getCouponInfo,
  canUseDevCoupon,
  isDevCouponAdmin,
  VALID_COUPONS,
} from '@/lib/coupons';

// ============================================================
// 1. TESTES: Identificação de cupom DEV
// ============================================================

describe('Dev Coupon - Identification', () => {
  test('TESTE50 é um cupom DEV', () => {
    const coupon = getCouponInfo('TESTE50');
    expect(coupon).not.toBeNull();
    expect(coupon?.isDevCoupon).toBe(true);
  });

  test('DEVTEST é um cupom DEV', () => {
    const coupon = getCouponInfo('DEVTEST');
    expect(coupon).not.toBeNull();
    expect(coupon?.isDevCoupon).toBe(true);
  });

  test('ARTHEMI10 NÃO é cupom DEV', () => {
    const coupon = getCouponInfo('ARTHEMI10');
    expect(coupon).not.toBeNull();
    expect(coupon?.isDevCoupon).toBeFalsy();
  });

  test('PRIMEIRACOMPRA NÃO é cupom DEV', () => {
    const coupon = getCouponInfo('PRIMEIRACOMPRA');
    expect(coupon).not.toBeNull();
    expect(coupon?.isDevCoupon).toBeFalsy();
  });
});

// ============================================================
// 2. TESTES: Whitelist de Admin
// ============================================================

describe('Dev Coupon - Admin Whitelist', () => {
  test('admin@arthemisaude.com é admin', () => {
    expect(isDevCouponAdmin('admin@arthemisaude.com')).toBe(true);
  });

  test('administrativo@arthemisaude.com é admin', () => {
    expect(isDevCouponAdmin('administrativo@arthemisaude.com')).toBe(true);
  });

  test('dev@arthemisaude.com é admin', () => {
    expect(isDevCouponAdmin('dev@arthemisaude.com')).toBe(true);
  });

  test('usuario@gmail.com NÃO é admin', () => {
    expect(isDevCouponAdmin('usuario@gmail.com')).toBe(false);
  });

  test('null/undefined NÃO é admin', () => {
    expect(isDevCouponAdmin(null)).toBe(false);
    expect(isDevCouponAdmin(undefined)).toBe(false);
    expect(isDevCouponAdmin('')).toBe(false);
  });
});

// ============================================================
// 3. TESTES: Permissão de uso (canUseDevCoupon)
// ============================================================

describe('Dev Coupon - Permission (canUseDevCoupon)', () => {
  // Mock NODE_ENV
  const originalEnv = process.env.NODE_ENV;
  
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('Cupom normal sempre permitido', () => {
    const coupon = getCouponInfo('ARTHEMI10');
    const result = canUseDevCoupon(coupon, 'usuario@gmail.com');
    expect(result.allowed).toBe(true);
  });

  test('Cupom DEV em desenvolvimento: sempre permitido', () => {
    process.env.NODE_ENV = 'development';
    const coupon = getCouponInfo('TESTE50');
    
    // Usuário comum
    const result1 = canUseDevCoupon(coupon, 'usuario@gmail.com');
    expect(result1.allowed).toBe(true);
    
    // Sem email
    const result2 = canUseDevCoupon(coupon, null);
    expect(result2.allowed).toBe(true);
  });

  test('Cupom DEV em produção para usuário comum: BLOQUEADO', () => {
    process.env.NODE_ENV = 'production';
    const coupon = getCouponInfo('TESTE50');
    
    const result = canUseDevCoupon(coupon, 'usuario@gmail.com');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('não disponível');
  });

  test('Cupom DEV em produção para admin: PERMITIDO', () => {
    process.env.NODE_ENV = 'production';
    const coupon = getCouponInfo('TESTE50');
    
    const result = canUseDevCoupon(coupon, 'admin@arthemisaude.com');
    expect(result.allowed).toBe(true);
  });

  test('Cupom DEV em produção sem email: BLOQUEADO', () => {
    process.env.NODE_ENV = 'production';
    const coupon = getCouponInfo('TESTE50');
    
    const result = canUseDevCoupon(coupon, null);
    expect(result.allowed).toBe(false);
  });
});

// ============================================================
// 4. TESTES: Configuração de cupons
// ============================================================

describe('Dev Coupon - Configuration', () => {
  test('TESTE50 tem desconto fixo de R$5', () => {
    const coupon = getCouponInfo('TESTE50');
    expect(coupon?.discountType).toBe('fixed');
    expect(coupon?.value).toBe(500);
  });

  test('DEVTEST tem desconto de 50%', () => {
    const coupon = getCouponInfo('DEVTEST');
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(50);
  });

  test('Todos os cupons DEV têm singleUsePerUser=false', () => {
    const devCoupons = Object.entries(VALID_COUPONS)
      .filter(([, config]) => config.isDevCoupon);
    
    for (const [code, config] of devCoupons) {
      expect(config.singleUsePerUser).toBeFalsy();
    }
  });
});

// ============================================================
// 5. TESTES: Não regressão em cupons normais
// ============================================================

describe('Dev Coupon - No Regression on Normal Coupons', () => {
  test('ARTHEMI10 funciona normalmente', () => {
    expect(isValidCoupon('ARTHEMI10')).toBe(true);
    const coupon = getCouponInfo('ARTHEMI10');
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(10);
    expect(coupon?.isDevCoupon).toBeFalsy();
  });

  test('PRIMEIRACOMPRA funciona normalmente com singleUse', () => {
    expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
    const coupon = getCouponInfo('PRIMEIRACOMPRA');
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(15);
    expect(coupon?.singleUsePerUser).toBe(true);
    expect(coupon?.isDevCoupon).toBeFalsy();
  });

  test('Cupom inválido continua inválido', () => {
    expect(isValidCoupon('NAOVALIDO')).toBe(false);
    expect(getCouponInfo('NAOVALIDO')).toBeNull();
  });
});
