// ===========================================================
// API: POST /api/admin/credits/create - Criar crédito manual
// ===========================================================
// P1-5: Agora aplica desconto de cupom no backend

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { createManualCredit } from '@/lib/business-rules';
import { logAdminAction } from '@/lib/audit';
import { isValidCoupon, applyDiscount, getCouponInfo } from '@/lib/coupons';

const createCreditSchema = z.object({
  userId: z.string().min(1, 'userId é obrigatório'),
  userPhone: z.string().optional(), // Alternativa ao userId
  roomId: z.string().optional(), // Se não informado, crédito genérico
  amount: z.number().positive('Valor deve ser positivo'), // Em centavos (valor ORIGINAL)
  type: z.enum(['PROMO', 'MANUAL', 'SATURDAY']).default('MANUAL'),
  usageType: z.enum(['HOURLY', 'SHIFT', 'SATURDAY_HOURLY', 'SATURDAY_SHIFT']).optional(), // Regra de uso
  expiresInMonths: z.number().min(1).max(24).optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(), // P1-5: Cupom para aplicar desconto
});

interface ApiResponse {
  success: boolean;
  creditId?: string;
  originalAmount?: number;
  finalAmount?: number;
  discountAmount?: number;
  couponApplied?: string | null;
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

  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

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

    // P1-5: Validar e aplicar cupom no backend (não confiar no frontend)
    const originalAmount = data.amount;
    let finalAmount = data.amount;
    let discountAmount = 0;
    let couponApplied: string | null = null;
    
    if (data.couponCode) {
      const couponUpper = data.couponCode.toUpperCase().trim();
      
      if (!isValidCoupon(couponUpper)) {
        return res.status(400).json({
          success: false,
          error: `Cupom "${data.couponCode}" inválido. Cupons aceitos: TESTE50, ARTHEMI10, PRIMEIRACOMPRA`,
        });
      }
      
      const discountResult = applyDiscount(originalAmount, couponUpper);
      finalAmount = discountResult.finalAmount;
      discountAmount = discountResult.discountAmount;
      couponApplied = couponUpper;
    }
    
    // Criar crédito com valor final (após desconto)
    // Inclui cupom nas notas para rastreabilidade
    const notesWithCoupon = couponApplied 
      ? `${data.notes || ''} [Cupom: ${couponApplied}, Desconto: R$${discountAmount.toFixed(2)}]`.trim()
      : data.notes;
      
    const credit = await createManualCredit({
      userId,
      roomId: data.roomId,
      amount: finalAmount, // P1-5: Usar valor com desconto aplicado
      type: data.type,
      usageType: data.usageType,
      expiresInMonths: data.expiresInMonths,
      notes: notesWithCoupon,
    });

    // Log de auditoria
    await logAdminAction(
      'CREDIT_CREATED',
      'Credit',
      credit.id,
      {
        userId,
        roomId: data.roomId,
        originalAmount,
        finalAmount,
        discountAmount,
        couponApplied,
        type: data.type,
        usageType: data.usageType,
      },
      req
    );

    return res.status(201).json({
      success: true,
      creditId: credit.id,
      originalAmount,
      finalAmount,
      discountAmount,
      couponApplied,
    });
  } catch (error) {
    console.error('Erro ao criar crédito:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar crédito',
    });
  }
}
