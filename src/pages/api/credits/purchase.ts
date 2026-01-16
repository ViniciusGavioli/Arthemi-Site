// ===========================================================
// API: POST /api/credits/purchase
// ===========================================================
// Compra de pacote de créditos (NÃO cria booking)
// Fluxo: User + Payment + Credit (após confirmação)
// Suporta PIX e Cartão de Crédito
// P-003: Idempotência - não cria cobrança duplicada

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { createBookingPayment, createBookingCardPayment, normalizeAsaasError } from '@/lib/asaas';
import { brazilianPhone, validateCPF } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkApiRateLimit, getClientIp, sendRateLimitResponse } from '@/lib/api-rate-limit';
import { resolveOrCreateUser } from '@/lib/user-resolve';
import { getAuthFromRequest } from '@/lib/auth';
import { withTimeout, getSafeErrorMessage, TIMEOUTS } from '@/lib/production-safety';
import { isValidCoupon, applyDiscount, checkCouponUsage, recordCouponUsageIdempotent, createCouponSnapshot, getCouponInfo, validateDevCouponAccess } from '@/lib/coupons';
import { logPurchaseCreated } from '@/lib/operation-logger';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { recordPurchaseCreated } from '@/lib/audit-event';
import { triggerAccountActivation } from '@/lib/account-activation';
import { addDays } from 'date-fns';
import { computeCreditAmountCents } from '@/lib/credits';
import { getBookingTotalByDate } from '@/lib/pricing';
import { getMinPaymentAmountCents } from '@/lib/business-rules';
import { respondError } from '@/lib/errors';
import { 
  generatePurchaseIdempotencyKey, 
  checkPurchaseHasPayment,
} from '@/lib/payment-idempotency';

// Schema de validação
const purchaseCreditsSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  userCpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'CPF deve conter apenas números'),
  roomId: z.string().min(1, 'Sala é obrigatória'),
  productId: z.string().optional(), // Pacote específico (ID do banco)
  productType: z.string().optional(), // Tipo de produto (SHIFT_FIXED, SATURDAY_SHIFT, etc)
  hours: z.number().min(1).max(20).optional(), // OU horas avulsas
  couponCode: z.string().optional(),
  // Método de pagamento
  paymentMethod: z.enum(['PIX', 'CARD']).optional().default('PIX'),
  installmentCount: z.number().min(1).max(12).optional(),
}).refine(data => data.productId || data.productType || data.hours, {
  message: 'Deve informar productId, productType ou hours',
});

// Cupons válidos: centralizados em /lib/coupons.ts (P1-5)

// Helper: mapear ProductType → CreditUsageType
// Retorna o tipo de uso do crédito baseado no tipo do produto
type CreditUsageType = 'HOURLY' | 'SHIFT' | 'SATURDAY_HOURLY' | 'SATURDAY_SHIFT';
function getUsageTypeFromProduct(productType: string | null): CreditUsageType {
  if (!productType) return 'HOURLY'; // Horas avulsas sem produto

  switch (productType) {
    case 'SHIFT_FIXED':
      return 'SHIFT';
    case 'SATURDAY_SHIFT':
      return 'SATURDAY_SHIFT';
    case 'SATURDAY_HOUR':
      return 'SATURDAY_HOURLY';
    // HOURLY_RATE, PACKAGE_10H, PACKAGE_20H, PACKAGE_40H → HOURLY
    default:
      return 'HOURLY';
  }
}

interface ApiResponse {
  success: boolean;
  creditId?: string;
  paymentUrl?: string;
  amount?: number;
  error?: string;
  code?: string; // Código de erro para frontend
  message?: string; // Mensagem amigável para erros
  details?: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // OBSERVABILIDADE: Gerar requestId para correlation
  const requestId = generateRequestId();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  const startTime = Date.now();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    console.log(`[API] POST /api/credits/purchase START`, JSON.stringify({ requestId }));

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

