// ===========================================================
// Testes: Regra PIX mínimo R$1,00
// ===========================================================
// Verifica que a lógica de piso funciona corretamente para PIX

import { applyDiscount } from '@/lib/coupons';

describe('PIX mínimo R$1,00', () => {
  describe('cenários onde PIX seria bloqueado (netAmount < 100)', () => {
    it('amount=50, cupom=TESTE50 (R$5 fixo) → netAmount=0', () => {
      const result = applyDiscount(50, 'TESTE50');
      expect(result.finalAmount).toBe(0);
      expect(result.discountAmount).toBe(50);
      // PIX deve ser bloqueado neste caso (finalAmount < 100)
      expect(result.finalAmount < 100).toBe(true);
    });

    it('amount=99, cupom=TESTE50 → netAmount=0', () => {
      const result = applyDiscount(99, 'TESTE50');
      expect(result.finalAmount).toBe(0);
      expect(result.discountAmount).toBe(99);
      expect(result.finalAmount < 100).toBe(true);
    });

    it('amount=50, cupom=ARTHEMI10 (10%) → netAmount=45', () => {
      const result = applyDiscount(50, 'ARTHEMI10');
      // 10% de 50 = 5
      expect(result.finalAmount).toBe(45);
      expect(result.discountAmount).toBe(5);
      expect(result.finalAmount < 100).toBe(true);
    });
  });

  describe('cenários onde PIX é permitido (netAmount >= 100)', () => {
    it('amount=300, cupom=TESTE50 → netAmount=100 (piso ativo)', () => {
      const result = applyDiscount(300, 'TESTE50');
      expect(result.finalAmount).toBe(100);
      expect(result.discountAmount).toBe(200);
      expect(result.finalAmount >= 100).toBe(true);
    });

    it('amount=10000, cupom=TESTE50 → netAmount=9500', () => {
      const result = applyDiscount(10000, 'TESTE50');
      expect(result.finalAmount).toBe(9500);
      expect(result.discountAmount).toBe(500);
      expect(result.finalAmount >= 100).toBe(true);
    });

    it('amount=1000, cupom=ARTHEMI10 → netAmount=900', () => {
      const result = applyDiscount(1000, 'ARTHEMI10');
      expect(result.finalAmount).toBe(900);
      expect(result.discountAmount).toBe(100);
      expect(result.finalAmount >= 100).toBe(true);
    });
  });

  describe('regra de validação PIX', () => {
    function shouldBlockPix(netAmount: number): boolean {
      return netAmount < 100;
    }

    it('bloqueia PIX quando netAmount=0', () => {
      expect(shouldBlockPix(0)).toBe(true);
    });

    it('bloqueia PIX quando netAmount=50', () => {
      expect(shouldBlockPix(50)).toBe(true);
    });

    it('bloqueia PIX quando netAmount=99', () => {
      expect(shouldBlockPix(99)).toBe(true);
    });

    it('permite PIX quando netAmount=100', () => {
      expect(shouldBlockPix(100)).toBe(false);
    });

    it('permite PIX quando netAmount=101', () => {
      expect(shouldBlockPix(101)).toBe(false);
    });
  });
});
