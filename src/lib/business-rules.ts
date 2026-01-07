// ===========================================================
// Regras de Negócio - Espaço Arthemi
// ===========================================================
// Implementa as regras essenciais do MVP

import { addDays, differenceInHours, isBefore, addMonths, isSaturday, startOfDay, isAfter, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { prisma } from './prisma';
import type { Credit, Room, CreditUsageType } from '@prisma/client';

// ---- Constantes ----
export const PACKAGE_VALIDITY = {
  PACKAGE_10H: 90,  // 90 dias
  PACKAGE_20H: 90,  // 90 dias
  PACKAGE_40H: 180, // 180 dias
  SHIFT_FIXED: 180, // 180 dias (turno fixo 4 semanas)
  DAY_PASS: 1,      // 1 dia
  SATURDAY_PASS: 1, // 1 dia
  HOURLY_RATE: 1,   // Uso imediato
} as const;

export const SHIFT_DURATION_WEEKS = 4;

export const SUBLET_CREDIT_PERCENTAGE = 0.5; // 50% do valor
export const MAX_CREDITS_PER_MONTH = 1;

// Horário mínimo de antecedência para cancelamento (horas)
// DECISÃO DE PRODUTO: Cancelamentos só são permitidos com 48h de antecedência
export const MIN_CANCELLATION_HOURS = 48;

// Horário mínimo de antecedência para reagendamento (horas)
export const MIN_RESCHEDULE_HOURS = 24;

// Buffer de limpeza entre reservas (minutos)
// DECISÃO DE PRODUTO: Sem intervalo entre reservas - slots colados permitidos
export const BUFFER_MINUTES = 0;

// Validade padrão de créditos em meses
export const CREDIT_VALIDITY_MONTHS = 6;

// Janela de reserva para créditos de horas avulsas e pacotes (dias)
// Créditos de hora avulsa/pacotes só podem ser usados para reservar até 30 dias no futuro
// Turnos fixos não têm limitação de janela (podem reservar o ano todo)
export const HOURLY_BOOKING_WINDOW_DAYS = 30;

// Janela UNIVERSAL de reserva: nenhum usuário pode reservar além de 30 dias
// Aplica a TODAS as reservas (com ou sem crédito, com ou sem turno fixo)
export const MAX_BOOKING_WINDOW_DAYS = 30;

// ===========================================================
// VALIDAÇÃO UNIVERSAL DE JANELA DE 30 DIAS
// ===========================================================

/**
 * Valida se uma data/hora de reserva está dentro da janela universal de 30 dias
 * Esta validação se aplica a TODAS as reservas, independente do tipo de produto
 * 
 * @param bookingDate Data/hora da reserva desejada
 * @returns { valid: boolean; maxDate: Date; error?: string }
 */
export function validateUniversalBookingWindow(
  bookingDate: Date
): { valid: boolean; maxDate: Date; error?: string } {
  // Usa timezone de São Paulo para comparação
  const now = new Date();
  const today = startOfDay(now);
  const maxDate = addDays(today, MAX_BOOKING_WINDOW_DAYS);
  const bookingDateStart = startOfDay(bookingDate);

  // Verifica se a data está além da janela de 30 dias
  if (isAfter(bookingDateStart, maxDate)) {
    return {
      valid: false,
      maxDate,
      error: `Reservas podem ser feitas com no máximo ${MAX_BOOKING_WINDOW_DAYS} dias de antecedência. Data máxima: ${format(maxDate, 'dd/MM/yyyy', { locale: ptBR })}.`,
    };
  }

  // Não pode ser no passado
  if (isBefore(bookingDateStart, today)) {
    return {
      valid: false,
      maxDate,
      error: 'Não é possível reservar datas no passado.',
    };
  }

  return { valid: true, maxDate };
}

/**
 * Calcula a data máxima permitida para reserva (30 dias a partir de hoje)
 * @returns Data máxima permitida
 */
export function getUniversalMaxBookingDate(): Date {
  const today = startOfDay(new Date());
  return addDays(today, MAX_BOOKING_WINDOW_DAYS);
}

// ===========================================================
// SISTEMA DE CRÉDITOS COM HIERARQUIA
// ===========================================================

/**
 * Verifica se um crédito pode ser usado em um consultório específico
 * Regra de hierarquia: Crédito de consultório superior pode ser usado em consultórios inferiores
 * - Tier 1 (Consultório 1) → pode usar em 1, 2, 3
 * - Tier 2 (Consultório 2) → pode usar em 2, 3
 * - Tier 3 (Consultório 3) → só pode usar em 3
 * 
 * @param creditRoomTier Tier do consultório do crédito (1, 2 ou 3). Se null, crédito é genérico
 * @param targetRoomTier Tier do consultório alvo da reserva
 * @returns true se o crédito pode ser usado
 */
export function canUseCredit(creditRoomTier: number | null, targetRoomTier: number): boolean {
  // Crédito genérico (sem consultório específico) pode ser usado em qualquer consultório
  if (creditRoomTier === null) {
    return true;
  }
  // Crédito de consultório superior (tier menor) pode ser usado em consultório igual ou inferior (tier maior ou igual)
  return creditRoomTier <= targetRoomTier;
}

/**
 * Verifica se um crédito de sábado pode ser usado na data da reserva
 * @param credit Crédito a ser validado
 * @param bookingDate Data da reserva
 * @returns true se válido
 */
export function validateSaturdayCredit(credit: Credit, bookingDate: Date): boolean {
  // Se não é crédito de sábado, sempre válido
  if (credit.type !== 'SATURDAY') {
    return true;
  }
  // Crédito de sábado só pode ser usado em sábados
  return isSaturday(bookingDate);
}

// ===========================================================
// VALIDAÇÃO POR USAGE TYPE (REGRA DE USO DO CRÉDITO)
// ===========================================================

// Re-import das funções de business-hours para validação de blocos
import { 
  isValidShiftBlock, 
  isValidHourlyBooking,
  isSaturdayDay,
  getHourInBrazil,
} from './business-hours';

/**
 * Resultado da validação de uso de crédito
 */
export interface CreditUsageValidation {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Valida se um crédito com usageType pode ser usado para uma reserva específica
 * 
 * REGRAS:
 * - HOURLY: Seg-Sex, 1h fixa (hora cheia)
 * - SHIFT: Seg-Sex, 4h em bloco fixo (08-12, 12-16, 16-20)
 * - SATURDAY_HOURLY: Sábado, 1h fixa
 * - SATURDAY_SHIFT: Sábado, 4h em bloco fixo (08-12)
 * - null (legado): Comportamento atual (sem restrição de duração)
 * 
 * @param credit Crédito a ser validado
 * @param startTime Início da reserva
 * @param endTime Fim da reserva
 * @returns Resultado da validação
 */
export function validateCreditUsage(
  credit: Credit,
  startTime: Date,
  endTime: Date
): CreditUsageValidation {
  const usageType = credit.usageType;
  const isSaturdayBooking = isSaturdayDay(startTime);
  
  // CRÉDITO LEGADO (sem usageType): Mantém comportamento atual
  // Não força regras novas, apenas valida sábado se for crédito SATURDAY
  if (!usageType) {
    return validateLegacyCreditUsage(credit, startTime, endTime);
  }
  
  // NOVOS CRÉDITOS: Validação estrita por usageType
  switch (usageType) {
    case 'HOURLY':
      return validateHourlyUsage(startTime, endTime, isSaturdayBooking);
      
    case 'SHIFT':
      return validateShiftUsage(startTime, endTime, isSaturdayBooking);
      
    case 'SATURDAY_HOURLY':
      return validateSaturdayHourlyUsage(startTime, endTime, isSaturdayBooking);
      
    case 'SATURDAY_SHIFT':
      return validateSaturdayShiftUsage(startTime, endTime, isSaturdayBooking);
      
    default:
      // Fallback seguro: permite (não bloqueia créditos desconhecidos)
      return { valid: true };
  }
}

/**
 * Valida crédito LEGADO (sem usageType explícito)
 * REGRA: Mantém comportamento atual do sistema
 * - Crédito SATURDAY só pode ser usado em sábado
 * - Demais créditos: sem restrição de duração (1-8h)
 */
function validateLegacyCreditUsage(
  credit: Credit,
  startTime: Date,
  endTime: Date
): CreditUsageValidation {
  const isSaturdayBooking = isSaturdayDay(startTime);
  
  // Crédito SATURDAY (legado) só pode ser usado em sábado
  if (credit.type === 'SATURDAY') {
    if (!isSaturdayBooking) {
      return {
        valid: false,
        error: 'Crédito de sábado só pode ser usado em sábados.',
        code: 'SATURDAY_CREDIT_WRONG_DAY',
      };
    }
  } else {
    // Créditos não-SATURDAY não podem ser usados em sábado
    // (mantém regra atual - sábado requer crédito específico)
    if (isSaturdayBooking) {
      return {
        valid: false,
        error: 'Para reservar em sábado, você precisa de crédito de sábado.',
        code: 'SATURDAY_REQUIRES_SATURDAY_CREDIT',
      };
    }
  }
  
  // LEGADO: Não força 1h fixa, permite comportamento atual (1-8h)
  return { valid: true };
}

/**
 * Valida crédito HOURLY (novo): Seg-Sex, 1h fixa
 */
function validateHourlyUsage(
  startTime: Date,
  endTime: Date,
  isSaturdayBooking: boolean
): CreditUsageValidation {
  // HOURLY só pode ser usado seg-sex
  if (isSaturdayBooking) {
    return {
      valid: false,
      error: 'Crédito de hora avulsa não pode ser usado em sábado. Use crédito de sábado.',
      code: 'HOURLY_NOT_ON_SATURDAY',
    };
  }
  
  // HOURLY deve ser exatamente 1 hora
  if (!isValidHourlyBooking(startTime, endTime)) {
    return {
      valid: false,
      error: 'Crédito de hora avulsa permite apenas reservas de 1 hora.',
      code: 'HOURLY_MUST_BE_1H',
    };
  }
  
  return { valid: true };
}

/**
 * Valida crédito SHIFT (novo): Seg-Sex, 4h em bloco fixo
 */
function validateShiftUsage(
  startTime: Date,
  endTime: Date,
  isSaturdayBooking: boolean
): CreditUsageValidation {
  // SHIFT só pode ser usado seg-sex
  if (isSaturdayBooking) {
    return {
      valid: false,
      error: 'Crédito de turno não pode ser usado em sábado. Use crédito de sábado turno.',
      code: 'SHIFT_NOT_ON_SATURDAY',
    };
  }
  
  // SHIFT deve ser bloco fixo de 4h (08-12, 12-16, 16-20)
  if (!isValidShiftBlock(startTime, endTime)) {
    return {
      valid: false,
      error: 'Crédito de turno só pode ser usado em blocos fixos de 4h: 08h-12h, 12h-16h ou 16h-20h.',
      code: 'SHIFT_INVALID_BLOCK',
    };
  }
  
  return { valid: true };
}

/**
 * Valida crédito SATURDAY_HOURLY (novo): Sábado, 1h fixa
 */
function validateSaturdayHourlyUsage(
  startTime: Date,
  endTime: Date,
  isSaturdayBooking: boolean
): CreditUsageValidation {
  // SATURDAY_HOURLY só pode ser usado em sábado
  if (!isSaturdayBooking) {
    return {
      valid: false,
      error: 'Crédito de sábado hora só pode ser usado em sábados.',
      code: 'SATURDAY_HOURLY_WRONG_DAY',
    };
  }
  
  // SATURDAY_HOURLY deve ser exatamente 1 hora
  if (!isValidHourlyBooking(startTime, endTime)) {
    return {
      valid: false,
      error: 'Crédito de sábado hora permite apenas reservas de 1 hora.',
      code: 'SATURDAY_HOURLY_MUST_BE_1H',
    };
  }
  
  return { valid: true };
}

/**
 * Valida crédito SATURDAY_SHIFT (novo): Sábado, 4h em bloco fixo
 */
function validateSaturdayShiftUsage(
  startTime: Date,
  endTime: Date,
  isSaturdayBooking: boolean
): CreditUsageValidation {
  // SATURDAY_SHIFT só pode ser usado em sábado
  if (!isSaturdayBooking) {
    return {
      valid: false,
      error: 'Crédito de sábado turno só pode ser usado em sábados.',
      code: 'SATURDAY_SHIFT_WRONG_DAY',
    };
  }
  
  // SATURDAY_SHIFT deve ser bloco fixo 08-12
  if (!isValidShiftBlock(startTime, endTime)) {
    return {
      valid: false,
      error: 'Crédito de sábado turno só pode ser usado no bloco 08h-12h.',
      code: 'SATURDAY_SHIFT_INVALID_BLOCK',
    };
  }
  
  return { valid: true };
}

/**
 * Verifica se um crédito é compatível com o tipo de reserva
 * Usado para filtrar créditos disponíveis
 * 
 * @param credit Crédito a verificar
 * @param bookingDate Data da reserva
 * @param isShiftBooking Se a reserva é de turno (4h) ou hora (1h)
 * @returns true se o crédito pode ser usado
 */
export function isCreditCompatibleWithBooking(
  credit: Credit,
  bookingDate: Date,
  isShiftBooking: boolean
): boolean {
  const usageType = credit.usageType;
  const isSaturdayBooking = isSaturdayDay(bookingDate);
  
  // CRÉDITO LEGADO: Comportamento atual
  if (!usageType) {
    // Crédito SATURDAY (tipo) só pode em sábado
    if (credit.type === 'SATURDAY') {
      return isSaturdayBooking;
    }
    // Demais créditos: só em dias úteis (comportamento atual)
    return !isSaturdayBooking;
  }
  
  // NOVOS CRÉDITOS: Verificar compatibilidade
  switch (usageType) {
    case 'HOURLY':
      // Só seg-sex, só hora
      return !isSaturdayBooking && !isShiftBooking;
      
    case 'SHIFT':
      // Só seg-sex, só turno
      return !isSaturdayBooking && isShiftBooking;
      
    case 'SATURDAY_HOURLY':
      // Só sábado, só hora
      return isSaturdayBooking && !isShiftBooking;
      
    case 'SATURDAY_SHIFT':
      // Só sábado, só turno
      return isSaturdayBooking && isShiftBooking;
      
    default:
      return true;
  }
}

/**
 * Busca créditos disponíveis de um usuário para um consultório específico
 * Considera hierarquia: créditos de consultórios superiores também são retornados
 * 
 * @param userId ID do usuário
 * @param roomId ID do consultório alvo
 * @param bookingDate Data da reserva (para validar créditos de sábado)
 * @param startTime Início da reserva (opcional, para validar usageType)
 * @param endTime Fim da reserva (opcional, para validar usageType)
 * @returns Lista de créditos disponíveis ordenados por prioridade
 */
export async function getAvailableCreditsForRoom(
  userId: string,
  roomId: string,
  bookingDate: Date,
  startTime?: Date,
  endTime?: Date
): Promise<(Credit & { room: Room | null })[]> {
  const now = new Date();

  // Busca o consultório alvo para obter o tier
  const targetRoom = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!targetRoom) {
    return [];
  }

  // Busca todos os créditos disponíveis do usuário
  const allCredits = await prisma.credit.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      usedAt: null,
      remainingAmount: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    include: {
      room: true,
    },
    orderBy: [
      { expiresAt: 'asc' }, // Primeiro os que vencem antes
      { createdAt: 'asc' }, // Depois os mais antigos
    ],
  });

  // Filtra créditos que podem ser usados neste consultório (hierarquia + sábado + usageType)
  const validCredits = allCredits.filter((credit) => {
    // Verifica hierarquia
    const creditTier = credit.room?.tier ?? null;
    if (!canUseCredit(creditTier, targetRoom.tier)) {
      return false;
    }

    // Verifica se é sábado (para créditos de sábado legados)
    if (!validateSaturdayCredit(credit, bookingDate)) {
      return false;
    }

    // Se startTime/endTime foram passados, valida usageType
    if (startTime && endTime) {
      const usageValidation = validateCreditUsage(credit, startTime, endTime);
      if (!usageValidation.valid) {
        return false;
      }
    }

    return true;
  });

  // Ordena: créditos específicos do consultório primeiro, depois genéricos
  return validCredits.sort((a, b) => {
    // Créditos do mesmo consultório têm prioridade
    if (a.roomId === roomId && b.roomId !== roomId) return -1;
    if (b.roomId === roomId && a.roomId !== roomId) return 1;
    return 0;
  });
}

