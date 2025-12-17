// ===========================================================
// lib/availability.ts - Verificação de disponibilidade
// ===========================================================

import prisma from './prisma';
import type { Booking } from '@prisma/client';

interface AvailabilityParams {
  roomId: string;
  startAt: Date;
  endAt: Date;
  excludeBookingId?: string;
}

/**
 * Verifica se um horário está disponível para reserva
 * Retorna true se disponível, false se há conflito
 */
export async function isAvailable({
  roomId,
  startAt,
  endAt,
  excludeBookingId,
}: AvailabilityParams): Promise<boolean> {
  // Busca reservas que conflitam com o período solicitado
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      roomId,
      // Apenas reservas ativas (não canceladas)
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      // Exclui a própria reserva (para casos de edição)
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      // Verifica sobreposição de horários
      OR: [
        // Nova reserva começa durante uma existente
        {
          startTime: { lte: startAt },
          endTime: { gt: startAt },
        },
        // Nova reserva termina durante uma existente
        {
          startTime: { lt: endAt },
          endTime: { gte: endAt },
        },
        // Nova reserva engloba uma existente
        {
          startTime: { gte: startAt },
          endTime: { lte: endAt },
        },
      ],
    },
  });

  return conflictingBookings.length === 0;
}

/**
 * Busca conflitos detalhados para um período
 */
export async function getConflicts(params: AvailabilityParams) {
  const { roomId, startAt, endAt, excludeBookingId } = params;

  const conflicts = await prisma.booking.findMany({
    where: {
      roomId,
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      OR: [
        {
          startTime: { lte: startAt },
          endTime: { gt: startAt },
        },
        {
          startTime: { lt: endAt },
          endTime: { gte: endAt },
        },
        {
          startTime: { gte: startAt },
          endTime: { lte: endAt },
        },
      ],
    },
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  return conflicts.map((b: Booking & { user: { name: string } }) => ({
    id: b.id,
    startAt: b.startTime,
    endAt: b.endTime,
    userName: b.user.name,
    status: b.status,
  }));
}

/**
 * Busca horários disponíveis para uma data específica
 */
export async function getAvailableSlots(roomId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Busca todas as reservas do dia
  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startTime: { gte: startOfDay },
      endTime: { lte: endOfDay },
    },
    orderBy: { startTime: 'asc' },
  });

  // Horário de funcionamento: 8h às 20h
  const BUSINESS_START = 8;
  const BUSINESS_END = 20;
  
  const slots: { start: Date; end: Date; available: boolean }[] = [];

  for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    // Verifica se há conflito com alguma reserva
    const hasConflict = bookings.some((booking: Booking) => {
      const bookingStart = new Date(booking.startTime).getTime();
      const bookingEnd = new Date(booking.endTime).getTime();
      return slotStart.getTime() < bookingEnd && slotEnd.getTime() > bookingStart;
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      available: !hasConflict,
    });
  }

  return slots;
}
