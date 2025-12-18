// ===========================================================
// API: POST /api/webhooks/asaas
// ===========================================================
// Recebe notificações de pagamento do Asaas

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AsaasWebhookPayload, 
  validateWebhookToken, 
  isPaymentConfirmed,
} from '@/lib/asaas';

// Cache de idempotência (em produção, usar Redis)
const processedEvents = new Set<string>();

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

    // 3. Idempotência - evitar processar mesmo evento duas vezes
    if (processedEvents.has(eventId)) {
      console.log(`⏭️ [Asaas Webhook] Evento já processado: ${eventId}`);
      return res.status(200).json({ received: true, skipped: true });
    }

    // Marcar como processado
    processedEvents.add(eventId);

    // Limpar cache antigo (manter últimos 1000)
    if (processedEvents.size > 1000) {
      const toDelete = Array.from(processedEvents).slice(0, 500);
      toDelete.forEach(id => processedEvents.delete(id));
    }

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
      },
    });

    console.log(`✅ [Asaas Webhook] Reserva confirmada: ${bookingId}`);

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

    // 9. Enviar email de confirmação
    try {
      const hours = Math.ceil(
        (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
      );
      
      const dateFormatted = format(booking.startTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const startFormatted = format(booking.startTime, 'HH:mm');
      const endFormatted = format(booking.endTime, 'HH:mm');
      
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
      });
      
      console.log(`📧 [Asaas Webhook] Email enviado: ${booking.user.email}`);
    } catch (emailError) {
      console.error('⚠️ [Asaas Webhook] Erro ao enviar email:', emailError);
      // Não falhar o webhook por erro de email
    }

    // 10. Responder sucesso
    return res.status(200).json({ 
      received: true,
      bookingId,
      status: 'CONFIRMED',
    });

  } catch (error) {
    console.error('❌ [Asaas Webhook] Erro:', error);
    
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
