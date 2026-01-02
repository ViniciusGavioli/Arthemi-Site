// ===========================================================
// Fonte única de horários de funcionamento
// ===========================================================
// Usar APENAS este arquivo para definir horários do Espaço Arthemi

/**
 * Horários de funcionamento
 * - Seg-Sex: 08:00 - 20:00
 * - Sábado: 08:00 - 12:00
 * - Domingo: Fechado
 */
export const BUSINESS_HOURS = {
  weekday: { start: 8, end: 20 },   // Seg-Sex
  saturday: { start: 8, end: 12 },   // Sábado
  sunday: null,                      // Domingo fechado
  // Legado (compatibilidade com testes)
  start: 8,
  end: 20,
} as const;

/**
 * Horários de turnos fixos
 */
export const SHIFT_HOURS = {
  MORNING: { start: 8, end: 12 },
  AFTERNOON: { start: 14, end: 18 },
} as const;

/**
 * Antecedência mínima para reservar (em minutos)
 */
export const MIN_ADVANCE_MINUTES = 30;

/**
 * Retorna o dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Verifica se é domingo
 */
export function isSunday(date: Date): boolean {
  return getDayOfWeek(date) === 0;
}

/**
 * Verifica se é sábado
 */
export function isSaturdayDay(date: Date): boolean {
  return getDayOfWeek(date) === 6;
}

/**
 * Retorna o horário de funcionamento para uma data específica
 * @returns { start, end } ou null se fechado
 */
export function getBusinessHoursForDate(date: Date): { start: number; end: number } | null {
  const day = getDayOfWeek(date);
  
  if (day === 0) {
    // Domingo: fechado
    return null;
  }
  
  if (day === 6) {
    // Sábado: 08:00-12:00
    return BUSINESS_HOURS.saturday;
  }
  
  // Seg-Sex: 08:00-20:00
  return BUSINESS_HOURS.weekday;
}

/**
 * Verifica se horário está dentro do expediente
 */
export function isWithinBusinessHours(date: Date): boolean {
  const hours = getBusinessHoursForDate(date);
  
  if (!hours) {
    return false; // Domingo = fechado
  }
  
  const hour = date.getHours();
  return hour >= hours.start && hour < hours.end;
}

/**
 * Verifica se um período (start-end) está completamente dentro do expediente
 */
export function isBookingWithinBusinessHours(startTime: Date, endTime: Date): boolean {
  const hours = getBusinessHoursForDate(startTime);
  
  if (!hours) {
    return false; // Domingo = fechado
  }
  
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();
  const endMinutes = endTime.getMinutes();
  
  // Início deve ser >= abertura
  if (startHour < hours.start) {
    return false;
  }
  
  // Fim deve ser <= fechamento (permite exatamente no horário de fechamento)
  if (endHour > hours.end || (endHour === hours.end && endMinutes > 0)) {
    return false;
  }
  
  return true;
}

/**
 * Gera slots de horário disponíveis para um dia
 * Respeita horários diferentes para sáb e retorna vazio para domingo
 */
export function generateTimeSlots(date: Date): { start: Date; end: Date }[] {
  const hours = getBusinessHoursForDate(date);
  
  if (!hours) {
    return []; // Domingo = sem slots
  }
  
  const slots: { start: Date; end: Date }[] = [];
  
  for (let hour = hours.start; hour < hours.end; hour++) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(hour + 1, 0, 0, 0);
    
    slots.push({ start, end });
  }
  
  return slots;
}
