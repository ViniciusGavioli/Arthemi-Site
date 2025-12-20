// ===========================================================
// API: POST /api/admin/credits/create - Criar crédito manual
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createManualCredit } from '@/lib/business-rules';
import { logAdminAction, type AuditAction } from '@/lib/audit';

const createCreditSchema = z.object({
  userId: z.string().min(1, 'userId é obrigatório'),
  userPhone: z.string().optional(), // Alternativa ao userId
  roomId: z.string().optional(), // Se não informado, crédito genérico
  amount: z.number().positive('Valor deve ser positivo'), // Em centavos
  type: z.enum(['PROMO', 'MANUAL', 'SATURDAY']).default('MANUAL'),
  expiresInMonths: z.number().min(1).max(24).optional(),
  notes: z.string().optional(),
});

interface ApiResponse {
  success: boolean;
  creditId?: string;
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

  // TODO: Verificar autenticação admin via cookie
  const adminToken = req.cookies.admin_token;
  if (!adminToken) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado',
    });
  }

  try {
    const validation = createCreditSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;

    // Se passou userPhone ao invés de userId, buscar usuário
    let userId = data.userId;
    if (data.userPhone && !data.userId) {
      const user = await prisma.user.findUnique({
        where: { phone: data.userPhone },
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
        });
      }
      userId = user.id;
    }

    // Verificar se sala existe (se informada)
    if (data.roomId) {
      const room = await prisma.room.findUnique({
        where: { id: data.roomId },
      });
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Sala não encontrada',
        });
      }
    }

    // Criar crédito
    const credit = await createManualCredit({
      userId,
      roomId: data.roomId,
      amount: data.amount,
      type: data.type,
      expiresInMonths: data.expiresInMonths,
      notes: data.notes,
    });

    // Log de auditoria
    await logAdminAction(
      'CREDIT_CREATED',
      'Credit',
      credit.id,
      {
        userId,
        roomId: data.roomId,
        amount: data.amount,
        type: data.type,
      },
      req
    );

    return res.status(201).json({
      success: true,
      creditId: credit.id,
    });
  } catch (error) {
    console.error('Erro ao criar crédito:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar crédito',
    });
  }
}
