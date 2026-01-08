// ===========================================================
// Fonte única de horários de funcionamento
// ===========================================================
// Usar APENAS este arquivo para definir horários do Espaço Arthemi
// IMPORTANTE: Todas as funções usam timezone America/Sao_Paulo

/**
 * Timezone padrão do sistema (Brasil)
 */
export const SYSTEM_TIMEZONE = 'America/Sao_Paulo';

/**
 * Extrai a hora no timezone do Brasil, independente do timezone do servidor
 * @param date - Data a extrair a hora
 * @returns hora (0-23) no timezone do Brasil
 */
export function getHourInBrazil(date: Date): number {
  // Usa Intl.DateTimeFormat para extrair a hora no timezone correto
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SYSTEM_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(date), 10);
}

/**
 * Extrai o dia da semana no timezone do Brasil
 * @param date - Data a extrair o dia
 * @returns dia da semana (0=Dom, 1=Seg, ..., 6=Sáb) no timezone do Brasil
 */
export function getDayOfWeekInBrazil(date: Date): number {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SYSTEM_TIMEZONE,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  // Mapear abreviações para números
  const dayMap: Record<string, number> = {
    'dom': 0, 'dom.': 0,
    'seg': 1, 'seg.': 1,
    'ter': 2, 'ter.': 2,
    'qua': 3, 'qua.': 3,
    'qui': 4, 'qui.': 4,
    'sex': 5, 'sex.': 5,
    'sáb': 6, 'sáb.': 6, 'sab': 6, 'sab.': 6,
  };
  return dayMap[dayStr.toLowerCase()] ?? date.getDay();
}

/**
 * P-010: Cria uma data com hora específica no timezone de São Paulo
 * Útil para admin criar reservas com hora local correta
 * @param dateString - Data no formato YYYY-MM-DD ou ISO
 * @param hour - Hora (0-23) no timezone de São Paulo
 * @param minute - Minuto (0-59), default 0
 * @returns Date em UTC que representa a hora especificada em São Paulo
 */
export function createDateInBrazilTimezone(
  dateString: string,
  hour: number,
  minute: number = 0
): Date {
  // Extrai apenas a parte da data (YYYY-MM-DD) se for ISO
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  
  // Monta string ISO com a hora desejada no timezone de São Paulo
  // O formato offset depende do horário de verão, então usamos a abordagem de criar
  // a data temporária e ajustar pelo offset real
  const tempDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  
  // Descobre o offset real de São Paulo para essa data específica
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Formata a tempDate no timezone de São Paulo
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  // Calcula a diferença entre o que temos e o que queremos
  const spHour = getPart('hour');
  const hourDiff = hour - spHour;
  
  // Ajusta a data UTC para que fique correta em São Paulo
  const result = new Date(tempDate.getTime() + hourDiff * 60 * 60 * 1000);
  
  return result;
}

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
 * Horários de turnos fixos (LEGADO - manter para compatibilidade)
 */
export const SHIFT_HOURS = {
  MORNING: { start: 8, end: 12 },
  AFTERNOON: { start: 14, end: 18 },
} as const;

/**
 * Blocos de turno NOVOS (4h fixas)
 * - Seg-Sex: 3 blocos (08-12, 12-16, 16-20)
 * - Sábado: 1 bloco (08-12)
 */
export interface ShiftBlock {
  id: string;
  start: number;
  end: number;
  label: string;
}

export const SHIFT_BLOCKS = {
  // Seg-Sex: 3 turnos de 4h
  WEEKDAY: [
    { id: 'MORNING', start: 8, end: 12, label: 'Manhã (08h-12h)' },
    { id: 'AFTERNOON', start: 12, end: 16, label: 'Tarde (12h-16h)' },
    { id: 'EVENING', start: 16, end: 20, label: 'Noite (16h-20h)' },
  ] as ShiftBlock[],
  // Sábado: 1 turno de 4h
  SATURDAY: [
    { id: 'MORNING', start: 8, end: 12, label: 'Manhã (08h-12h)' },
  ] as ShiftBlock[],
} as const;

/**
 * Duração fixa de um turno em horas
 */
export const SHIFT_DURATION_HOURS = 4;

/**
 * Antecedência mínima para reservar (em minutos)
 */
