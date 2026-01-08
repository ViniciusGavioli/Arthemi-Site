// ===========================================================
// Testes de Horário de Funcionamento (Business Hours)
// ===========================================================
// Valida que reservas fora do horário de funcionamento são bloqueadas
// Seg-Sex: 08:00-20:00 | Sáb: 08:00-12:00 | Dom: Fechado

import { 
  isBookingWithinBusinessHours,
  getBusinessHoursForDate,
  getHourOptionsForDate,
  isClosedDay,
  getValidDurations,
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

// ===========================================================
// getHourOptionsForDate - Opções de hora para UI
// ===========================================================
describe('getHourOptionsForDate - Opções de hora dinâmicas', () => {
  it('deve retornar [8,9,10,11,12,13,14,15,16,17,18,19] para dia útil (Seg-Sex)', () => {
    const monday = getNextDayOfWeek(1);
    const hours = getHourOptionsForDate(monday);
    expect(hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(hours.length).toBe(12);
  });

  it('deve retornar [8,9,10,11] para sábado', () => {
    const saturday = getNextDayOfWeek(6);
    const hours = getHourOptionsForDate(saturday);
    expect(hours).toEqual([8, 9, 10, 11]);
    expect(hours.length).toBe(4);
  });

  it('NÃO deve incluir 12h ou 13h no sábado', () => {
    const saturday = getNextDayOfWeek(6);
    const hours = getHourOptionsForDate(saturday);
    expect(hours).not.toContain(12);
    expect(hours).not.toContain(13);
    expect(hours).not.toContain(19);
  });

  it('deve retornar [] (array vazio) para domingo', () => {
    const sunday = getNextDayOfWeek(0);
    const hours = getHourOptionsForDate(sunday);
    expect(hours).toEqual([]);
    expect(hours.length).toBe(0);
  });

  it('deve retornar padrão de dia útil quando date é null', () => {
    const hours = getHourOptionsForDate(null);
    expect(hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });
});

// ===========================================================
// isClosedDay - Verificação de dia fechado
// ===========================================================
describe('isClosedDay', () => {
  it('deve retornar true para domingo', () => {
    const sunday = getNextDayOfWeek(0);
    expect(isClosedDay(sunday)).toBe(true);
  });

  it('deve retornar false para sábado', () => {
    const saturday = getNextDayOfWeek(6);
    expect(isClosedDay(saturday)).toBe(false);
  });

  it('deve retornar false para dia útil', () => {
    const monday = getNextDayOfWeek(1);
    expect(isClosedDay(monday)).toBe(false);
  });
});

// ===========================================================
// getValidDurations - Durações válidas baseadas em businessHours.end
// ===========================================================
describe('getValidDurations - Durações respeitam businessHours.end', () => {
  describe('Sábado (fecha 12h)', () => {
    it('Sábado 10h: duração máxima = 2h (10+2=12)', () => {
      const saturday = getNextDayOfWeek(6);
      const durations = getValidDurations(saturday, 10);
      expect(durations).toEqual([1, 2]);
    });

    it('Sábado 11h: duração máxima = 1h (11+1=12)', () => {
      const saturday = getNextDayOfWeek(6);
      const durations = getValidDurations(saturday, 11);
      expect(durations).toEqual([1]);
    });

    it('Sábado 8h: permite até 4h (8+4=12)', () => {
      const saturday = getNextDayOfWeek(6);
      const durations = getValidDurations(saturday, 8);
      expect(durations).toEqual([1, 2, 3, 4]);
    });

    it('Sábado 9h: permite até 3h (9+3=12)', () => {
      const saturday = getNextDayOfWeek(6);
      const durations = getValidDurations(saturday, 9);
      expect(durations).toEqual([1, 2, 3]);
    });
  });

  describe('Dias úteis (fecha 20h)', () => {
    it('Dia útil 18h: duração máxima = 2h (18+2=20)', () => {
      const monday = getNextDayOfWeek(1);
      const durations = getValidDurations(monday, 18);
      expect(durations).toEqual([1, 2]);
    });

    it('Dia útil 19h: duração máxima = 1h (19+1=20)', () => {
      const monday = getNextDayOfWeek(1);
      const durations = getValidDurations(monday, 19);
      expect(durations).toEqual([1]);
    });

    it('Dia útil 10h: todas durações permitidas', () => {
      const monday = getNextDayOfWeek(1);
      const durations = getValidDurations(monday, 10);
      expect(durations).toEqual([1, 2, 3, 4]);
    });

    it('Dia útil 17h: permite até 3h (17+3=20)', () => {
      const friday = getNextDayOfWeek(5);
      const durations = getValidDurations(friday, 17);
      expect(durations).toEqual([1, 2, 3]);
    });
  });

  describe('Domingo (fechado)', () => {
    it('Domingo: nenhuma duração válida', () => {
      const sunday = getNextDayOfWeek(0);
      const durations = getValidDurations(sunday, 10);
      expect(durations).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('date null: usa horário de dia útil (fallback)', () => {
      const durations = getValidDurations(null, 18);
      expect(durations).toEqual([1, 2]);
    });

    it('Custom maxDurations [1,2,3,4,5,6]: respeita limite', () => {
      const monday = getNextDayOfWeek(1);
      const durations = getValidDurations(monday, 15, [1, 2, 3, 4, 5, 6]);
      expect(durations).toEqual([1, 2, 3, 4, 5]); // 15+5=20
    });
  });
});
