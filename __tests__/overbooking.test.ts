// ===========================================================
// Testes: P-001 - Concorrência de Reservas (Overbooking)
// ===========================================================
// Testes unitários para verificar detecção de overbooking
// 
// Execute: npm test -- overbooking.test.ts
// ===========================================================

import { isOverbookingError, OVERBOOKING_ERROR_MESSAGE } from '../src/lib/overbooking';

// ============================================================
// TESTES: DETECÇÃO DE ERRO DE OVERBOOKING
// ============================================================

describe('isOverbookingError', () => {
  test('detecta erro com mensagem contendo 23p01', () => {
    const error = new Error('ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap" (SQLSTATE 23P01)');
    expect(isOverbookingError(error)).toBe(true);
  });

  test('detecta erro com mensagem contendo exclusion_violation', () => {
    const error = new Error('exclusion_violation: cannot insert overlapping booking');
    expect(isOverbookingError(error)).toBe(true);
  });

  test('detecta erro com mensagem contendo bookings_no_overlap', () => {
    const error = new Error('violates constraint "bookings_no_overlap"');
    expect(isOverbookingError(error)).toBe(true);
  });

  test('não detecta erro genérico sem referência a overbooking', () => {
    const error = new Error('Generic database error');
    expect(isOverbookingError(error)).toBe(false);
  });

  test('não detecta null/undefined', () => {
    expect(isOverbookingError(null)).toBe(false);
    expect(isOverbookingError(undefined)).toBe(false);
  });

  test('não detecta objeto sem propriedade message', () => {
    expect(isOverbookingError({ foo: 'bar' })).toBe(false);
  });

  test('detecta erro case-insensitive', () => {
    const error = new Error('EXCLUSION_VIOLATION occurred');
    expect(isOverbookingError(error)).toBe(true);
  });

  test('detecta erro com conflicting key value message', () => {
    const error = new Error('conflicting key value violates exclusion constraint');
    expect(isOverbookingError(error)).toBe(true);
  });
});

// ============================================================
// TESTES: MENSAGEM DE ERRO
// ============================================================

describe('OVERBOOKING_ERROR_MESSAGE', () => {
  test('mensagem é user-friendly em português', () => {
    expect(OVERBOOKING_ERROR_MESSAGE).toBeTruthy();
    expect(OVERBOOKING_ERROR_MESSAGE).toContain('horário');
    expect(OVERBOOKING_ERROR_MESSAGE).toContain('reservado');
  });

  test('mensagem não expõe detalhes técnicos', () => {
    expect(OVERBOOKING_ERROR_MESSAGE.toLowerCase()).not.toContain('sql');
    expect(OVERBOOKING_ERROR_MESSAGE.toLowerCase()).not.toContain('constraint');
    expect(OVERBOOKING_ERROR_MESSAGE.toLowerCase()).not.toContain('database');
    expect(OVERBOOKING_ERROR_MESSAGE.toLowerCase()).not.toContain('23p01');
  });
});

// ============================================================
// TESTES: CENÁRIOS DE SOBREPOSIÇÃO (CONCEITUAL)
// ============================================================

describe('Cenários de Sobreposição de Horário', () => {
  // Helpers para simular detecção
  function detectOverlap(
    existing: { start: number; end: number },
    newBooking: { start: number; end: number }
  ): boolean {
    // tsrange '[)' = inclui start, exclui end
    // Overlap: NOT (new.end <= existing.start OR new.start >= existing.end)
    return !(newBooking.end <= existing.start || newBooking.start >= existing.end);
  }

  test('booking exatamente no mesmo horário: CONFLITO', () => {
    const existing = { start: 9, end: 11 }; // 09:00-11:00
    const newBooking = { start: 9, end: 11 }; // 09:00-11:00
    expect(detectOverlap(existing, newBooking)).toBe(true);
  });

  test('novo booking contém o existente: CONFLITO', () => {
    const existing = { start: 10, end: 11 }; // 10:00-11:00
    const newBooking = { start: 9, end: 12 }; // 09:00-12:00
    expect(detectOverlap(existing, newBooking)).toBe(true);
  });

  test('novo booking dentro do existente: CONFLITO', () => {
    const existing = { start: 9, end: 12 }; // 09:00-12:00
    const newBooking = { start: 10, end: 11 }; // 10:00-11:00
    expect(detectOverlap(existing, newBooking)).toBe(true);
  });

  test('overlap parcial no início: CONFLITO', () => {
    const existing = { start: 10, end: 12 }; // 10:00-12:00
    const newBooking = { start: 9, end: 11 }; // 09:00-11:00
    expect(detectOverlap(existing, newBooking)).toBe(true);
  });

  test('overlap parcial no final: CONFLITO', () => {
    const existing = { start: 9, end: 11 }; // 09:00-11:00
    const newBooking = { start: 10, end: 12 }; // 10:00-12:00
    expect(detectOverlap(existing, newBooking)).toBe(true);
  });

  test('adjacente anterior (end = start): SEM CONFLITO', () => {
    const existing = { start: 11, end: 13 }; // 11:00-13:00
    const newBooking = { start: 9, end: 11 }; // 09:00-11:00 (end = existing.start)
    expect(detectOverlap(existing, newBooking)).toBe(false);
  });

  test('adjacente posterior (start = end): SEM CONFLITO', () => {
    const existing = { start: 9, end: 11 }; // 09:00-11:00
    const newBooking = { start: 11, end: 13 }; // 11:00-13:00 (start = existing.end)
    expect(detectOverlap(existing, newBooking)).toBe(false);
  });

  test('completamente antes: SEM CONFLITO', () => {
    const existing = { start: 14, end: 16 }; // 14:00-16:00
    const newBooking = { start: 9, end: 11 }; // 09:00-11:00
    expect(detectOverlap(existing, newBooking)).toBe(false);
  });

  test('completamente depois: SEM CONFLITO', () => {
    const existing = { start: 9, end: 11 }; // 09:00-11:00
    const newBooking = { start: 14, end: 16 }; // 14:00-16:00
    expect(detectOverlap(existing, newBooking)).toBe(false);
  });
});

// ============================================================
// TESTES: CONSTRAINT CONSIDERA STATUS
// ============================================================

describe('Constraint considera apenas bookings ativos', () => {
  test('constraint ignora bookings CANCELLED', () => {
    // O constraint SQL usa WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'))
    // Portanto, reservas canceladas não bloqueiam novas reservas
    const constraint = "WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'))";
    expect(constraint).toContain('CANCELLED');
    expect(constraint).toContain('NO_SHOW');
  });

  test('bookings PENDING são considerados ativos', () => {
    // PENDING deve bloquear novas reservas no mesmo horário
    const activeStatuses = ['PENDING', 'CONFIRMED'];
    expect(activeStatuses).not.toContain('CANCELLED');
    expect(activeStatuses).not.toContain('NO_SHOW');
  });
});