/**
 * Calcula o saldo total de créditos disponíveis para um consultório
 * @param userId ID do usuário
 * @param roomId ID do consultório
 * @param bookingDate Data da reserva
 * @param startTime Início da reserva (opcional, para validar usageType)
 * @param endTime Fim da reserva (opcional, para validar usageType)
 */
export async function getCreditBalanceForRoom(
  userId: string,
  roomId: string,
  bookingDate: Date = new Date(),
  startTime?: Date,
  endTime?: Date
): Promise<number> {
  const credits = await getAvailableCreditsForRoom(userId, roomId, bookingDate, startTime, endTime);
  return credits.reduce((sum, c) => sum + c.remainingAmount, 0);
}

/**
 * Consome créditos para uma reserva
 * Retorna os IDs dos créditos consumidos e o valor total consumido
 * 
 * @param userId ID do usuário
 * @param roomId ID do consultório
 * @param amount Valor a consumir (em centavos)
 * @param bookingDate Data da reserva
 * @param startTime Início da reserva (opcional, para validar usageType)
 * @param endTime Fim da reserva (opcional, para validar usageType)
 * @returns { creditIds, totalConsumed }
 */
export async function consumeCreditsForBooking(
  userId: string,
  roomId: string,
  amount: number,
  bookingDate: Date,
  startTime?: Date,
  endTime?: Date
): Promise<{ creditIds: string[]; totalConsumed: number }> {
  const credits = await getAvailableCreditsForRoom(userId, roomId, bookingDate, startTime, endTime);
  
  let remaining = amount;
  const usedCreditIds: string[] = [];
  let totalConsumed = 0;

  for (const credit of credits) {
    if (remaining <= 0) break;

    const toConsume = Math.min(credit.remainingAmount, remaining);
    
    await prisma.credit.update({
      where: { id: credit.id },
      data: {
        remainingAmount: { decrement: toConsume },
        usedAt: credit.remainingAmount === toConsume ? new Date() : null,
        status: credit.remainingAmount === toConsume ? 'USED' : 'CONFIRMED',
      },
    });

    usedCreditIds.push(credit.id);
    totalConsumed += toConsume;
    remaining -= toConsume;
  }

  return { creditIds: usedCreditIds, totalConsumed };
}