export const MIN_ADVANCE_MINUTES = 30;

/**
 * Retorna o dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
 * IMPORTANTE: Usa timezone do Brasil
 */
export function getDayOfWeek(date: Date): number {
  return getDayOfWeekInBrazil(date);
}

/**
 * Verifica se é domingo (no timezone do Brasil)
 */
export function isSunday(date: Date): boolean {
  return getDayOfWeek(date) === 0;
}

/**
 * Verifica se é sábado (no timezone do Brasil)
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
 * IMPORTANTE: Usa timezone do Brasil
 */
export function isWithinBusinessHours(date: Date): boolean {
  const hours = getBusinessHoursForDate(date);
  
  if (!hours) {
    return false; // Domingo = fechado
  }
  
  const hour = getHourInBrazil(date);
  return hour >= hours.start && hour < hours.end;
}

/**
 * Extrai minutos no timezone do Brasil
 */
function getMinutesInBrazil(date: Date): number {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SYSTEM_TIMEZONE,
    minute: 'numeric',
  });
  return parseInt(formatter.format(date), 10);
}

/**
 * Verifica se um período (start-end) está completamente dentro do expediente
 * IMPORTANTE: Usa timezone do Brasil para garantir consistência
 */
export function isBookingWithinBusinessHours(startTime: Date, endTime: Date): boolean {
  const hours = getBusinessHoursForDate(startTime);
  
  if (!hours) {
    return false; // Domingo = fechado
  }
  
  const startHour = getHourInBrazil(startTime);
  const endHour = getHourInBrazil(endTime);
  const endMinutes = getMinutesInBrazil(endTime);
  
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

// ===========================================================
// FUNÇÕES DE VALIDAÇÃO DE BLOCOS DE TURNO
// ===========================================================

/**
 * Retorna os blocos de turno disponíveis para uma data
 * @param date Data para verificar
 * @returns Array de blocos disponíveis (vazio se domingo)
 */
export function getShiftBlocksForDate(date: Date): ShiftBlock[] {
  const dayOfWeek = getDayOfWeek(date);
  
  // Domingo = fechado
  if (dayOfWeek === 0) {
    return [];
  }
  
  // Sábado = apenas bloco da manhã
  if (dayOfWeek === 6) {
    return [...SHIFT_BLOCKS.SATURDAY];
  }
  
  // Seg-Sex = 3 blocos
  return [...SHIFT_BLOCKS.WEEKDAY];
}

/**
 * Verifica se um horário (start-end) corresponde a um bloco de turno válido
 * Blocos válidos:
 * - Seg-Sex: 08-12, 12-16, 16-20
 * - Sábado: 08-12
 * 
 * @param startTime Início da reserva
 * @param endTime Fim da reserva
 * @returns true se é um bloco de turno válido
 */
export function isValidShiftBlock(startTime: Date, endTime: Date): boolean {
  const startHour = getHourInBrazil(startTime);
  const endHour = getHourInBrazil(endTime);
  
  // Turno deve ter exatamente 4 horas
  if (endHour - startHour !== SHIFT_DURATION_HOURS) {
    return false;
  }
  
  // Busca blocos válidos para a data
  const validBlocks = getShiftBlocksForDate(startTime);
  
  // Verifica se corresponde a algum bloco
  return validBlocks.some(block => 
    block.start === startHour && block.end === endHour
  );
}

/**
 * Verifica se um horário é válido para reserva de HORA (1h fixa)
 * @param startTime Início da reserva
 * @param endTime Fim da reserva
 * @returns true se é exatamente 1 hora
 */
export function isValidHourlyBooking(startTime: Date, endTime: Date): boolean {
  const startHour = getHourInBrazil(startTime);
  const endHour = getHourInBrazil(endTime);
  
  // Hora avulsa deve ter exatamente 1 hora
  return endHour - startHour === 1;
}

/**
 * Encontra o bloco de turno correspondente a um horário
 * @param startTime Início da reserva
 * @returns Bloco de turno ou null se não encontrar
 */
export function findShiftBlock(startTime: Date): ShiftBlock | null {
  const startHour = getHourInBrazil(startTime);
  const blocks = getShiftBlocksForDate(startTime);
  
  return blocks.find(block => block.start === startHour) || null;
}
