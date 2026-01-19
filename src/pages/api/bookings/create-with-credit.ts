// ===========================================================
// API: POST /api/bookings/create-with-credit
// ===========================================================
// Cria reserva consumindo créditos do usuário
// Requer autenticação via JWT (cookie arthemi_session)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { 
  consumeCreditsForBooking, 
  getCreditBalanceForRoom,
  isBookingWithinBusinessHours,
  validateUniversalBookingWindow,
  PENDING_BOOKING_EXPIRATION_HOURS,
} from '@/lib/business-rules';
import { logAudit } from '@/lib/audit';
import { differenceInHours, isBefore } from 'date-fns';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';
import { 
  shouldBlockHourlyPurchase,
  TURNO_PROTECTION_ERROR_CODE,
} from '@/lib/turno-protection';
import { requireEmailVerifiedForBooking } from '@/lib/email-verification';
import { getBookingTotalCentsByDate } from '@/lib/pricing';
import {
  isValidCoupon,
  applyDiscount,
  checkCouponUsage,
  recordCouponUsageIdempotent,
  createCouponSnapshot,
} from '@/lib/coupons';
import { CouponUsageContext } from '@prisma/client';
import {
  checkBookingHasActivePayment,
  generateBookingIdempotencyKey,
} from '@/lib/payment-idempotency';
import { createBookingPayment } from '@/lib/asaas';
import { sendCapiSchedule } from '@/lib/meta';

interface ApiResponse {
  success: boolean;
  bookingId?: string;
  creditsUsed?: number;
  amountToPay?: number; // Valor a pagar em dinheiro (após créditos e cupom)
  paymentUrl?: string; // URL de pagamento Asaas se amountToPay > 0
  paymentId?: string | null; // ID externo do pagamento (para debug)
  emailSent?: boolean;
  error?: string;
  code?: string; // Código de erro para tratamento no frontend
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    // Verifica autenticação JWT
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const userId = auth.userId;

    // Verifica se o email foi verificado (bloqueio de agendamento)
    const emailCheck = await requireEmailVerifiedForBooking(userId);
    if (!emailCheck.canBook) {
      return res.status(emailCheck.response!.status).json({
        success: false,
        error: emailCheck.response!.body.message,
        code: emailCheck.response!.body.code,
      });
    }

