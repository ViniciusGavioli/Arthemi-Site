// ===========================================================
// API: POST /api/webhooks/asaas
// ===========================================================
// Recebe notificações de pagamento do Asaas
// Idempotência garantida por banco de dados (WebhookEvent)
// Suporta PIX e Cartão (crédito/débito)
// Trata: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_REFUNDED, CHARGEBACK_*

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
  realToCents,
} from '@/lib/asaas';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';


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
    const rawPayload = req.body as AsaasWebhookPayload;
    
    if (!rawPayload || !rawPayload.event || !rawPayload.payment) {
      console.error('❌ [Asaas Webhook] Payload inválido');
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Sanitizar dados do payload
    const payload = sanitizeWebhookPayload(rawPayload);
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
    const existingEvent = await withTimeout(
      prisma.webhookEvent.findUnique({
        where: { eventId },
      }),
      5000,
      'verificação de evento existente'
    );

    if (existingEvent) {
      console.log(`⏭️ [Asaas Webhook] Evento já processado: ${eventId}`);
      return res.status(200).json({ received: true, skipped: true, processedAt: existingEvent.processedAt });
    }

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
        
        await prisma.credit.updateMany({
          where: { id: creditId },
          data: {
            status: 'REFUNDED',
            remainingAmount: 0,
          },
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
          select: { id: true, status: true, creditIds: true },
        });

        if (booking) {
          // IMPORTANTE: NÃO mudar status nem financialStatus - preservar histórico
          // Apenas atualizar paymentStatus + notes para refletir o estorno
          // (financialStatus não tem enum REFUNDED, então deixamos inalterado)
          await prisma.booking.update({
            where: { id: actualBookingId },
            data: {
              // status: mantém o valor atual (CONFIRMED, etc)
              // financialStatus: mantém o valor atual (PAID, etc) - sem enum para REFUNDED
              paymentStatus: 'REFUNDED',
              notes: `⚠️ Estorno/Chargeback em ${new Date().toISOString()} - Evento: ${event}. Status e financialStatus originais mantidos para auditoria.`,
            },
          });
          console.log(`💸 [Asaas Webhook] Booking paymentStatus=REFUNDED (status e financialStatus preservados): ${actualBookingId}`);

          // Se booking usou créditos, restaurar os créditos
          if (booking.creditIds && booking.creditIds.length > 0) {
            // Nota: Restaurar créditos é complexo - requer lógica de ledger
            // Por segurança, apenas logamos e o admin deve tratar manualmente
            console.log(`⚠️ [Asaas Webhook] Booking tinha créditos: ${booking.creditIds.join(', ')}`);
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
      await prisma.credit.update({
        where: { id: creditId },
        data: {
          status: 'CONFIRMED',
          remainingAmount: credit.amount, // Libera as horas compradas
        },
      });

      console.log(`✅ [Asaas Webhook] Crédito confirmado: ${creditId} (${credit.amount} centavos liberados)`);

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

    // 6. Buscar booking para determinar tipo de processamento
    const booking = await withTimeout(
      prisma.booking.findUnique({
        where: { id: actualBookingId },
        include: { 
          user: true,
          room: true,
          product: true,
        },
      }),
      5000,
      'busca de booking'
    );

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
          return res.status(200).json({ received: true, alreadyConfirmed: true });
        }

        await prisma.credit.update({
          where: { id: actualBookingId },
          data: {
            status: 'CONFIRMED',
            remainingAmount: creditFallback.amount,
          },
        });

        await prisma.webhookEvent.update({
          where: { eventId },
          data: { status: 'PROCESSED' },
        });

        console.log(`✅ [Asaas Webhook] Crédito confirmado (fallback): ${actualBookingId}`);
        return res.status(200).json({ received: true, creditId: actualBookingId, action: 'credit_confirmed_fallback' });
      }

      // Não é booking nem crédito - ignorar (legado/deletado)
      console.warn(`⚠️ [Asaas Webhook] Entidade não encontrada (legado/deletado): ${actualBookingId}`);
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'IGNORED_NOT_FOUND' },
      });
      return res.status(200).json({ ok: true, ignored: 'entity_not_found', id: actualBookingId });
    }

    // ================================================================
    // PROTEÇÕES CONTRA ESTADOS INVÁLIDOS
    // ================================================================
    
    // Proteção 1: Booking já CONFIRMED - não processar novamente
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

    // ================================================================
    // CASO 1: PACOTE DE HORAS - Criar crédito, NÃO alterar booking
    // ================================================================
    if (booking.product && isPackageProduct(booking.product.type)) {
      const hoursIncluded = booking.product.hoursIncluded || getPackageHours(booking.product.type);
      const creditAmount = hoursIncluded * (booking.room?.hourlyRate || booking.product.price / hoursIncluded);
      
      // Calcular expiração (90 dias padrão para pacotes)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (booking.product.validityDays || 90));
      
      // Criar crédito
      const credit = await withTimeout(
        prisma.credit.create({
          data: {
            userId: booking.userId,
            roomId: booking.roomId,
            amount: creditAmount,
            remainingAmount: creditAmount,
            type: 'MANUAL', // Crédito gerado por compra de pacote
            status: 'CONFIRMED',
            referenceMonth: new Date().getMonth() + 1,
            referenceYear: new Date().getFullYear(),
            expiresAt,
          },
        }),
        5000,
        'criação de crédito'
      );
      
      console.log(`💳 [Asaas Webhook] Crédito criado: ${creditAmount} centavos para user ${booking.userId}`);
      
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

      // Enviar email de confirmação para PACOTE
      let emailSent = false;
      if (!updatedPackageBooking.emailSentAt) {
        try {
          const emailSuccess = await withTimeout(
            sendBookingConfirmationNotification(bookingId),
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
          sendBookingConfirmationNotification(bookingId),
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


