// ===========================================================
// Testes: Blocos de Turno (SHIFT_BLOCKS)
// ===========================================================

import {
  SHIFT_BLOCKS,
  SHIFT_DURATION_HOURS,
  getShiftBlocksForDate,
  isValidShiftBlock,
  isValidHourlyBooking,
  findShiftBlock,
  getDayOfWeek,
} from '@/lib/business-hours';
import { addDays, setDay } from 'date-fns';

describe('SHIFT_BLOCKS Constants', () => {
  it('deve ter 3 blocos para dias úteis', () => {
    expect(SHIFT_BLOCKS.WEEKDAY).toHaveLength(3);
  });

  it('deve ter 1 bloco para sábado', () => {
    expect(SHIFT_BLOCKS.SATURDAY).toHaveLength(1);
  });

  it('blocos de dia útil devem ser 08-12, 12-16, 16-20', () => {
    const [morning, afternoon, evening] = SHIFT_BLOCKS.WEEKDAY;
    
    expect(morning.start).toBe(8);
    expect(morning.end).toBe(12);
    
    expect(afternoon.start).toBe(12);
    expect(afternoon.end).toBe(16);
    
    expect(evening.start).toBe(16);
    expect(evening.end).toBe(20);
  });

  it('bloco de sábado deve ser 08-12', () => {
    const [morning] = SHIFT_BLOCKS.SATURDAY;
    
    expect(morning.start).toBe(8);
    expect(morning.end).toBe(12);
  });

  it('duração de turno deve ser 4 horas', () => {
    expect(SHIFT_DURATION_HOURS).toBe(4);
  });
});

describe('getShiftBlocksForDate', () => {
  // Helper para criar datas em dias específicos
  const getNextWeekday = (dayOfWeek: number) => {
    const today = new Date();
    return setDay(today, dayOfWeek, { weekStartsOn: 0 });
  };

  it('deve retornar 3 blocos para segunda-feira', () => {
    const monday = getNextWeekday(1);
    const blocks = getShiftBlocksForDate(monday);
    expect(blocks).toHaveLength(3);
  });

  it('deve retornar 3 blocos para sexta-feira', () => {
    const friday = getNextWeekday(5);
    const blocks = getShiftBlocksForDate(friday);
    expect(blocks).toHaveLength(3);
  });

  it('deve retornar 1 bloco para sábado', () => {
    const saturday = getNextWeekday(6);
    const blocks = getShiftBlocksForDate(saturday);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('MORNING');
  });

  it('deve retornar vazio para domingo', () => {
    const sunday = getNextWeekday(0);
    const blocks = getShiftBlocksForDate(sunday);
    expect(blocks).toHaveLength(0);
  });
});

describe('isValidShiftBlock', () => {
  // Helper para criar datas com horário específico
  const createDateTime = (dayOfWeek: number, hour: number) => {
    const date = setDay(new Date(), dayOfWeek, { weekStartsOn: 0 });
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  describe('Dias úteis (seg-sex)', () => {
    it('deve PERMITIR bloco 08-12', () => {
      const start = createDateTime(1, 8); // Segunda 08h
      const end = createDateTime(1, 12);  // Segunda 12h
      expect(isValidShiftBlock(start, end)).toBe(true);
    });

    it('deve PERMITIR bloco 12-16', () => {
      const start = createDateTime(2, 12); // Terça 12h
      const end = createDateTime(2, 16);   // Terça 16h
      expect(isValidShiftBlock(start, end)).toBe(true);
    });

    it('deve PERMITIR bloco 16-20', () => {
      const start = createDateTime(3, 16); // Quarta 16h
      const end = createDateTime(3, 20);   // Quarta 20h
      expect(isValidShiftBlock(start, end)).toBe(true);
    });

    it('deve REJEITAR bloco 09-13 (não alinhado)', () => {
      const start = createDateTime(1, 9);
      const end = createDateTime(1, 13);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });

    it('deve REJEITAR bloco 14-18 (antigo AFTERNOON)', () => {
      const start = createDateTime(1, 14);
      const end = createDateTime(1, 18);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });

    it('deve REJEITAR bloco de 2 horas (08-10)', () => {
      const start = createDateTime(1, 8);
      const end = createDateTime(1, 10);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });

    it('deve REJEITAR bloco de 1 hora', () => {
      const start = createDateTime(1, 8);
      const end = createDateTime(1, 9);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });
  });

  describe('Sábado', () => {
    it('deve PERMITIR bloco 08-12', () => {
      const start = createDateTime(6, 8);  // Sábado 08h
      const end = createDateTime(6, 12);   // Sábado 12h
      expect(isValidShiftBlock(start, end)).toBe(true);
    });

    it('deve REJEITAR bloco 12-16 (sábado fecha 12h)', () => {
      const start = createDateTime(6, 12);
      const end = createDateTime(6, 16);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });
  });

  describe('Domingo', () => {
    it('deve REJEITAR qualquer bloco', () => {
      const start = createDateTime(0, 8);
      const end = createDateTime(0, 12);
      expect(isValidShiftBlock(start, end)).toBe(false);
    });
  });
});

describe('isValidHourlyBooking', () => {
  const createDateTime = (hour: number) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  it('deve PERMITIR reserva de 1 hora', () => {
    const start = createDateTime(10);
    const end = createDateTime(11);
    expect(isValidHourlyBooking(start, end)).toBe(true);
  });

  it('deve REJEITAR reserva de 2 horas', () => {
    const start = createDateTime(10);
    const end = createDateTime(12);
    expect(isValidHourlyBooking(start, end)).toBe(false);
  });

  it('deve REJEITAR reserva de 4 horas', () => {
    const start = createDateTime(8);
    const end = createDateTime(12);
    expect(isValidHourlyBooking(start, end)).toBe(false);
  });
});

describe('findShiftBlock', () => {
  const createDateTime = (dayOfWeek: number, hour: number) => {
    const date = setDay(new Date(), dayOfWeek, { weekStartsOn: 0 });
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  it('deve encontrar bloco MORNING para 08h em dia útil', () => {
    const start = createDateTime(1, 8);
    const block = findShiftBlock(start);
    expect(block).not.toBeNull();
    expect(block!.id).toBe('MORNING');
  });

  it('deve encontrar bloco AFTERNOON para 12h em dia útil', () => {
    const start = createDateTime(1, 12);
    const block = findShiftBlock(start);
    expect(block).not.toBeNull();
    expect(block!.id).toBe('AFTERNOON');
  });

  it('deve encontrar bloco EVENING para 16h em dia útil', () => {
    const start = createDateTime(1, 16);
    const block = findShiftBlock(start);
    expect(block).not.toBeNull();
    expect(block!.id).toBe('EVENING');
  });

  it('deve retornar null para horário não-alinhado (09h)', () => {
    const start = createDateTime(1, 9);
    const block = findShiftBlock(start);
    expect(block).toBeNull();
  });

  it('deve retornar null para domingo', () => {
    const start = createDateTime(0, 8);
    const block = findShiftBlock(start);
    expect(block).toBeNull();
  });
});
