// ===========================================================
// API: POST /api/webhooks/asaas
// ===========================================================
// Recebe notificações de pagamento do Asaas
// Idempotência garantida por banco de dados (WebhookEvent)
// ETAPA 3: Pagamento confirmado = estado financeiro correto

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { 
  AsaasWebhookPayload, 
  validateWebhookToken, 
  isPaymentConfirmed,
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
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
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

    // 4. Verificar se é evento de pagamento confirmado
    if (!isPaymentConfirmed(event)) {
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

    // 5. Pagamento confirmado - processar
    if (!bookingId) {
      console.error('❌ [Asaas Webhook] Sem externalReference (bookingId)');
      return res.status(400).json({ error: 'Sem referência de reserva' });
    }

    // 6. Buscar booking para determinar tipo de processamento
    const booking = await withTimeout(
      prisma.booking.findUnique({
        where: { id: bookingId },
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
      console.error(`❌ [Asaas Webhook] Booking não encontrado: ${bookingId}`);
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    // ================================================================
    // PROTEÇÕES CONTRA ESTADOS INVÁLIDOS
    // ================================================================
    
    // Proteção 1: Booking já CONFIRMED - não processar novamente
    if (booking.status === 'CONFIRMED' && booking.financialStatus === 'PAID') {
      console.log(`⏭️ [Asaas Webhook] Booking já confirmado e pago: ${bookingId}`);
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
      console.warn(`⚠️ [Asaas Webhook] Tentativa de pagamento em reserva COURTESY: ${bookingId}`);
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
          where: { id: bookingId },
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

      console.log(`✅ [Asaas Webhook] Pacote confirmado: ${bookingId} (financialStatus=PAID)`);

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
              where: { id: bookingId },
              data: { emailSentAt: new Date() },
            });
            emailSent = true;
            console.log(`📧 [Asaas Webhook] Email de confirmação enviado para pacote ${bookingId}`);
          } else {
            console.warn(`⚠️ [Asaas Webhook] Falha ao enviar email para pacote ${bookingId}`);
          }
        } catch (emailError) {
          console.error('⚠️ [Asaas Webhook] Erro no envio de email (pacote):', emailError);
        }
      } else {
        console.log(`⏭️ [Asaas Webhook] Email já enviado anteriormente para pacote ${bookingId}`);
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
        where: { id: bookingId },
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

    console.log(`✅ [Asaas Webhook] Reserva confirmada: ${bookingId} (financialStatus=PAID, origin=COMMERCIAL)`);

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
            where: { id: bookingId },
            data: { emailSentAt: new Date() },
          });
          emailSent = true;
          console.log(`📧 [Asaas Webhook] Email de confirmação enviado para ${bookingId}`);
        } else {
          console.warn(`⚠️ [Asaas Webhook] Falha ao enviar email para ${bookingId}`);
        }
      } catch (emailError) {
        console.error('⚠️ [Asaas Webhook] Erro no envio de email:', emailError);
        // Não falha o webhook por erro de email
      }
    } else {
      console.log(`⏭️ [Asaas Webhook] Email já enviado anteriormente para ${bookingId}`);
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
