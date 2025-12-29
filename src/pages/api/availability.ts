// ===========================================================
// API: GET /api/availability - Consultar horários disponíveis
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

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

    // Verificar se sala existe
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada',
      });
    }

    // Buscar reservas do dia para esta sala
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
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

    // Horário de funcionamento:
    // - Segunda a Sexta: 8h às 18h
    // - Sábado: 8h às 12h
    const BUSINESS_START = 8;
    const isSaturday = dateObj.getDay() === 6;
    const BUSINESS_END = isSaturday ? 12 : 18;
    const MIN_ADVANCE_MINUTES = 30; // Mínimo de 30 minutos de antecedência para reservar
    const CLEANING_BUFFER_MINUTES = 40; // 40 minutos de intervalo para limpeza entre reservas
    
    const slots: Slot[] = [];
    const now = new Date();

    for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
      const slotStart = new Date(dateObj);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(dateObj);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      // Verifica se este horário já passou OU está dentro do prazo mínimo de 30 minutos
      const minutesUntilSlot = (slotStart.getTime() - now.getTime()) / (1000 * 60);
      const isTooSoon = minutesUntilSlot < MIN_ADVANCE_MINUTES;

      // Verifica se há conflito com alguma reserva (incluindo buffer de limpeza)
      const hasConflict = bookings.some((booking) => {
        const bookingStart = new Date(booking.startTime).getTime();
        const bookingEnd = new Date(booking.endTime).getTime();
        // Buffer de limpeza: adiciona 40 minutos após o fim da reserva
        const bookingEndWithBuffer = bookingEnd + (CLEANING_BUFFER_MINUTES * 60 * 1000);
        
        // Conflito existe se:
        // 1. O slot começa antes do fim da reserva + buffer E
        // 2. O slot termina depois do início da reserva
        return slotStart.getTime() < bookingEndWithBuffer && slotEnd.getTime() > bookingStart;
      });

      slots.push({
        hour,
        available: !hasConflict && !isTooSoon,
      });
    }

    return res.status(200).json({
      success: true,
      date,
      roomId,
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
