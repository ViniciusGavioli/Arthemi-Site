import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logUserAction } from '@/lib/audit';
import { MIN_CANCELLATION_HOURS } from '@/lib/business-rules';
import { getPaymentByExternalReference, isPaymentStatusConfirmed, realToCents } from '@/lib/asaas';
import { sendBookingConfirmationNotification } from '@/lib/booking-notifications';
import { getAuthFromRequest } from '@/lib/auth';
import { getAdminAuth } from '@/lib/admin-auth';

/**
 * API /api/bookings/[id]
 * GET - Busca detalhes de uma reserva específica (autenticado)
 * PATCH - Atualiza status da reserva (cancelamento - autenticado)
 * 
 * P-004: Segurança/Ownership/PII
 * - Exige autenticação em ambas as rotas
 * - Verifica ownership: apenas owner ou admin podem acessar
 * - Remove PII (email/phone) se não for owner/admin
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da reserva é obrigatório' });
  }

  // P-004: Verificar autenticação (usuário ou admin)
  const userAuth = getAuthFromRequest(req);
  const isAdmin = getAdminAuth(req);

  if (!userAuth && !isAdmin) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  // ========================================================
  // GET - Buscar reserva
  // ========================================================
  if (req.method === 'GET') {
    // ======================================================
    // CACHE CONTROL: Dados transacionais NUNCA devem ser cacheados
    // O status da reserva muda via webhook (PENDING → CONFIRMED)
    // e o cliente precisa receber dados frescos em cada polling.
    // ======================================================
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          room: {
            select: {
              id: true,
              name: true,
              description: true,
              hourlyRate: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              type: true,
            },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      // P-004: Verificar ownership (apenas owner ou admin pode acessar)
      const isOwner = userAuth && booking.user.id === userAuth.userId;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Acesso não autorizado' });
      }

      // Incluir campos de cupom/desconto na resposta (HARDENING UX)
      const responseWithCoupon = {
        ...booking,
        // Campos de auditoria de desconto
        grossAmount: booking.grossAmount,
        discountAmount: booking.discountAmount,
        netAmount: booking.netAmount,
        couponCode: booking.couponCode,
      };

      // Verificar no asaas se o pagamento foi realizado e atualizar status da reserva se necessário
      try {
        const payment = await getPaymentByExternalReference(booking.id);

        if (!payment) {
          console.log(`⚠️ [BOOKING] Nenhum pagamento encontrado para a reserva ${booking.id}`);
        } else {
          const isConfirmed = isPaymentStatusConfirmed(payment.status);

          // P-013: Verificar se reserva está em estado final antes de atualizar
          // Estados finais: CANCELLED, CONFIRMED, COMPLETED, NO_SHOW
          const isFinalState = ['CANCELLED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(booking.status);

          if (booking.status === 'CANCELLED') {
            // NUNCA reviver uma reserva cancelada, mesmo que o pagamento seja confirmado
            console.log(`⚠️ [BOOKING] Reserva ${booking.id} está CANCELADA - NÃO reviver mesmo com pagamento confirmado`);
          } else if (isConfirmed && booking.status === 'PENDING') {
            // Atualizar apenas se PENDING e pagamento confirmado
            const updatedBooking = await prisma.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CONFIRMED',
                paymentStatus: 'APPROVED',
                paymentId: payment.id,
                amountPaid: realToCents(payment.value),
                financialStatus: 'PAID',
                origin: 'COMMERCIAL',
              },
              select: {
                id: true,
                emailSentAt: true,
              },
            });

            console.log(`✅ [BOOKING] Reserva ${booking.id} atualizada para CONFIRMED (financialStatus=PAID, amountPaid=${realToCents(payment.value)})`);

            // ENVIAR EMAIL DE CONFIRMAÇÃO - Verificar emailSentAt para evitar duplicidade
            if (!updatedBooking.emailSentAt) {
              try {
                const emailSuccess = await sendBookingConfirmationNotification(booking.id);
                if (emailSuccess) {
                  // Marcar email como enviado
                  await prisma.booking.update({
                    where: { id: booking.id },
                    data: { emailSentAt: new Date() },
                  });
                  console.log(`📧 [BOOKING] Email de confirmação enviado para ${booking.id}`);
                } else {
                  console.warn(`⚠️ [BOOKING] Falha ao enviar email para ${booking.id}`);
                }
              } catch (emailError) {
                console.error('⚠️ [BOOKING] Erro ao enviar email:', emailError);
                // Não falha a requisição por erro de email
              }
            } else {
              console.log(`⏭️ [BOOKING] Email já enviado anteriormente para ${booking.id}`);
            }

          } else if (!isConfirmed && booking.status === 'PENDING') {
            // Reserva ainda pendente, pagamento não confirmado
            console.log(`ℹ️ [BOOKING] Reserva ${booking.id} ainda PENDING, pagamento não confirmado`);
          } else if (isFinalState) {
            // P-012: NÃO rebaixar estados finais - apenas log
            console.log(`⚠️ [BOOKING] Reserva ${booking.id} em estado final ${booking.status}, não alterar`);
          }
        }
      } catch (error) {
        console.error(`❌ [BOOKING] Erro ao processar pagamento da reserva ${booking.id}:`, error);
      }
      // Retornar booking com campos de cupom/desconto
      return res.status(200).json(responseWithCoupon);
    } catch (error) {
      console.error('Get booking error:', error);
      return res.status(500).json({ error: 'Erro ao buscar reserva' });
    }
  }

  // ========================================================
  // PATCH - Cancelar reserva
  // P0-3 ATUALIZADO: Usuários podem cancelar reservas PENDING
  // Reservas CONFIRMED+ requerem admin
  // ========================================================
  if (req.method === 'PATCH') {

    try {
      const { action } = req.body;

      // Apenas ação de cancelamento permitida
      if (action !== 'cancel') {
        return res.status(400).json({
          error: 'Ação inválida. Use action: "cancel"'
        });
      }

      // Buscar reserva atual
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          startTime: true,
          userId: true, // P-004: Necessário para verificar ownership
        },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      // P-004: Verificar ownership (apenas owner ou admin pode cancelar)
      const isOwner = userAuth && booking.userId === userAuth.userId;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Acesso não autorizado' });
      }

      // P0-3: Usuários (não-admin) só podem cancelar reservas PENDING
      if (!isAdmin && booking.status !== 'PENDING') {
        return res.status(403).json({
          error: 'Para cancelar reservas confirmadas, entre em contato pelo WhatsApp: (31) 9992-3910',
          code: 'USER_CANCEL_CONFIRMED_ONLY_ADMIN'
        });
      }

      // ====================================================
      // REGRAS DE CANCELAMENTO
      // ====================================================

      // 1. Não pode cancelar se já está cancelada
      if (booking.status === 'CANCELLED') {
        return res.status(400).json({
          error: 'Esta reserva já foi cancelada',
          code: 'ALREADY_CANCELLED'
        });
      }

      // 2. Não pode cancelar se horário já iniciou
      const now = new Date();
      const startTime = new Date(booking.startTime);

      if (startTime <= now) {
        return res.status(400).json({
          error: 'Não é possível cancelar uma reserva que já iniciou ou passou',
          code: 'ALREADY_STARTED'
        });
      }

      // 3. OBRIGATÓRIO: mínimo de 48 horas de antecedência (APENAS PARA CONFIRMED/PAID)
      // Se for PENDING, permite cancelar a qualquer momento (liberar agenda)
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isPending = booking.status === 'PENDING';

      // Regra de 48h só se aplica se NÃO for PENDING (ou seja, CONFIRMED/PAID)
      // Se for PENDING, pode cancelar mesmo em cima da hora
      if (!isPending && hoursUntilStart < MIN_CANCELLATION_HOURS) {
        return res.status(400).json({
          error: `Cancelamentos confirmados só são permitidos com no mínimo ${MIN_CANCELLATION_HOURS} horas de antecedência.`,
          code: 'TOO_LATE',
          hoursRemaining: Math.floor(hoursUntilStart),
          minHoursRequired: MIN_CANCELLATION_HOURS
        });
      }

      // ====================================================
      // EXECUTAR CANCELAMENTO
      // ====================================================
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
        include: {
          room: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      });

      console.log(`🚫 [BOOKING] Cancelada pelo cliente: ${id}`);

      // ✅ LOG DE AUDITORIA - Reserva cancelada
      await logUserAction(
        'BOOKING_CANCELLED',
        updatedBooking.user.email || 'unknown',
        'Booking',
        id,
        {
          roomName: updatedBooking.room.name,
          cancelledBy: 'client',
          hoursBeforeStart: Math.floor(hoursUntilStart),
        },
        req
      );

      return res.status(200).json({
        success: true,
        message: 'Reserva cancelada com sucesso',
        booking: {
          id: updatedBooking.id,
          status: updatedBooking.status,
          roomName: updatedBooking.room.name,
        }
      });

    } catch (error) {
      console.error('Cancel booking error:', error);
      return res.status(500).json({ error: 'Erro ao cancelar reserva' });
    }
  }

  // Método não permitido
  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: `Método ${req.method} não permitido` });
}