/**
 * Converte um cancelamento em crédito
 * NÃO gera reembolso em dinheiro
 * 
 * @param bookingId ID da reserva cancelada
 * @returns Crédito criado ou null se não aplicável
 */
export async function convertCancellationToCredit(bookingId: string): Promise<Credit | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true },
  });

  if (!booking || booking.status === 'CANCELLED') {
    return null;
  }

  // Só gera crédito se teve pagamento ou uso de crédito
  const valueToCredit = booking.amountPaid + booking.creditsUsed;
  if (valueToCredit <= 0) {
    return null;
  }

  // Verifica antecedência mínima para gerar crédito
  if (!canCancelWithRefund(booking.startTime)) {
    return null;
  }

  const now = new Date();
  const expiresAt = addMonths(now, CREDIT_VALIDITY_MONTHS);

  // Cria crédito para o mesmo consultório da reserva
  const credit = await prisma.credit.create({
    data: {
      userId: booking.userId,
      roomId: booking.roomId,
      amount: valueToCredit,
      remainingAmount: valueToCredit,
      type: 'CANCELLATION',
      status: 'CONFIRMED',
      sourceBookingId: bookingId,
      referenceMonth: now.getMonth() + 1,
      referenceYear: now.getFullYear(),
      expiresAt,
    },
  });

  // Atualiza booking para cancelado
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
  });

  return credit;
}

