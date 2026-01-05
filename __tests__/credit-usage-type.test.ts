// ===========================================================
// Testes: CreditUsageType Validation
// ===========================================================

import {
  validateCreditUsage,
  isCreditCompatibleWithBooking,
} from '@/lib/business-rules';
import type { Credit } from '@prisma/client';
import { setDay } from 'date-fns';

// Helper para criar crédito mock
function createMockCredit(overrides: Partial<Credit> = {}): Credit {
  return {
    id: 'test-credit-id',
    userId: 'test-user-id',
    roomId: null,
    amount: 10000,
    remainingAmount: 10000,
    type: 'MANUAL',
    usageType: null, // Default: legado
    status: 'CONFIRMED',
    subletRequestId: null,
    sourceBookingId: null,
    referenceMonth: 1,
    referenceYear: 2026,
    expiresAt: null,
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Credit;
}

// Helper para criar datas com dia da semana e horário específicos
function createDateTime(dayOfWeek: number, startHour: number, endHour: number) {
  const baseDate = setDay(new Date(), dayOfWeek, { weekStartsOn: 0 });
  
  const start = new Date(baseDate);
  start.setHours(startHour, 0, 0, 0);
  
  const end = new Date(baseDate);
  end.setHours(endHour, 0, 0, 0);
  
  return { start, end };
}

describe('validateCreditUsage', () => {
  describe('Crédito LEGADO (usageType = null)', () => {
    it('deve PERMITIR reserva de 1h em dia útil', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const { start, end } = createDateTime(1, 10, 11); // Segunda 10-11h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve PERMITIR reserva de 4h em dia útil (comportamento atual)', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const { start, end } = createDateTime(1, 8, 12); // Segunda 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve PERMITIR reserva de 8h em dia útil (comportamento atual)', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const { start, end } = createDateTime(1, 8, 16); // Segunda 08-16h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('crédito não-SATURDAY legado deve REJEITAR reserva em sábado', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const { start, end } = createDateTime(6, 9, 10); // Sábado 09-10h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_REQUIRES_SATURDAY_CREDIT');
    });

    it('crédito SATURDAY legado deve PERMITIR reserva em sábado', () => {
      const credit = createMockCredit({ usageType: null, type: 'SATURDAY' });
      const { start, end } = createDateTime(6, 9, 10); // Sábado 09-10h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('crédito SATURDAY legado deve REJEITAR reserva em dia útil', () => {
      const credit = createMockCredit({ usageType: null, type: 'SATURDAY' });
      const { start, end } = createDateTime(1, 10, 11); // Segunda 10-11h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_CREDIT_WRONG_DAY');
    });
  });

  describe('Crédito HOURLY (usageType = HOURLY)', () => {
    it('deve PERMITIR reserva de 1h em dia útil', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const { start, end } = createDateTime(1, 10, 11); // Segunda 10-11h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve REJEITAR reserva de 2h', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const { start, end } = createDateTime(1, 10, 12); // Segunda 10-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('HOURLY_MUST_BE_1H');
    });

    it('deve REJEITAR reserva de 4h', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const { start, end } = createDateTime(1, 8, 12); // Segunda 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('HOURLY_MUST_BE_1H');
    });

    it('deve REJEITAR reserva em sábado', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const { start, end } = createDateTime(6, 9, 10); // Sábado 09-10h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('HOURLY_NOT_ON_SATURDAY');
    });
  });

  describe('Crédito SHIFT (usageType = SHIFT)', () => {
    it('deve PERMITIR bloco 08-12 em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(1, 8, 12); // Segunda 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve PERMITIR bloco 12-16 em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(2, 12, 16); // Terça 12-16h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve PERMITIR bloco 16-20 em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(3, 16, 20); // Quarta 16-20h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve REJEITAR bloco 09-13 (não alinhado)', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(1, 9, 13);
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SHIFT_INVALID_BLOCK');
    });

    it('deve REJEITAR bloco 14-18 (antigo AFTERNOON)', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(1, 14, 18);
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SHIFT_INVALID_BLOCK');
    });

    it('deve REJEITAR reserva de 1h', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(1, 10, 11);
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SHIFT_INVALID_BLOCK');
    });

    it('deve REJEITAR reserva em sábado', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const { start, end } = createDateTime(6, 8, 12); // Sábado 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SHIFT_NOT_ON_SATURDAY');
    });
  });

  describe('Crédito SATURDAY_HOURLY (usageType = SATURDAY_HOURLY)', () => {
    it('deve PERMITIR reserva de 1h em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const { start, end } = createDateTime(6, 9, 10); // Sábado 09-10h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve REJEITAR reserva de 2h em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const { start, end } = createDateTime(6, 9, 11); // Sábado 09-11h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_HOURLY_MUST_BE_1H');
    });

    it('deve REJEITAR reserva em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const { start, end } = createDateTime(1, 10, 11); // Segunda 10-11h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_HOURLY_WRONG_DAY');
    });
  });

  describe('Crédito SATURDAY_SHIFT (usageType = SATURDAY_SHIFT)', () => {
    it('deve PERMITIR bloco 08-12 em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const { start, end } = createDateTime(6, 8, 12); // Sábado 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(true);
    });

    it('deve REJEITAR reserva de 1h em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const { start, end } = createDateTime(6, 9, 10); // Sábado 09-10h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_SHIFT_INVALID_BLOCK');
    });

    it('deve REJEITAR reserva em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const { start, end } = createDateTime(1, 8, 12); // Segunda 08-12h
      
      const result = validateCreditUsage(credit, start, end);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SATURDAY_SHIFT_WRONG_DAY');
    });
  });
});

