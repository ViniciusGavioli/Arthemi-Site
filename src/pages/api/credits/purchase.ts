// ===========================================================
// API: POST /api/credits/purchase
// ===========================================================
// Compra de pacote de créditos (NÃO cria booking)
// Fluxo: User + Payment + Credit (após confirmação)

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { createBookingPayment } from '@/lib/asaas';
import { brazilianPhone, validateCPF } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { addDays } from 'date-fns';

// Schema de validação
const purchaseCreditsSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  userCpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'CPF deve conter apenas números'),
  roomId: z.string().min(1, 'Sala é obrigatória'),
  productId: z.string().min(1, 'Produto é obrigatório'),
  couponCode: z.string().optional(),
});

// Cupons válidos
const VALID_COUPONS: Record<string, { discountType: 'fixed' | 'percent'; value: number }> = {
  'TESTE50': { discountType: 'fixed', value: -1 }, // -1 = preço fixo de R$ 5,00
};

interface ApiResponse {
  success: boolean;
  creditId?: string;
  paymentUrl?: string;
  amount?: number;
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

  try {
    // Validação
    const validation = purchaseCreditsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;

    // Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     (req.headers['x-real-ip'] as string) || 
                     'unknown';

    const ipRateLimit = await checkRateLimit(clientIp, 'purchase-credits', {
      windowMinutes: 60,
      maxRequests: 10,
    });

    if (!ipRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Muitas tentativas. Tente novamente após ${ipRateLimit.resetAt.toLocaleTimeString('pt-BR')}.`,
      });
    }

    // Validar CPF
    if (!validateCPF(data.userCpf)) {
      return res.status(400).json({
        success: false,
        error: 'CPF inválido.',
      });
    }

    // Buscar produto
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado ou inativo.',
      });
    }

    // Verificar que é um pacote (não hora avulsa)
    if (product.type === 'HOURLY_RATE') {
      return res.status(400).json({
        success: false,
        error: 'Use o fluxo de reserva para hora avulsa.',
      });
    }

    // Verificar sala
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa.',
      });
    }

    // Calcular valor
    let amount = product.price;
    let couponApplied: string | null = null;

    if (data.couponCode) {
      const couponKey = data.couponCode.toUpperCase().trim();
      const coupon = VALID_COUPONS[couponKey];
      
      if (coupon) {
        if (coupon.discountType === 'fixed' && coupon.value === -1) {
          amount = 500; // R$ 5,00
        } else if (coupon.discountType === 'fixed') {
          amount = Math.max(0, amount - coupon.value);
        } else if (coupon.discountType === 'percent') {
          amount = Math.round(amount * (1 - coupon.value / 100));
        }
        couponApplied = couponKey;
      }
    }

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      // Buscar ou criar usuário
      let user = await tx.user.findUnique({
        where: { phone: data.userPhone },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            name: data.userName,
            phone: data.userPhone,
            email: data.userEmail || `${data.userPhone}@temp.arthemi.com.br`,
            cpf: data.userCpf,
            role: 'CUSTOMER',
          },
        });
      } else if (!user.cpf && data.userCpf) {
        // Atualizar CPF se não tinha
        user = await tx.user.update({
          where: { id: user.id },
          data: { cpf: data.userCpf },
        });
      }

      // Criar crédito PENDENTE (será ativado após pagamento)
      // Valor em centavos baseado nas horas do pacote * hourlyRate da sala
      const creditHours = product.hoursIncluded || 0;
      const creditAmount = creditHours * room.hourlyRate; // Valor em centavos
      const now = new Date();
      const expiresAt = addDays(now, product.validityDays || 365);

      const credit = await tx.credit.create({
        data: {
          userId: user.id,
          roomId: data.roomId,
          amount: creditAmount,
          remainingAmount: 0, // Será atualizado para creditAmount após pagamento
          type: 'MANUAL', // Usando MANUAL para compras - TODO: adicionar PACKAGE
          status: 'PENDING', // Pendente até pagamento confirmado
          referenceMonth: now.getMonth() + 1,
          referenceYear: now.getFullYear(),
          expiresAt,
        },
      });

      return { user, credit, creditHours };
    });

    // Criar pagamento no Asaas
    const paymentResult = await createBookingPayment({
      bookingId: `credit_${result.credit.id}`, // Prefixo para identificar no webhook
      customerName: data.userName,
      customerPhone: data.userPhone,
      customerCpf: data.userCpf,
      customerEmail: data.userEmail || `${data.userPhone}@temp.arthemi.com.br`,
      value: amount, // Em centavos
      description: `${product.name} - ${room.name}`,
    });

    if (!paymentResult || !paymentResult.invoiceUrl) {
      // Rollback - excluir crédito pendente
      await prisma.credit.delete({
        where: { id: result.credit.id },
      });

      return res.status(500).json({
        success: false,
        error: 'Erro ao criar pagamento. Tente novamente.',
      });
    }

    // Nota: O webhook de pagamento irá ativar o crédito quando confirmado
    // usando o externalReference que começa com 'credit_'

    // Log
    await logUserAction(
      'CREDIT_CREATED',
      data.userEmail || data.userPhone,
      'Credit',
      result.credit.id,
      {
        roomId: data.roomId,
        roomName: room.name,
        productName: product.name,
        hours: result.creditHours,
        amount,
        couponApplied,
        paymentId: paymentResult.paymentId,
        status: 'PENDING',
      }
    );

    console.log(`[CREDIT] Compra iniciada: ${result.credit.id} - ${product.name} - R$ ${(amount / 100).toFixed(2)}`);

    return res.status(201).json({
      success: true,
      creditId: result.credit.id,
      paymentUrl: paymentResult.invoiceUrl,
      amount,
    });

  } catch (error) {
    console.error('[CREDIT] Erro na compra:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}
