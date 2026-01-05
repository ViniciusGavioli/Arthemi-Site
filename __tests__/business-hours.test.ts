// ===========================================================
// Testes de Horário de Funcionamento (Business Hours)
// ===========================================================
// Valida que reservas fora do horário de funcionamento são bloqueadas
// Seg-Sex: 08:00-20:00 | Sáb: 08:00-12:00 | Dom: Fechado

import { 
  isBookingWithinBusinessHours,
  getBusinessHoursForDate,
  BUSINESS_HOURS 
} from '../src/lib/business-hours';

// Helper para criar datas em dias específicos da semana
// 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
function getNextDayOfWeek(dayOfWeek: number): Date {
  const date = new Date();
  const currentDay = date.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilTarget);
  date.setHours(0, 0, 0, 0);
  return date;
}

describe('BUSINESS_HOURS constants', () => {
  it('deve ter horários corretos para dias úteis (Seg-Sex)', () => {
    expect(BUSINESS_HOURS.weekday.start).toBe(8);
    expect(BUSINESS_HOURS.weekday.end).toBe(20);
  });

  it('deve ter horários corretos para sábado', () => {
    expect(BUSINESS_HOURS.saturday.start).toBe(8);
    expect(BUSINESS_HOURS.saturday.end).toBe(12);
  });

  it('deve estar fechado no domingo', () => {
    expect(BUSINESS_HOURS.sunday).toBeNull();
  });
});

describe('getBusinessHoursForDate', () => {
  it('deve retornar horário de dia útil para segunda-feira', () => {
    const monday = getNextDayOfWeek(1);
    const hours = getBusinessHoursForDate(monday);
    expect(hours).toEqual({ start: 8, end: 20 });
  });

  it('deve retornar horário de dia útil para sexta-feira', () => {
    const friday = getNextDayOfWeek(5);
    const hours = getBusinessHoursForDate(friday);
    expect(hours).toEqual({ start: 8, end: 20 });
  });

  it('deve retornar horário de sábado', () => {
    const saturday = getNextDayOfWeek(6);
    const hours = getBusinessHoursForDate(saturday);
    expect(hours).toEqual({ start: 8, end: 12 });
  });

  it('deve retornar null para domingo (fechado)', () => {
    const sunday = getNextDayOfWeek(0);
    const hours = getBusinessHoursForDate(sunday);
    expect(hours).toBeNull();
  });
});

describe('isBookingWithinBusinessHours - Dias úteis (Seg-Sex)', () => {
  const weekday = getNextDayOfWeek(3); // Quarta-feira

  it('deve PERMITIR reserva 08:00-09:00 (primeiro horário)', () => {
    const start = new Date(weekday);
    start.setHours(8, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(9, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve PERMITIR reserva 19:00-20:00 (último horário)', () => {
    const start = new Date(weekday);
    start.setHours(19, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(20, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve PERMITIR reserva 10:00-14:00 (múltiplas horas)', () => {
    const start = new Date(weekday);
    start.setHours(10, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(14, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve REJEITAR reserva 07:00-08:00 (antes da abertura)', () => {
    const start = new Date(weekday);
    start.setHours(7, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(8, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 20:00-21:00 (após fechamento)', () => {
    const start = new Date(weekday);
    start.setHours(20, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(21, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 19:00-21:00 (ultrapassa fechamento)', () => {
    const start = new Date(weekday);
    start.setHours(19, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(21, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 06:00-22:00 (ultrapassa ambos)', () => {
    const start = new Date(weekday);
    start.setHours(6, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(22, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });
});

describe('isBookingWithinBusinessHours - Sábado', () => {
  const saturday = getNextDayOfWeek(6);

  it('deve PERMITIR reserva 08:00-09:00 (primeiro horário)', () => {
    const start = new Date(saturday);
    start.setHours(8, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(9, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve PERMITIR reserva 11:00-12:00 (último horário)', () => {
    const start = new Date(saturday);
    start.setHours(11, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(12, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve PERMITIR reserva 08:00-12:00 (expediente completo)', () => {
    const start = new Date(saturday);
    start.setHours(8, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(12, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve REJEITAR reserva 12:00-13:00 (após fechamento)', () => {
    const start = new Date(saturday);
    start.setHours(12, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(13, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 11:00-14:00 (ultrapassa fechamento)', () => {
    const start = new Date(saturday);
    start.setHours(11, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(14, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 15:00-16:00 (completamente fora)', () => {
    const start = new Date(saturday);
    start.setHours(15, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(16, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 07:00-08:00 (antes da abertura)', () => {
    const start = new Date(saturday);
    start.setHours(7, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(8, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });
});

describe('isBookingWithinBusinessHours - Domingo (fechado)', () => {
  const sunday = getNextDayOfWeek(0);

  it('deve REJEITAR reserva 08:00-09:00', () => {
    const start = new Date(sunday);
    start.setHours(8, 0, 0, 0);
    const end = new Date(sunday);
    end.setHours(9, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva 10:00-14:00', () => {
    const start = new Date(sunday);
    start.setHours(10, 0, 0, 0);
    const end = new Date(sunday);
    end.setHours(14, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });

  it('deve REJEITAR qualquer horário no domingo', () => {
    const start = new Date(sunday);
    start.setHours(12, 0, 0, 0);
    const end = new Date(sunday);
    end.setHours(13, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(false);
  });
});

describe('isBookingWithinBusinessHours - Edge Cases', () => {
  // Nota: Validação de endAt <= startAt é feita ANTES de chamar isBookingWithinBusinessHours
  // no endpoint /api/bookings (linha 160-165), então não testamos aqui

  it('deve PERMITIR reserva exatamente no horário de fechamento (19:00-20:00 dia útil)', () => {
    const weekday = getNextDayOfWeek(2); // Terça
    const start = new Date(weekday);
    start.setHours(19, 0, 0, 0);
    const end = new Date(weekday);
    end.setHours(20, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });

  it('deve PERMITIR reserva exatamente no horário de abertura (08:00-09:00 sábado)', () => {
    const saturday = getNextDayOfWeek(6);
    const start = new Date(saturday);
    start.setHours(8, 0, 0, 0);
    const end = new Date(saturday);
    end.setHours(9, 0, 0, 0);
    
    expect(isBookingWithinBusinessHours(start, end)).toBe(true);
  });
});