/**
 * Cria crédito manualmente (admin)
 */
export async function createManualCredit(params: {
  userId: string;
  roomId?: string;
  amount: number;
  type: 'PROMO' | 'MANUAL' | 'SATURDAY';
  usageType?: 'HOURLY' | 'SHIFT' | 'SATURDAY_HOURLY' | 'SATURDAY_SHIFT';
  expiresInMonths?: number;
  notes?: string;
}): Promise<Credit> {
  const now = new Date();
  const expiresAt = addMonths(now, params.expiresInMonths ?? CREDIT_VALIDITY_MONTHS);

  return prisma.credit.create({
    data: {
      userId: params.userId,
      roomId: params.roomId ?? null,
      amount: params.amount,
      remainingAmount: params.amount,
      type: params.type,
      usageType: params.usageType ?? null, // null = legado (sem restrição)
      status: 'CONFIRMED',
      referenceMonth: now.getMonth() + 1,
      referenceYear: now.getFullYear(),
      expiresAt,
    },
  });
}

/**
 * Busca saldo total de créditos do usuário por consultório
 * Retorna valores em centavos E horas calculadas
 */
export async function getUserCreditsSummary(userId: string): Promise<{
  total: number;
  totalHours: number;
  byRoom: { roomId: string | null; roomName: string; amount: number; hours: number; tier: number | null }[];
}> {
  const credits = await prisma.credit.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      usedAt: null,
      remainingAmount: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { room: true },
  });

  const byRoomMap = new Map<string, { roomId: string | null; roomName: string; amount: number; hours: number; tier: number | null; hourlyRate: number }>();

  for (const credit of credits) {
    const key = credit.roomId ?? 'generic';
    const hourlyRate = credit.room?.hourlyRate ?? 6000; // Fallback: R$ 60/h
    const existing = byRoomMap.get(key);
    
    if (existing) {
      existing.amount += credit.remainingAmount;
      existing.hours += credit.remainingAmount / existing.hourlyRate;
    } else {
      byRoomMap.set(key, {
        roomId: credit.roomId,
        roomName: credit.room?.name ?? 'Genérico',
        amount: credit.remainingAmount,
        hours: credit.remainingAmount / hourlyRate,
        tier: credit.room?.tier ?? null,
        hourlyRate,
      });
    }
  }

  const total = credits.reduce((sum, c) => sum + c.remainingAmount, 0);
  
  // Calcular horas totais por sala (cada sala tem seu próprio hourlyRate)
  let totalHours = 0;
  const byRoom = Array.from(byRoomMap.values())
    .map(r => {
      totalHours += r.hours;
      return {
        roomId: r.roomId,
        roomName: r.roomName,
        amount: r.amount,
        hours: Math.floor(r.hours * 10) / 10, // Arredondar para 1 casa decimal
        tier: r.tier,
      };
    })
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));

  return { total, totalHours: Math.floor(totalHours * 10) / 10, byRoom };
}

