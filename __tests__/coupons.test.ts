// ===========================================================
// Testes: Cupons - applyDiscount, isValidCoupon, validate API
// ===========================================================
// NOTA: DEV coupons (TESTE50, DEVTEST) foram removidos
// Use PRICE_OVERRIDE para preços administrativos

import { applyDiscount, isValidCoupon, getCouponInfo, createCouponSnapshot } from '@/lib/coupons';

describe('lib/coupons', () => {
  describe('isValidCoupon', () => {
    it('retorna true para cupom válido', () => {
      expect(isValidCoupon('ARTHEMI10')).toBe(true);
      expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
      // DEV coupons são válidos (mas restritos em produção)
      expect(isValidCoupon('TESTE50')).toBe(true);
      expect(isValidCoupon('DEVTEST')).toBe(true);
    });

    it('retorna true normalizado (case insensitive, trim)', () => {
      expect(isValidCoupon('arthemi10')).toBe(true);
      expect(isValidCoupon('  ARTHEMI10  ')).toBe(true);
      expect(isValidCoupon(' primeiracompra ')).toBe(true);
    });

    it('retorna false para cupom inválido', () => {
      expect(isValidCoupon('INVALIDO')).toBe(false);
      expect(isValidCoupon('CUPOM123')).toBe(false);
      expect(isValidCoupon('')).toBe(false);
      // Cupons que não existem
      expect(isValidCoupon('PRIMEIRACOMPRA10')).toBe(false);
      expect(isValidCoupon('NAOVALIDO')).toBe(false);
    });
  });

  describe('getCouponInfo', () => {
    it('retorna config para cupom válido', () => {
      const info = getCouponInfo('ARTHEMI10');
      expect(info).toBeDefined();
      expect(info?.discountType).toBe('percent');
      expect(info?.value).toBe(10);
    });

    it('retorna null para cupom inválido', () => {
      expect(getCouponInfo('INVALIDO')).toBeNull();
      expect(getCouponInfo('')).toBeNull();
    });
  });

  describe('applyDiscount', () => {
    describe('cupom percentual (ARTHEMI10 = 10%)', () => {
      it('calcula 10% de R$100,00 = R$10,00 desconto', () => {
        const result = applyDiscount(10000, 'ARTHEMI10');
        expect(result.discountAmount).toBe(1000); // 10% de 10000
        expect(result.finalAmount).toBe(9000);
        expect(result.couponApplied).toBe(true);
      });

      it('calcula 10% de R$83,98 = R$8,40 desconto (arredondado)', () => {
        const result = applyDiscount(8398, 'ARTHEMI10');
        expect(result.discountAmount).toBe(840); // Math.round(8398 * 0.10) = 840
        expect(result.finalAmount).toBe(7558);
        expect(result.couponApplied).toBe(true);
      });

      it('calcula 10% de R$1,50 = R$0,15 desconto', () => {
        const result = applyDiscount(150, 'ARTHEMI10');
        // 10% de 150 = 15, finalAmount = 135 (piso 100, mas 135 > 100)
        expect(result.finalAmount).toBe(135);
        expect(result.discountAmount).toBe(15);
      });

      it('piso ativo: 10% de R$1,00 → net=100, discount=0', () => {
        const result = applyDiscount(100, 'ARTHEMI10');
        // 10% de 100 = 10, finalAmount seria 90 mas piso = 100
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(0);
      });
    });

    describe('cupom percentual (PRIMEIRACOMPRA = 15%)', () => {
      it('calcula 15% de R$100,00 = R$15,00 desconto', () => {
        const result = applyDiscount(10000, 'PRIMEIRACOMPRA');
        expect(result.discountAmount).toBe(1500);
        expect(result.finalAmount).toBe(8500);
      });

      it('calcula 15% de R$839,80 = R$125,97 desconto', () => {
        const result = applyDiscount(83980, 'PRIMEIRACOMPRA');
        // 15% de 83980 = 12597
        expect(result.discountAmount).toBe(12597);
        expect(result.finalAmount).toBe(71383);
      });
    });

    // NOTA: TESTE50 é agora um DEV coupon válido (R$5 desconto fixo)
    describe('DEV coupon (TESTE50)', () => {
      it('TESTE50 aplica R$5 de desconto (DEV coupon)', () => {
        const result = applyDiscount(10000, 'TESTE50');
        expect(result.discountAmount).toBe(500); // R$5,00
        expect(result.finalAmount).toBe(9500);
        expect(result.couponApplied).toBe(true);
      });
    });

    describe('cupom inválido', () => {
      it('não aplica desconto para cupom inválido', () => {
        const result = applyDiscount(10000, 'INVALIDO');
        expect(result.discountAmount).toBe(0);
        expect(result.finalAmount).toBe(10000);
        expect(result.couponApplied).toBe(false);
      });

      it('não aplica desconto para cupom vazio', () => {
        const result = applyDiscount(10000, '');
        expect(result.discountAmount).toBe(0);
        expect(result.finalAmount).toBe(10000);
        expect(result.couponApplied).toBe(false);
      });
    });
  });

  describe('createCouponSnapshot', () => {
    it('cria snapshot com dados do cupom', () => {
      const snapshot = createCouponSnapshot('ARTHEMI10') as Record<string, unknown>;
      expect(snapshot).toBeDefined();
      expect(snapshot.code).toBe('ARTHEMI10');
      expect(snapshot.discountType).toBe('percent');
      expect(snapshot.value).toBe(10);
      expect(snapshot.appliedAt).toBeDefined();
    });

    it('retorna null para cupom inválido', () => {
      expect(createCouponSnapshot('INVALIDO')).toBeNull();
    });
  });

  // ===========================================================
  // TESTES DE BLINDAGEM: Consistência entre preview e backend
  // ===========================================================
  describe('consistência grossAmount → netAmount', () => {
    // NOTA: Removido TESTE50 dos testes - cupom não existe mais
    const testCases = [
      { grossAmount: 16796, coupon: 'ARTHEMI10', expectedNet: 15116, desc: '2h avulsa + 10%' },
      { grossAmount: 83980, coupon: 'PRIMEIRACOMPRA', expectedNet: 71383, desc: 'Pacote 10h + 15%' },
      { grossAmount: 50000, coupon: 'ARTHEMI10', expectedNet: 45000, desc: '10% de R$500' },
    ];

    testCases.forEach(({ grossAmount, coupon, expectedNet, desc }) => {
      it(`${desc}: ${grossAmount} centavos → ${expectedNet} centavos`, () => {
        const result = applyDiscount(grossAmount, coupon);
        expect(result.finalAmount).toBe(expectedNet);
        // Verificar invariante: gross = net + discount
        expect(grossAmount).toBe(result.finalAmount + result.discountAmount);
      });
    });

    it('invariante: grossAmount = finalAmount + discountAmount (sempre)', () => {
      const values = [100, 500, 1000, 5000, 10000, 50000, 83980, 167960];
      // Apenas cupons válidos (TESTE50 removido)
      const coupons = ['ARTHEMI10', 'PRIMEIRACOMPRA', 'PRIMEIRACOMPRA10'];
      
      for (const gross of values) {
        for (const coupon of coupons) {
          const result = applyDiscount(gross, coupon);
          expect(gross).toBe(result.finalAmount + result.discountAmount);
        }
      }
    });
  });

  // ===========================================================
  // REGRA DE PISO: R$1,00 mínimo (Asaas PIX)
  // ===========================================================
  describe('regra de piso R$1,00', () => {
    describe('amount >= 100 (piso ativo)', () => {
      it('cupom 10% em R$1 → net=100, discount=0 (piso)', () => {
        const result = applyDiscount(100, 'ARTHEMI10');
        // 10% de 100 = 10, net seria 90 mas piso 100
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(0);
        expect(result.couponApplied).toBe(true);
      });

      it('cupom 10% em R$3 → net=270, discount=30', () => {
        const result = applyDiscount(300, 'ARTHEMI10');
        // 10% de 300 = 30, net = 270 (acima do piso)
        expect(result.finalAmount).toBe(270);
        expect(result.discountAmount).toBe(30);
      });

      it('cupom 15% em R$6 → net=510, discount=90', () => {
        const result = applyDiscount(600, 'PRIMEIRACOMPRA');
        // 15% de 600 = 90, net = 510 (acima do piso)
        expect(result.finalAmount).toBe(510);
        expect(result.discountAmount).toBe(90);
      });

      it('cupom 15% em R$1 → net=100, discount=0 (piso impede zerar)', () => {
        // 15% de 100 = 15, net seria 85 mas piso 100
        const result = applyDiscount(100, 'PRIMEIRACOMPRA');
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(0);
      });
    });

    describe('amount < 100 (sem piso)', () => {
      it('cupom inválido em R$0,50 → sem desconto', () => {
        const result = applyDiscount(50, 'INVALIDO');
        // Cupom inválido, não aplica desconto
        expect(result.finalAmount).toBe(50);
        expect(result.discountAmount).toBe(0);
      });

      it('cupom 10% em R$0,99 → net=89, discount=10', () => {
        const result = applyDiscount(99, 'ARTHEMI10');
        // 10% de 99 = 9.9 → 10
        expect(result.finalAmount).toBe(89);
        expect(result.discountAmount).toBe(10);
      });

      it('invariante mantida com amount < 100', () => {
        const result = applyDiscount(50, 'ARTHEMI10');
        expect(50).toBe(result.finalAmount + result.discountAmount);
      });
    });
  });

  describe('edge cases de arredondamento', () => {
    it('arredonda para inteiro (centavos)', () => {
      // 10% de 8399 = 839.9 → deve arredondar para 840
      const result = applyDiscount(8399, 'ARTHEMI10');
      expect(Number.isInteger(result.discountAmount)).toBe(true);
      expect(Number.isInteger(result.finalAmount)).toBe(true);
    });

    it('valores nunca negativos', () => {
      const result = applyDiscount(50, 'ARTHEMI10');
      expect(result.finalAmount).toBeGreaterThanOrEqual(0);
      expect(result.discountAmount).toBeGreaterThanOrEqual(0);
    });

    it('invariante: amount = final + discount (exaustivo)', () => {
      const amounts = [1, 50, 99, 100, 101, 500, 1000, 10000];
      // Apenas cupons válidos
      const coupons = ['ARTHEMI10', 'PRIMEIRACOMPRA', 'PRIMEIRACOMPRA10'];
      
      for (const amount of amounts) {
        for (const coupon of coupons) {
          const result = applyDiscount(amount, coupon);
          expect(amount).toBe(result.finalAmount + result.discountAmount);
        }
      }
    });
  });
});
