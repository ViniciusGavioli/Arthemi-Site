// ===========================================================
// Proteção Anti-Canibalização de Turnos
// ===========================================================
// Regra: Horas avulsas e pacotes por hora não podem ser
// comprados/agendados para datas com mais de 30 dias de
// antecedência em dias que têm produto TURNO disponível.

import { startOfDay, addDays, isAfter, differenceInCalendarDays } from 'date-fns';
import { getDayOfWeek } from './business-hours';

// ===========================================================
// CONSTANTES
// ===========================================================

/**
 * Janela de proteção em dias
 * Horas avulsas/pacotes só podem ser agendados até 30 dias no futuro
 * para dias que têm TURNO disponível
 */
export const TURNO_PROTECTION_WINDOW_DAYS = 30;

/**
 * Código de erro para bloqueio por proteção de turno
 */
export const TURNO_PROTECTION_ERROR_CODE = 'TURNO_PROTECTION_30D';

/**
 * Mensagem de erro amigável
 */
export const TURNO_PROTECTION_ERROR_MESSAGE = 
  'Para manter disponibilidade de turnos, horas avulsas e pacotes por hora só podem ser comprados para datas dentro de 30 dias.';

// ===========================================================
// TIPOS
// ===========================================================

export interface TurnoProtectionResult {
  blocked: boolean;
  reason?: string;
  code?: string;
  maxAllowedDate?: Date;
  daysUntilAllowed?: number;
}

// ===========================================================
// FUNÇÕES DE VERIFICAÇÃO
// ===========================================================

/**
 * Verifica se uma data é um "dia de TURNO" (dia que tem produto TURNO disponível)
 * 
 * TURNO está disponível em dias úteis (segunda a sexta)
 * Sábado tem produto próprio (SATURDAY_SHIFT)
 * Domingo está fechado
 * 
 * @param date Data a verificar
 * @returns true se é um dia de TURNO
 */
export function isTurnoDay(date: Date): boolean {
  const dayOfWeek = getDayOfWeek(date);
  // 0 = Domingo, 1-5 = Segunda a Sexta, 6 = Sábado
  // TURNO disponível de Segunda (1) a Sexta (5)
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

/**
 * Verifica se uma data está dentro da janela de proteção
 * (ou seja, até 30 dias a partir de hoje)
 * 
 * @param date Data alvo do agendamento
 * @param protectionDays Número de dias da janela (default: 30)
 * @returns true se a data está dentro da janela permitida
 */
export function isWithinTurnoProtectionWindow(
  date: Date, 
  protectionDays: number = TURNO_PROTECTION_WINDOW_DAYS
): boolean {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  const maxDate = addDays(today, protectionDays);
  
  // Data deve ser <= maxDate para estar dentro da janela
  return !isAfter(targetDate, maxDate);
}

/**
 * Determina se um tipo de produto é hora avulsa ou pacote por hora
 * (sujeito à regra de proteção de turno)
 * 
 * @param productType Tipo de produto (HOURLY_RATE, PACKAGE_10H, etc)
 * @returns true se o produto está sujeito à proteção
 */
export function isHourlyProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  
  const hourlyProducts = [
    'HOURLY_RATE',
    'PACKAGE_10H',
    'PACKAGE_20H',
    'PACKAGE_40H',
    'PACKAGE_5H',
    'SATURDAY_HOUR',
    'SATURDAY_5H',
  ];
  
  return hourlyProducts.includes(productType);
}

/**
 * Determina se um tipo de produto é TURNO (não sujeito à proteção)
 * 
 * @param productType Tipo de produto
 * @returns true se é produto de TURNO
 */
export function isShiftProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  
  const shiftProducts = [
    'SHIFT_FIXED',
    'SHIFT',
    'SATURDAY_SHIFT',
    'DAY_PASS', // Diária também é venda recorrente
  ];
  
  return shiftProducts.includes(productType);
}

/**
 * Verifica se uma compra/agendamento de horas deve ser bloqueada
 * pela regra de proteção de turnos
 * 
 * Regra:
 * - Se é dia de TURNO (seg-sex) E data > 30 dias no futuro
 * - E o produto é hora avulsa ou pacote por hora
 * => BLOQUEAR
 * 
 * @param date Data do agendamento
 * @param productType Tipo de produto (opcional, para validar só se for hourly)
 * @returns Resultado com blocked, reason, code, etc
 */
export function shouldBlockHourlyPurchase(
  date: Date,
  productType?: string | null
): TurnoProtectionResult {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  
  // Se não é dia de TURNO, não bloqueia
  if (!isTurnoDay(date)) {
    return { blocked: false };
  }
  
  // Se o produto for TURNO/SHIFT, não bloqueia
  if (productType && isShiftProduct(productType)) {
    return { blocked: false };
  }
  
  // Se productType for passado e não for hourly, não bloqueia
  if (productType && !isHourlyProduct(productType)) {
    return { blocked: false };
  }
  
  // Verifica se está dentro da janela de 30 dias
  if (isWithinTurnoProtectionWindow(date)) {
    return { blocked: false };
  }
  
  // BLOQUEAR: É dia de turno + data > 30 dias + produto hourly
  const maxAllowedDate = addDays(today, TURNO_PROTECTION_WINDOW_DAYS);
  const daysUntilAllowed = differenceInCalendarDays(targetDate, maxAllowedDate);
  
  return {
    blocked: true,
    reason: TURNO_PROTECTION_ERROR_MESSAGE,
    code: TURNO_PROTECTION_ERROR_CODE,
    maxAllowedDate,
    daysUntilAllowed,
  };
}

/**
 * Valida uma lista de datas para agendamento
 * Retorna as datas que estão bloqueadas pela proteção de turno
 * 
 * @param dates Lista de datas a validar
 * @param productType Tipo de produto
 * @returns Lista de datas bloqueadas com motivos
 */
export function validateDatesForTurnoProtection(
  dates: Date[],
  productType?: string | null
): { date: Date; result: TurnoProtectionResult }[] {
  return dates
    .map(date => ({
      date,
      result: shouldBlockHourlyPurchase(date, productType),
    }))
    .filter(item => item.result.blocked);
}

/**
 * Calcula a data máxima permitida para agendamento de horas avulsas/pacotes
 * em dias de TURNO
 * 
 * @returns Data máxima (hoje + 30 dias)
 */
export function getMaxHourlyBookingDate(): Date {
  const today = startOfDay(new Date());
  return addDays(today, TURNO_PROTECTION_WINDOW_DAYS);
}
