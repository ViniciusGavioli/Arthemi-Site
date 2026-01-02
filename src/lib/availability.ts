// ===========================================================
// lib/availability.ts - Verificação de disponibilidade
// ===========================================================
// DECISÃO DE PRODUTO: Sem buffer entre reservas - slots colados permitidos

import prisma from './prisma';
import type { Booking } from '@prisma/client';
import { getBusinessHoursForDate } from './business-rules';

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
  // Busca todas as reservas ativas da sala para verificar conflitos com buffer
  const existingBookings = await prisma.booking.findMany({
    where: {
      roomId,
      // Apenas reservas ativas (não canceladas)
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      // Exclui a própria reserva (para casos de edição)
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
    },
  });

  // Verifica conflitos simples (sem buffer - slots colados permitidos)
  const hasConflict = existingBookings.some((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = new Date(booking.endTime).getTime();
    
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    // Verifica sobreposição (reserva termina no mesmo momento que outra começa = OK)
    return newStart < bookingEnd && newEnd > bookingStart;
  });

  return !hasConflict;
}

/**
 * Busca conflitos detalhados para um período
 */
export async function getConflicts(params: AvailabilityParams) {
  const { roomId, startAt, endAt, excludeBookingId } = params;

  // Busca todas as reservas ativas para verificar conflitos com buffer
  const allBookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
    },
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  // Filtra reservas que conflitam (sem buffer)
  const conflicts = allBookings.filter((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = new Date(booking.endTime).getTime();
    
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    return newStart < bookingEnd && newEnd > bookingStart;
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
 * Respeita horários de funcionamento (Seg-Sex 8-20, Sáb 8-12, Dom fechado)
 */
export async function getAvailableSlots(roomId: string, date: Date) {
  // Verifica horário de funcionamento para a data
  const hours = getBusinessHoursForDate(date);
  
  if (!hours) {
    // Domingo = fechado
    return [];
  }
  
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
  
  const slots: { start: Date; end: Date; available: boolean }[] = [];

  for (let hour = hours.start; hour < hours.end; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    // Verifica se há conflito com alguma reserva (sem buffer)
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
