// ===========================================================
// API: GET /api/availability - Consultar horários disponíveis
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getBusinessHoursForDate, MIN_ADVANCE_MINUTES } from '@/lib/business-hours';

interface Slot {
  hour: number;
  available: boolean;
}

interface ApiResponse {
  success: boolean;
  date?: string;
  roomId?: string;
  slots?: Slot[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    const { roomId, date } = req.query;

    // Validar parâmetros obrigatórios
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'roomId é obrigatório',
      });
    }

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'date é obrigatório (formato: YYYY-MM-DD)',
      });
    }

    // Parsear data
    const dateObj = new Date(date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Formato de data inválido. Use YYYY-MM-DD',
      });
    }

    // Verificar se sala existe (busca por id ou fallback por slug)
    let room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    // Fallback: se não encontrar por id, tenta por slug
    if (!room) {
      room = await prisma.room.findUnique({
        where: { slug: roomId },
      });
    }

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada',
      });
    }

    // Usar o ID real da sala para as queries subsequentes
    const realRoomId = room.id;

    // Buscar reservas do dia para esta sala
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        roomId: realRoomId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          // Reserva começa neste dia
          {
            startTime: { gte: startOfDay, lte: endOfDay },
          },
          // Reserva termina neste dia
          {
            endTime: { gte: startOfDay, lte: endOfDay },
          },
          // Reserva engloba o dia inteiro
          {
            startTime: { lte: startOfDay },
            endTime: { gte: endOfDay },
          },
        ],
      },
      select: {
        startTime: true,
        endTime: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Buscar horários de funcionamento para esta data (fonte única)
    const businessHours = getBusinessHoursForDate(dateObj);
    
    // Se fechado (domingo), retorna sem slots
    if (!businessHours) {
      return res.status(200).json({
        success: true,
        date,
        roomId: realRoomId,
        slots: [],
      });
    }
    
    const slots: Slot[] = [];
    const now = new Date();

    for (let hour = businessHours.start; hour < businessHours.end; hour++) {
      const slotStart = new Date(dateObj);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(dateObj);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      // Verifica se este horário já passou OU está dentro do prazo mínimo
      const minutesUntilSlot = (slotStart.getTime() - now.getTime()) / (1000 * 60);
      const isTooSoon = minutesUntilSlot < MIN_ADVANCE_MINUTES;

      // Verifica se há conflito com alguma reserva
      const hasConflict = bookings.some((booking) => {
        const bookingStart = new Date(booking.startTime).getTime();
        const bookingEnd = new Date(booking.endTime).getTime();
        // Conflito existe se há sobreposição
        return slotStart.getTime() < bookingEnd && slotEnd.getTime() > bookingStart;
      });

      slots.push({
        hour,
        available: !hasConflict && !isTooSoon,
      });
    }

    return res.status(200).json({
      success: true,
      date,
      roomId: realRoomId,
      slots,
    });
  } catch (error) {
    console.error('Erro ao buscar disponibilidade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar disponibilidade',
    });
  }
}