// ---- Validação de Disponibilidade ----

/**
 * Adiciona o buffer de limpeza ao horário de término
 * O buffer é aplicado APÓS a reserva existente, bloqueando o horário para limpeza
 */
function addBufferToEndTime(date: Date): Date {
  return new Date(date.getTime() + BUFFER_MINUTES * 60 * 1000);
}

interface AvailabilityCheck {
  roomId: string;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}

/**
 * Verifica se um horário está disponível para reserva
 * Considera o buffer de 30 minutos após cada reserva existente para limpeza
 */
export async function checkAvailability({
  roomId,
  startTime,
  endTime,
  excludeBookingId,
}: AvailabilityCheck): Promise<{ available: boolean; conflictingBookings?: unknown[] }> {
  // Busca todas as reservas ativas do consultório
  const existingBookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
    },
  });

  // Filtra reservas que conflitam considerando o buffer de limpeza
  // O buffer de 30 minutos é adicionado ao endTime de cada reserva existente
  const conflictingBookings = existingBookings.filter((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    // endTime + BUFFER_MINUTES = tempo total bloqueado pela reserva
    const bookingEndWithBuffer = addBufferToEndTime(new Date(booking.endTime)).getTime();
    
    const newStart = startTime.getTime();
    const newEnd = endTime.getTime();

    // Verifica sobreposição:
    // A nova reserva conflita se começar antes do fim+buffer E terminar depois do início
    return newStart < bookingEndWithBuffer && newEnd > bookingStart;
  });

  return {
    available: conflictingBookings.length === 0,
    conflictingBookings: conflictingBookings.length > 0 ? conflictingBookings : undefined,
  };
}

