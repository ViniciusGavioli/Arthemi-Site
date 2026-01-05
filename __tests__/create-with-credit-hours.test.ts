// ===========================================================
// Testes de consistência de horário: create-with-credit vs availability
// ===========================================================
// Garante que create-with-credit usa as MESMAS regras que availability

import { 
  isBookingWithinBusinessHours,
  getBusinessHoursForDate,
  getHourInBrazil,
  getDayOfWeekInBrazil,
  SYSTEM_TIMEZONE,
} from '../src/lib/business-hours';

// Helper para criar datas no timezone do Brasil
function createBrazilDate(year: number, month: number, day: number, hour: number): Date {
  // Cria ISO string no formato que seria enviado pelo frontend
  const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000-03:00`;
  return new Date(isoString);
}

// Helper para criar datas em dias específicos da semana
function getNextDayOfWeek(dayOfWeek: number): Date {
  const date = new Date();
  const currentDay = date.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilTarget);
  date.setHours(12, 0, 0, 0); // Meio-dia para evitar problemas de DST
  return date;
}

describe('Timezone Functions', () => {
  it('deve extrair hora correta no Brasil para ISO string UTC', () => {
    // 18:00 no Brasil = 21:00 UTC
    const utcDate = new Date('2026-01-05T21:00:00.000Z');
    const hour = getHourInBrazil(utcDate);
    expect(hour).toBe(18);
  });

  it('deve extrair hora correta para horário de verão (se aplicável)', () => {
    // Teste com data que pode ter horário de verão
    const date = new Date('2026-01-05T12:00:00.000-03:00');
    const hour = getHourInBrazil(date);
    expect(hour).toBe(12);
  });

  it('deve identificar dia da semana corretamente no Brasil', () => {
    // Segunda-feira no Brasil
    const monday = new Date('2026-01-05T12:00:00.000-03:00'); // 5 de janeiro de 2026 é segunda
    expect(getDayOfWeekInBrazil(monday)).toBe(1);
  });
});

describe('isBookingWithinBusinessHours - Consistência com Timezone', () => {
  describe('Dia útil (segunda-feira)', () => {
    it('deve PERMITIR 18:00-19:00 quando enviado como UTC', () => {
      // Frontend envia: 18:00 Brasil = 21:00 UTC
      const start = new Date('2026-01-05T21:00:00.000Z'); // 18:00 Brasil (segunda)
      const end = new Date('2026-01-05T22:00:00.000Z');   // 19:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(true);
    });

    it('deve PERMITIR 19:00-20:00 quando enviado como UTC', () => {
      // 19:00 Brasil = 22:00 UTC
      const start = new Date('2026-01-05T22:00:00.000Z'); // 19:00 Brasil (segunda)
      const end = new Date('2026-01-05T23:00:00.000Z');   // 20:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(true);
    });

    it('deve REJEITAR 20:00-21:00 quando enviado como UTC', () => {
      // 20:00 Brasil = 23:00 UTC
      const start = new Date('2026-01-05T23:00:00.000Z'); // 20:00 Brasil (segunda)
      const end = new Date('2026-01-06T00:00:00.000Z');   // 21:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(false);
    });

    it('deve PERMITIR 08:00-09:00 quando enviado como UTC', () => {
      // 08:00 Brasil = 11:00 UTC
      const start = new Date('2026-01-05T11:00:00.000Z'); // 08:00 Brasil (segunda)
      const end = new Date('2026-01-05T12:00:00.000Z');   // 09:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(true);
    });

    it('deve REJEITAR 07:00-08:00 quando enviado como UTC', () => {
      // 07:00 Brasil = 10:00 UTC
      const start = new Date('2026-01-05T10:00:00.000Z'); // 07:00 Brasil (segunda)
      const end = new Date('2026-01-05T11:00:00.000Z');   // 08:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(false);
    });
  });

  describe('Sábado', () => {
    it('deve PERMITIR 11:00-12:00 quando enviado como UTC', () => {
      // 11:00 Brasil = 14:00 UTC (sábado 10/01/2026)
      const start = new Date('2026-01-10T14:00:00.000Z'); // 11:00 Brasil (sábado)
      const end = new Date('2026-01-10T15:00:00.000Z');   // 12:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(true);
    });

    it('deve REJEITAR 12:00-13:00 quando enviado como UTC', () => {
      // 12:00 Brasil = 15:00 UTC (sábado 10/01/2026)
      const start = new Date('2026-01-10T15:00:00.000Z'); // 12:00 Brasil (sábado)
      const end = new Date('2026-01-10T16:00:00.000Z');   // 13:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(false);
    });

    it('deve REJEITAR 18:00-19:00 no sábado (fora do expediente)', () => {
      // 18:00 Brasil = 21:00 UTC (sábado 10/01/2026)
      const start = new Date('2026-01-10T21:00:00.000Z'); // 18:00 Brasil (sábado)
      const end = new Date('2026-01-10T22:00:00.000Z');   // 19:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(false);
    });

    it('deve PERMITIR 08:00-12:00 (expediente completo sábado)', () => {
      // 08:00 Brasil = 11:00 UTC (sábado 10/01/2026)
      const start = new Date('2026-01-10T11:00:00.000Z'); // 08:00 Brasil (sábado)
      const end = new Date('2026-01-10T15:00:00.000Z');   // 12:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(true);
    });
  });

  describe('Domingo', () => {
    it('deve REJEITAR qualquer horário no domingo', () => {
      // 10:00 Brasil = 13:00 UTC (domingo 11/01/2026)
      const start = new Date('2026-01-11T13:00:00.000Z'); // 10:00 Brasil (domingo)
      const end = new Date('2026-01-11T14:00:00.000Z');   // 11:00 Brasil
      
      expect(isBookingWithinBusinessHours(start, end)).toBe(false);
    });
  });
});

describe('Cenário Real: Frontend envia ISO string', () => {
  it('simula requisição real do frontend para 18:00 em dia útil', () => {
    // O frontend faz:
    // const date = selectedDate; // Date object
    // date.setHours(18, 0, 0, 0);
    // startTime: date.toISOString()
    
    // Em um navegador no Brasil, isso gera:
    // "2026-01-05T21:00:00.000Z" (18:00 Brasil = 21:00 UTC)
    
    const startTimeFromFrontend = '2026-01-05T21:00:00.000Z';
    const endTimeFromFrontend = '2026-01-05T22:00:00.000Z';
    
    const start = new Date(startTimeFromFrontend);
    const end = new Date(endTimeFromFrontend);
    
    // DEVE SER VÁLIDO - 18:00-19:00 em dia útil
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('simula requisição real do frontend para 11:00 em sábado', () => {
    const startTimeFromFrontend = '2026-01-10T14:00:00.000Z'; // 11:00 Brasil
    const endTimeFromFrontend = '2026-01-10T15:00:00.000Z';   // 12:00 Brasil
    
    const start = new Date(startTimeFromFrontend);
    const end = new Date(endTimeFromFrontend);
    
    // DEVE SER VÁLIDO - 11:00-12:00 em sábado
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('simula requisição inválida para 12:00 em sábado', () => {
    const startTimeFromFrontend = '2026-01-10T15:00:00.000Z'; // 12:00 Brasil
    const endTimeFromFrontend = '2026-01-10T16:00:00.000Z';   // 13:00 Brasil
    
    const start = new Date(startTimeFromFrontend);
    const end = new Date(endTimeFromFrontend);
    
    // DEVE SER INVÁLIDO - 12:00-13:00 em sábado (fechado às 12)
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });
});
