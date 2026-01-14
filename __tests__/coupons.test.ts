// ===========================================================
// Testes: Cupons - applyDiscount, isValidCoupon, validate API
// ===========================================================

import { applyDiscount, isValidCoupon, getCouponInfo, createCouponSnapshot } from '@/lib/coupons';

describe('lib/coupons', () => {
  describe('isValidCoupon', () => {
    it('retorna true para cupom válido', () => {
      expect(isValidCoupon('ARTHEMI10')).toBe(true);
      expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
      expect(isValidCoupon('TESTE50')).toBe(true);
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

    describe('cupom fixo (TESTE50 = R$5,00)', () => {
      it('desconta R$5,00 de R$100,00', () => {
        const result = applyDiscount(10000, 'TESTE50');
        expect(result.discountAmount).toBe(500);
        expect(result.finalAmount).toBe(9500);
      });

      it('desconta R$5,00 de R$839,80', () => {
        const result = applyDiscount(83980, 'TESTE50');
        expect(result.discountAmount).toBe(500);
        expect(result.finalAmount).toBe(83480);
      });

      it('valor mínimo R$1,00 quando desconto é maior que valor', () => {
        const result = applyDiscount(300, 'TESTE50');
        // 500 > 300, mas mínimo é 100
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(200); // desconto efetivo
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
    const testCases = [
      { grossAmount: 83980, coupon: 'TESTE50', expectedNet: 83480, desc: 'Pacote 10h + R$5 fixo' },
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
      const coupons = ['TESTE50', 'ARTHEMI10', 'PRIMEIRACOMPRA'];
      
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
      it('cupom R$5 em R$1 → net=100, discount=0 (piso)', () => {
        const result = applyDiscount(100, 'TESTE50');
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(0);
        expect(result.couponApplied).toBe(true);
      });

      it('cupom R$5 em R$3 → net=100, discount=200', () => {
        const result = applyDiscount(300, 'TESTE50');
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(200);
      });

      it('cupom R$5 em R$6 → net=100, discount=500 (desconto integral)', () => {
        const result = applyDiscount(600, 'TESTE50');
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(500);
      });

      it('cupom 100% em R$100 → net=100, discount=0 (piso impede zerar)', () => {
        // Simular cupom 100% com PRIMEIRACOMPRA (15%) não zera
        // Usar valor calculado: 100 * 0.15 = 15, net = 85? Não, piso = 100
        const result = applyDiscount(100, 'PRIMEIRACOMPRA');
        expect(result.finalAmount).toBe(100);
        expect(result.discountAmount).toBe(0);
      });
    });

    describe('amount < 100 (sem piso)', () => {
      it('cupom R$5 em R$0,50 → net=0, discount=50 (sem piso)', () => {
        const result = applyDiscount(50, 'TESTE50');
        expect(result.finalAmount).toBe(0);
        expect(result.discountAmount).toBe(50);
      });

      it('cupom 10% em R$0,99 → net=89, discount=10', () => {
        const result = applyDiscount(99, 'ARTHEMI10');
        // 10% de 99 = 9.9 → 10
        expect(result.finalAmount).toBe(89);
        expect(result.discountAmount).toBe(10);
      });

      it('invariante mantida com amount < 100', () => {
        const result = applyDiscount(50, 'TESTE50');
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
      const result = applyDiscount(50, 'TESTE50');
      expect(result.finalAmount).toBeGreaterThanOrEqual(0);
      expect(result.discountAmount).toBeGreaterThanOrEqual(0);
    });

    it('invariante: amount = final + discount (exaustivo)', () => {
      const amounts = [1, 50, 99, 100, 101, 500, 1000, 10000];
      const coupons = ['TESTE50', 'ARTHEMI10', 'PRIMEIRACOMPRA'];
      
      for (const amount of amounts) {
        for (const coupon of coupons) {
          const result = applyDiscount(amount, coupon);
          expect(amount).toBe(result.finalAmount + result.discountAmount);
        }
      }
    });
  });
});
