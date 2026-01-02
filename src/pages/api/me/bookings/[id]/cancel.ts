// ===========================================================
// API: POST /api/me/bookings/[id]/cancel - Cancelar Reserva
// ===========================================================
// Usa autenticação JWT (cookie arthemi_session)
// Só permite cancelar com pelo menos 48h de antecedência
// Pode criar RefundRequest se requestRefund=true

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { 
  sendRefundRequestedEmailToAdmin, 
  sendRefundRequestedEmailToUser,
  sendCancellationEmail,
  RefundEmailData,
  CancellationEmailData,
} from '@/lib/email';
import type { PixKeyType } from '@prisma/client';

interface CancelRequestBody {
  requestRefund?: boolean;
  pixKeyType?: PixKeyType;
  pixKey?: string;
  reason?: string;
}

interface ApiResponse {
  ok: boolean;
  message?: string;
  error?: string;
  refundRequestId?: string;
}

// Constante: mínimo de horas para cancelamento
const MIN_HOURS_TO_CANCEL = 48;

// Validar formato de chave PIX
const PIX_KEY_VALIDATORS: Record<PixKeyType, (key: string) => boolean> = {
  CPF: (key) => /^\d{11}$/.test(key.replace(/\D/g, '')),
  CNPJ: (key) => /^\d{14}$/.test(key.replace(/\D/g, '')),
  EMAIL: (key) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key),
  PHONE: (key) => /^\d{10,11}$/.test(key.replace(/\D/g, '')),
  RANDOM: (key) => key.length >= 20 && key.length <= 50, // UUID-like
};