// ---- Validação de Janela de Reserva ----

/**
 * Determina se um tipo de produto é turno fixo
 * Turnos fixos não têm limitação de janela de reserva
 */
export function isShiftProduct(productType: string): boolean {
  return productType === 'SHIFT_FIXED';
}

/**
 * Determina se um tipo de produto está sujeito à janela de 30 dias
 * Horas avulsas e pacotes só podem reservar até 30 dias no futuro
 */
export function hasBookingWindowLimit(productType: string): boolean {
  return ['HOURLY_RATE', 'PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'DAY_PASS', 'SATURDAY_5H'].includes(productType);
}

/**
 * Valida se uma data de reserva está dentro da janela permitida
 * 
 * Regras:
 * - Turnos fixos (SHIFT_FIXED): Sem limitação, podem reservar qualquer data futura
 * - Horas avulsas/pacotes: Limitados a 30 dias no futuro
 * 
 * @param bookingDate Data da reserva desejada
 * @param productType Tipo de produto/crédito sendo usado
 * @returns { valid: boolean, maxDate?: Date, error?: string }
 */
export function validateBookingWindow(
  bookingDate: Date,
  productType: string | null
): { valid: boolean; maxDate?: Date; error?: string } {
  // Se não tem tipo de produto (pagamento direto), permite reservar
  // ou se é turno fixo, não tem limitação
  if (!productType || isShiftProduct(productType)) {
    return { valid: true };
  }

  // Verifica se este tipo de produto tem limitação de janela
  if (!hasBookingWindowLimit(productType)) {
    return { valid: true };
  }

  // Calcula data máxima permitida (hoje + 30 dias)
  const today = startOfDay(new Date());
  const maxDate = addDays(today, HOURLY_BOOKING_WINDOW_DAYS);
  const bookingDateStart = startOfDay(bookingDate);

  // Verifica se a data está dentro da janela
  if (isAfter(bookingDateStart, maxDate)) {
    return {
      valid: false,
      maxDate,
      error: `Reservas com créditos de horas/pacotes podem ser feitas com até ${HOURLY_BOOKING_WINDOW_DAYS} dias de antecedência. Data máxima: ${format(maxDate, 'dd/MM/yyyy', { locale: ptBR })}.`,
    };
  }

  // Não pode ser no passado
  if (isBefore(bookingDateStart, today)) {
    return {
      valid: false,
      error: 'Não é possível reservar datas no passado.',
    };
  }

  return { valid: true, maxDate };
}

/**
 * Calcula a data máxima permitida para reserva baseado nos créditos do usuário
 * 
 * Regra:
 * - Usuários com turno fixo ATIVO podem reservar sem limitação (datas do turno)
 * - Usuários usando créditos de pacotes/horas estão limitados a 30 dias
 * 
 * @param userId ID do usuário
 * @returns Data máxima permitida ou null se não há limitação (usuário tem turno fixo)
 */
export async function getMaxBookingDate(userId: string): Promise<Date | null> {
  // Busca reservas de turno fixo do usuário (confirmadas, futuras)
  const now = new Date();
  const shiftBookings = await prisma.booking.findMany({
    where: {
      userId,
      bookingType: 'SHIFT',
      status: 'CONFIRMED',
      endTime: { gte: now },
    },
  });

  // Se tem turno fixo ativo, sem limitação de janela
  if (shiftBookings.length > 0) {
    return null;
  }

  // Busca todos os créditos ativos do usuário
  const credits = await prisma.credit.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      usedAt: null,
      remainingAmount: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });

  // Se não tem créditos nem turnos, sem limitação (pagamento direto)
  if (credits.length === 0) {
    return null;
  }

  // Usuário tem créditos mas não tem turno fixo ativo
  // Aplica janela de 30 dias
  const today = startOfDay(new Date());
  return addDays(today, HOURLY_BOOKING_WINDOW_DAYS);
}