    // RATE LIMIT EM MEMÓRIA (5 req/min por IP) - Barreira rápida
    const clientIp = getClientIp(req);
    const memRateLimit = checkApiRateLimit('credits/purchase', clientIp);
    if (!memRateLimit.allowed) {
      return sendRateLimitResponse(res, memRateLimit);
    }

    // Rate limiting adicional (DB)

    const ipRateLimit = await checkRateLimit(clientIp, 'purchase-credits', {
      windowMinutes: 60,
      maxRequests: 20,
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

    // Verificar sala (busca por id ou fallback por slug)
    let room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    // Fallback: se não encontrar por id, tenta por slug
    if (!room) {
      room = await prisma.room.findUnique({
        where: { slug: data.roomId },
      });
    }

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou inativa.',
      });
    }

    // Usar o ID real da sala para as queries subsequentes
    const realRoomId = room.id;

    // Determinar se é compra de horas avulsas ou pacote
    let creditHours: number;
    let amount: number;
    let productName: string;
    let validityDays = 365; // padrão 1 ano
    let productType: string | null = null; // Para determinar usageType do crédito

    if (data.hours) {
      // Compra de horas avulsas
      creditHours = data.hours;
      // Usar helper PRICES_V3: default para HOURLY_RATE (dia útil, sem data booking)
      try {
        amount = Math.round(getBookingTotalByDate(realRoomId, new Date(), data.hours, room.slug) * 100);
      } catch (err) {
        console.error('[CREDITS] Erro ao calcular preço de horas:', err);
        throw new Error(`Erro ao calcular o preço do crédito: ${err instanceof Error ? err.message : 'Desconhecido'}`);
      }
      productName = `${data.hours} hora${data.hours > 1 ? 's' : ''} avulsa${data.hours > 1 ? 's' : ''}`;
      productType = null; // Horas avulsas → HOURLY
    } else if (data.productType) {
      // Compra por tipo de produto (SHIFT_FIXED, SATURDAY_SHIFT, etc)
      const product = await prisma.product.findFirst({
        where: { 
          roomId: realRoomId,
          type: data.productType as any, // Cast necessário - validado pelo schema
          isActive: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado ou inativo.',
        });
      }

      // Bloquear produtos descontinuados (DAY_PASS, SATURDAY_5H)
      const discontinuedTypes = ['DAY_PASS', 'SATURDAY_5H'];
      if (discontinuedTypes.includes(product.type)) {
        return res.status(400).json({
          success: false,
          error: 'Este produto foi descontinuado e não está mais disponível para compra.',
        });
      }

      creditHours = product.hoursIncluded || 0;
      amount = product.price;
      productName = product.name;
      validityDays = product.validityDays || 365;
      productType = product.type; // Captura tipo para definir usageType
    } else if (data.productId) {
      // Compra de pacote por ID (legado)
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

      // Bloquear produtos descontinuados (DAY_PASS, SATURDAY_5H)
      const discontinuedTypes = ['DAY_PASS', 'SATURDAY_5H'];
      if (discontinuedTypes.includes(product.type)) {
        return res.status(400).json({
          success: false,
          error: 'Este produto foi descontinuado e não está mais disponível para compra.',
        });
      }

      creditHours = product.hoursIncluded || 0;
      amount = product.price;
      productName = product.name;
      validityDays = product.validityDays || 365;
      productType = product.type; // Captura tipo para definir usageType
    } else {
      return res.status(400).json({
        success: false,
        error: 'Deve informar hours, productType ou productId.',
      });
    }

    // ========== AUDITORIA: Guardar valor bruto antes de cupom ==========
    const grossAmount = amount;
    let discountAmount = 0;
    let couponApplied: string | null = null;
    let couponSnapshot: object | null = null;

    // ========== VALIDAÇÃO DE DEV COUPON (ANTES de aplicar) ==========
    // DEV coupon em produção REQUER sessão autenticada com email na whitelist
    // NUNCA confiar em email do body para autorizar DEV coupon
    const auth = getAuthFromRequest(req);
    const sessionEmail = auth?.userId ? null : null; // Buscaremos no banco dentro da transação
    
    // Pré-validação: se é DEV coupon e NÃO tem sessão, bloqueia imediatamente
    if (data.couponCode) {
      const couponKey = data.couponCode.toUpperCase().trim();
      const couponConfig = getCouponInfo(couponKey);
      
      if (couponConfig?.isDevCoupon && !auth?.userId) {
        // DEV coupon sem sessão: bloqueia
        console.log(`[DEV_COUPON] ${requestId} | isDevCoupon=true | hasSession=false | BLOCKED`);
        return res.status(403).json({
          success: false,
          code: 'DEV_COUPON_NO_SESSION',
          error: 'Cupom de teste requer login.',
        });
      }
    }

    // Aplicar cupom (P1-5: usando lib/coupons centralizada)
    if (data.couponCode) {
      const couponKey = data.couponCode.toUpperCase().trim();
      
      // Validar cupom ANTES de aplicar - retornar erro claro se inválido
      if (!isValidCoupon(couponKey)) {
        return res.status(400).json({
          success: false,
          code: 'COUPON_INVALID',
          error: 'Cupom inválido ou não aplicável.',
        });
      }
      
      // Cupom válido - aplicar desconto
      const discountResult = applyDiscount(amount, couponKey);
      discountAmount = discountResult.discountAmount;
      amount = discountResult.finalAmount;
      couponApplied = couponKey;
      couponSnapshot = createCouponSnapshot(couponKey);
    }
    
    // netAmount é o valor após desconto
    const netAmount = amount;

    // ========== VALIDAÇÃO PIX MÍNIMO R$1,00 ==========
    // Asaas exige mínimo de R$1,00 para cobranças PIX
    if (data.paymentMethod === 'PIX' && netAmount < 100) {
      return res.status(400).json({
        success: false,
        code: 'PIX_MIN_AMOUNT',
        error: 'Pagamento via PIX exige mínimo de R$ 1,00. Escolha cartão ou ajuste o valor.',
      });
    }

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      // Determinar userId: sessão (logado) ou resolveOrCreateUser (checkout anônimo)
      // NOTA: 'auth' já foi obtido antes para pré-validação de DEV coupon
      let userId: string;
      let sessionEmail: string | null = null; // Email da SESSÃO (não do body)
      let isAnonymousCheckout = false;
      
      if (auth?.userId) {
        // LOGADO: usar userId da sessão diretamente
        // NÃO chamar resolveOrCreateUser - email/phone do body são ignorados
        userId = auth.userId;
        // Buscar email do usuário logado para validação de cupom DEV
        const loggedUser = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        sessionEmail = loggedUser?.email || null;
      } else {
        // NÃO LOGADO: resolver por email > phone
        const { user } = await resolveOrCreateUser(tx, {
          name: data.userName,
          email: data.userEmail,
          phone: data.userPhone,
          cpf: data.userCpf,
        });
        userId = user.id;
        // SEGURANÇA: NÃO usar email do body para validar DEV coupon
        // sessionEmail permanece null para checkout anônimo
        isAnonymousCheckout = true; // Flag para disparo de email de ativação
      }

      // P1-5: Verificar se usuário pode usar este cupom (ex: PRIMEIRACOMPRA single-use)
      // DEV coupon: sessionEmail vem da SESSÃO, não do body
      let isDevCoupon = false;
      if (couponApplied) {
        // Validar acesso ao DEV coupon usando email da SESSÃO
        const devCheck = validateDevCouponAccess(couponApplied, sessionEmail, requestId);
        if (!devCheck.allowed) {
          throw new Error(`DEV_COUPON_BLOCKED: ${devCheck.reason}`);
        }
        
        // Validar uso do cupom (PRIMEIRACOMPRA, etc)
        const usageCheck = await checkCouponUsage(tx, userId, couponApplied, 'CREDIT_PURCHASE', sessionEmail);
        if (!usageCheck.canUse) {
          throw new Error(`CUPOM_INVALIDO: ${usageCheck.reason}`);
        }
        isDevCoupon = usageCheck.isDevCoupon || false;
      }

      // Criar crédito PENDENTE (será ativado após pagamento)
      // Usar helper PRICES_V3: calcular creditAmount baseado no tipo do produto
      let creditAmount: number;
      try {
        creditAmount = computeCreditAmountCents({
          amountCents: amount,
          isHoursPurchase: !!data.hours,
          roomId: realRoomId,
          creditHours,
          roomSlug: room.slug,
        });
      } catch (err) {
        console.error('[CREDITS] Erro ao calcular creditAmount:', err);
        throw new Error(`Erro ao calcular o valor do crédito: ${err instanceof Error ? err.message : 'Desconhecido'}`);
      }
      const now = new Date();
      const expiresAt = addDays(now, validityDays);

      // Determinar usageType baseado no tipo do produto
      const usageType = getUsageTypeFromProduct(productType);

      // ========== CRIAR CRÉDITO ==========
      // Campos de auditoria requerem migração 20260110220000_coupon_audit_refund
      const credit = await tx.credit.create({
        data: {
          userId: userId,
          roomId: realRoomId,
          amount: creditAmount,
          remainingAmount: 0, // Será atualizado para creditAmount após pagamento
          type: 'MANUAL' as const, // Usando MANUAL para compras
          usageType, // Regra de uso: HOURLY, SHIFT, SATURDAY_HOURLY, etc
          status: 'PENDING' as const, // Pendente até pagamento confirmado
          referenceMonth: now.getMonth() + 1,
          referenceYear: now.getFullYear(),
          expiresAt,
          // Campos de auditoria de desconto/cupom
          grossAmount,
          discountAmount,
          netAmount,
          couponCode: couponApplied,
          couponSnapshot: couponSnapshot || undefined,
        },
      });

      // ========== REGISTRAR USO DO CUPOM (Idempotente - Anti-fraude) ==========
      // Cupom DEV (isDevCoupon=true) → NÃO registra uso (uso infinito)
      if (couponApplied) {
        const couponResult = await recordCouponUsageIdempotent(tx, {
          userId,
          couponCode: couponApplied,
          context: 'CREDIT_PURCHASE',
          creditId: credit.id,
          isDevCoupon, // Se true, skip registro (cupom DEV)
        });
        
        if (!couponResult.ok) {
          throw new Error(`COUPON_ALREADY_USED:${couponApplied}`);
        }
      }

      return { userId, credit, isAnonymousCheckout };
    });

    // ATIVAÇÃO DE CONTA (best-effort) - Apenas checkout anônimo
    if (result.isAnonymousCheckout && data.userEmail) {
      triggerAccountActivation({
        userId: result.userId,
        userEmail: data.userEmail,
        userName: data.userName,
      }).catch((err) => {
        console.error('❌ [ACTIVATION] Erro não tratado:', err);
      });
    }

    // LOG DE OPERAÇÃO - Purchase criado
    logPurchaseCreated({
      creditId: result.credit.id,
      userId: result.userId,
      email: data.userEmail,
      ip: clientIp,
      amount,
      paymentMethod: data.paymentMethod || 'PIX',
      hours: creditHours,
      roomId: realRoomId,
    });

    // AUDIT EVENT (DB) - Best-effort
    recordPurchaseCreated({
      requestId,
      userId: result.userId,
      creditId: result.credit.id,
      roomId: realRoomId,
      amount,
      hours: creditHours,
      paymentMethod: data.paymentMethod || 'PIX',
    });

    // Criar pagamento no Asaas (PIX ou Cartão)
    // P-003: Gerar idempotencyKey e verificar se já existe pagamento
    const idempotencyKey = generatePurchaseIdempotencyKey(result.credit.id, data.paymentMethod || 'PIX');
    const existingPayment = await checkPurchaseHasPayment(result.credit.id);
    
    if (existingPayment.exists && existingPayment.existingPayment) {
      console.log(`♻️ [CREDITS] Pagamento já existe (idempotência): ${existingPayment.existingPayment.id}`);
      return res.status(200).json({
        success: true,
        creditId: result.credit.id,
        paymentUrl: existingPayment.existingPayment.externalUrl || undefined,
        amount,
      });
    }

    // Validação preventiva de valor mínimo
    const paymentMethodType = data.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX';
    const minAmount = getMinPaymentAmountCents(paymentMethodType);
    
    if (amount < minAmount) {
      // Excluir crédito pendente criado
      await prisma.credit.delete({
        where: { id: result.credit.id },
      });
      
      return res.status(400).json({
        success: false,
        error: `Valor abaixo do mínimo permitido para ${paymentMethodType === 'PIX' ? 'PIX' : 'cartão'}.`,
        code: 'PAYMENT_MIN_AMOUNT',
        details: {
          minAmountCents: minAmount,
          paymentMethod: paymentMethodType,
        },
      });
    }

    const basePaymentInput = {
      bookingId: `purchase:${result.credit.id}`, // Prefixo 'purchase:' para distinguir de 'booking:' no webhook
      customerName: data.userName,
      customerPhone: data.userPhone,
      customerCpf: data.userCpf,
      customerEmail: data.userEmail || `${data.userPhone}@temp.arthemi.com.br`,
      value: amount, // Em centavos
      description: `${productName} - ${room.name}`,
    };

    let paymentResult;
    
    if (data.paymentMethod === 'CARD') {
      // Pagamento por Cartão (com timeout)
      paymentResult = await withTimeout(
        createBookingCardPayment({
          ...basePaymentInput,
          installmentCount: data.installmentCount || 1,
        }),
        TIMEOUTS.PAYMENT_CREATE,
        'criação de pagamento cartão'
      );
      console.log(`[CREDIT] Pagamento CARTÃO criado: ${paymentResult.paymentId}`);
    } else {
      // Pagamento por PIX (default) (com timeout)
      paymentResult = await withTimeout(
        createBookingPayment(basePaymentInput),
        TIMEOUTS.PAYMENT_CREATE,
        'criação de pagamento PIX'
      );
      console.log(`[CREDIT] Pagamento PIX criado: ${paymentResult.paymentId}`);
    }

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

    // P-003: Criar registro de Payment com idempotencyKey e purchaseId
    await prisma.payment.create({
      data: {
        purchaseId: result.credit.id,
        userId: result.userId,
        amount,
        status: 'PENDING',
        method: data.paymentMethod || 'PIX',
        externalId: paymentResult.paymentId,
        externalUrl: paymentResult.invoiceUrl,
        idempotencyKey,
      },
    });

    // Nota: O webhook de pagamento irá ativar o crédito quando confirmado
    // usando o externalReference que começa com 'purchase:' (ou 'credit_' para retrocompatibilidade)

    // Log
    await logUserAction(
      'CREDIT_CREATED',
      data.userEmail || data.userPhone,
      'Credit',
      result.credit.id,
      {
        roomId: realRoomId,
        roomName: room.name,
        productName,
        hours: creditHours,
        amount,
        couponApplied,
        paymentId: paymentResult.paymentId,
        status: 'PENDING',
      }
    );

    console.log(`[CREDIT] Compra iniciada: ${result.credit.id} - ${productName} - R$ ${(amount / 100).toFixed(2)}`);

    console.log(`[API] POST /api/credits/purchase END`, JSON.stringify({ 
      requestId, 
      statusCode: 201, 
      duration: Date.now() - startTime 
    }));

    return res.status(201).json({
      success: true,
      creditId: result.credit.id,
      paymentUrl: paymentResult.invoiceUrl,
      amount,
    });

  } catch (error) {
    // Handler centralizado de erros
    return respondError(res, error, requestId, {
      endpoint: '/api/credits/purchase',
      method: 'POST',
      extra: { startTime },
    });
  }
}