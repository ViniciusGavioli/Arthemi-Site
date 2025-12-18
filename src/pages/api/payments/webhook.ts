// ===========================================================
// API: POST /api/payments/webhook
// ===========================================================
// Webhook do MercadoPago para receber notificações de pagamento
// FASE 0.3: Validação, segurança e idempotência
// FASE 1.3: Email de confirmação
// FASE 3.3: Audit logs

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getPaymentDetails, isMockMode } from '@/lib/mercadopago';
import { sendBookingConfirmationEmail, type BookingEmailData } from '@/lib/email';
import { logSystemAction } from '@/lib/audit';

// ============================================================
// TIPOS
// ============================================================

type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

interface WebhookResponse {
  received: boolean;
  action?: 'confirmed' | 'ignored' | 'skipped' | 'error';
  reason?: string;
  bookingId?: string;
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  mock?: boolean;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
) {
  // MercadoPago envia GET para verificar se endpoint existe
  if (req.method === 'GET') {
    return res.status(200).json({ 
      received: true, 
      action: 'skipped',
      reason: 'health_check' 
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      received: false, 
      action: 'error',
      reason: 'method_not_allowed' 
    });
  }

  try {
    // ========================================================
    // 1. PARSING DO PAYLOAD
    // ========================================================
    const { type, data, action } = req.body;
    
    console.log('📩 [WEBHOOK] Recebido:', { type, action, dataId: data?.id });

    // ========================================================
    // 2. FILTRAR APENAS EVENTOS DE PAGAMENTO
    // ========================================================
    const isPaymentNotification = 
      type === 'payment' || 
      action?.startsWith('payment.');

    if (!isPaymentNotification) {
      console.log('⏭️ [WEBHOOK] Ignorando:', type || action);
      return res.status(200).json({ 
        received: true, 
        action: 'ignored',
        reason: 'not_payment_event' 
      });
    }

    // ========================================================
    // 3. VALIDAR PAYMENT ID
    // ========================================================
    const paymentId = data?.id;
    if (!paymentId) {
      console.error('❌ [WEBHOOK] Payment ID ausente');
      return res.status(200).json({ 
        received: true, 
        action: 'error',
        reason: 'missing_payment_id' 
      });
    }

    // ========================================================
    // 4. MODO MOCK - RETORNAR SEM PROCESSAR
    // ========================================================
    if (isMockMode()) {
      console.log('🎭 [WEBHOOK] Modo mock - ignorando');
      return res.status(200).json({ 
        received: true, 
        action: 'skipped',
        reason: 'mock_mode',
        mock: true 
      });
    }

    // ========================================================
    // 5. BUSCAR DETALHES DO PAGAMENTO NO MERCADOPAGO
    // ========================================================
    const paymentInfo = await getPaymentDetails(paymentId.toString());
    
    if (!paymentInfo) {
      console.error('❌ [WEBHOOK] Pagamento não encontrado no MP:', paymentId);
      return res.status(200).json({ 
        received: true, 
        action: 'error',
        reason: 'payment_not_found_in_mp' 
      });
    }

    console.log('💳 [WEBHOOK] Pagamento:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      reference: paymentInfo.externalReference,
    });

    // ========================================================
    // 6. ACEITAR APENAS STATUS "APPROVED"
    // ========================================================
    if (paymentInfo.status !== 'approved') {
      console.log(`⏭️ [WEBHOOK] Status não é approved: ${paymentInfo.status}`);
      return res.status(200).json({ 
        received: true, 
        action: 'ignored',
        reason: `status_${paymentInfo.status}` 
      });
    }

    // ========================================================
    // 7. VALIDAR EXTERNAL REFERENCE (BOOKING ID)
    // ========================================================
    const bookingId = paymentInfo.externalReference;
    
    if (!bookingId) {
      console.error('❌ [WEBHOOK] BookingId ausente na referência');
      return res.status(200).json({ 
        received: true, 
        action: 'error',
        reason: 'missing_booking_reference' 
      });
    }

    // ========================================================
    // 8. BUSCAR BOOKING NO BANCO (com dados para email)
    // ========================================================
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        product: true,
        room: true,
        user: true,
      },
    });

    if (!booking) {
      console.error('❌ [WEBHOOK] Booking não encontrado:', bookingId);
      return res.status(200).json({ 
        received: true, 
        action: 'error',
        reason: 'booking_not_found',
        bookingId 
      });
    }

    // ========================================================
    // 9. IDEMPOTÊNCIA: VERIFICAR SE JÁ ESTÁ CONFIRMADO
    // ========================================================
    if (booking.status === 'CONFIRMED') {
      console.log(`⏭️ [WEBHOOK] Booking já confirmado: ${bookingId}`);
      return res.status(200).json({ 
        received: true, 
        action: 'skipped',
        reason: 'already_confirmed',
        bookingId,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'APPROVED'
      });
    }

    // ========================================================
    // 10. IDEMPOTÊNCIA: VERIFICAR SE JÁ TEM MESMO PAYMENT ID
    // ========================================================
    if (booking.paymentId === paymentInfo.id && booking.paymentStatus === 'APPROVED') {
      console.log(`⏭️ [WEBHOOK] Pagamento já processado: ${paymentInfo.id}`);
      return res.status(200).json({ 
        received: true, 
        action: 'skipped',
        reason: 'payment_already_processed',
        bookingId,
        bookingStatus: booking.status as BookingStatus,
        paymentStatus: 'APPROVED'
      });
    }

    // ========================================================
    // 11. ATUALIZAR BOOKING PARA CONFIRMED
    // ========================================================
    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CONFIRMED',
        paymentId: paymentInfo.id,
        paymentStatus: 'APPROVED',
        amountPaid: paymentInfo.transactionAmount,
        paymentMethod: paymentInfo.paymentMethodId || 'mercadopago',
      },
    });

    console.log(`✅ [WEBHOOK] Booking confirmado: ${bookingId}`);

    // ✅ LOG DE AUDITORIA - Pagamento recebido e confirmado
    await logSystemAction('PAYMENT_RECEIVED', 'Booking', bookingId, {
      paymentId: paymentInfo.id,
      status: paymentInfo.status,
      transactionAmount: paymentInfo.transactionAmount,
      paymentMethodId: paymentInfo.paymentMethodId,
    });
    
    await logSystemAction('BOOKING_CONFIRMED', 'Booking', bookingId, {
      confirmedBy: 'webhook_mercadopago',
      paymentId: paymentInfo.id,
      amountPaid: paymentInfo.transactionAmount,
    });

    // ========================================================
    // 12. ENVIAR EMAIL DE CONFIRMAÇÃO
    // ========================================================
    if (booking.user.email) {
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      const durationHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
      
      const emailData: BookingEmailData = {
        userName: booking.user.name,
        userEmail: booking.user.email,
        roomName: booking.room.name,
        date: startDate.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        }),
        startTime: startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        endTime: endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        duration: `${durationHours} hora${durationHours > 1 ? 's' : ''}`,
        amountPaid: paymentInfo.transactionAmount,
        bookingId: booking.id,
        paymentMethod: paymentInfo.paymentMethodId || 'mercadopago',
      };
      
      // Enviar email (não bloqueia resposta do webhook)
      sendBookingConfirmationEmail(emailData).catch(err => {
        console.error('❌ [WEBHOOK] Erro ao enviar email:', err);
      });
    } else {
      console.log('⚠️ [WEBHOOK] Email não enviado - usuário sem email cadastrado');
    }

    // ========================================================
    // 13. CRIAR USER PACKAGE (SE FOR PACOTE) - COM IDEMPOTÊNCIA
    // ========================================================
    if (booking.product) {
      await handlePackagePurchaseIdempotent(booking, paymentInfo);
    }

    // ========================================================
    // 14. RETORNAR SUCESSO
    // ========================================================
    return res.status(200).json({ 
      received: true, 
      action: 'confirmed',
      bookingId, 
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'APPROVED',
    });

  } catch (error) {
    // ========================================================
    // ERROR HANDLER - SEMPRE RETORNA 200
    // ========================================================
    console.error('❌ [WEBHOOK] Erro crítico:', error);
    
    // IMPORTANTE: Retornar 200 mesmo em erro para evitar retentativas infinitas do MP
    return res.status(200).json({ 
      received: true, 
      action: 'error',
      reason: error instanceof Error ? error.message : 'internal_error'
    });
  }
}