// ---- Pacotes de Horas ----

/**
 * Calcula data de expiração de um pacote baseado no tipo
 * @param type Tipo do produto/pacote
 * @param purchaseDate Data de compra (default: agora)
 */
export function applyValidity(type: keyof typeof PACKAGE_VALIDITY, purchaseDate: Date = new Date()): Date {
  const days = PACKAGE_VALIDITY[type] || 30;
  return addDays(purchaseDate, days);
}

// Alias para compatibilidade
export const calculatePackageExpiry = applyValidity;

/**
 * Busca pacotes válidos de um usuário
 */
export async function getValidUserPackages(userId: string) {
  const now = new Date();
  
  return prisma.userPackage.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
      remainingHours: { gt: 0 },
    },
    orderBy: {
      expiresAt: 'asc', // Usa primeiro os que vencem antes
    },
  });
}

/**
 * Usa horas de um pacote
 */
export async function usePackageHours(packageId: string, hours: number) {
  const pkg = await prisma.userPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || pkg.remainingHours < hours) {
    throw new Error('Horas insuficientes no pacote');
  }

  return prisma.userPackage.update({
    where: { id: packageId },
    data: {
      remainingHours: { decrement: hours },
    },
  });
}

// ---- Créditos por Sublocação ----

/**
 * Verifica se usuário já usou crédito no mês
 */
