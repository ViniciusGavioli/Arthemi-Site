// ===========================================================
// API: POST /api/admin/bookings/create - Reserva manual (diária/turno)
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAvailable } from '@/lib/availability';
import { logAdminAction } from '@/lib/audit';
import { SHIFT_HOURS } from '@/lib/business-rules';

const createManualBookingSchema = z.object({
  userId: z.string().optional(),
  userPhone: z.string().optional(),
  userName: z.string().optional(),
  userEmail: z.string().email().optional(),
  roomId: z.string().min(1, 'roomId é obrigatório'),
  date: z.string().datetime({ message: 'Data inválida' }),
  bookingType: z.enum(['HOURLY', 'SHIFT', 'DAY_PASS']).default('HOURLY'),
  shiftType: z.enum(['MORNING', 'AFTERNOON']).optional(), // Para turno
  startHour: z.number().min(0).max(23).optional(), // Para HOURLY
  endHour: z.number().min(0).max(23).optional(), // Para HOURLY
  amount: z.number().min(0).default(0), // Valor cobrado (pode ser 0 para cortesia)
  notes: z.string().optional(),
});

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  // Verificar autenticação admin
  const adminToken = req.cookies.admin_token;
  if (!adminToken) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado',
    });
  }

  try {
    const validation = createManualBookingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;
    const bookingDate = new Date(data.date);

    // Verificar sala
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa',
      });
    }

    // Buscar ou criar usuário
    let user;
    if (data.userId) {
      user = await prisma.user.findUnique({ where: { id: data.userId } });
    } else if (data.userPhone) {
      user = await prisma.user.findUnique({ where: { phone: data.userPhone } });
      if (!user && data.userName) {
        user = await prisma.user.create({
          data: {
            name: data.userName,
            phone: data.userPhone,
            email: data.userEmail || `${data.userPhone}@temp.arthemi.com.br`,
            role: 'CUSTOMER',
          },
        });
      }
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Usuário não encontrado. Informe userId, userPhone ou dados para criar.',
      });
    }

    // Calcular horários baseado no tipo
    let startTime: Date;
    let endTime: Date;

    if (data.bookingType === 'SHIFT' && data.shiftType) {
      const shift = SHIFT_HOURS[data.shiftType];
      startTime = new Date(bookingDate);
      startTime.setHours(shift.start, 0, 0, 0);
      endTime = new Date(bookingDate);
      endTime.setHours(shift.end, 0, 0, 0);
    } else if (data.bookingType === 'DAY_PASS') {
      // Diária: 8h às 20h
      startTime = new Date(bookingDate);
      startTime.setHours(8, 0, 0, 0);
      endTime = new Date(bookingDate);
      endTime.setHours(20, 0, 0, 0);
    } else {
      // HOURLY
      if (!data.startHour || !data.endHour) {
        return res.status(400).json({
          success: false,
          error: 'startHour e endHour são obrigatórios para reservas por hora',
        });
      }
      startTime = new Date(bookingDate);
      startTime.setHours(data.startHour, 0, 0, 0);
      endTime = new Date(bookingDate);
      endTime.setHours(data.endHour, 0, 0, 0);
    }

    // Verificar disponibilidade
    const available = await isAvailable({
      roomId: data.roomId,
      startAt: startTime,
      endAt: endTime,
    });

    if (!available) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Já existe uma reserva neste período.',
      });
    }

    // Criar booking manual (já confirmado)
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        roomId: data.roomId,
        startTime,
        endTime,
        status: 'CONFIRMED',
        paymentStatus: data.amount > 0 ? 'PENDING' : 'APPROVED',
        amountPaid: data.amount,
        bookingType: data.bookingType === 'DAY_PASS' ? 'HOURLY' : data.bookingType,
        isManual: true,
        notes: data.notes || `Reserva manual - ${data.bookingType}`,
        creditsUsed: 0,
        creditIds: [],
      },
    });

    // Log de auditoria
    await logAdminAction(
      'BOOKING_MANUAL_CREATED',
      'Booking',
      booking.id,
      {
        userId: user.id,
        roomId: data.roomId,
        bookingType: data.bookingType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        amount: data.amount,
      },
      req
    );

    return res.status(201).json({
      success: true,
      bookingId: booking.id,
    });
  } catch (error) {
    console.error('Erro ao criar reserva manual:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar reserva',
    });
  }
}
