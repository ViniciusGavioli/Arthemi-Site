// ===========================================================
// API: GET /api/credits/[id]
// ===========================================================
// Busca detalhes de um crédito específico (para polling da página pending)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * API /api/credits/[id]
 * GET - Busca detalhes de um crédito específico
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do crédito é obrigatório' });
  }

  // Apenas GET suportado
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Método ${req.method} não permitido` });
  }

  // ======================================================
  // CACHE CONTROL: Dados transacionais NUNCA devem ser cacheados
  // O status do crédito muda via webhook (PENDING → CONFIRMED)
  // e o cliente precisa receber dados frescos em cada polling.
  // ======================================================
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const credit = await prisma.credit.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!credit) {
      return res.status(404).json({ error: 'Crédito não encontrado' });
    }

    // Retornar dados do crédito
    return res.status(200).json({
      id: credit.id,
      status: credit.status,
      amount: credit.amount,
      remainingAmount: credit.remainingAmount,
      type: credit.type,
      expiresAt: credit.expiresAt,
      createdAt: credit.createdAt,
      room: credit.room,
      user: {
        id: credit.user.id,
        name: credit.user.name,
      },
    });

  } catch (error) {
    console.error('[API] GET /api/credits/[id] error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