export async function checkCreditLimitForMonth(
  userId: string,
  month: number,
  year: number
): Promise<boolean> {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const creditCount = await prisma.credit.count({
    where: {
      userId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return creditCount < MAX_CREDITS_PER_MONTH;
}

/**
 * Cria crédito por sublocação (50% do valor)
 * Limite: 1 crédito por mês por usuário
 * @param userId ID do usuário
 * @param hourlyRate Valor da hora
 * @param subletRequestId ID da solicitação de sublocação
 */
export async function createCreditForSublocation(
  userId: string,
  hourlyRate: number,
  subletRequestId: string
) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Verifica limite mensal
  const canCreate = await checkCreditLimitForMonth(userId, month, year);
  if (!canCreate) {
    throw new Error('Limite de 1 crédito por mês já atingido');
  }

  // Calcula valor do crédito (50% da hora)
  const creditAmount = Math.floor(hourlyRate * SUBLET_CREDIT_PERCENTAGE);

  // Crédito expira em 6 meses
  const expiresAt = addMonths(now, 6);

  return prisma.credit.create({
    data: {
      userId,
      amount: creditAmount,
      type: 'SUBLET',
      referenceMonth: now.getMonth() + 1,
      referenceYear: now.getFullYear(),
      expiresAt,
      subletRequestId,
    },
  });
}

// Alias para compatibilidade
export const createSubletCredit = createCreditForSublocation;

/**
 * Confirma crédito de sublocação (ação manual do admin)
 */
export async function confirmSubletCredit(creditId: string) {
  return prisma.credit.update({
    where: { id: creditId },
    data: {
      usedAt: null, // Reset para disponível
    },
  });
}

/**
 * Busca créditos disponíveis de um usuário
 */
export async function getAvailableCredits(userId: string) {
  return prisma.credit.findMany({
    where: {
      userId,
      usedAt: null, // Não foi usado
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

// ---- Reagendamento ----

/**
 * Verifica se uma reserva pode ser reagendada
 * Regra: Mínimo 24h de antecedência
 */
export function canReschedule(bookingStartTime: Date): boolean {
  const now = new Date();
  const hoursUntilBooking = differenceInHours(bookingStartTime, now);
  return hoursUntilBooking >= MIN_RESCHEDULE_HOURS;
}

/**
 * Verifica se uma reserva pode ser cancelada
 * Regra: Mínimo 24h de antecedência para reembolso
 */
export function canCancelWithRefund(bookingStartTime: Date): boolean {
  const now = new Date();
  const hoursUntilBooking = differenceInHours(bookingStartTime, now);
  return hoursUntilBooking >= MIN_CANCELLATION_HOURS;
}

/**
 * Verifica se uma reserva está no passado
 */
export function isBookingInPast(bookingStartTime: Date): boolean {
  return isBefore(bookingStartTime, new Date());
}

// ---- Horários de Funcionamento ----
// Re-exportar de business-hours.ts (fonte única)
export {
  BUSINESS_HOURS,
  SHIFT_HOURS,
  MIN_ADVANCE_MINUTES,
  getDayOfWeek,
  isSunday,
  isSaturdayDay,
  getBusinessHoursForDate,
  isWithinBusinessHours,
  isBookingWithinBusinessHours,
  generateTimeSlots,
} from './business-hours';

// Alias para isSaturdayDay (compatibilidade)
export { isSaturdayDay as isSaturday } from './business-hours';
