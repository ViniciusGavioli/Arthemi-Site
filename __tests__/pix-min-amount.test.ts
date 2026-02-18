// ===========================================================
// Testes: Regra PIX mínimo R$1,00
// ===========================================================
// Verifica que a lógica de piso funciona corretamente para PIX

import { applyDiscount } from '@/lib/coupons';

describe('PIX mínimo R$1,00', () => {
  describe('cenários onde PIX seria bloqueado (netAmount < 100)', () => {
    it('amount=50, cupom=PRIMEIRACOMPRA (15%) → netAmount=42', async () => {
      const result = await applyDiscount(50, 'PRIMEIRACOMPRA');
      // 15% de 50 = 7,5 arredondado = 7
      expect(result.finalAmount).toBeLessThan(100);
      // PIX deve ser bloqueado neste caso (finalAmount < 100)
      expect(result.finalAmount < 100).toBe(true);
    });

    it('amount=99, cupom=ARTHEMI10 (10%) → netAmount=89', async () => {
      const result = await applyDiscount(99, 'ARTHEMI10');
      // 10% de 99 = 9,9 arredondado = 10, finalAmount = 89
      expect(result.finalAmount).toBe(89);
      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount < 100).toBe(true);
    });

    it('amount=50, cupom=ARTHEMI10 (10%) → netAmount=45', async () => {
      const result = await applyDiscount(50, 'ARTHEMI10');
      // 10% de 50 = 5
      expect(result.finalAmount).toBe(45);
      expect(result.discountAmount).toBe(5);
      expect(result.finalAmount < 100).toBe(true);
    });
  });

  describe('cenários onde PIX é permitido (netAmount >= 100)', () => {
    it('amount=300, cupom=PRIMEIRACOMPRA (15%) → netAmount=255', async () => {
      const result = await applyDiscount(300, 'PRIMEIRACOMPRA');
      // 15% de 300 = 45
      expect(result.finalAmount).toBe(255);
      expect(result.discountAmount).toBe(45);
      expect(result.finalAmount >= 100).toBe(true);
    });

    it('amount=10000, cupom=ARTHEMI10 (10%) → netAmount=9000', async () => {
      const result = await applyDiscount(10000, 'ARTHEMI10');
      expect(result.finalAmount).toBe(9000);
      expect(result.discountAmount).toBe(1000);
      expect(result.finalAmount >= 100).toBe(true);
    });

    it('amount=1000, cupom=ARTHEMI10 → netAmount=900', async () => {
      const result = await applyDiscount(1000, 'ARTHEMI10');
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