/**
 * Extrai IP do cliente
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Autenticação JWT
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  // ID da reserva
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'ID da reserva é obrigatório' });
  }

  // Body opcional para refund
  const body: CancelRequestBody = req.body || {};
  const { requestRefund, pixKeyType, pixKey, reason } = body;

  try {
    // Buscar reserva
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: {
          select: { name: true },
        },
        user: {
          select: { id: true, email: true, name: true },
        },
        refundRequest: true, // Verificar se já existe
      },
    });

    // Verificar se existe
    if (!booking) {
      return res.status(404).json({ ok: false, error: 'Reserva não encontrada' });
    }

    // Verificar se pertence ao usuário
    if (booking.userId !== auth.userId) {
      return res.status(403).json({ ok: false, error: 'Acesso não autorizado' });
    }

    // Verificar se já está cancelada (com idempotência)
    if (booking.status === 'CANCELLED') {
      // Se já tem refundRequest, retornar sucesso idempotente
      if (booking.refundRequest) {
        return res.status(200).json({
          ok: true,
          message: 'Reserva já foi cancelada. Pedido de estorno já existe.',
          refundRequestId: booking.refundRequest.id,
        });
      }
      // Cancelada sem refund - retornar sucesso simples
      return res.status(200).json({
        ok: true,
        message: 'Esta reserva já foi cancelada.',
      });
    }

    // Verificar antecedência mínima (48 horas)
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < MIN_HOURS_TO_CANCEL) {
      return res.status(400).json({
        ok: false,
        error: `Cancelamento permitido apenas com ${MIN_HOURS_TO_CANCEL} horas de antecedência. Faltam ${Math.floor(hoursUntilStart)} horas.`,
      });
    }

    // Verificar se já passou
    if (startTime < now) {
      return res.status(400).json({ ok: false, error: 'Não é possível cancelar reservas passadas' });
    }

    // Se já existe refundRequest mas booking não foi cancelado, continuar para cancelar
    // (sem criar novo refund - idempotência)

    // Validar dados de refund se solicitado
    if (requestRefund) {
      // Bloquear estorno se não houve pagamento
      if (booking.amountPaid <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'Estorno não disponível. Esta reserva não possui pagamento registrado.',
        });
      }

      if (!pixKeyType || !pixKey) {
        return res.status(400).json({
          ok: false,
          error: 'Tipo e chave PIX são obrigatórios para solicitar estorno',
        });
      }

      // Validar tipo de chave
      const validTypes: PixKeyType[] = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'];
      if (!validTypes.includes(pixKeyType)) {
        return res.status(400).json({
          ok: false,
          error: 'Tipo de chave PIX inválido',
        });
      }

      // Validar formato da chave
      const validator = PIX_KEY_VALIDATORS[pixKeyType];
      if (!validator(pixKey)) {
        return res.status(400).json({
          ok: false,
          error: `Formato de chave PIX inválido para tipo ${pixKeyType}`,
        });
      }
    }

    // Cancelar a reserva em transação
    let refundRequestId: string | undefined;

    // Se já existe refundRequest, usar o ID existente (idempotência)
    if (booking.refundRequest) {
      refundRequestId = booking.refundRequest.id;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Cancelar booking
      await tx.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      // 2. Criar RefundRequest se solicitado E não existe ainda
      if (requestRefund && pixKeyType && pixKey && !booking.refundRequest) {
        // Calcular valor do estorno
        // Prioridade: amountPaid > creditsUsed > 0
        let refundAmount = 0;
        if (booking.amountPaid > 0) {
          refundAmount = booking.amountPaid;
        } else if (booking.creditsUsed > 0) {
          refundAmount = booking.creditsUsed;
        }

        const refund = await tx.refundRequest.create({
          data: {
            bookingId: id,
            userId: auth.userId,
            amount: refundAmount,
            pixKeyType: pixKeyType,
            pixKey: pixKey.trim(),
            reason: reason?.trim() || null,
            status: 'REQUESTED',
          },
        });

        refundRequestId = refund.id;

        // Log audit para refund
        await logAudit({
          action: 'REFUND_REQUESTED',
          source: 'USER',
          actorId: auth.userId,
          actorIp: getClientIp(req),
          userAgent: req.headers['user-agent'] as string,
          targetType: 'RefundRequest',
          targetId: refund.id,
          metadata: {
            bookingId: id,
            amount: refundAmount,
            pixKeyType,
            reason: reason || null,
          },
        });

        // Enviar email para admin
        const emailData: RefundEmailData = {
          refundId: refund.id,
          bookingId: id,
          userName: booking.user.name,
          userEmail: booking.user.email,
          roomName: booking.room.name,
          bookingDate: startTime.toLocaleDateString('pt-BR'),
          bookingTime: startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          amount: refundAmount,
          pixKeyType,
          pixKey: pixKey.trim(),
          status: 'REQUESTED',
          reason: reason || undefined,
        };

        // Fire and forget - não bloquear resposta
        sendRefundRequestedEmailToAdmin(emailData).catch((err) => {
          console.error('❌ [CANCEL] Erro ao enviar email de estorno para admin:', err);
        });

        // Enviar confirmação para o cliente
        sendRefundRequestedEmailToUser(emailData).catch((err) => {
          console.error('❌ [CANCEL] Erro ao enviar email de estorno para cliente:', err);
        });
      }
    });

    // Se não solicitou estorno, enviar email de cancelamento simples
    if (!requestRefund) {
      const cancellationData: CancellationEmailData = {
        userName: booking.user.name,
        userEmail: booking.user.email,
        roomName: booking.room.name,
        date: startTime.toLocaleDateString('pt-BR'),
        startTime: startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(booking.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      
      sendCancellationEmail(cancellationData).catch((err) => {
        console.error('❌ [CANCEL] Erro ao enviar email de cancelamento:', err);
      });
    }

    // Registrar cancelamento no audit log
    await logAudit({
      action: 'BOOKING_CANCELLED',
      source: 'USER',
      actorId: auth.userId,
      actorIp: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      targetType: 'Booking',
      targetId: booking.id,
      metadata: {
        roomName: booking.room.name,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        hoursBeforeStart: Math.floor(hoursUntilStart),
        cancelledBy: 'USER',
        refundRequested: requestRefund || false,
        refundRequestId: refundRequestId || null,
      },
    });

    console.log(`✅ [CANCEL] Reserva ${id} cancelada pelo usuário ${auth.userId}${refundRequestId ? ` (estorno ${refundRequestId})` : ''}`);

    // Resposta
    const message = refundRequestId
      ? 'Reserva cancelada e pedido de estorno registrado. Você receberá um email com a atualização.'
      : 'Reserva cancelada com sucesso';

    return res.status(200).json({
      ok: true,
      message,
      refundRequestId,
    });

  } catch (error) {
    console.error('❌ [API /me/bookings/cancel] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
