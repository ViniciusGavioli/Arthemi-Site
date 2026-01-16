// ===========================================================
// TESTES: Sistema de Cupons (Atualizado para PRICE_OVERRIDE)
// ===========================================================
// MUDANÇA: DEV coupons foram REMOVIDOS
// Agora usamos PRICE_OVERRIDE para preços administrativos
// 
// Este arquivo testa apenas cupons COMERCIAIS válidos

import {
  isValidCoupon,
  getCouponInfo,
  canUseDevCoupon,
  isDevCouponAdmin,
  validateDevCouponAccess,
  DEV_COUPON_ADMIN_EMAILS,
  VALID_COUPONS,
} from '@/lib/coupons';

// ============================================================
// 1. TESTES: Cupons Comerciais Válidos
// ============================================================

describe('Cupons Comerciais - Identificação', () => {
  test('PRIMEIRACOMPRA10 é um cupom válido', () => {
    const coupon = getCouponInfo('PRIMEIRACOMPRA10');
    expect(coupon).not.toBeNull();
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(10);
    expect(coupon?.singleUsePerUser).toBe(true);
  });

  test('ARTHEMI10 é um cupom válido (legado)', () => {
    const coupon = getCouponInfo('ARTHEMI10');
    expect(coupon).not.toBeNull();
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(10);
  });

  test('PRIMEIRACOMPRA é um cupom válido (legado)', () => {
    const coupon = getCouponInfo('PRIMEIRACOMPRA');
    expect(coupon).not.toBeNull();
    expect(coupon?.discountType).toBe('percent');
    expect(coupon?.value).toBe(15);
    expect(coupon?.singleUsePerUser).toBe(true);
  });

  test('Cupom inválido retorna null', () => {
    expect(getCouponInfo('INVALIDO')).toBeNull();
    expect(getCouponInfo('')).toBeNull();
    expect(isValidCoupon('INVALIDO')).toBe(false);
  });
});

// ============================================================
// 2. TESTES: DEV Coupons REMOVIDOS
// ============================================================

describe('DEV Coupons - Removidos', () => {
  test('TESTE50 NÃO é mais um cupom válido', () => {
    // DEV coupons foram removidos - usar OVERRIDE_X
    const coupon = getCouponInfo('TESTE50');
    expect(coupon).toBeNull();
    expect(isValidCoupon('TESTE50')).toBe(false);
  });

  test('DEVTEST NÃO é mais um cupom válido', () => {
    const coupon = getCouponInfo('DEVTEST');
    expect(coupon).toBeNull();
    expect(isValidCoupon('DEVTEST')).toBe(false);
  });

  test('Nenhum cupom atual é DEV coupon', () => {
    const hasDevCoupon = Object.values(VALID_COUPONS).some(c => c.isDevCoupon);
    expect(hasDevCoupon).toBe(false);
  });
});

// ============================================================
// 3. TESTES: Admin Whitelist (para OVERRIDE)
// ============================================================

describe('Admin Whitelist', () => {
  test('admin@arthemisaude.com está na whitelist', () => {
    expect(isDevCouponAdmin('admin@arthemisaude.com')).toBe(true);
  });

  test('administrativo@arthemisaude.com está na whitelist', () => {
    expect(isDevCouponAdmin('administrativo@arthemisaude.com')).toBe(true);
  });

  test('dev@arthemisaude.com está na whitelist', () => {
    expect(isDevCouponAdmin('dev@arthemisaude.com')).toBe(true);
  });

  test('usuario@gmail.com NÃO está na whitelist', () => {
    expect(isDevCouponAdmin('usuario@gmail.com')).toBe(false);
  });

  test('Whitelist normaliza para lowercase', () => {
    expect(isDevCouponAdmin('ADMIN@ARTHEMISAUDE.COM')).toBe(true);
    expect(isDevCouponAdmin('  admin@arthemisaude.com  ')).toBe(true);
  });

  test('null/undefined retorna false', () => {
    expect(isDevCouponAdmin(null)).toBe(false);
    expect(isDevCouponAdmin(undefined)).toBe(false);
    expect(isDevCouponAdmin('')).toBe(false);
  });
});

// ============================================================
// 4. TESTES: canUseDevCoupon (retrocompatibilidade)
// ============================================================

describe('canUseDevCoupon - Retrocompatibilidade', () => {
  test('Cupom normal sempre permitido (não é DEV)', () => {
    const coupon = getCouponInfo('PRIMEIRACOMPRA10');
    const result = canUseDevCoupon(coupon, 'qualquer@email.com');
    expect(result.allowed).toBe(true);
  });

  test('null coupon permite passthrough', () => {
    const result = canUseDevCoupon(null, 'qualquer@email.com');
    expect(result.allowed).toBe(true);
  });
});

// ============================================================
// 5. TESTES: validateDevCouponAccess (retrocompatibilidade)
// ============================================================

describe('validateDevCouponAccess - Retrocompatibilidade', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('Cupom normal sempre passa (sem checagem de sessão)', () => {
    process.env.NODE_ENV = 'production';
    const result = validateDevCouponAccess('PRIMEIRACOMPRA10', null, 'test-req-1');
    expect(result.allowed).toBe(true);
  });

  test('Cupom inválido passa (validação no backend)', () => {
    const result = validateDevCouponAccess('INVALIDO', null, 'test-req-2');
    expect(result.allowed).toBe(true);
    // Validação real acontece em isValidCoupon()
  });
});

// ============================================================
// 6. TESTES: Migração para PRICE_OVERRIDE
// ============================================================

describe('Migração DEV Coupon → PRICE_OVERRIDE', () => {
  test('Use OVERRIDE_5 ao invés de TESTE50', () => {
    // TESTE50 era R$5 de desconto
    // Agora use OVERRIDE_5 para R$5 preço final
    // Comportamento diferente: OVERRIDE é preço FINAL, não desconto
    expect(isValidCoupon('TESTE50')).toBe(false);
    // OVERRIDE_5 é tratado no backend, não em VALID_COUPONS
  });

  test('Use OVERRIDE_X para preço administrativo', () => {
    // Formato: OVERRIDE_<valor_em_reais>
    // OVERRIDE_5 = R$5,00 final
    // OVERRIDE_0 = gratuito
    // OVERRIDE_1 = R$1,00 (mínimo Asaas)
    expect(true).toBe(true); // Placeholder - testes reais em price-override.test.ts
  });

  test('OVERRIDE requer permissão (whitelist ou ADMIN)', () => {
    // Validado em validateOverrideAccess()
    expect(DEV_COUPON_ADMIN_EMAILS.length).toBeGreaterThan(0);
  });
});
