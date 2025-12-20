// ===========================================================
// API: GET /api/user/profile - Perfil do usuário com saldo
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserCreditsSummary } from '@/lib/business-rules';

interface ApiResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    createdAt: string;
  };
  credits?: {
    total: number;
    byRoom: { roomId: string | null; roomName: string; amount: number; tier: number | null }[];
  };
  stats?: {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    // Identificar usuário por phone (query param)
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Phone é obrigatório',
      });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    // Buscar saldo de créditos
    const credits = await getUserCreditsSummary(user.id);

    // Estatísticas de reservas
    const now = new Date();
    const [totalBookings, upcomingBookings, completedBookings] = await Promise.all([
      prisma.booking.count({
        where: { userId: user.id },
      }),
      prisma.booking.count({
        where: {
          userId: user.id,
          startTime: { gt: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      }),
      prisma.booking.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
      credits,
      stats: {
        totalBookings,
        upcomingBookings,
        completedBookings,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno',
    });
  }
}
