// ===========================================================
// API: POST /api/bookings - Criar reserva
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma, { isOverbookingError, OVERBOOKING_ERROR_MESSAGE } from '@/lib/prisma';
import { createBookingPayment, createBookingCardPayment, createAsaasCheckoutForBooking, normalizeAsaasError } from '@/lib/asaas';
import { brazilianPhone, validateCPF } from '@/lib/validations';
import { logUserAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkApiRateLimit, getClientIp, sendRateLimitResponse } from '@/lib/api-rate-limit';
import { resolveOrCreateUser } from '@/lib/user-resolve';
import { getAuthFromRequest } from '@/lib/auth';
import {
  withTimeout,
  getSafeErrorMessage,
  TIMEOUTS,
  cpfInUseByOther,
} from '@/lib/production-safety';
import { isValidCoupon, applyDiscount, checkCouponUsage, recordCouponUsageIdempotent, createCouponSnapshot, getCouponInfo, validateDevCouponAccess, areCouponsEnabled } from '@/lib/coupons';
import {
  getAvailableCreditsForRoom,
  consumeCreditsForBooking,
  getCreditBalanceForRoom,
  validateBookingWindow,
  isBookingWithinBusinessHours,
  validateUniversalBookingWindow,
  PENDING_BOOKING_EXPIRATION_HOURS,
  getMinPaymentAmountCents,
} from '@/lib/business-rules';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';
import { sendPixPendingEmail, BookingEmailData } from '@/lib/email';
import { logBookingCreated } from '@/lib/operation-logger';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { recordBookingCreated } from '@/lib/audit-event';
import {
  checkBookingHasActivePayment,
  generateBookingIdempotencyKey,
} from '@/lib/payment-idempotency';
import { triggerAccountActivation } from '@/lib/account-activation';
import { requireEmailVerifiedForBooking } from '@/lib/email-verification';
import { getBookingTotalByDate } from '@/lib/pricing';
import { toCents, assertIntegerCents } from '@/lib/money';
import { respondError, isOverbookingPrismaError, BusinessError } from '@/lib/errors';


// Schema de validação com Zod
const createBookingSchema = z.object({
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
  userEmail: z.string().email('Email inválido').optional(),
  userCpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'CPF deve conter apenas números'),
  professionalRegister: z.string().optional(), // Opcional aqui pois o usuário pode já ter no banco
  productId: z.string().optional(),
  roomId: z.string().min(1, 'Sala é obrigatória'),
  startAt: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endAt: z.string().datetime({ message: 'Data/hora de término inválida' }),
  payNow: z.boolean().default(false),
  useCredits: z.boolean().default(false),
  couponCode: z.string().optional(),
  notes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
  // Método de pagamento: PIX (default) ou CARD
  paymentMethod: z.enum(['PIX', 'CARD']).default('PIX'),
  // Parcelamento (apenas para CARD, 1-12)
  installmentCount: z.number().min(1).max(10).optional(),
  // Valores de parcelamento sincronizados (calculados pela utility financial.ts)
  adjustedTotalCents: z.number().int().positive().optional(),
  installmentValueCents: z.number().int().positive().optional(),
});


// Cupons válidos: centralizados em /lib/coupons.ts (P1-5)

