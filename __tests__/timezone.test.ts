// ===========================================================
// Testes: Timezone e Business Hours (P-010)
// ===========================================================
// Testes unitários para business-hours.ts
// 
// Execute: npm test -- timezone.test.ts

import {
  getHourInBrazil,
  getDayOfWeekInBrazil,
  createDateInBrazilTimezone,
  SYSTEM_TIMEZONE,
  BUSINESS_HOURS,
} from '../src/lib/business-hours';

// ============================================================
// TESTES: TIMEZONE BRASIL
// ============================================================

describe('Timezone Functions (P-010)', () => {
  describe('SYSTEM_TIMEZONE', () => {
    test('deve ser America/Sao_Paulo', () => {
      expect(SYSTEM_TIMEZONE).toBe('America/Sao_Paulo');
    });
  });

  describe('getHourInBrazil', () => {
    test('deve extrair hora corretamente', () => {
      // Cria uma data específica
      const date = new Date('2025-01-15T15:30:00Z'); // 15:30 UTC = 12:30 São Paulo (sem horário de verão)
      const hour = getHourInBrazil(date);
      
      // Hora em São Paulo (UTC-3)
      expect(hour).toBe(12);
    });

    test('deve funcionar com qualquer hora', () => {
      const date = new Date('2025-01-15T03:00:00Z'); // 03:00 UTC = 00:00 São Paulo
      const hour = getHourInBrazil(date);
      expect(hour).toBe(0);
    });
  });

  describe('getDayOfWeekInBrazil', () => {
    test('deve retornar 0 para domingo', () => {
      // 2025-01-19 é domingo
      const date = new Date('2025-01-19T12:00:00Z');
      expect(getDayOfWeekInBrazil(date)).toBe(0);
    });

    test('deve retornar 6 para sábado', () => {
      // 2025-01-18 é sábado
      const date = new Date('2025-01-18T12:00:00Z');
      expect(getDayOfWeekInBrazil(date)).toBe(6);
    });

    test('deve retornar 1 para segunda', () => {
      // 2025-01-20 é segunda
      const date = new Date('2025-01-20T12:00:00Z');
      expect(getDayOfWeekInBrazil(date)).toBe(1);
    });
  });

  describe('createDateInBrazilTimezone', () => {
    test('deve criar data com hora correta em São Paulo', () => {
      const date = createDateInBrazilTimezone('2025-01-15', 10, 0);
      
      // Verifica que a hora em São Paulo é 10:00
      const hourInBrazil = getHourInBrazil(date);
      expect(hourInBrazil).toBe(10);
    });

    test('deve funcionar com diferentes horas', () => {
      const date8h = createDateInBrazilTimezone('2025-01-15', 8, 0);
      const date12h = createDateInBrazilTimezone('2025-01-15', 12, 0);
      const date18h = createDateInBrazilTimezone('2025-01-15', 18, 0);
      
      expect(getHourInBrazil(date8h)).toBe(8);
      expect(getHourInBrazil(date12h)).toBe(12);
      expect(getHourInBrazil(date18h)).toBe(18);
    });

    test('deve manter a data correta ao cruzar meia-noite UTC', () => {
      // 22:00 em São Paulo = 01:00 UTC do dia seguinte
      const date = createDateInBrazilTimezone('2025-01-15', 22, 0);
      
      const hourInBrazil = getHourInBrazil(date);
      expect(hourInBrazil).toBe(22);
    });

    test('deve aceitar formato ISO completo', () => {
      const date = createDateInBrazilTimezone('2025-01-15T00:00:00.000Z', 14, 30);
      
      const hourInBrazil = getHourInBrazil(date);
      expect(hourInBrazil).toBe(14);
    });
  });
});

// ============================================================
// TESTES: HORÁRIOS DE FUNCIONAMENTO
// ============================================================

describe('Business Hours', () => {
  test('horário de semana: 08:00 - 20:00', () => {
    expect(BUSINESS_HOURS.weekday.start).toBe(8);
    expect(BUSINESS_HOURS.weekday.end).toBe(20);
  });

  test('horário de sábado: 08:00 - 12:00', () => {
    expect(BUSINESS_HOURS.saturday.start).toBe(8);
    expect(BUSINESS_HOURS.saturday.end).toBe(12);
  });

  test('domingo fechado', () => {
    expect(BUSINESS_HOURS.sunday).toBeNull();
  });
});
