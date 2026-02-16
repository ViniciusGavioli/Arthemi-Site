// ===========================================================
// API: POST /api/webhooks/asaas
// ===========================================================
// Recebe notificações de pagamento do Asaas
// Idempotência garantida por banco de dados (WebhookEvent)
// Suporta PIX e Cartão (crédito/débito) + Checkout API
// Trata: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_REFUNDED, CHARGEBACK_*, CHECKOUT_PAID

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logPaymentConfirmed, logWebhookReceived } from '@/lib/operation-logger';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { recordPaymentConfirmed, recordWebhookReceived } from '@/lib/audit-event';
import {
  AsaasWebhookPayload,
  validateWebhookToken,
  isPaymentConfirmed,
  isPaymentRefundedOrChargeback,
  isCardCaptureRefused,
  isCheckoutPaid,
  isCheckoutEvent,
  realToCents,
} from '@/lib/asaas';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';
import { triggerAccountActivation } from '@/lib/account-activation';
import { sendCapiPurchase, isCapiEventSent } from '@/lib/meta';
import { recordCouponUsageIdempotent } from '@/lib/coupons';
import { restoreCouponUsage } from '@/lib/coupons';


// Idempotência via banco de dados (WebhookEvent table)

// Helper: timeout para operações assíncronas
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${operation} excedeu ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Helper: sanitizar string (remove caracteres perigosos)
function sanitizeString(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[<>"'&]/g, '') // Remove caracteres HTML perigosos
    .substring(0, 500); // Limita tamanho
}

// Helper: sanitizar payload do webhook
function sanitizeWebhookPayload(payload: AsaasWebhookPayload): AsaasWebhookPayload {
  return {
    ...payload,
    id: sanitizeString(payload.id),
    event: sanitizeString(payload.event) as any,
    payment: {
      ...payload.payment,
      id: sanitizeString(payload.payment.id),
      externalReference: sanitizeString(payload.payment.externalReference),
      status: sanitizeString(payload.payment.status) as any,
      billingType: sanitizeString(payload.payment.billingType) as any,
    },
  };
}

// Helper: normaliza externalReference para formato canônico
// Aceita: booking:<id>, purchase:<id>, booking:purchase:<id> (legado), credit_<id>, <id> puro
// Retorna: { type: 'booking' | 'purchase', id: string }
function parseExternalReference(ref: string | null | undefined): { type: 'booking' | 'purchase'; id: string } | null {
  if (!ref) return null;

  // booking:purchase:<id> => purchase (legado com prefixo duplicado)
  if (ref.startsWith('booking:purchase:')) {
    return { type: 'purchase', id: ref.replace('booking:purchase:', '') };
  }

  // purchase:<id> => purchase
  if (ref.startsWith('purchase:')) {
    return { type: 'purchase', id: ref.replace('purchase:', '') };
  }

  // credit_<id> => purchase (legado)
  if (ref.startsWith('credit_')) {
    return { type: 'purchase', id: ref.replace('credit_', '') };
  }

  // booking:<id> => booking
  if (ref.startsWith('booking:')) {
    return { type: 'booking', id: ref.replace('booking:', '') };
  }

  // ID puro => booking (retrocompatibilidade)
  return { type: 'booking', id: ref };
}

// Helper: verifica se produto é pacote de horas
function isPackageProduct(type: string): boolean {
  return ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H'].includes(type);
}

// Helper: retorna horas do pacote
function getPackageHours(type: string): number {
  switch (type) {
    case 'PACKAGE_10H': return 10;
    case 'PACKAGE_20H': return 20;
    case 'PACKAGE_40H': return 40;
    default: return 0;
  }
}

// Helper: mapear ProductType → CreditUsageType
// Retorna o tipo de uso do crédito baseado no tipo do produto
type CreditUsageType = 'HOURLY' | 'SHIFT' | 'SATURDAY_HOURLY' | 'SATURDAY_SHIFT';
function getUsageTypeFromProduct(productType: string | null): CreditUsageType {
  if (!productType) return 'HOURLY';

  switch (productType) {
    case 'SHIFT_FIXED':
      return 'SHIFT';
    case 'SATURDAY_HOUR':
    case 'SATURDAY_5H':
      return 'SATURDAY_HOURLY';
    // HOURLY_RATE, PACKAGE_10H, PACKAGE_20H, PACKAGE_40H, DAY_PASS, PROMO → HOURLY
    default:
      return 'HOURLY';
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // OBSERVABILIDADE: Gerar requestId para correlation
  const requestId = generateRequestId();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  const startTime = Date.now();

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log(`[API] POST /api/webhooks/asaas START`, JSON.stringify({ requestId }));

    // 1. Validar token de autenticação
    const token = req.headers['asaas-access-token'] as string | null;

    if (!validateWebhookToken(token)) {
      console.error('❌ [Asaas Webhook] Token inválido');
      return res.status(401).json({ error: 'Token inválido' });
    }

    // 2. Parsear e sanitizar payload
    // NOTA: Checkout events têm estrutura diferente de Payment events
    const rawPayload = req.body;

    // Detectar se é evento de checkout (estrutura diferente)
    const isCheckout = rawPayload?.event?.startsWith('CHECKOUT_');

    if (isCheckout) {
      // ===================================================================
      // CHECKOUT EVENT (CHECKOUT_PAID, CHECKOUT_EXPIRED, etc)
      // ===================================================================
      const checkoutPayload = rawPayload as {
        id: string;
        event: string;
        checkout: {
          id: string;
          externalReference?: string;
          status: string;
          value?: number;
        };
      };

      if (!checkoutPayload || !checkoutPayload.event || !checkoutPayload.checkout) {
        console.error('❌ [Asaas Webhook] Payload de checkout inválido');
        return res.status(400).json({ error: 'Payload de checkout inválido' });
      }

      const { id: eventId, event, checkout } = checkoutPayload;
      const externalRef = sanitizeString(checkout.externalReference);
      const checkoutId = sanitizeString(checkout.id);

      console.log(`🛒 [Asaas Webhook] Evento de Checkout: ${event}`, {
        eventId,
        checkoutId,
        externalReference: externalRef,
        status: checkout.status,
      });

      // Idempotência para eventos de checkout
      const existingCheckoutEvent = await withTimeout(
        prisma.webhookEvent.findUnique({
          where: { eventId },
        }),
        5000,
        'verificação de evento checkout existente'
      );

      if (existingCheckoutEvent && existingCheckoutEvent.status === 'PROCESSED') {
        console.log(`⏭️ [Asaas Webhook] Evento de checkout já processado: ${eventId}`);
        return res.status(200).json({ received: true, skipped: true });
      }

      // Registrar evento antes de processar
      if (!existingCheckoutEvent) {
        await withTimeout(
          prisma.webhookEvent.create({
            data: {
              eventId,
              eventType: event,
              paymentId: checkoutId,
              bookingId: externalRef || null,
              status: 'PROCESSING',
              payload: checkoutPayload as object,
            },
          }),
          5000,
          'criação de webhook event checkout'
        );
      }

      // Tratar apenas CHECKOUT_PAID (confirma pagamento)
      if (isCheckoutPaid(event)) {
        // Extrair bookingId do externalReference
        const parsed = parseExternalReference(externalRef);

        if (!parsed) {
          console.log(`⚠️ [Asaas Webhook] CHECKOUT_PAID sem externalReference válido`);
          await prisma.webhookEvent.update({
            where: { eventId },
            data: { status: 'IGNORED_NO_REF' },
          });
          return res.status(200).json({ received: true, message: 'Sem referência' });
        }

        const actualBookingId = parsed.id;
        const isPurchase = parsed.type === 'purchase';

        console.log(`✅ [Asaas Webhook] CHECKOUT_PAID processando:`, {
          checkoutId,
          bookingId: actualBookingId,
          isPurchase,
        });

        if (isPurchase) {
          // Crédito: confirmar (mesma lógica de PAYMENT_CONFIRMED para créditos)
          const credit = await prisma.credit.findUnique({
            where: { id: actualBookingId },
            include: { user: true },
          });

          if (credit && credit.status !== 'CONFIRMED') {
            await prisma.$transaction(async (tx) => {
              // Atualizar status do crédito
              await tx.credit.update({
                where: { id: actualBookingId },
                data: {
                  status: 'CONFIRMED',
                  remainingAmount: credit.amount, // Libera as horas compradas
                },
              });

              // ========== MARCAR CUPOM COMO USADO (apenas quando pagamento confirmado) ==========
              if (credit.couponCode) {
                // Verificar se é cupom DEV (não marca como usado)
                const isDevCoupon = credit.couponCode.toUpperCase().startsWith('DEV');
                
                if (!isDevCoupon) {
                  const couponResult = await recordCouponUsageIdempotent(tx, {
                    userId: credit.userId,
                    couponCode: credit.couponCode,
                    context: 'CREDIT_PURCHASE',
                    creditId: credit.id,
                    isDevCoupon: false,
                  });

                  if (couponResult.ok) {
                    console.log(`🎫 [Asaas Webhook] Cupom ${credit.couponCode} marcado como usado para crédito ${actualBookingId}`);
                  } else {
                    console.warn(`⚠️ [Asaas Webhook] Cupom ${credit.couponCode} já estava marcado como usado para crédito ${actualBookingId}`);
                  }
                }
              }
            });

            console.log(`💳 [Asaas Webhook] Crédito confirmado via checkout: ${actualBookingId} (checkout: ${checkoutId})`);
          }
        } else {
          // Booking: confirmar
          const booking = await prisma.booking.findUnique({
            where: { id: actualBookingId },
            include: { user: true, room: true },
          });

          if (booking && booking.status !== 'CONFIRMED') {
            await prisma.booking.update({
              where: { id: actualBookingId },
              data: {
                status: 'CONFIRMED',
                paymentStatus: 'APPROVED', // PaymentStatus enum usa APPROVED
                financialStatus: 'PAID',
                paymentId: checkoutId,
                amountPaid: checkout.value ? realToCents(checkout.value) : (booking.netAmount ?? 0),
              },
            });

            // Atualizar Payment record
            await prisma.payment.updateMany({
              where: { bookingId: actualBookingId, status: 'PENDING' },
              data: { status: 'APPROVED' }, // Consistência com PaymentStatus enum
            });

            // Enviar notificação de confirmação
            // sendBookingConfirmationNotification busca os dados internamente via bookingId
            sendBookingConfirmationNotification(actualBookingId).catch(err =>
              console.error('⚠️ Erro ao enviar notificação:', err)
            );

            // Trigger account activation (best-effort)
            if (booking.user && !booking.user.emailVerifiedAt) {
              triggerAccountActivation({
                userId: booking.user.id,
                userEmail: booking.user.email,
                userName: booking.user.name || 'Cliente',
              }).catch(err =>
                console.error('⚠️ Erro ao ativar conta:', err)
              );
            }

            console.log(`✅ [Asaas Webhook] Booking confirmado via checkout: ${actualBookingId}`);
          }
        }

        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        });

        return res.status(200).json({
          received: true,
          event,
          action: 'checkout_paid_processed',
          bookingId: actualBookingId,
        });
      }

      // Outros eventos de checkout (EXPIRED, CANCELED, etc) - restaurar cupom se necessário
      console.log(`ℹ️ [Asaas Webhook] Evento de checkout: ${event}`);
      
      // Se checkout expirou ou foi cancelado, restaurar cupom se o crédito ainda está PENDING
      if (event === 'CHECKOUT_EXPIRED' || event === 'CHECKOUT_CANCELED') {
        const parsed = parseExternalReference(externalRef);
        if (parsed && parsed.type === 'purchase') {
          const credit = await prisma.credit.findUnique({
            where: { id: parsed.id },
            select: { id: true, status: true, couponCode: true, userId: true },
          });

          // Se crédito ainda está PENDING e tem cupom, restaurar o cupom (caso tenha sido marcado antes)
          if (credit && credit.status === 'PENDING' && credit.couponCode) {
            await prisma.$transaction(async (tx) => {
              const restoreResult = await restoreCouponUsage(tx, undefined, credit.id, false);
              if (restoreResult.restored) {
                console.log(`♻️ [Asaas Webhook] Cupom ${credit.couponCode} restaurado após ${event} do checkout ${checkoutId}`);
              }
            });
          }
        }
      }

      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'PROCESSED' },
      });
      return res.status(200).json({ received: true, event });
    }

    // ===================================================================
    // PAYMENT EVENT (fluxo original)
    // ===================================================================
    const rawPaymentPayload = rawPayload as AsaasWebhookPayload;

    if (!rawPaymentPayload || !rawPaymentPayload.event || !rawPaymentPayload.payment) {
      console.error('❌ [Asaas Webhook] Payload inválido');
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Sanitizar dados do payload
    const payload = sanitizeWebhookPayload(rawPaymentPayload);
    const { id: eventId, event, payment } = payload;
    const bookingId = payment.externalReference;

    // LOG DE OPERAÇÃO - Webhook recebido
    const webhookIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress || 'unknown';
    logWebhookReceived({
      externalId: payment.id,
      event,
      ip: webhookIp,
    });

    // AUDIT EVENT (DB) - Webhook recebido (best-effort)
    recordWebhookReceived({
      requestId,
      eventId,
      eventType: event,
      paymentId: payment.id,
    });

    console.log(`📥 [Asaas Webhook] Evento: ${event}`, {
      eventId,
      paymentId: payment.id,
      bookingId,
      status: payment.status,
    });

    // 3. Idempotência via banco de dados - evitar processar mesmo evento duas vezes
    // P-006: Permitir reprocessamento de eventos PROCESSING ou FAILED
    const existingEvent = await withTimeout(
      prisma.webhookEvent.findUnique({
        where: { eventId },
      }),
      5000,
      'verificação de evento existente'
    );

    if (existingEvent) {
      // P-006: Se status é PROCESSED ou IGNORED_*, skip (já processado com sucesso)
      // Se status é PROCESSING ou FAILED, reprocessar
      const shouldReprocess = existingEvent.status === 'PROCESSING' || existingEvent.status === 'FAILED';

      if (!shouldReprocess) {
        console.log(`⏭️ [Asaas Webhook] Evento já processado: ${eventId} (status: ${existingEvent.status})`);
        return res.status(200).json({ received: true, skipped: true, processedAt: existingEvent.processedAt });
      }

      // Reprocessar evento que falhou ou ficou travado
      console.log(`🔄 [Asaas Webhook] Reprocessando evento: ${eventId} (status anterior: ${existingEvent.status})`);

      // Atualizar para PROCESSING antes de reprocessar
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSING' },
        }),
        5000,
        'atualização de status para reprocessamento'
      );
    } else {
      // Registrar evento ANTES de processar (para garantir idempotência mesmo em crash)
      await withTimeout(
        prisma.webhookEvent.create({
          data: {
            eventId,
            eventType: event,
            paymentId: payment.id,
            bookingId: bookingId || null,
            status: 'PROCESSING',
            payload: payload as object,
          },
        }),
        5000,
        'criação de webhook event'
      );
    }

    // 4. Verificar se é evento de pagamento confirmado, estorno/chargeback ou recusa de cartão
    if (!isPaymentConfirmed(event) && !isPaymentRefundedOrChargeback(event) && !isCardCaptureRefused(event)) {
      console.log(`ℹ️ [Asaas Webhook] Evento ignorado: ${event}`);

      // Marcar evento como processado mesmo sendo ignorado
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        }),
        5000,
        'atualização de status de webhook event'
      );

      return res.status(200).json({ received: true, event });
    }

    // 4.0.5 Tratar CAPTURE_REFUSED - Cartão recusado na captura
    // IMPORTANTE: NÃO confirmar booking, NÃO creditar horas, NÃO alterar booking.status
    if (isCardCaptureRefused(event)) {
      console.log(`❌ [Asaas Webhook] Cartão recusado na captura: ${event}`, {
        paymentId: payment.id,
        bookingId,
        status: payment.status,
      });

      if (bookingId) {
        // Normalizar externalReference para detectar tipo
        const parsed = parseExternalReference(bookingId);
        const isPurchase = parsed?.type === 'purchase';

        if (isPurchase && parsed) {
          // Crédito: marcar como falha (mantém PENDING, não ativa)
          const creditId = parsed.id;
          console.log(`💳 [Asaas Webhook] Crédito não ativado (captura recusada): ${creditId}`);
          // Crédito permanece PENDING - não precisa atualizar nada
          await logAudit({
            action: 'PAYMENT_FAILED',
            source: 'SYSTEM',
            targetType: 'Credit',
            targetId: creditId,
            metadata: { event, paymentId: payment.id, reason: 'card_capture_refused' },
          });
        } else {
          // Booking: extrair ID (suporta "booking:xxx" ou ID direto para legado)
          const actualBookingId = bookingId.replace('booking:', '');

          // SOMENTE atualizar paymentStatus - NÃO tocar em status ou financialStatus
          await prisma.booking.updateMany({
            where: { id: actualBookingId },
            data: {
              paymentStatus: 'REJECTED',
              // NÃO alterar status (mantém PENDING ou o que for)
              // NÃO alterar financialStatus
            },
          });

          await logAudit({
            action: 'PAYMENT_FAILED',
            source: 'SYSTEM',
            targetType: 'Booking',
            targetId: actualBookingId,
            metadata: { event, paymentId: payment.id, reason: 'card_capture_refused' },
          });

          console.log(`💳 [Asaas Webhook] Booking paymentStatus=REJECTED (status preservado): ${actualBookingId}`);
        }
      }

      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'PROCESSED' },
      });

      return res.status(200).json({
        received: true,
        event,
        action: 'capture_refused_processed',
      });
    }

    // 4.1 Tratar REFUND/CHARGEBACK - Atualizar status financeiro SEM cancelar booking
    // HARDENING: Idempotência via Refund record + não duplicar créditos
    if (isPaymentRefundedOrChargeback(event)) {
      console.log(`⚠️ [Asaas Webhook] Evento de estorno/chargeback: ${event}`, {
        paymentId: payment.id,
        bookingId,
        status: payment.status,
      });

      if (!bookingId) {
        console.log(`ℹ️ [Asaas Webhook] Estorno sem bookingId - ignorando`);
        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        });
        return res.status(200).json({ received: true, event, message: 'Sem referência' });
      }

      // Normalizar externalReference para detectar tipo
      const parsed = parseExternalReference(bookingId);
      const isPurchase = parsed?.type === 'purchase';

      if (isPurchase && parsed) {
        // Extrair ID do crédito (suporta todos os formatos)
        const creditId = parsed.id;

        await prisma.$transaction(async (tx) => {
          // Buscar crédito para obter informações do cupom
          const credit = await tx.credit.findUnique({
            where: { id: creditId },
            select: { id: true, couponCode: true, userId: true },
          });

          // Atualizar status do crédito
          await tx.credit.updateMany({
            where: { id: creditId },
            data: {
              status: 'REFUNDED',
              remainingAmount: 0,
            },
          });

          // ========== RESTAURAR CUPOM quando pagamento for estornado ==========
          if (credit && credit.couponCode) {
            const restoreResult = await restoreCouponUsage(tx, undefined, creditId, false);
            if (restoreResult.restored) {
              console.log(`♻️ [Asaas Webhook] Cupom ${credit.couponCode} restaurado após estorno do crédito ${creditId}`);
            }
          }
        });

        console.log(`💸 [Asaas Webhook] Crédito estornado: ${creditId}`);

        await logAudit({
          action: 'CREDIT_REFUNDED',
          source: 'SYSTEM',
          targetType: 'Credit',
          targetId: creditId,
          metadata: { event, paymentId: payment.id, reason: 'chargeback_or_refund' },
        });
      } else {
        // É uma booking - extrair ID (suporta "booking:xxx" ou ID direto para retrocompatibilidade)
        const actualBookingId = bookingId.replace('booking:', '');

        const booking = await prisma.booking.findUnique({
          where: { id: actualBookingId },
          select: {
            id: true,
            userId: true,
            status: true,
            creditIds: true,
            creditsUsed: true,
            netAmount: true,
            amountPaid: true,
          },
        });

        if (booking) {
          // ===============================================================
          // HARDENING IDEMPOTÊNCIA: Verificar se já existe Refund para booking
          // ===============================================================
          const existingRefund = await prisma.refund.findUnique({
            where: { bookingId: actualBookingId },
          });

          if (existingRefund) {
            // Refund já existe - apenas atualizar status se necessário
            if (existingRefund.status === 'PENDING') {
              await prisma.refund.update({
                where: { id: existingRefund.id },
                data: {
                  status: 'COMPLETED',
                  gateway: 'ASAAS',
                  externalRefundId: payment.id,
                  processedAt: new Date(),
                },
              });
              console.log(`✅ [Asaas Webhook] Refund ${existingRefund.id} marcado COMPLETED (gateway confirmou)`);
            } else {
              console.log(`⏭️ [Asaas Webhook] Refund já existe para booking ${actualBookingId} (status: ${existingRefund.status}) - ignorando duplicata`);
            }

            // Atualizar booking para REFUNDED se ainda não estiver
            if (booking.status !== 'CANCELLED' || !['REFUNDED'].includes(booking.status)) {
              await prisma.booking.update({
                where: { id: actualBookingId },
                data: {
                  financialStatus: 'REFUNDED',
                  paymentStatus: 'REFUNDED',
                },
              });
            }

            await prisma.webhookEvent.update({
              where: { eventId },
              data: { status: 'PROCESSED' },
            });

            return res.status(200).json({
              received: true,
              event,
              action: 'refund_already_exists',
              refundId: existingRefund.id,
            });
          }

          // ===============================================================
          // Nenhum Refund interno - criar idempotente (gateway iniciou refund)
          // ===============================================================

          // Calcular valor esperado = netAmount (valor total da reserva após cupom)
          // IMPORTANTE: netAmount JÁ INCLUI créditos + dinheiro, NÃO somar com creditsUsed
          const creditsUsedAmount = booking.creditsUsed ?? 0;
          // expectedAmount = total da reserva (NET), NÃO netAmount + creditsUsed
          const expectedAmount = booking.netAmount ?? ((booking.amountPaid ?? 0) + creditsUsedAmount);

          // Obter valor efetivamente estornado do payload
          // Prioridade: refundedValue > chargebackValue > value > fallback para esperado
          let refundedAmount: number;
          if (payment.refundedValue !== undefined && payment.refundedValue > 0) {
            refundedAmount = realToCents(payment.refundedValue);
          } else if (payment.chargebackValue !== undefined && payment.chargebackValue > 0) {
            refundedAmount = realToCents(payment.chargebackValue);
          } else if (payment.value !== undefined && payment.value > 0) {
            // Fallback: usar value do payment (buscar do Payment table se necessário)
            refundedAmount = realToCents(payment.value);
          } else {
            // Último fallback: buscar do Payment table no banco
            const dbPayment = await prisma.payment.findFirst({
              where: {
                OR: [
                  { externalId: payment.id },
                  { purchaseId: actualBookingId },
                ],
              },
              select: { amount: true },
            });

            if (dbPayment?.amount) {
              refundedAmount = dbPayment.amount;
            } else {
              // SEGURANÇA: Payload não trouxe valor e não encontramos no banco
              // NÃO assumir refund total automaticamente - marcar como UNKNOWN para revisão
              console.warn(`⚠️ [Asaas Webhook] Refund sem valor no payload e sem Payment no banco - bookingId=${actualBookingId}, paymentId=${payment.id}`);
              refundedAmount = 0; // Valor desconhecido
            }
          }

          // Flag para indicar que o valor é desconhecido (precisa revisão manual)
          const isAmountUnknown = refundedAmount === 0 && expectedAmount > 0;

          // Determinar se é refund parcial (tolerância de 1% para arredondamentos)
          const tolerance = Math.max(100, expectedAmount * 0.01); // mínimo R$1 ou 1%
          const isPartial = isAmountUnknown || refundedAmount < (expectedAmount - tolerance);

          console.log(`📊 [Asaas Webhook] Refund analysis: expected=${expectedAmount}, refunded=${refundedAmount}, isPartial=${isPartial}, isAmountUnknown=${isAmountUnknown}`);

          // Calcular distribuição: créditos vs dinheiro
          // Prioridade: primeiro restaura créditos, depois dinheiro
          const creditsRestored = Math.min(creditsUsedAmount, refundedAmount);
          const moneyReturned = Math.max(0, refundedAmount - creditsRestored);

          const newRefund = await prisma.refund.create({
            data: {
              bookingId: actualBookingId,
              userId: booking.userId,
              creditsReturned: creditsRestored,
              moneyReturned: moneyReturned,
              totalRefunded: creditsRestored + moneyReturned,
              // Campos de refund parcial
              expectedAmount,
              refundedAmount,
              isPartial,
              gateway: 'ASAAS',
              externalRefundId: payment.id,
              // IMPORTANTE: Se parcial OU valor desconhecido, manter PENDING para revisão manual
              status: isPartial ? 'PENDING' : 'COMPLETED',
              reason: isAmountUnknown
                ? `Gateway ${event}: Valor DESCONHECIDO - payload sem refundedValue/chargebackValue - REVISÃO MANUAL`
                : isPartial
                  ? `Gateway ${event}: Refund PARCIAL (${refundedAmount}/${expectedAmount} centavos)`
                  : `Gateway ${event}: ${payment.id}`,
              processedAt: isPartial ? null : new Date(),
            },
          });
          console.log(`📝 [Asaas Webhook] Refund criado via gateway: ${newRefund.id} (isPartial=${isPartial}, isAmountUnknown=${isAmountUnknown})`);

          // P-013: Atualizar para REFUNDED (agora existe no enum)
          // Se parcial, marcar como PARTIAL_REFUND no financialStatus
          await prisma.booking.update({
            where: { id: actualBookingId },
            data: {
              // status: mantém o valor atual (CONFIRMED, etc) para histórico
              financialStatus: isPartial ? 'PARTIAL_REFUND' : 'REFUNDED', // P-007: Estado final de estorno
              paymentStatus: 'REFUNDED',
              notes: isPartial
                ? `⚠️ Estorno PARCIAL em ${new Date().toISOString()} - Evento: ${event} - Valor: ${refundedAmount}/${expectedAmount} centavos`
                : `⚠️ Estorno/Chargeback em ${new Date().toISOString()} - Evento: ${event}`,
            },
          });
          console.log(`💸 [Asaas Webhook] Booking financialStatus=${isPartial ? 'PARTIAL_REFUND' : 'REFUNDED'}: ${actualBookingId}`);

          // P-013: Se booking usou créditos, restaurar os créditos consumidos
          // NOTA: Só restaura se Refund é novo (evita duplicação)
          // IMPORTANTE: Se refund parcial, restaurar proporcionalmente ao valor estornado
          if (booking.creditIds && booking.creditIds.length > 0 && creditsRestored > 0) {
            console.log(`🔄 [Asaas Webhook] Restaurando créditos para booking ${actualBookingId} (${creditsRestored} centavos)...`);

            // Calcular valor a restaurar por crédito (proporcionalmente)
            // Usa creditsRestored (calculado baseado no refundedAmount, não booking.creditsUsed)
            const amountPerCredit = Math.floor(creditsRestored / booking.creditIds.length);
            let remaining = creditsRestored - (amountPerCredit * booking.creditIds.length);

            for (const creditId of booking.creditIds) {
              // Valor a restaurar para este crédito (último recebe o restante)
              const restoreAmount = amountPerCredit + (remaining > 0 ? 1 : 0);
              if (remaining > 0) remaining--;

              const credit = await prisma.credit.findUnique({
                where: { id: creditId },
                select: { id: true, status: true, remainingAmount: true, amount: true },
              });

              // P0-3: Restaurar crédito se USED OU parcialmente consumido (remainingAmount < amount)
              const isUsed = credit?.status === 'USED';
              const isPartiallyConsumed = credit && credit.remainingAmount < credit.amount;

              if (credit && (isUsed || isPartiallyConsumed)) {
                // Calcular quanto foi realmente usado deste crédito
                const usedAmount = credit.amount - credit.remainingAmount;
                // Não restaurar mais do que foi usado
                const actualRestore = Math.min(restoreAmount, usedAmount);

                if (actualRestore > 0) {
                  // Restaurar crédito: status volta para CONFIRMED, remainingAmount aumenta
                  await prisma.credit.update({
                    where: { id: creditId },
                    data: {
                      status: 'CONFIRMED',
                      remainingAmount: Math.min(credit.amount, credit.remainingAmount + actualRestore),
                    },
                  });
                  console.log(`✅ [Asaas Webhook] Crédito ${creditId} restaurado: +${actualRestore} centavos (usedAmount=${usedAmount}, wasPartial=${isPartiallyConsumed})`);

                  await logAudit({
                    action: 'CREDIT_REFUNDED',
                    source: 'SYSTEM',
                    targetType: 'Credit',
                    targetId: creditId,
                    metadata: {
                      event,
                      bookingId: actualBookingId,
                      restoredAmount: actualRestore,
                      reason: 'booking_refunded',
                      wasPartiallyConsumed: isPartiallyConsumed,
                    },
                  });
                }
              }
            }
          }

          await logAudit({
            action: 'PAYMENT_REFUNDED',
            source: 'SYSTEM',
            targetType: 'Booking',
            targetId: actualBookingId,
            metadata: {
              event,
              paymentId: payment.id,
              reason: 'chargeback_or_refund',
              originalBookingStatus: booking.status,
              creditsRestored: booking.creditIds?.length || 0,
              refundId: newRefund.id,
            },
          });
        }
      }

      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'PROCESSED' },
      });

      return res.status(200).json({
        received: true,
        event,
        action: 'refund_processed',
      });
    }

    // 5. Pagamento confirmado - processar
    if (!bookingId) {
      console.warn('⚠️ [Asaas Webhook] Sem externalReference - ignorando evento');
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'IGNORED_NO_REFERENCE' },
      });
      return res.status(200).json({ ok: true, ignored: 'no_reference' });
    }

    // 5.1 Normalizar externalReference e verificar tipo (purchase vs booking)
    // Aceita: booking:<id>, purchase:<id>, booking:purchase:<id> (legado), credit_<id>, <id> puro
    const parsed = parseExternalReference(bookingId);
    const isPurchase = parsed?.type === 'purchase';

    if (isPurchase && parsed) {
      // Processar confirmação de compra de crédito
      const creditId = parsed.id;

      const credit = await prisma.credit.findUnique({
        where: { id: creditId },
        include: {
          user: {
            select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true },
          },
        },
      });

      if (!credit) {
        console.warn(`⚠️ [Asaas Webhook] Crédito não encontrado (legado/deletado): ${creditId}`);
        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'IGNORED_NOT_FOUND' },
        });
        return res.status(200).json({ ok: true, ignored: 'credit_not_found', creditId });
      }

      // Já confirmado?
      if (credit.status === 'CONFIRMED') {
        console.log(`⏭️ [Asaas Webhook] Crédito já confirmado: ${creditId}`);
        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        });
        return res.status(200).json({ received: true, alreadyConfirmed: true });
      }

      // Ativar crédito - IMPORTANTE: setar remainingAmount para liberar as horas
      await prisma.$transaction(async (tx) => {
        // Atualizar status do crédito
        await tx.credit.update({
          where: { id: creditId },
          data: {
            status: 'CONFIRMED',
            remainingAmount: credit.amount, // Libera as horas compradas
          },
        });

        // ========== MARCAR CUPOM COMO USADO (apenas quando pagamento confirmado) ==========
        if (credit.couponCode) {
          // Verificar se é cupom DEV (não marca como usado)
          const isDevCoupon = credit.couponCode.toUpperCase().startsWith('DEV');
          
          if (!isDevCoupon) {
            const couponResult = await recordCouponUsageIdempotent(tx, {
              userId: credit.userId,
              couponCode: credit.couponCode,
              context: 'CREDIT_PURCHASE',
              creditId: credit.id,
              isDevCoupon: false,
            });

            if (couponResult.ok) {
              console.log(`🎫 [Asaas Webhook] Cupom ${credit.couponCode} marcado como usado para crédito ${creditId}`);
            } else {
              console.warn(`⚠️ [Asaas Webhook] Cupom ${credit.couponCode} já estava marcado como usado para crédito ${creditId}`);
            }
          }
        }
      });

      console.log(`✅ [Asaas Webhook] Crédito confirmado: ${creditId} (${credit.amount} centavos liberados)`);

      // ================================================================
      // META CAPI: Enviar evento Purchase (best-effort, non-blocking)
      // ================================================================
      const alreadySentCapi = await isCapiEventSent('Purchase', 'Credit', creditId);
      if (!alreadySentCapi) {
        sendCapiPurchase({
          entityType: 'Credit',
          entityId: creditId,
          value: payment.value, // Valor em reais do pagamento
          orderId: payment.id,
          contentIds: [creditId],
          contentName: `Créditos Arthemi`,
          userEmail: credit.user?.email,
          userPhone: credit.user?.phone || undefined,
          userId: credit.userId,
          requestId,
        }).then((capiResult) => {
          if (capiResult.ok) {
            console.log(`📊 [CAPI] Purchase sent for credit ${creditId}`, { metaTraceId: capiResult.metaTraceId });
          } else {
            console.warn(`⚠️ [CAPI] Purchase failed for credit ${creditId}`, { error: capiResult.error });
          }
        }).catch((err) => {
          console.error(`❌ [CAPI] Purchase error for credit ${creditId}`, { error: err.message });
        });
      }

      // ATIVAÇÃO DE CONTA (best-effort) - Enviar email se usuário não verificado
      if (credit.user && !credit.user.emailVerifiedAt) {
        triggerAccountActivation({
          userId: credit.user.id,
          userEmail: credit.user.email,
          userName: credit.user.name || 'Cliente',
        }).then((result) => {
          if (result.sent) {
            console.log(`📧 [Asaas Webhook] Email de ativação enviado para: ${credit.user!.email}`);
          }
        }).catch((err) => {
          console.error('⚠️ [Asaas Webhook] Erro ao enviar email de ativação:', err);
        });
      }

      await logAudit({
        action: 'CREDIT_CONFIRMED',
        source: 'SYSTEM',
        targetType: 'Credit',
        targetId: creditId,
        metadata: { event, paymentId: payment.id },
      });

      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'PROCESSED' },
      });

      return res.status(200).json({
        received: true,
        event,
        creditId,
        action: 'credit_confirmed',
      });
    }

    // 5.2 Extrair ID real da booking (já normalizado por parseExternalReference)
    // Se chegou aqui, parsed.type === 'booking'
    const actualBookingId = parsed?.id || bookingId.replace('booking:', '');

    // 6. Buscar booking para determinar tipo de processamento (FIX: Suporte a Short Code displayId)
    // Usamos findFirst com OR para buscar tanto por ID (UUID) quanto por displayId (Código curto ex: CML04D96)
    // 6. Buscar booking para determinar tipo de processamento (FIX: Suporte a Short Code displayId)
    // Usamos findFirst com OR para buscar tanto por ID (UUID) quanto por displayId (Código curto ex: CML04D96)
    // TypeScript: Removemos withTimeout para garantir inferência correta de tipos (product, room, user)
    // WORKAROUND: Cast explícito para any devido a falha na geração do cliente Prisma (coluna displayId faltante nos tipos)
    const booking: any = await prisma.booking.findFirst({
      where: {
        OR: [
          { id: actualBookingId },
          // @ts-ignore - Assumindo que a coluna displayId existe ou será criada conforme solicitado
          { displayId: actualBookingId }
        ]
      },
      include: {
        user: true,
        room: true,
        product: true,
      },
    });

    if (!booking) {
      // Fallback: tentar encontrar como crédito (externalReference legado sem prefixo)
      const creditFallback = await prisma.credit.findUnique({
        where: { id: actualBookingId },
      });

      if (creditFallback) {
        // É um crédito com ID legado - processar como purchase
        console.log(`🔄 [Asaas Webhook] Fallback: encontrado como crédito: ${actualBookingId}`);

        if (creditFallback.status === 'CONFIRMED') {
          await prisma.webhookEvent.update({
            where: { eventId },
            data: { status: 'PROCESSED' },
          });
          return res.status(200).json({ received: true, status: 'already_processed' });
        }

        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
          await prisma.credit.update({
            where: { id: creditFallback.id },
            data: { status: 'CONFIRMED' },
          });
          console.log(`✅ [Asaas Webhook] Crédito (legado) confirmado: ${creditFallback.id}`);
        }

        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        });

        return res.status(200).json({
          received: true,
          event,
          creditId: creditFallback.id,
          action: 'credit_confirmed_fallback',
        });
      }

      // Não é booking nem crédito - ignorar (legado/deletado)
      console.warn(`⚠️ [Asaas Webhook] Entidade não encontrada (nem booking UUID, nem displayId, nem crédito): ${actualBookingId}`);
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'IGNORED_NOT_FOUND' },
      });
      return res.status(200).json({ ok: true, ignored: 'entity_not_found', id: actualBookingId });
    }

    if (booking.status === 'CONFIRMED' && booking.financialStatus === 'PAID') {
      console.log(`⏭️ [Asaas Webhook] Booking já confirmado e pago: ${actualBookingId}`);
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        }),
        5000,
        'atualização de status webhook - já confirmado'
      );
      return res.status(200).json({ received: true, alreadyConfirmed: true });
    }

    // Proteção 2: Booking COURTESY - pagamento não pode alterar cortesia
    if (booking.financialStatus === 'COURTESY') {
      console.warn(`⚠️ [Asaas Webhook] Tentativa de pagamento em reserva COURTESY: ${actualBookingId}`);
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        }),
        5000,
        'atualização de status webhook - courtesy bloqueado'
      );
      return res.status(200).json({ received: true, blocked: true, reason: 'COURTESY_BOOKING' });
    }

    // P-007: Proteção 3: Booking CANCELLED - NÃO reverter para CONFIRMED/PAID
    // Webhook de pagamento tardio não deve ressuscitar booking cancelado
    if (booking.status === 'CANCELLED') {
      console.warn(`⚠️ [Asaas Webhook] Tentativa de confirmar booking CANCELADO: ${actualBookingId}`);
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'BLOCKED_CANCELLED' },
        }),
        5000,
        'atualização de status webhook - cancelado bloqueado'
      );
      await logAudit({
        action: 'ALERT_PAYMENT_NOT_CONFIRMED',
        source: 'SYSTEM',
        targetType: 'Booking',
        targetId: actualBookingId,
        metadata: {
          event,
          paymentId: payment.id,
          reason: 'booking_cancelled',
          message: 'Pagamento recebido para booking cancelado. Requer análise manual.',
        },
      });
      return res.status(200).json({
        received: true,
        blocked: true,
        reason: 'BOOKING_CANCELLED',
        message: 'Booking cancelado não pode ser reativado via webhook. Análise manual necessária.',
      });
    }

    // P-007: Proteção 4: Booking REFUNDED - estado final, não reverter
    if (booking.financialStatus === 'REFUNDED') {
      console.warn(`⚠️ [Asaas Webhook] Tentativa de pagamento em reserva REFUNDED: ${actualBookingId}`);
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'BLOCKED_REFUNDED' },
        }),
        5000,
        'atualização de status webhook - refunded bloqueado'
      );
      return res.status(200).json({
        received: true,
        blocked: true,
        reason: 'BOOKING_REFUNDED',
        message: 'Booking já estornado não pode receber novos pagamentos.',
      });
    }

    // ================================================================
    // CASO 1: PACOTE DE HORAS - Criar crédito, NÃO alterar booking
    // ================================================================
    if (booking.product && isPackageProduct(booking.product.type)) {
      const hoursIncluded = booking.product.hoursIncluded || getPackageHours(booking.product.type);
      const creditAmount = hoursIncluded * (booking.room?.hourlyRate || booking.product.price / hoursIncluded);

      // Calcular expiração (90 dias padrão para pacotes)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (booking.product.validityDays || 90));

      // Determinar usageType baseado no tipo do produto
      const usageType = getUsageTypeFromProduct(booking.product.type);

      // Criar crédito
      const credit = await withTimeout(
        prisma.credit.create({
          data: {
            userId: booking.userId,
            roomId: booking.roomId,
            amount: creditAmount,
            remainingAmount: creditAmount,
            type: 'MANUAL', // Crédito gerado por compra de pacote
            usageType, // Regra de uso: HOURLY, SHIFT, SATURDAY_HOURLY, etc
            status: 'CONFIRMED',
            referenceMonth: new Date().getMonth() + 1,
            referenceYear: new Date().getFullYear(),
            expiresAt,
          },
        }),
        5000,
        'criação de crédito'
      );

      console.log(`💳 [Asaas Webhook] Crédito criado: ${creditAmount} centavos para user ${booking.userId} (usageType: ${usageType})`);

      // Atualizar Payment table se existir
      try {
        await withTimeout(
          prisma.payment.updateMany({
            where: {
              OR: [
                { externalId: payment.id },
                { bookingId: bookingId },
              ]
            },
            data: {
              status: 'APPROVED',
              paidAt: new Date(),
            },
          }),
          5000,
          'atualização de payment - pacote'
        );
      } catch (paymentError) {
        console.warn('⚠️ [Asaas Webhook] Erro ao atualizar Payment (pacote):', paymentError);
      }

      // Log de auditoria para crédito
      await withTimeout(
        logAudit({
          action: 'CREDIT_CREATED',
          source: 'SYSTEM',
          targetType: 'Credit',
          targetId: credit.id,
          metadata: {
            amount: creditAmount,
            hoursIncluded,
            productId: booking.product.id,
            productType: booking.product.type,
            userId: booking.userId,
            roomId: booking.roomId,
            paymentId: sanitizeString(payment.id),
            eventId: sanitizeString(eventId),
            expiresAt: expiresAt.toISOString(),
          },
        }),
        3000,
        'log de auditoria de crédito'
      );

      // Atualizar booking para CONFIRMED (pacote pago)
      const updatedPackageBooking = await withTimeout(
        prisma.booking.update({
          where: { id: actualBookingId },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'APPROVED',
            paymentId: sanitizeString(payment.id),
            amountPaid: realToCents(payment.value),
            financialStatus: 'PAID',
            origin: 'COMMERCIAL',
          },
          select: {
            id: true,
            emailSentAt: true,
          },
        }),
        5000,
        'atualização de booking - pacote'
      );

      console.log(`✅ [Asaas Webhook] Pacote confirmado: ${actualBookingId} (financialStatus=PAID)`);

      // ================================================================
      // META CAPI: Enviar evento Purchase para pacote pago (best-effort)
      // ================================================================
      const alreadySentCapiPackage = await isCapiEventSent('Purchase', 'Booking', actualBookingId);
      if (!alreadySentCapiPackage) {
        sendCapiPurchase({
          entityType: 'Booking',
          entityId: actualBookingId,
          value: payment.value, // Valor em reais do pagamento
          orderId: payment.id,
          contentIds: [booking.roomId, booking.product?.id || ''].filter(Boolean),
          contentName: booking.product?.name || booking.room?.name || 'Pacote Arthemi',
          userEmail: booking.user?.email,
          userPhone: booking.user?.phone || undefined,
          userId: booking.userId,
          requestId,
        }).then((capiResult) => {
          if (capiResult.ok) {
            console.log(`📊 [CAPI] Purchase sent for package ${actualBookingId}`, { metaTraceId: capiResult.metaTraceId });
          } else {
            console.warn(`⚠️ [CAPI] Purchase failed for package ${actualBookingId}`, { error: capiResult.error });
          }
        }).catch((err) => {
          console.error(`❌ [CAPI] Purchase error for package ${actualBookingId}`, { error: err.message });
        });
      }

      // ATIVAÇÃO DE CONTA (best-effort) - Enviar email se usuário não verificado
      if (booking.user && !booking.user.emailVerifiedAt) {
        triggerAccountActivation({
          userId: booking.user.id,
          userEmail: booking.user.email,
          userName: booking.user.name || 'Cliente',
        }).then((result) => {
          if (result.sent) {
            console.log(`📧 [Asaas Webhook] Email de ativação enviado para: ${booking.user.email}`);
          }
        }).catch((err) => {
          console.error('⚠️ [Asaas Webhook] Erro ao enviar email de ativação:', err);
        });
      }

      // Enviar email de confirmação para PACOTE
      let emailSent = false;
      if (!updatedPackageBooking.emailSentAt) {
        try {
          const emailSuccess = await withTimeout(
            sendBookingConfirmationNotification(actualBookingId),
            10000,
            'envio de email de confirmação - pacote'
          );

          if (emailSuccess) {
            await prisma.booking.update({
              where: { id: actualBookingId },
              data: { emailSentAt: new Date() },
            });
            emailSent = true;
            console.log(`📧 [Asaas Webhook] Email de confirmação enviado para pacote ${actualBookingId}`);
          } else {
            console.warn(`⚠️ [Asaas Webhook] Falha ao enviar email para pacote ${actualBookingId}`);
          }
        } catch (emailError) {
          console.error('⚠️ [Asaas Webhook] Erro no envio de email (pacote):', emailError);
        }
      } else {
        console.log(`⏭️ [Asaas Webhook] Email já enviado anteriormente para pacote ${actualBookingId}`);
        emailSent = true;
      }

      // Marcar webhook como processado
      await withTimeout(
        prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        }),
        5000,
        'atualização de status de webhook event'
      );

      return res.status(200).json({
        received: true,
        type: 'PACKAGE',
        creditId: credit.id,
        creditAmount,
        emailSent,
      });
    }

    // ================================================================
    // CASO 2: HORA AVULSA - Atualizar booking com estados corretos
    // ================================================================

    // Atualizar booking com todos os campos necessários
    const updatedBooking = await withTimeout(
      prisma.booking.update({
        where: { id: actualBookingId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'APPROVED',
          paymentId: sanitizeString(payment.id),
          amountPaid: realToCents(payment.value),
          // Campos ETAPA 1: Estado financeiro correto
          financialStatus: 'PAID',
          origin: 'COMMERCIAL',
        },
        select: {
          id: true,
          emailSentAt: true,
        },
      }),
      5000,
      'atualização de booking'
    );

    console.log(`✅ [Asaas Webhook] Reserva confirmada: ${actualBookingId} (financialStatus=PAID, origin=COMMERCIAL)`);

    // ================================================================
    // META CAPI: Enviar evento Purchase para booking pago (best-effort)
    // ================================================================
    const alreadySentCapiBooking = await isCapiEventSent('Purchase', 'Booking', actualBookingId);
    if (!alreadySentCapiBooking) {
      sendCapiPurchase({
        entityType: 'Booking',
        entityId: actualBookingId,
        value: payment.value, // Valor em reais do pagamento
        orderId: payment.id,
        contentIds: [booking.roomId],
        contentName: booking.room?.name || 'Reserva Arthemi',
        userEmail: booking.user?.email,
        userPhone: booking.user?.phone || undefined,
        userId: booking.userId,
        requestId,
      }).then((capiResult) => {
        if (capiResult.ok) {
          console.log(`📊 [CAPI] Purchase sent for booking ${actualBookingId}`, { metaTraceId: capiResult.metaTraceId });
        } else {
          console.warn(`⚠️ [CAPI] Purchase failed for booking ${actualBookingId}`, { error: capiResult.error });
        }
      }).catch((err) => {
        console.error(`❌ [CAPI] Purchase error for booking ${actualBookingId}`, { error: err.message });
      });
    }

    // ATIVAÇÃO DE CONTA (best-effort) - Enviar email se usuário não verificado
    if (booking.user && !booking.user.emailVerifiedAt) {
      triggerAccountActivation({
        userId: booking.user.id,
        userEmail: booking.user.email,
        userName: booking.user.name || 'Cliente',
      }).then((result) => {
        if (result.sent) {
          console.log(`📧 [Asaas Webhook] Email de ativação enviado para: ${booking.user.email}`);
        }
      }).catch((err) => {
        console.error('⚠️ [Asaas Webhook] Erro ao enviar email de ativação:', err);
      });
    }

    // LOG DE OPERAÇÃO - Pagamento confirmado (booking)
    logPaymentConfirmed({
      paymentId: payment.id,
      externalId: payment.id,
      amount: realToCents(payment.value),
      bookingId: actualBookingId,
    });

    // AUDIT EVENT (DB) - Pagamento confirmado (best-effort)
    recordPaymentConfirmed({
      requestId,
      paymentId: payment.id,
      externalId: payment.id,
      amount: realToCents(payment.value),
      bookingId: actualBookingId,
    });

    // Atualizar Payment table se existir
    try {
      await withTimeout(
        prisma.payment.updateMany({
          where: {
            OR: [
              { externalId: payment.id },
              { bookingId: bookingId },
            ]
          },
          data: {
            status: 'APPROVED',
            paidAt: new Date(),
          },
        }),
        5000,
        'atualização de payment'
      );
    } catch (paymentError) {
      console.warn('⚠️ [Asaas Webhook] Erro ao atualizar Payment:', paymentError);
    }

    // Log de auditoria - PAYMENT_RECEIVED
    await withTimeout(
      logAudit({
        action: 'PAYMENT_RECEIVED',
        source: 'SYSTEM',
        targetType: 'Booking',
        targetId: bookingId,
        metadata: {
          paymentId: sanitizeString(payment.id),
          value: payment.value,
          valueCents: realToCents(payment.value),
          billingType: sanitizeString(payment.billingType),
          event: sanitizeString(event),
          origin: 'webhook',
          eventId: sanitizeString(eventId),
          financialStatus: 'PAID',
          bookingOrigin: 'COMMERCIAL',
        },
      }),
      3000,
      'log de auditoria de pagamento'
    );

    // Enviar email de confirmação (aguardar envio para garantir entrega)
    // Verificar emailSentAt para evitar duplicidade
    let emailSent = false;
    if (!updatedBooking.emailSentAt) {
      try {
        const emailSuccess = await withTimeout(
          sendBookingConfirmationNotification(actualBookingId),
          10000,
          'envio de email de confirmação'
        );

        if (emailSuccess) {
          // Marcar email como enviado
          await prisma.booking.update({
            where: { id: actualBookingId },
            data: { emailSentAt: new Date() },
          });
          emailSent = true;
          console.log(`📧 [Asaas Webhook] Email de confirmação enviado para ${actualBookingId}`);
        } else {
          console.warn(`⚠️ [Asaas Webhook] Falha ao enviar email para ${actualBookingId}`);
        }
      } catch (emailError) {
        console.error('⚠️ [Asaas Webhook] Erro no envio de email:', emailError);
        // Não falha o webhook por erro de email
      }
    } else {
      console.log(`⏭️ [Asaas Webhook] Email já enviado anteriormente para ${actualBookingId}`);
      emailSent = true;
    }

    // Marcar WebhookEvent como processado com sucesso
    await withTimeout(
      prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'PROCESSED' },
      }),
      5000,
      'atualização de status de webhook event'
    );

    // Responder sucesso
    return res.status(200).json({
      received: true,
      type: 'HOURLY',
      bookingId,
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      emailSent,
    });

  } catch (error) {
    console.error('❌ [Asaas Webhook] Erro:', error);

    // Tentar marcar evento como falho
    try {
      const payload = req.body as AsaasWebhookPayload;
      if (payload?.id) {
        const sanitizedId = sanitizeString(payload.id);
        await withTimeout(
          prisma.webhookEvent.update({
            where: { eventId: sanitizedId },
            data: { status: 'FAILED' },
          }),
          3000,
          'marcação de evento como falho'
        );
      }
    } catch {
      // Ignora erro ao atualizar status
    }

    // Retornar 200 para evitar retry infinito em erros de código
    // Em produção, enviar para fila de reprocessamento
    return res.status(200).json({
      received: true,
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}

// Desabilitar body parser padrão para receber raw body se necessário
export const config = {
  api: {
    bodyParser: true,
  },
};