    // Busca usuário (incluindo cpf e phone para pagamento híbrido)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, cpf: true, phone: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
    }

    // Extrai dados da requisição
    const { roomId, startTime, endTime, couponCode } = req.body;

    if (!roomId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'roomId, startTime e endTime são obrigatórios',
      });
    }

    // Normalizar couponCode (opcional)
    const normalizedCouponCode = couponCode ? String(couponCode).toUpperCase().trim() : null;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    // Validações básicas
    if (isBefore(start, now)) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível agendar no passado',
      });
    }

    if (isBefore(end, start)) {
      return res.status(400).json({
        success: false,
        error: 'Horário de fim deve ser após o início',
      });
    }

    // Validar horário de funcionamento
    if (!isBookingWithinBusinessHours(start, end)) {
      return res.status(400).json({
        success: false,
        error: 'Horário fora do expediente. Seg-Sex: 08h-20h, Sáb: 08h-12h, Dom: fechado.',
        code: 'OUT_OF_BUSINESS_HOURS',
      });
    }

    // VALIDAÇÃO UNIVERSAL: Reservas limitadas a 30 dias a partir de hoje
    const windowValidation = validateUniversalBookingWindow(start);
    if (!windowValidation.valid) {
      return res.status(400).json({
        success: false,
        error: windowValidation.error || 'Data fora da janela de reserva permitida.',
      });
    }

    // REGRA ANTI-CANIBALIZAÇÃO: Proteção de Turnos
    // Horas avulsas/pacotes não podem ser agendados > 30 dias em dias de TURNO
    const turnoCheck = shouldBlockHourlyPurchase(start, 'HOURLY_RATE');
    if (turnoCheck.blocked) {
      return res.status(400).json({
        success: false,
        error: turnoCheck.reason || 'Data não permitida para agendamento de horas avulsas',
        code: turnoCheck.code || TURNO_PROTECTION_ERROR_CODE,
      });
    }

    // Busca sala
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala não encontrada' });
    }

    // Calcula duração e valor
    const hours = differenceInHours(end, start);
    if (hours < 1 || hours > 8) {
      return res.status(400).json({
        success: false,
        error: 'Duração deve ser entre 1 e 8 horas',
      });
    }

    // Calcular valor total usando helper unificado (weekday vs saturday)
    let totalAmount: number;
    try {
      totalAmount = getBookingTotalCentsByDate(roomId, start, hours, room.slug);
    } catch (err) {
      console.error('[BOOKING] Erro ao calcular preço:', err);
      return res.status(400).json({
        success: false,
        error: 'Erro ao calcular o preço da reserva. Tente novamente.',
      });
    }

    // ========== AUDITORIA: Guardar valor bruto antes de cupom ==========
    const grossAmount = totalAmount;
    let discountAmount = 0;
    let couponApplied: string | null = null;
    let couponSnapshot: object | null = null;
    let netAmount = grossAmount;

    // ========== APLICAR CUPOM (se fornecido) ==========
    if (normalizedCouponCode && isValidCoupon(normalizedCouponCode)) {
      // Verificar se usuário pode usar este cupom (ex: PRIMEIRACOMPRA single-use)
      const usageCheck = await checkCouponUsage(prisma, userId, normalizedCouponCode, CouponUsageContext.BOOKING);
      if (!usageCheck.canUse) {
        return res.status(400).json({
          success: false,
          error: usageCheck.reason || 'Cupom não pode ser utilizado',
          code: 'COUPON_ALREADY_USED',
        });
      }
      
      const discountResult = applyDiscount(grossAmount, normalizedCouponCode);
      discountAmount = discountResult.discountAmount;
      netAmount = discountResult.finalAmount;
      couponApplied = normalizedCouponCode;
      couponSnapshot = createCouponSnapshot(normalizedCouponCode);
    }

    // Verifica saldo de créditos disponíveis para este horário específico
    // Passa start/end para validar usageType dos créditos
    const availableCredits = await getCreditBalanceForRoom(userId, roomId, start, start, end);
    
    // Calcular créditos a usar (sobre o netAmount - valor após cupom)
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;

    // ========== ANTIFRAUDE: Cupom só vale se houver pagamento em dinheiro ==========
    if (couponApplied && amountToPay === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cupons promocionais são aplicáveis apenas a reservas com pagamento via PIX ou cartão. Quando a reserva é integralmente coberta por créditos, o cupom não é elegível.',
        code: 'COUPON_REQUIRES_CASH_PAYMENT',
      });
    }

    // ========== P0-4: Validar CPF ANTES de criar booking se há pagamento pendente ==========
    if (amountToPay > 0 && !user.cpf) {
      return res.status(400).json({
        success: false,
        error: 'CPF é obrigatório para reservas com pagamento. Atualize seu perfil antes de continuar.',
        code: 'CPF_REQUIRED_FOR_PAYMENT',
      });
    }

    // Valida se tem créditos suficientes para cobrir pelo menos parte da reserva
    // (se não há cupom, precisa cobrir o total; se há cupom + dinheiro, OK)
    if (creditsToUse === 0 && amountToPay === netAmount && availableCredits === 0) {
      return res.status(402).json({
        success: false,
        error: `Saldo insuficiente. Disponível: R$ ${(availableCredits / 100).toFixed(2)}, Necessário: R$ ${(netAmount / 100).toFixed(2)}`,
      });
    }

    // Verifica conflito de horários
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          {
            startTime: { lt: end },
            endTime: { gt: start },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        error: 'Horário não disponível. Conflito com outra reserva.',
      });
    }

    // TRANSAÇÃO: Cria reserva + consome créditos + registra cupom
    const result = await prisma.$transaction(async (tx) => {
      // P-002: Consome créditos dentro da transação (passa tx)
      let creditIds: string[] = [];
      let totalConsumed = 0;
      
      if (creditsToUse > 0) {
        const consumeResult = await consumeCreditsForBooking(
          userId,
          roomId,
          creditsToUse,
          start,
          start,
          end,
          tx // P-002: Passar transação
        );
        creditIds = consumeResult.creditIds;
        totalConsumed = consumeResult.totalConsumed;
      }

      // Determinar status baseado em se há pagamento pendente
      const bookingStatus = amountToPay > 0 ? 'PENDING' : 'CONFIRMED';
      const paymentStatus = amountToPay > 0 ? 'PENDING' : 'APPROVED';
      const financialStatus = amountToPay > 0 ? 'PENDING_PAYMENT' : 'PAID';

      // Calcular expiresAt para bookings PENDING (cleanup automático)
      const isPendingBooking = amountToPay > 0;
      const expiresAt = isPendingBooking 
        ? new Date(Date.now() + PENDING_BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000)
        : null;

      // Cria reserva com campos de auditoria
      const booking = await tx.booking.create({
        data: {
          roomId,
          userId,
          startTime: start,
          endTime: end,
          status: bookingStatus,
          paymentStatus: paymentStatus,
          bookingType: 'HOURLY',
          creditsUsed: totalConsumed,
          creditIds,
          amountPaid: amountToPay > 0 ? 0 : totalConsumed, // Se pago só com crédito, amountPaid = créditos usados
          origin: 'COMMERCIAL',
          financialStatus,
          expiresAt,
          // ========== AUDITORIA DE DESCONTO/CUPOM ==========
          grossAmount,
          discountAmount,
          netAmount,
          couponCode: couponApplied,
          couponSnapshot: couponSnapshot || undefined,
        },
      });

      // ========== REGISTRAR USO DO CUPOM (Anti-fraude) ==========
      if (couponApplied) {
        const couponResult = await recordCouponUsageIdempotent(tx, {
          userId,
          couponCode: couponApplied,
          context: CouponUsageContext.BOOKING,
          bookingId: booking.id,
        });
        
        if (!couponResult.ok) {
          throw new Error(`COUPON_ALREADY_USED:${couponApplied}`);
        }
      }

      return { booking, creditIds, totalConsumed, amountToPay };
    });

    // Log de auditoria
    await logAudit({
      action: 'BOOKING_CREATED',
      source: 'USER',
      actorId: userId,
      actorEmail: user.email,
      targetType: 'Booking',
      targetId: result.booking.id,
      metadata: {
        roomId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        creditsUsed: result.totalConsumed,
        creditIds: result.creditIds,
        // Auditoria de cupom
        grossAmount,
        discountAmount,
        netAmount,
        couponCode: couponApplied,
        amountToPay: result.amountToPay,
      },
    });

    if (result.totalConsumed > 0) {
      await logAudit({
        action: 'CREDIT_USED',
        source: 'USER',
        actorId: userId,
        actorEmail: user.email,
        targetType: 'Booking',
        targetId: result.booking.id,
        metadata: {
          amount: result.totalConsumed,
          creditIds: result.creditIds,
        },
      });
    }

    // Enviar email de confirmação apenas para reservas totalmente pagas (sem pagamento pendente)
    let emailSent = false;
    if (result.amountToPay === 0) {
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

      // ================================================================
      // META CAPI: Enviar Schedule para booking confirmado com créditos
      // ================================================================
      sendCapiSchedule({
        entityType: 'Booking',
        entityId: result.booking.id,
        roomName: room.name,
        roomId: room.id,
        value: result.totalConsumed / 100, // Converter centavos para reais
        userEmail: user.email,
        userPhone: user.phone || undefined,
        userId: user.id,
      }).then((capiResult) => {
        if (capiResult.ok) {
          console.log(`📊 [CAPI] Schedule sent for booking ${result.booking.id}`, { metaTraceId: capiResult.metaTraceId });
        } else {
          console.warn(`⚠️ [CAPI] Schedule failed for booking ${result.booking.id}`, { error: capiResult.error });
        }
      }).catch((err) => {
        console.error(`❌ [CAPI] Schedule error for booking ${result.booking.id}`, { error: err.message });
      });
    }

    // ========== P0-4: Se amountToPay > 0, criar cobrança no Asaas (PIX) ==========
    let paymentUrl: string | undefined;
    if (result.amountToPay > 0) {
      try {
        // Idempotência: verificar se já existe pagamento ativo
        const existingPayment = await checkBookingHasActivePayment(result.booking.id);
        if (existingPayment.exists && existingPayment.existingPayment?.externalUrl) {
          console.log(`⚠️ [BOOKING] Pagamento híbrido já existe para ${result.booking.id}, retornando URL existente`);
          return res.status(201).json({
            success: true,
            bookingId: result.booking.id,
            creditsUsed: result.totalConsumed,
            amountToPay: result.amountToPay,
            paymentUrl: existingPayment.existingPayment.externalUrl,
            paymentId: existingPayment.existingPayment.externalId, // P0-4: Para debug
          });
        }

        // Criar cobrança PIX no Asaas
        const paymentResult = await createBookingPayment({
          bookingId: result.booking.id,
          customerName: user.name || 'Cliente',
          customerEmail: user.email,
          customerPhone: user.phone || '',
          customerCpf: user.cpf!,
          valueCents: result.amountToPay, // CENTAVOS (inteiro)
          description: `Reserva ${room.name} - ${hours}h (R$ ${(result.totalConsumed / 100).toFixed(2)} em créditos)`,
        });

        paymentUrl = paymentResult.invoiceUrl;

        // Atualizar booking com paymentId
        await prisma.booking.update({
          where: { id: result.booking.id },
          data: {
            paymentId: paymentResult.paymentId,
            paymentMethod: 'PIX',
          },
        });

        // Criar Payment local com idempotencyKey
        await prisma.payment.create({
          data: {
            bookingId: result.booking.id,
            userId,
            amount: result.amountToPay,
            status: 'PENDING',
            externalId: paymentResult.paymentId,
            externalUrl: paymentResult.invoiceUrl,
            idempotencyKey: generateBookingIdempotencyKey(result.booking.id, 'PIX'),
          },
        });

        console.log(`🔲 [BOOKING] Pagamento híbrido PIX criado: ${paymentResult.paymentId} para booking ${result.booking.id}`);
      } catch (paymentError) {
        console.error('❌ [BOOKING] Erro ao criar cobrança híbrida:', paymentError);
        
        // ROLLBACK: Cancelar booking E restaurar créditos consumidos
        // Isso é necessário porque a criação de pagamento falhou FORA da transaction
        await prisma.$transaction(async (tx) => {
          // 1. Cancelar booking
          await tx.booking.update({
            where: { id: result.booking.id },
            data: { status: 'CANCELLED' },
          });
          
          // 2. Restaurar créditos consumidos
          if (result.creditIds && result.creditIds.length > 0) {
            const amountPerCredit = Math.floor(result.totalConsumed / result.creditIds.length);
            let remaining = result.totalConsumed - (amountPerCredit * result.creditIds.length);
            
            for (const creditId of result.creditIds) {
              const restoreAmount = amountPerCredit + (remaining > 0 ? 1 : 0);
              if (remaining > 0) remaining--;
              
              const credit = await tx.credit.findUnique({
                where: { id: creditId },
                select: { remainingAmount: true, amount: true },
              });
              
              if (credit) {
                await tx.credit.update({
                  where: { id: creditId },
                  data: {
                    remainingAmount: Math.min(credit.amount, credit.remainingAmount + restoreAmount),
                    status: 'CONFIRMED',
                  },
                });
              }
            }
            console.log(`🔄 [BOOKING] Créditos restaurados após falha no pagamento: ${result.creditIds.length} créditos`);
          }
        });
        
        return res.status(500).json({
          success: false,
          error: 'Erro ao gerar pagamento. Reserva cancelada e créditos restaurados. Tente novamente.',
          code: 'PAYMENT_CREATION_FAILED',
        });
      }
    }

    return res.status(201).json({
      success: true,
      bookingId: result.booking.id,
      creditsUsed: result.totalConsumed,
      amountToPay: result.amountToPay,
      paymentUrl,
      emailSent,
    });

  } catch (error) {
    console.error('[BOOKING] Erro ao criar reserva com crédito:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar reserva',
    });
  }
}