type CreateBookingInput = z.infer<typeof createBookingSchema>;

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  paymentUrl?: string;
  paymentId?: string | null; // ID externo do pagamento (para debug)
  paymentMethod?: 'PIX' | 'CREDIT_CARD';
  installmentCount?: number;
  installmentValue?: number;
  creditsUsed?: number;
  amountToPay?: number;
  emailSent?: boolean;
  error?: string;
  code?: string; // Código de erro padronizado (ex: COUPON_INVALID, COUPON_ALREADY_USED)
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

  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    console.log(`[API] POST /api/bookings START`, JSON.stringify({ requestId }));

    // 1. Validar body com Zod
    const validation = createBookingSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data: CreateBookingInput = validation.data;

    // RATE LIMIT EM MEMÓRIA (5 req/min por IP) - Barreira rápida
    const clientIp = getClientIp(req);
    const memRateLimit = checkApiRateLimit('bookings', clientIp);
    if (!memRateLimit.allowed) {
      return sendRateLimitResponse(res, memRateLimit);
    }

    // RATE LIMITING ADICIONAL (DB) - Por IP e por telefone

    const ipRateLimit = await checkRateLimit(clientIp, 'create-booking', {
      windowMinutes: 60,
      maxRequests: 30, // 30 tentativas por hora por IP
    });

    if (!ipRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Muitas tentativas. Tente novamente após ${ipRateLimit.resetAt.toLocaleTimeString('pt-BR')}.`,
      });
    }

    const phoneRateLimit = await checkRateLimit(data.userPhone, 'create-booking', {
      windowMinutes: 60,
      maxRequests: 10, // 10 reservas por hora por telefone
    });

    if (!phoneRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Muitas reservas recentes. Tente novamente após ${phoneRateLimit.resetAt.toLocaleTimeString('pt-BR')}.`,
      });
    }

    // VALIDAÇÃO REAL DE CPF - Backend é fonte da verdade
    if (!validateCPF(data.userCpf)) {
      console.error(`[BOOKING] CPF inválido rejeitado: ${data.userCpf.slice(0, 3)}***`);
      return res.status(400).json({
        success: false,
        error: 'CPF inválido. Verifique os dados e tente novamente.',
      });
    }

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);

    // 2. Validar que endAt > startAt
    if (endAt <= startAt) {
      return res.status(400).json({
        success: false,
        error: 'Horário de término deve ser após o início',
      });
    }

    // 2.1 Validar horário de funcionamento (Seg-Sex 08-20, Sáb 08-12, Dom fechado)
    if (!isBookingWithinBusinessHours(startAt, endAt)) {
      return res.status(400).json({
        success: false,
        error: 'Horário fora do expediente. Seg-Sex: 08h-20h, Sáb: 08h-12h, Dom: fechado.',
      });
    }

    // P-009: VALIDAÇÃO UNIVERSAL - Reservas limitadas a 30 dias a partir de hoje
    const windowValidation = validateUniversalBookingWindow(startAt);
    if (!windowValidation.valid) {
      return res.status(400).json({
        success: false,
        error: windowValidation.error || 'Data fora da janela de reserva permitida.',
      });
    }

    // 3. Verificar se sala existe (busca por id ou fallback por slug)
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
        error: 'Sala não encontrada ou inativa',
      });
    }

    // Usar o ID real da sala para as queries subsequentes
    const realRoomId = room.id;

    // ========== PRÉ-VALIDAÇÃO DE DEV COUPON (ANTES da transação) ==========
    // DEV coupon em produção REQUER sessão autenticada com email na whitelist
    // NUNCA confiar em email do body para autorizar DEV coupon
    const auth = getAuthFromRequest(req);

    if (data.couponCode) {
      const couponKey = data.couponCode.toUpperCase().trim();
      const couponConfig = await getCouponInfo(couponKey);

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

    // TRANSACTION ATÔMICA - Previne race condition
    // Timeout aumentado para 15 segundos devido à complexidade das operações (validações, créditos, cupons)
    const result = await prisma.$transaction(async (tx) => {
      // 3.1. [HIJACK_FIX] Limpeza de reservas PENDENTES antigas (> 15 min)
      // Se houver reservas PENDENTES antigas conflitando, cancelamos elas antes de verificar disponibilidade
      const toleranceTime = new Date(Date.now() - 15 * 60 * 1000);

      const staleBookings = await tx.booking.findMany({
        where: {
          roomId: realRoomId,
          status: 'PENDING',
          createdAt: { lt: toleranceTime }, // Criadas antes do limite de tolerância
          OR: [
            { startTime: { lt: endAt, gte: startAt } },
            { endTime: { gt: startAt, lte: endAt } },
            { AND: [{ startTime: { lte: startAt } }, { endTime: { gte: endAt } }] },
          ],
        },
        select: { id: true },
      });

      if (staleBookings.length > 0) {
        console.log(`🧹 [HIJACK_FIX] Cancelando ${staleBookings.length} reservas PENDENTES antigas para liberar horário.`);
        await tx.booking.updateMany({
          where: {
            id: { in: staleBookings.map((b) => b.id) },
          },
          data: {
            status: 'CANCELLED',
            cancelReason: 'System: Expired (Hijack Protection)',
          },
        });
      }

      // 4. Verificar disponibilidade com lock (FOR UPDATE)
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          roomId: realRoomId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            { startTime: { lt: endAt, gte: startAt } },
            { endTime: { gt: startAt, lte: endAt } },
            { AND: [{ startTime: { lte: startAt } }, { endTime: { gte: endAt } }] },
          ],
        },
      });

      if (conflictingBooking) {
        throw new Error('CONFLICT');
      }

      // 5. Determinar userId: sessão (logado) ou resolveOrCreateUser (checkout anônimo)
      // NOTA: 'auth' já foi obtido antes para pré-validação de DEV coupon
      let userId: string;
      let sessionEmail: string | null = null; // Email da SESSÃO (não do body)
      let isAnonymousCheckout = false;

      if (auth?.userId) {
        // LOGADO: usar userId da sessão diretamente
        // NÃO chamar resolveOrCreateUser - email/phone do body são ignorados
        userId = auth.userId;

        // BLOQUEIO: Usuário logado deve ter email verificado para agendar
        const emailCheck = await requireEmailVerifiedForBooking(userId);
        if (!emailCheck.canBook) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        // Buscar email da SESSÃO para validação de cupom DEV
        const loggedUser = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        sessionEmail = loggedUser?.email || null;
      } else {
        // NÃO LOGADO: resolver por email > phone
        const { user } = await resolveOrCreateUser(tx, {
          name: data.userName,
          email: data.userEmail,
          phone: data.userPhone,
          cpf: data.userCpf,
          professionalRegister: data.professionalRegister,
        });
        userId = user.id;
        // SEGURANÇA: NÃO usar email do body para validar DEV coupon
        // sessionEmail permanece null para checkout anônimo
        isAnonymousCheckout = true; // Flag para disparo de email de ativação
      }

      // 5.1 VALIDAÇÃO OBRIGATÓRIA: Registro Profissional
      // Todo usuário deve ter o registro profissional salvo para fazer uma reserva
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { professionalRegister: true, role: true }
      });

      // Se não tem no banco e não veio no request (para update via resolveOrCreateUser), bloqueia
      // Nota: resolveOrCreateUser já atualizou o user se veio no request. Então basta checar o banco agora.
      if (!currentUser?.professionalRegister && currentUser?.role !== 'ADMIN') {
        const providedRegister = data.professionalRegister;

        // Se forneceu agora mas resolveOrCreateUser não rodou (usuário logado), precisamos atualizar
        if (providedRegister && auth?.userId) {
          await tx.user.update({
            where: { id: userId },
            data: { professionalRegister: providedRegister }
          });
        } else if (!providedRegister) {
          // Não tem no banco e não mandou agora
          throw new Error('REGISTRO_PROFISSIONAL_OBRIGATORIO');
        }
      }

      // 6. Calcular valor usando helper unificado de preço (weekday vs saturday)
      // IMPORTANTE: Todos os valores financeiros são em CENTAVOS (inteiros)
      const hours = Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60));

      let amountCents: number;

      // Se tem productId, busca preço do produto (já em CENTAVOS no banco)
      if (data.productId) {
        const product = await tx.product.findUnique({
          where: { id: data.productId },
        });
        if (product) {
          amountCents = product.price; // Já em CENTAVOS
        } else {
          // Fallback: usar preço por hora baseado na data
          try {
            const amountReais = getBookingTotalByDate(realRoomId, startAt, hours, room.slug);
            amountCents = toCents(amountReais); // Converter REAIS → CENTAVOS
          } catch (err) {
            throw new Error(`PRICING_ERROR: ${err instanceof Error ? err.message : 'Erro ao calcular preço'}`);
          }
        }
      } else {
        // Sem produto específico: usar preço por hora conforme data (weekday/saturday)
        try {
          const amountReais = getBookingTotalByDate(realRoomId, startAt, hours, room.slug);
          amountCents = toCents(amountReais); // Converter REAIS → CENTAVOS
        } catch (err) {
          throw new Error(`PRICING_ERROR: ${err instanceof Error ? err.message : 'Erro ao calcular preço'}`);
        }
      }

      // Validar que amount é inteiro (CENTAVOS)
      assertIntegerCents(amountCents, 'booking.amountCents');

      // ========== AUDITORIA: Guardar valor bruto antes de cupom ==========
      const grossAmountCents = amountCents;
      let discountAmountCents = 0;
      let couponApplied: string | null = null;
      let couponSnapshot: object | null = null;
      let isDevCoupon = false;

      // 6.1 PRIMEIRO: Verificar e aplicar créditos se solicitado
      // (Reorganizado: créditos ANTES de cupom para saber se há pagamento)
      let creditsUsedCents = 0;
      let creditIds: string[] = [];
      let amountToPayWithoutCoupon = amountCents; // Valor antes do cupom

      if (data.useCredits) {
        // P-008/P-011: Passar startAt/endAt para validar usageType
        const availableCreditsCents = await getCreditBalanceForRoom(userId, realRoomId, startAt, startAt, endAt);

        if (availableCreditsCents > 0) {
          const creditsToUseCents = Math.min(availableCreditsCents, amountCents);
          amountToPayWithoutCoupon = amountCents - creditsToUseCents;

          // P-002: Passa tx para consumo atômico dentro da transação
          // P-008/P-011: Passar startAt/endAt para validar usageType
          const consumeResult = await consumeCreditsForBooking(
            userId,
            realRoomId,
            creditsToUseCents,
            startAt,
            startAt, // startTime - validação de usageType
            endAt,   // endTime - validação de usageType
            tx // Transação Prisma
          );

          creditsUsedCents = consumeResult.totalConsumed;
          creditIds = consumeResult.creditIds;
        }
      }

      // 6.0.1 DEPOIS: Aplicar cupom APENAS se:
      // - COUPONS_ENABLED=true (flag MVP)
      // - Houver valor a pagar após créditos
      const couponsEnabled = areCouponsEnabled();

      if (couponsEnabled && data.couponCode && amountToPayWithoutCoupon > 0) {
        const couponKey = data.couponCode.toUpperCase().trim();

        if (await isValidCoupon(couponKey)) {
          // Validar acesso ao DEV coupon usando email da SESSÃO
          const devCheck = await validateDevCouponAccess(couponKey, sessionEmail, requestId);
          if (!devCheck.allowed) {
            throw new Error(`DEV_COUPON_BLOCKED: ${devCheck.reason}`);
          }

          // P1-5: Verificar se usuário pode usar este cupom (ex: PRIMEIRACOMPRA single-use)
          // DEV coupon: sessionEmail vem da SESSÃO, não do body
          const usageCheck = await checkCouponUsage(tx, userId, couponKey, 'BOOKING', sessionEmail);
          if (!usageCheck.canUse) {
            throw new Error(`CUPOM_INVALIDO: ${usageCheck.reason}`);
          }
          isDevCoupon = usageCheck.isDevCoupon || false;

          // applyDiscount espera e retorna CENTAVOS (busca do banco)
          // Aplicar desconto sobre o valor RESTANTE (após créditos)
          const discountResult = await applyDiscount(amountToPayWithoutCoupon, couponKey);
          discountAmountCents = discountResult.discountAmount;
          couponApplied = couponKey;
          couponSnapshot = await createCouponSnapshot(couponKey);
        }
      } else if (data.couponCode && !couponsEnabled) {
        // MVP: Cupons desabilitados - ignorar silenciosamente
        console.log(`[BOOKING] ${requestId} | coupon=${data.couponCode} ignored (COUPONS_ENABLED=false)`);
      }

      // ========== CÁLCULO FINAL (CORRIGIDO) ==========
      // netAmountCents = valor líquido da reserva (gross - discount, SEM créditos)
      // Usado para auditoria: quanto vale a reserva após desconto
      const netAmountCents = grossAmountCents - discountAmountCents;

      // amountToPayCents = valor que o cliente deve PAGAR (após créditos e cupom)
      // FÓRMULA: gross - créditos - desconto = net - créditos
      const amountToPayCents = Math.max(0, netAmountCents - creditsUsedCents);

      // LOG ESTRUTURADO: Antes de criar booking/cobrança (sem PII)
      console.log(`[BOOKING_CALC] ${requestId} | entityType=booking | grossAmount=${grossAmountCents} | creditsUsed=${creditsUsedCents} | amountToPayWithoutCoupon=${amountToPayWithoutCoupon} | couponCode=${couponApplied || 'none'} | isDevCoupon=${isDevCoupon} | discountAmount=${discountAmountCents} | netAmount=${netAmountCents} | amountToPayFinal=${amountToPayCents}`);

      // 6.2 Validar prazo mínimo para reservas que precisam de pagamento
      // Reservas com pagamento pendente precisam ter início > 30 minutos
      if (amountToPayCents > 0) {
        const now = new Date();
        const minutesUntilStart = (startAt.getTime() - now.getTime()) / (1000 * 60);

        if (minutesUntilStart < 30) {
          throw new Error('TEMPO_INSUFICIENTE');
        }
      }

      // 7. Criar booking
      // Determinar financialStatus baseado no pagamento/créditos
      const financialStatus = amountToPayCents <= 0 ? 'PAID' : 'PENDING_PAYMENT';

      // Calcular expiresAt para bookings PENDING (cleanup automático)
      const isPendingBooking = amountToPayCents > 0;
      const expiresAt = isPendingBooking
        ? new Date(Date.now() + PENDING_BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000)
        : null;

      const booking = await tx.booking.create({
        data: {
          userId: userId,
          roomId: realRoomId,
          startTime: startAt,
          endTime: endAt,
          status: amountToPayCents > 0 ? 'PENDING' : 'CONFIRMED',
          paymentStatus: amountToPayCents > 0 ? 'PENDING' : 'APPROVED',
          amountPaid: creditsUsedCents,
          bookingType: 'HOURLY',
          notes: data.notes || null,
          creditsUsed: creditsUsedCents,
          creditIds,
          origin: 'COMMERCIAL',
          financialStatus,
          expiresAt,
          // ========== AUDITORIA DE DESCONTO/CUPOM (em CENTAVOS) ==========
          grossAmount: grossAmountCents,
          discountAmount: discountAmountCents,
          netAmount: netAmountCents,
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
          context: 'BOOKING',
          bookingId: booking.id,
          isDevCoupon, // Se true, skip registro (cupom DEV)
        });

        if (!couponResult.ok) {
          throw new Error(`COUPON_ALREADY_USED:${couponApplied}`);
        }
      }

      return { booking, userId, amountCents, amountToPayCents, creditsUsedCents, hours, isAnonymousCheckout, grossAmountCents, discountAmountCents, couponApplied };
    }, {
      maxWait: 15000, // 15 segundos - tempo máximo de espera para iniciar a transação
      timeout: 15000, // 15 segundos - timeout aumentado para operações complexas (validações, créditos, cupons)
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

    // LOG DE OPERAÇÃO - Booking criado
    logBookingCreated({
      bookingId: result.booking.id,
      userId: result.userId,
      email: data.userEmail,
      ip: clientIp,
      amount: result.amountToPayCents,
      paymentMethod: data.paymentMethod,
      roomId: realRoomId,
    });

    // AUDIT EVENT (DB) - Best-effort
    recordBookingCreated({
      requestId,
      userId: result.userId,
      bookingId: result.booking.id,
      roomId: realRoomId,
      amount: result.amountToPayCents,
      paymentMethod: data.paymentMethod,
    });

    await logUserAction(
      'BOOKING_CREATED',
      data.userEmail || data.userPhone,
      'Booking',
      result.booking.id,
      {
        roomId: realRoomId,
        roomName: room.name,
        startAt: data.startAt,
        endAt: data.endAt,
        amountCents: result.amountCents,
        amountToPayCents: result.amountToPayCents,
        creditsUsedCents: result.creditsUsedCents,
        hours: result.hours,
        // ❌ NÃO incluir dados sensíveis (CPF, telefone completo)
      },
      req
    );

    // Se pagou 100% com créditos
    if (result.amountToPayCents <= 0) {
      // Enviar email de confirmação para reserva paga com créditos
      let emailSent = false;
      try {
        const emailSuccess = await sendBookingConfirmationNotification(result.booking.id);
        if (emailSuccess) {
          await prisma.booking.update({
            where: { id: result.booking.id },
            data: { emailSentAt: new Date() },
          });
          emailSent = true;
          console.log(`📧 [BOOKING] Email de confirmação enviado para reserva com créditos ${result.booking.id}`);
        } else {
          console.warn(`⚠️ [BOOKING] Falha ao enviar email para reserva com créditos ${result.booking.id}`);
        }
      } catch (emailError) {
        console.error('⚠️ [BOOKING] Erro no envio de email (créditos):', emailError);
        // Não falha a requisição por erro de email
      }

      return res.status(201).json({
        success: true,
        bookingId: result.booking.id,
        creditsUsed: result.creditsUsedCents,
        amountToPay: 0,
        emailSent,
      });
    }

    // 8. Criar pagamento se necessário (PIX ou CARTÃO via Checkout)
    let paymentUrl: string | undefined;
    let paymentMethod: 'PIX' | 'CREDIT_CARD' = 'PIX';
    // NOTA: installmentCount/installmentValue não são mais enviados
    // Cliente escolhe parcelas diretamente no Checkout Asaas

    if (data.payNow && result.amountToPayCents > 0) {
      // Validação preventiva de valor mínimo (APÓS desconto)
      const paymentMethodType = data.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX';
      const minAmountCents = getMinPaymentAmountCents(paymentMethodType);

      if (result.amountToPayCents < minAmountCents) {
        // Cancelar booking criado pois pagamento não pode ser processado
        await prisma.booking.update({
          where: { id: result.booking.id },
          data: { status: 'CANCELLED', cancelReason: 'Valor abaixo do mínimo para pagamento após desconto' },
        });

        return res.status(400).json({
          success: false,
          error: `Valor após desconto (R$ ${(result.amountToPayCents / 100).toFixed(2)}) abaixo do mínimo permitido para ${paymentMethodType === 'PIX' ? 'PIX' : 'cartão'} (R$ ${(minAmountCents / 100).toFixed(2)}).`,
          code: 'PAYMENT_MIN_AMOUNT_AFTER_DISCOUNT',
          details: {
            minAmountCents,
            netAmountCents: result.amountToPayCents,
            paymentMethod: paymentMethodType,
          },
        } as ApiResponse);
      }

      try {
        // P0-1: Verificar se já existe pagamento ativo para este booking (idempotência)
        const existingPayment = await checkBookingHasActivePayment(result.booking.id);
        if (existingPayment.exists && existingPayment.existingPayment?.externalUrl) {
          console.log(`\u26a0\ufe0f [BOOKING] Pagamento já existe para booking ${result.booking.id}, retornando URL existente`);
          return res.status(201).json({
            success: true,
            bookingId: result.booking.id,
            paymentUrl: existingPayment.existingPayment.externalUrl, paymentId: existingPayment.existingPayment.externalId, // P0-1: Para debug            paymentMethod: data.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX',
            creditsUsed: result.creditsUsedCents,
            amountToPay: result.amountToPayCents,
          });
        }

        // createBookingPayment espera value em CENTAVOS
        const basePaymentInput = {
          bookingId: result.booking.id,
          customerName: data.userName,
          customerEmail: data.userEmail || `${data.userPhone}@placeholder.com`,
          customerPhone: data.userPhone,
          customerCpf: data.userCpf,
          value: result.amountToPayCents, // CENTAVOS
          description: `Reserva ${room.name} - ${result.hours}h${result.creditsUsedCents > 0 ? ` (R$ ${(result.creditsUsedCents / 100).toFixed(2)} em créditos)` : ''}`,
        };

        let paymentResult: { paymentId?: string; invoiceUrl?: string; checkoutId?: string; checkoutUrl?: string };
        let isCheckoutFlow = false;

        if (data.paymentMethod === 'CARD') {
          // CARTÃO: Sempre usar createBookingCardPayment para forçar parcelas/valores
          // Isso evita que o cliente altere as parcelas no checkout do Asaas
          // Se installmentCount=1 (ou undefined), será cobrado à vista
          const cardResult = await withTimeout(
            createBookingCardPayment({
              bookingId: result.booking.id,
              customerName: data.userName,
              customerEmail: data.userEmail || `${data.userPhone}@placeholder.com`,
              customerPhone: data.userPhone,
              customerCpf: data.userCpf,
              // Usar valor ajustado se disponível (com juros), senão valor normal (net)
              value: data.adjustedTotalCents ?? result.amountToPayCents,
              description: `Reserva ${room.name} - ${result.hours}h`,
              installmentCount: data.installmentCount || 1,
              installmentValueCents: data.installmentValueCents,
            }),
            TIMEOUTS.PAYMENT_CREATE,
            'criação de pagamento cartão'
          );

          paymentResult = {
            paymentId: cardResult.paymentId,
            invoiceUrl: cardResult.invoiceUrl,
          };
          paymentMethod = 'CREDIT_CARD';
          isCheckoutFlow = false; // Agora sempre usamos invoice direta (/payments)
          console.log(`💳 [BOOKING] Pagamento CARTÃO criado (Force Strict): ${cardResult.paymentId} | ${data.installmentCount || 1}x`);
        } else {
          // Pagamento por PIX (default) (com timeout)
          const pixResult = await withTimeout(
            createBookingPayment(basePaymentInput),
            TIMEOUTS.PAYMENT_CREATE,
            'criação de pagamento PIX'
          );
          paymentResult = {
            paymentId: pixResult.paymentId,
            invoiceUrl: pixResult.invoiceUrl,
          };
          console.log(`🔲 [BOOKING] Pagamento PIX criado: ${pixResult.paymentId}`);
        }

        // URL para redirecionar cliente
        paymentUrl = isCheckoutFlow ? paymentResult.checkoutUrl : paymentResult.invoiceUrl;

        await prisma.booking.update({
          where: { id: result.booking.id },
          data: {
            paymentId: isCheckoutFlow ? paymentResult.checkoutId : paymentResult.paymentId,
            paymentMethod,
          },
        });

        await prisma.payment.create({
          data: {
            bookingId: result.booking.id,
            userId: result.userId,
            amount: result.amountToPayCents,
            status: 'PENDING',
            externalId: isCheckoutFlow ? paymentResult.checkoutId : paymentResult.paymentId,
            externalUrl: paymentUrl,
            idempotencyKey: generateBookingIdempotencyKey(result.booking.id, data.paymentMethod),
          },
        });

        // Enviar email de pagamento pendente (PIX ou Cartão)
        if (data.userEmail && data.paymentMethod === 'PIX') {
          const startDate = new Date(data.startAt);
          const endDate = new Date(data.endAt);
          const pixEmailData: BookingEmailData = {
            userName: data.userName,
            userEmail: data.userEmail,
            roomName: room.name,
            date: startDate.toLocaleDateString('pt-BR'),
            startTime: startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            endTime: endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            duration: `${result.hours}h`,
            amountPaid: result.amountToPayCents,
            bookingId: result.booking.id,
            paymentMethod: 'PIX',
            pixPaymentUrl: paymentUrl,
          };

          sendPixPendingEmail(pixEmailData).catch((err) => {
            console.error('⚠️ [BOOKING] Erro ao enviar email pagamento pendente:', err);
          });
        }
        // TODO: Implementar email para pagamento com cartão pendente
      } catch (paymentError) {
        // Normalizar erro do Asaas para código padronizado
        const normalizedError = normalizeAsaasError(
          paymentError,
          data.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX'
        );

        console.error('❌ [BOOKING] Erro ao criar cobrança Asaas:', {
          requestId,
          bookingId: result.booking.id,
          code: normalizedError.code,
          message: normalizedError.message,
          details: normalizedError.details,
        });

        await prisma.booking.update({
          where: { id: result.booking.id },
          data: { status: 'CANCELLED', cancelReason: `Erro pagamento: ${normalizedError.code}` },
        });

        // Retornar erro normalizado com código padronizado
        const statusCode = normalizedError.code === 'PAYMENT_MIN_AMOUNT' ? 400 : 502;
        return res.status(statusCode).json({
          success: false,
          error: normalizedError.message,
          code: normalizedError.code,
          details: normalizedError.details,
        } as ApiResponse);
      }
    }

    console.log(`[API] POST /api/bookings END`, JSON.stringify({
      requestId,
      statusCode: 201,
      duration: Date.now() - startTime
    }));

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
      paymentUrl,
      paymentMethod,
      // CARTÃO: cliente escolhe parcelas no Checkout Asaas (não retornamos mais aqui)
      creditsUsed: result.creditsUsedCents,
      amountToPay: result.amountToPayCents,
    });

  } catch (error) {
    // P-001: Detectar violação de constraint de overbooking (constraint específico)
    if (isOverbookingError(error) || isOverbookingPrismaError(error)) {
      return respondError(res, BusinessError.bookingConflict(), requestId, {
        endpoint: '/api/bookings',
        method: 'POST',
        extra: { startTime },
      });
    }

    // Handler centralizado de erros (reconhece erros legados e BusinessError)
    return respondError(res, error, requestId, {
      endpoint: '/api/bookings',
      method: 'POST',
      extra: { startTime },
    });
  }
}
