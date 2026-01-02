// ===========================================================
// API: GET /api/rooms - Lista de consultórios
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface RoomData {
  id: string;
  name: string;
  slug: string;
  tier: number;
  pricePerHour: number;
  isActive: boolean;
}

interface ApiResponse {
  success: boolean;
  rooms?: RoomData[];
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
    // Buscar salas ativas ordenadas por tier e nome
    const rooms = await prisma.room.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        pricePerHour: true,
        isActive: true,
      },
      orderBy: [
        { tier: 'asc' },
        { name: 'asc' },
      ],
    });

    return res.status(200).json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error('[API /rooms] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar salas',
    });
  }
}
