// ===========================================================
// API: GET /api/user/credits - Créditos do usuário
// ===========================================================
// Autenticação via JWT (cookie arthemi_session)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAvailableCreditsForRoom, getUserCreditsSummary } from '@/lib/business-rules';
import { getAuthFromRequest } from '@/lib/auth';

// Tipos temporários para novos campos (até TS atualizar cache do Prisma)
interface ExtendedCredit {
  id: string;
  roomId?: string | null;
  room?: { name: string; tier?: number } | null;
  amount: number;
  remainingAmount: number;
  type: string;
  status: string;
  usageType?: string | null; // HOURLY | SHIFT | SATURDAY_HOURLY | SATURDAY_SHIFT
  expiresAt: Date | null;
  createdAt: Date;
}

interface CreditItem {
  id: string;
  roomId: string | null;
  roomName: string | null;
  roomTier: number | null;
  amount: number;
  remainingAmount: number;
  type: string;
  usageType: string | null; // HOURLY | SHIFT | SATURDAY_HOURLY | SATURDAY_SHIFT
  expiresAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  summary?: {
    total: number;
    totalHours: number;
    byRoom: { roomId: string | null; roomName: string; amount: number; hours: number; tier: number | null }[];
  };
  credits?: CreditItem[];
  // FIX E: Informação sobre créditos pendentes
  hasPendingCredits?: boolean;
  pendingCreditsCount?: number;
  availableForRoom?: {
    roomId: string;
    roomName: string;
    available: number;
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
    const { roomId, date } = req.query;

    // Autenticação JWT obrigatória
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const userId = auth.userId;

    // Se passou roomId, busca créditos disponíveis para aquela sala
    if (roomId && typeof roomId === 'string') {
      const bookingDate = date ? new Date(date as string) : new Date();
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Sala não encontrada',
        });
      }

      const availableCreditsRaw = await getAvailableCreditsForRoom(userId, roomId, bookingDate);
      // Cast para tipo estendido
      const availableCredits = availableCreditsRaw as unknown as ExtendedCredit[];
      const totalAvailable = availableCredits.reduce((sum, c) => sum + (c.remainingAmount || c.amount), 0);

      return res.status(200).json({
        success: true,
        availableForRoom: {
          roomId,
          roomName: room.name,
          available: totalAvailable,
        },
        credits: availableCredits.map((c: ExtendedCredit) => ({
          id: c.id,
          roomId: c.roomId ?? null,
          roomName: c.room?.name ?? null,
          roomTier: c.room?.tier ?? null,
          amount: c.amount,
          remainingAmount: c.remainingAmount || c.amount,
          type: c.type,
          usageType: c.usageType ?? null,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
      });
    }

    // Caso geral: retorna resumo + lista completa
    const summary = await getUserCreditsSummary(userId);

    // Cast para any temporário - Prisma types ainda não atualizados no TS
    const allCredits = await (prisma.credit as any).findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        remainingAmount: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: { room: true },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    }) as ExtendedCredit[];

    // FIX E: Contar créditos pendentes (últimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingCredits = await (prisma.credit as any).count({
      where: {
        userId,
        status: 'PENDING',
        createdAt: { gte: oneDayAgo },
      },
    });

    return res.status(200).json({
      success: true,
      summary,
      // FIX E: Incluir informação de pendentes
      hasPendingCredits: pendingCredits > 0,
      pendingCreditsCount: pendingCredits,
      credits: allCredits.map((c: ExtendedCredit) => ({
        id: c.id,
        roomId: c.roomId ?? null,
        roomName: c.room?.name ?? null,
        roomTier: c.room?.tier ?? null,
        amount: c.amount,
        remainingAmount: c.remainingAmount,
        type: c.type,
        usageType: c.usageType ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar créditos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno',
    });
  }
}
