// ===========================================================
// API: POST /api/webhooks/asaas
// ===========================================================
// Recebe notificações de pagamento do Asaas
// Idempotência garantida por banco de dados (WebhookEvent)

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AsaasWebhookPayload, 
  validateWebhookToken, 
  isPaymentConfirmed,
} from '@/lib/asaas';
import { createMagicLink } from '@/lib/magic-link';
import { getUserCreditsSummary } from '@/lib/business-rules';

// Idempotência via banco de dados (WebhookEvent table)

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

    // 2. Parsear payload
    const payload = req.body as AsaasWebhookPayload;
    
    if (!payload || !payload.event || !payload.payment) {
      console.error('❌ [Asaas Webhook] Payload inválido:', req.body);
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const { id: eventId, event, payment } = payload;
    const bookingId = payment.externalReference;

    console.log(`📥 [Asaas Webhook] Evento: ${event}`, {
      eventId,
      paymentId: payment.id,
      bookingId,
      status: payment.status,
    });

    // 3. Idempotência via banco de dados - evitar processar mesmo evento duas vezes
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      console.log(`⏭️ [Asaas Webhook] Evento já processado: ${eventId}`);
      return res.status(200).json({ received: true, skipped: true, processedAt: existingEvent.processedAt });
    }

    // Registrar evento ANTES de processar (para garantir idempotência mesmo em crash)
    await prisma.webhookEvent.create({
      data: {
        eventId,
        eventType: event,
        paymentId: payment.id,
        bookingId: bookingId || null,
        status: 'PROCESSING',
        payload: payload as object,
      },
    });

    // 4. Verificar se é evento de pagamento confirmado
    if (!isPaymentConfirmed(event)) {
      console.log(`ℹ️ [Asaas Webhook] Evento ignorado: ${event}`);
      
      return res.status(200).json({ received: true, event });
    }

    // 5. Pagamento confirmado - processar
    if (!bookingId) {
      console.error('❌ [Asaas Webhook] Sem externalReference (bookingId)');
      return res.status(400).json({ error: 'Sem referência de reserva' });
    }

    // 6. Buscar e atualizar booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        user: true,
        room: true,
        product: true,
      },
    });

    if (!booking) {
      console.error(`❌ [Asaas Webhook] Booking não encontrado: ${bookingId}`);
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    // Verificar se já foi confirmado (idempotência extra)
    if (booking.status === 'CONFIRMED') {
      console.log(`⏭️ [Asaas Webhook] Booking já confirmado: ${bookingId}`);
      return res.status(200).json({ received: true, alreadyConfirmed: true });
    }

    // 7. Confirmar reserva
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'APPROVED',
        paymentId: payment.id,
        amountPaid: Math.round(payment.value * 100), // Converter reais para centavos
      },
    });

    console.log(`✅ [Asaas Webhook] Reserva confirmada: ${bookingId}`);

    // 7.1. Atualizar Payment table se existir
    try {
      await prisma.payment.updateMany({
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
      });
    } catch (paymentError) {
      console.warn('⚠️ [Asaas Webhook] Erro ao atualizar Payment:', paymentError);
    }

    // 7.2. Criar Credit se for pacote de horas
    let creditCreated = false;
    if (booking.product && isPackageProduct(booking.product.type)) {
      try {
        const hoursIncluded = booking.product.hoursIncluded || getPackageHours(booking.product.type);
        const creditAmount = hoursIncluded * (booking.room?.hourlyRate || booking.product.price / hoursIncluded);
        
        // Calcular expiração (90 dias padrão para pacotes)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (booking.product.validityDays || 90));
        
        await prisma.credit.create({
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
        });
        
        creditCreated = true;
        console.log(`💳 [Asaas Webhook] Crédito criado: ${creditAmount} centavos para user ${booking.userId}`);
        
        // Log de auditoria para crédito
        await logAudit({
          action: 'CREDIT_CREATED',
          source: 'SYSTEM',
          targetType: 'Credit',
          targetId: booking.userId,
          metadata: {
            amount: creditAmount,
            productId: booking.product.id,
            productType: booking.product.type,
            bookingId,
            paymentId: payment.id,
          },
        });
      } catch (creditError) {
        console.error('❌ [Asaas Webhook] Erro ao criar crédito:', creditError);
      }
    }

    // 8. Log de auditoria
    await logAudit({
      action: 'PAYMENT_RECEIVED',
      source: 'SYSTEM',
      targetType: 'Booking',
      targetId: bookingId,
      metadata: {
        paymentId: payment.id,
        value: payment.value,
        billingType: payment.billingType,
        event,
      },
    });

    // 9. Enviar email de confirmação com magic link
    try {
      const hours = Math.ceil(
        (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
      );
      
      const dateFormatted = format(booking.startTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const startFormatted = format(booking.startTime, 'HH:mm');
      const endFormatted = format(booking.endTime, 'HH:mm');
      
      // Gera magic link para acesso direto à conta
      let magicLinkToken: string | undefined;
      try {
        const magicLinkResult = await createMagicLink(booking.user.email);
        if (magicLinkResult.success && magicLinkResult.token) {
          magicLinkToken = magicLinkResult.token;
        }
      } catch (mlError) {
        console.warn('⚠️ [Asaas Webhook] Erro ao gerar magic link:', mlError);
      }

      // Calcula saldo de créditos do usuário
      let creditBalance = 0;
      try {
        const creditsSummary = await getUserCreditsSummary(booking.userId);
        creditBalance = creditsSummary.total;
      } catch (credError) {
        console.warn('⚠️ [Asaas Webhook] Erro ao calcular saldo:', credError);
      }
      
      await sendBookingConfirmationEmail({
        userName: booking.user.name,
        userEmail: booking.user.email,
        bookingId: booking.id,
        roomName: booking.room.name,
        date: dateFormatted,
        startTime: startFormatted,
        endTime: endFormatted,
        duration: `${hours}h`,
        amountPaid: payment.value * 100, // Converter para centavos
        paymentMethod: 'PIX',
        magicLinkToken,
        creditBalance,
      });
      
      console.log(`📧 [Asaas Webhook] Email enviado: ${booking.user.email}`);
    } catch (emailError) {
      console.error('⚠️ [Asaas Webhook] Erro ao enviar email:', emailError);
      // Não falhar o webhook por erro de email
    }

    // 11. Atualizar WebhookEvent como processado com sucesso
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { status: 'PROCESSED' },
    });

    // 12. Responder sucesso
    return res.status(200).json({ 
      received: true,
      bookingId,
      status: 'CONFIRMED',
    });

  } catch (error) {
    console.error('❌ [Asaas Webhook] Erro:', error);
    
    // Tentar marcar evento como falho
    try {
      const payload = req.body as AsaasWebhookPayload;
      if (payload?.id) {
        await prisma.webhookEvent.update({
          where: { eventId: payload.id },
          data: { status: 'FAILED' },
        });
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
