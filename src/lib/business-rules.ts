// ===========================================================
// Regras de Negócio - Espaço Arthemi
// ===========================================================
// Implementa as regras essenciais do MVP

import { addDays, differenceInHours, isBefore, addMonths } from 'date-fns';
import { prisma } from './prisma';

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
export const MIN_CANCELLATION_HOURS = 24;

// Horário mínimo de antecedência para reagendamento (horas)
export const MIN_RESCHEDULE_HOURS = 24;

// ---- Validação de Disponibilidade ----

interface AvailabilityCheck {
  roomId: string;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}

/**
 * Verifica se um horário está disponível para reserva
 */
export async function checkAvailability({
  roomId,
  startTime,
  endTime,
  excludeBookingId,
}: AvailabilityCheck): Promise<{ available: boolean; conflictingBookings?: unknown[] }> {
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      OR: [
        // Nova reserva começa durante uma existente
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
        // Nova reserva termina durante uma existente
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime },
        },
        // Nova reserva engloba uma existente
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
      ],
    },
  });

  return {
    available: conflictingBookings.length === 0,
    conflictingBookings: conflictingBookings.length > 0 ? conflictingBookings : undefined,
  };
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

export const BUSINESS_HOURS = {
  start: 8,  // 8:00
  end: 20,   // 20:00
  lunchStart: 12,
  lunchEnd: 14,
} as const;

export const SHIFT_HOURS = {
  MORNING: { start: 8, end: 12 },
  AFTERNOON: { start: 14, end: 18 },
} as const;

/**
 * Verifica se horário está dentro do expediente
 */
export function isWithinBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}

/**
 * Gera slots de horário disponíveis para um dia
 */
export function generateTimeSlots(date: Date): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  
  for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
    // Pula horário de almoço se desejar
    // if (hour >= BUSINESS_HOURS.lunchStart && hour < BUSINESS_HOURS.lunchEnd) continue;
    
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(hour + 1, 0, 0, 0);
    
    slots.push({ start, end });
  }
  
  return slots;
}