describe('isCreditCompatibleWithBooking', () => {
  describe('Crédito LEGADO', () => {
    it('crédito MANUAL legado: compatível com hora em dia útil', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(true);
    });

    it('crédito MANUAL legado: compatível com turno em dia útil', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(true);
    });

    it('crédito MANUAL legado: NÃO compatível com sábado', () => {
      const credit = createMockCredit({ usageType: null, type: 'MANUAL' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });

    it('crédito SATURDAY legado: compatível com sábado', () => {
      const credit = createMockCredit({ usageType: null, type: 'SATURDAY' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(true);
    });

    it('crédito SATURDAY legado: NÃO compatível com dia útil', () => {
      const credit = createMockCredit({ usageType: null, type: 'SATURDAY' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });
  });

  describe('Crédito HOURLY', () => {
    it('compatível com hora em dia útil', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(true);
    });

    it('NÃO compatível com turno em dia útil', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(false);
    });

    it('NÃO compatível com sábado', () => {
      const credit = createMockCredit({ usageType: 'HOURLY' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });
  });

  describe('Crédito SHIFT', () => {
    it('compatível com turno em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(true);
    });

    it('NÃO compatível com hora em dia útil', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });

    it('NÃO compatível com sábado', () => {
      const credit = createMockCredit({ usageType: 'SHIFT' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(false);
    });
  });

  describe('Crédito SATURDAY_HOURLY', () => {
    it('compatível com hora em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(true);
    });

    it('NÃO compatível com turno em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(false);
    });

    it('NÃO compatível com dia útil', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_HOURLY' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });
  });

  describe('Crédito SATURDAY_SHIFT', () => {
    it('compatível com turno em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(true);
    });

    it('NÃO compatível com hora em sábado', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const bookingDate = setDay(new Date(), 6); // Sábado
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, false)).toBe(false);
    });

    it('NÃO compatível com dia útil', () => {
      const credit = createMockCredit({ usageType: 'SATURDAY_SHIFT' });
      const bookingDate = setDay(new Date(), 1); // Segunda
      
      expect(isCreditCompatibleWithBooking(credit, bookingDate, true)).toBe(false);
    });
  });
});
