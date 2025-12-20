// ===========================================================
// lib/availability.ts - Verificação de disponibilidade
// ===========================================================

import prisma from './prisma';
import type { Booking } from '@prisma/client';
import { BUFFER_MINUTES } from './business-rules';

/**
 * Adiciona o buffer de limpeza ao horário de término
 * O buffer é aplicado APÓS a reserva existente, bloqueando o horário para limpeza
 */
function addBuffer(date: Date): Date {
  return new Date(date.getTime() + BUFFER_MINUTES * 60 * 1000);
}

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

  // Verifica conflitos considerando o buffer de limpeza após cada reserva existente
  // O buffer de 30 minutos é adicionado ao endTime de cada reserva existente
  // Isso garante tempo para limpeza/organização entre atendimentos
  const hasConflict = existingBookings.some((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    // endTime + BUFFER_MINUTES = tempo total bloqueado pela reserva
    const bookingEndWithBuffer = addBuffer(new Date(booking.endTime)).getTime();
    
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    // Verifica sobreposição:
    // A nova reserva conflita se começar antes do fim+buffer E terminar depois do início
    return newStart < bookingEndWithBuffer && newEnd > bookingStart;
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

  // Filtra reservas que conflitam considerando o buffer de limpeza
  const conflicts = allBookings.filter((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEndWithBuffer = addBuffer(new Date(booking.endTime)).getTime();
    
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    return newStart < bookingEndWithBuffer && newEnd > bookingStart;
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

    // Verifica se há conflito com alguma reserva (considerando buffer de limpeza)
    const hasConflict = bookings.some((booking: Booking) => {
      const bookingStart = new Date(booking.startTime).getTime();
      // Adiciona buffer de limpeza ao fim da reserva
      const bookingEndWithBuffer = addBuffer(new Date(booking.endTime)).getTime();
      return slotStart.getTime() < bookingEndWithBuffer && slotEnd.getTime() > bookingStart;
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      available: !hasConflict,
    });
  }

  return slots;
}
