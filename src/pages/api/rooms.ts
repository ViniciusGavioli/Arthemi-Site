// ===========================================================
// API: GET /api/rooms
// ===========================================================
// Lista todas as salas disponíveis para reserva

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { PRICES_V3 } from '@/constants/prices';

interface Room {
  id: string;
  name: string;
  slug: string;
  pricePerHour: number;
  tier: number;
}

interface ApiResponse {
  success: boolean;
  rooms?: Room[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
      },
      orderBy: { tier: 'asc' },
    });

    // Adiciona preço por hora de cada sala
    const roomsWithPrices: Room[] = rooms.map((room) => {
      // Mapeia slug para chave de preço
      const priceKey = room.slug === 'sala-a' ? 'SALA_A' 
        : room.slug === 'sala-b' ? 'SALA_B' 
        : 'SALA_C';
      
      const priceConfig = PRICES_V3[priceKey as keyof typeof PRICES_V3];
      
      // Converte de reais para centavos
      const hourlyRateCents = Math.round((priceConfig?.prices?.HOURLY_RATE || 60) * 100);
      
      return {
        id: room.id,
        name: room.name,
        slug: room.slug,
        pricePerHour: hourlyRateCents,
        tier: room.tier,
      };
    });

    return res.status(200).json({
      success: true,
      rooms: roomsWithPrices,
    });

  } catch (error) {
    console.error('[API /rooms] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