// ============================================================
// HANDLER DE PACOTES - COM IDEMPOTÊNCIA
// ============================================================

async function handlePackagePurchaseIdempotent(
  booking: { 
    id: string;
    userId: string; 
    paymentId: string | null;
    product: { type: string; name: string; price: number } | null 
  },
  paymentInfo: { id: string; transactionAmount: number; paymentMethodId: string }
): Promise<void> {
  if (!booking.product) return;

  const productType = booking.product.type;
  
  // Mapear tipo de produto para horas
  const hoursMap: Record<string, number> = {
    PACKAGE_10H: 10,
    PACKAGE_20H: 20,
    PACKAGE_40H: 40,
    SHIFT_FIXED: 16,
    DAY_PASS: 10,
    SATURDAY_PASS: 4,
  };

  const totalHours = hoursMap[productType] || 0;
  
  if (totalHours === 0) {
    console.log('⏭️ [WEBHOOK] Produto não é pacote:', productType);
    return;
  }

  // ========================================================
  // IDEMPOTÊNCIA: Verificar se já existe UserPackage para este booking
  // ========================================================
  const existingPackage = await prisma.userPackage.findFirst({
    where: {
      userId: booking.userId,
      // Usar o amountPaid e createdAt para identificar duplicatas
      // Como não temos bookingId no UserPackage, usamos paymentStatus + amount
      paymentStatus: 'APPROVED',
      amountPaid: paymentInfo.transactionAmount,
      totalHours: totalHours,
      // Criado nos últimos 5 minutos (janela de duplicata)
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000)
      }
    }
  });

  if (existingPackage) {
    console.log(`⏭️ [WEBHOOK] UserPackage já existe: ${existingPackage.id}`);
    return;
  }

  // Calcular data de expiração
  const expiryDaysMap: Record<string, number> = {
    PACKAGE_10H: 90,
    PACKAGE_20H: 90,
    PACKAGE_40H: 180,
    SHIFT_FIXED: 30,
    DAY_PASS: 1,
    SATURDAY_PASS: 1,
  };

  const expiryDays = expiryDaysMap[productType] || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  // Criar UserPackage
  const newPackage = await prisma.userPackage.create({
    data: {
      userId: booking.userId,
      type: totalHours <= 10 ? 'HOURS_4' : 'HOURS_8',
      totalHours,
      remainingHours: totalHours,
      expiresAt,
      paymentStatus: 'APPROVED',
      amountPaid: paymentInfo.transactionAmount,
    },
  });

  console.log(`📦 [WEBHOOK] UserPackage criado: ${newPackage.id} (${totalHours}h)`);
}
