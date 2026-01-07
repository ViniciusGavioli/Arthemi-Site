// ===========================================================
// Testes: Preços de Weekday vs Saturday
// ===========================================================
// Cobertura: helper pricing + backend pago + backend créditos

import {
  isSaturday,
  getRoomKeyFromId,
  getRoomHourlyPriceByDate,
  getBookingTotalByDate,
  getBookingTotalCentsByDate,
  getPricingInfoForUI,
} from '@/lib/pricing';
import { computeCreditAmountCents } from '@/lib/credits';
import { PRICES_V3 } from '@/constants/prices';

describe('Pricing Helper - Weekday vs Saturday', () => {
  // IMPORTANTE: Usar datas com timezone Brasil (-03:00) para precisão
  // new Date('2025-01-15') cria em UTC; no Brasil é 2025-01-14 21:00 (terça)
  const weekdayDate = new Date('2025-01-15T10:00:00-03:00'); // Quarta-feira em Brasil
  const saturdayDate = new Date('2025-01-18T10:00:00-03:00'); // Sábado em Brasil

  describe('isSaturday', () => {
    it('deve retornar false para sexta-feira', () => {
      const friday = new Date('2025-01-17T10:00:00-03:00');
      expect(isSaturday(friday)).toBe(false);
    });

    it('deve retornar true para sábado', () => {
      expect(isSaturday(saturdayDate)).toBe(true);
    });

    it('deve retornar false para domingo', () => {
      const sunday = new Date('2025-01-19T10:00:00-03:00');
      expect(isSaturday(sunday)).toBe(false);
    });
  });

  describe('getRoomKeyFromId', () => {
    it('deve mapear slug sala-a para SALA_A', () => {
      const key = getRoomKeyFromId('room-123', 'sala-a');
      expect(key).toBe('SALA_A');
    });

    it('deve mapear slug sala-b para SALA_B', () => {
      const key = getRoomKeyFromId('room-456', 'sala-b');
      expect(key).toBe('SALA_B');
    });

    it('deve mapear slug sala-c para SALA_C', () => {
      const key = getRoomKeyFromId('room-789', 'sala-c');
      expect(key).toBe('SALA_C');
    });

    it('deve retornar null para slug inválido', () => {
      const key = getRoomKeyFromId('room-xxx', 'sala-inexistente');
      expect(key).toBeNull();
    });
  });

  describe('getRoomHourlyPriceByDate', () => {
    it('deve retornar preço de dia útil para quarta-feira (SALA_A)', () => {
      const price = getRoomHourlyPriceByDate('room-123', weekdayDate, 'sala-a');
      expect(price).toBe(PRICES_V3.SALA_A.prices.HOURLY_RATE);
      expect(price).toBe(59.99);
    });

    it('deve retornar preço de sábado para sábado (SALA_A)', () => {
      const price = getRoomHourlyPriceByDate('room-123', saturdayDate, 'sala-a');
      expect(price).toBe(PRICES_V3.SALA_A.prices.SATURDAY_HOUR);
      expect(price).toBe(64.99);
    });

    it('deve retornar preço de sábado diferente para SALA_B', () => {
      const satPrice = getRoomHourlyPriceByDate('room-456', saturdayDate, 'sala-b');
      const weekPrice = getRoomHourlyPriceByDate('room-456', weekdayDate, 'sala-b');
      expect(satPrice).toBe(PRICES_V3.SALA_B.prices.SATURDAY_HOUR); // 53.99
      expect(weekPrice).toBe(PRICES_V3.SALA_B.prices.HOURLY_RATE); // 49.99
      expect(satPrice).toBeGreaterThan(weekPrice);
    });

    it('deve retornar preço de sábado diferente para SALA_C', () => {
      const satPrice = getRoomHourlyPriceByDate('room-789', saturdayDate, 'sala-c');
      const weekPrice = getRoomHourlyPriceByDate('room-789', weekdayDate, 'sala-c');
      expect(satPrice).toBe(PRICES_V3.SALA_C.prices.SATURDAY_HOUR); // 42.99
      expect(weekPrice).toBe(PRICES_V3.SALA_C.prices.HOURLY_RATE); // 39.99
      expect(satPrice).toBeGreaterThan(weekPrice);
    });

    it('deve lançar erro para sala não mapeada', () => {
      expect(() => {
        getRoomHourlyPriceByDate('room-invalid', weekdayDate, 'sala-inexistente');
      }).toThrow();
    });
  });

  describe('getBookingTotalByDate', () => {
    it('deve calcular total correto para 3h em dia útil (SALA_A)', () => {
      const total = getBookingTotalByDate('room-123', weekdayDate, 3, 'sala-a');
      const expected = 59.99 * 3; // 179.97
      expect(total).toBeCloseTo(expected, 2);
    });

    it('deve calcular total diferente para 3h em sábado (SALA_A)', () => {
      const satTotal = getBookingTotalByDate('room-123', saturdayDate, 3, 'sala-a');
      const weekTotal = getBookingTotalByDate('room-123', weekdayDate, 3, 'sala-a');
      const satExpected = 64.99 * 3; // 194.97
      const weekExpected = 59.99 * 3; // 179.97
      expect(satTotal).toBeCloseTo(satExpected, 2);
      expect(weekTotal).toBeCloseTo(weekExpected, 2);
      expect(satTotal).toBeGreaterThan(weekTotal);
    });

    it('deve calcular total para 5h em sábado (SALA_C)', () => {
      const total = getBookingTotalByDate('room-789', saturdayDate, 5, 'sala-c');
      const expected = 42.99 * 5; // 214.95
      expect(total).toBeCloseTo(expected, 2);
    });
  });

  describe('getBookingTotalCentsByDate', () => {
    it('deve retornar valor em centavos (3h dia útil SALA_A)', () => {
      const cents = getBookingTotalCentsByDate('room-123', weekdayDate, 3, 'sala-a');
      const expected = Math.round(59.99 * 3 * 100); // 17997
      expect(cents).toBe(expected);
    });

    it('deve retornar valor em centavos (3h sábado SALA_A)', () => {
      const cents = getBookingTotalCentsByDate('room-123', saturdayDate, 3, 'sala-a');
      const expected = Math.round(64.99 * 3 * 100); // 19497
      expect(cents).toBe(expected);
    });

    it('deve manter precisão de centavos para valores decimais', () => {
      const cents = getBookingTotalCentsByDate('room-456', weekdayDate, 2, 'sala-b');
      // 49.99 * 2 = 99.98
      const expected = Math.round(49.99 * 2 * 100); // 9998
      expect(cents).toBe(expected);
    });
  });

  describe('getPricingInfoForUI', () => {
    it('deve retornar preço de dia útil sem data selecionada (em CENTAVOS)', () => {
      const info = getPricingInfoForUI('room-123', null, 'sala-a');
      expect(info.hourlyPrice).toBe(5999); // 59.99 * 100 = 5999 centavos
      expect(info.isSaturday).toBe(false);
      expect(info.label).toBe('Preço por hora');
    });

    it('deve retornar preço de dia útil para quarta-feira (em CENTAVOS)', () => {
      const info = getPricingInfoForUI('room-123', weekdayDate, 'sala-a');
      expect(info.hourlyPrice).toBe(5999); // 59.99 * 100 = 5999 centavos
      expect(info.isSaturday).toBe(false);
      expect(info.label).toBe('Preço por hora');
    });

    it('deve retornar preço de sábado com label especial (em CENTAVOS)', () => {
      const info = getPricingInfoForUI('room-123', saturdayDate, 'sala-a');
      expect(info.hourlyPrice).toBe(6499); // 64.99 * 100 = 6499 centavos
      expect(info.isSaturday).toBe(true);
      expect(info.label).toContain('Sábado');
    });

    it('deve retornar label diferente para cada sala no sábado', () => {
      const infoA = getPricingInfoForUI('room-123', saturdayDate, 'sala-a');
      const infoB = getPricingInfoForUI('room-456', saturdayDate, 'sala-b');
      // Ambos devem ter sábado, mas preços diferentes
      expect(infoA.isSaturday).toBe(true);
      expect(infoB.isSaturday).toBe(true);
      expect(infoA.hourlyPrice).toBeGreaterThan(infoB.hourlyPrice); // 6499 > 5399 centavos
    });
  });

  describe('Consistência UI x Backend', () => {
    it('preço exibido no UI deve bater com valor cobrado no backend (weekday)', () => {
      const roomId = 'room-123';
      const slug = 'sala-a';
      const date = weekdayDate;
      const hours = 3;

      const uiPriceCents = getPricingInfoForUI(roomId, date, slug).hourlyPrice;
      const backendTotalReais = getBookingTotalByDate(roomId, date, hours, slug);
      const backendTotalCents = Math.round(backendTotalReais * 100);

      expect(uiPriceCents * hours).toBe(backendTotalCents);
    });

    it('preço exibido no UI deve bater com valor cobrado no backend (saturday)', () => {
      const roomId = 'room-456';
      const slug = 'sala-b';
      const date = saturdayDate;
      const hours = 2;

      const uiPriceCents = getPricingInfoForUI(roomId, date, slug).hourlyPrice;
      const backendTotalReais = getBookingTotalByDate(roomId, date, hours, slug);
      const backendTotalCents = Math.round(backendTotalReais * 100);

      expect(uiPriceCents * hours).toBe(backendTotalCents);
    });

    it('backend pago deve usar mesmo preço que créditos (weekday)', () => {
      const roomId = 'room-789';
      const slug = 'sala-c';
      const date = weekdayDate;
      const hours = 4;

      const pagoTotal = getBookingTotalByDate(roomId, date, hours, slug);
      const creditoCents = getBookingTotalCentsByDate(roomId, date, hours, slug);
      const creditoReais = creditoCents / 100;

      expect(pagoTotal).toBeCloseTo(creditoReais, 2);
    });

    it('backend pago deve usar mesmo preço que créditos (saturday)', () => {
      const roomId = 'room-123';
      const slug = 'sala-a';
      const date = saturdayDate;
      const hours = 2;

      const pagoTotal = getBookingTotalByDate(roomId, date, hours, slug);
      const creditoCents = getBookingTotalCentsByDate(roomId, date, hours, slug);
      const creditoReais = creditoCents / 100;

      expect(pagoTotal).toBeCloseTo(creditoReais, 2);
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com 1 hora em sábado', () => {
      const total = getBookingTotalByDate('room-123', saturdayDate, 1, 'sala-a');
      expect(total).toBe(64.99);
    });

    it('deve lidar com múltiplas horas em sábado', () => {
      const total = getBookingTotalByDate('room-456', saturdayDate, 6, 'sala-b');
      const expected = 53.99 * 6; // 323.94
      expect(total).toBeCloseTo(expected, 2);
    });

    it('deve manter precisão com arredondamento de centavos', () => {
      const cents1 = getBookingTotalCentsByDate('room-123', weekdayDate, 1, 'sala-a');
      const cents3 = getBookingTotalCentsByDate('room-123', weekdayDate, 3, 'sala-a');
      
      // 3x o valor deve ser próximo (com margem de erro de centavo)
      expect(Math.abs(cents3 - cents1 * 3)).toBeLessThanOrEqual(2);
    });
  });

  describe('credits/purchase.ts - computeCreditAmountCents (Anti-Regressão)', () => {
    it('ANTI-REGRESSÃO: produto (não horas) → creditAmount = amount (centavos, não * 100)', () => {
      // BUG histórico: creditAmount = Math.round(amount * 100) → 100x maior
      // FIX: creditAmount = amount
      // Este teste FALHA se alguém reintroduzir "amount * 100"
      
      const productPriceCents = 5999; // R$ 59.99 em centavos (Product.price)
      const roomId = 'room-123';
      const roomSlug = 'sala-a';
      
      // Chamar a função REAL de computeCreditAmountCents
      const creditAmount = computeCreditAmountCents({
        amountCents: productPriceCents,
        isHoursPurchase: false, // ← Branch de PRODUTO (não horas)
        roomId,
        creditHours: 0, // ignorado quando isHoursPurchase=false
        roomSlug,
      });
      
      // Assertion 1: creditAmount deve ser IGUAL a amount (não multiplicado)
      expect(creditAmount).toBe(productPriceCents);
      
      // Assertion 2: Falha se creditAmount virar 100x (detecta regressão)
      expect(creditAmount).not.toBe(productPriceCents * 100);
      
      // Assertion 3: Unidade = centavos
      expect(creditAmount).toBe(5999);
      expect(creditAmount / 100).toBeCloseTo(59.99, 2);
    });

    it('ANTI-REGRESSÃO: horas (data.hours) → creditAmount usa helper * 100 (determinístico)', () => {
      // Horas avulsas sempre usam helper → Math.round(getBookingTotalByDate * 100)
      // Este teste FALHA se alguém remover o "* 100" ou o helper
      // Usa `now` determinístico para reproducibilidade
      
      const roomId = 'room-123';
      const roomSlug = 'sala-a';
      const creditHours = 3;
      const referenceDate = new Date('2025-01-15T12:00:00-03:00'); // Quarta-feira determinística
      
      // Chamar a função REAL de computeCreditAmountCents com `now` fixo
      const creditAmount = computeCreditAmountCents({
        amountCents: 0, // ignorado quando isHoursPurchase=true
        isHoursPurchase: true, // ← Branch de HORAS
        roomId,
        creditHours,
        roomSlug,
        now: referenceDate, // ← Determinístico
      });
      
      // Verification: resultado deve estar em centavos (inteiro)
      expect(typeof creditAmount).toBe('number');
      expect(Number.isInteger(creditAmount)).toBe(true);
      
      // Verification: resultado deve ser > 0
      expect(creditAmount).toBeGreaterThan(0);
      
      // Verification: magnitude razoável (menor que 1 dia de aluguel = ~500 reais = 50000 centavos)
      expect(creditAmount).toBeLessThan(100000);
      
      // Verification: consistência com helper (usando mesma data)
      const directHelper = getBookingTotalCentsByDate(roomId, referenceDate, creditHours, roomSlug);
      expect(creditAmount).toBe(directHelper);
    });
  });
});


