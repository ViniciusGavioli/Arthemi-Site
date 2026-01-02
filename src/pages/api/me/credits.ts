// ===========================================================
// API: GET /api/me/credits - Créditos do Usuário Logado
// ===========================================================
// Usa autenticação JWT (cookie arthemi_session)
// Retorna créditos agrupados por consultório

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { CreditStatus } from '@prisma/client';

interface CreditsByRoom {
  roomId: string | null;
  roomName: string;
  roomTier: number | null;
  totalAmount: number;       // Total de horas (em minutos)
  remainingAmount: number;   // Horas restantes (em minutos)
  credits: {
    id: string;
    amount: number;
    remainingAmount: number;
    type: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
  }[];
}

interface ApiResponse {
  ok: boolean;
  summary?: {
    totalRemaining: number;  // Total geral restante (em minutos)
    byRoom: CreditsByRoom[];
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Autenticação JWT
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  try {
    // Buscar créditos confirmados do usuário
    const credits = await prisma.credit.findMany({
      where: {
        userId: auth.userId,
        status: CreditStatus.CONFIRMED,
        remainingAmount: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
      orderBy: [
        { expiresAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Agrupar por consultório
    const byRoomMap = new Map<string, CreditsByRoom>();

    for (const credit of credits) {
      const key = credit.roomId || 'general';
      
      if (!byRoomMap.has(key)) {
        byRoomMap.set(key, {
          roomId: credit.roomId,
          roomName: credit.room?.name || 'Crédito Geral',
          roomTier: credit.room?.tier ?? null,
          totalAmount: 0,
          remainingAmount: 0,
          credits: [],
        });
      }

      const group = byRoomMap.get(key)!;
      group.totalAmount += credit.amount;
      group.remainingAmount += credit.remainingAmount;
      group.credits.push({
        id: credit.id,
        amount: credit.amount,
        remainingAmount: credit.remainingAmount,
        type: credit.type,
        status: credit.status,
        expiresAt: credit.expiresAt?.toISOString() ?? null,
        createdAt: credit.createdAt.toISOString(),
      });
    }

    // Calcular total geral
    const totalRemaining = Array.from(byRoomMap.values()).reduce(
      (sum, group) => sum + group.remainingAmount,
      0
    );

    return res.status(200).json({
      ok: true,
      summary: {
        totalRemaining,
        byRoom: Array.from(byRoomMap.values()),
      },
    });

  } catch (error) {
    console.error('❌ [API /me/credits] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
