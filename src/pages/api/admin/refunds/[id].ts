// ===========================================================
// API: PATCH /api/admin/refunds/[id] - Atualizar status de estorno
// ===========================================================
// Requer autenticação JWT com role ADMIN
// Actions: REVIEW, APPROVE, REJECT, MARK_PAID

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logAudit, AuditAction } from '@/lib/audit';
import { sendRefundStatusEmailToUser, RefundEmailData } from '@/lib/email';
import type { RefundStatus } from '@prisma/client';

interface PatchRequestBody {
  action: 'REVIEW' | 'APPROVE' | 'REJECT' | 'MARK_PAID';
  notes?: string;
  rejectionReason?: string;
  proofUrl?: string;
}

interface ApiResponse {
  ok: boolean;
  message?: string;
  error?: string;
  status?: RefundStatus;
}

// Mapear action para status e audit action
const ACTION_CONFIG: Record<string, { status: RefundStatus; auditAction: AuditAction }> = {
  REVIEW: { status: 'REVIEWING', auditAction: 'REFUND_REVIEWING' },
  APPROVE: { status: 'APPROVED', auditAction: 'REFUND_APPROVED' },
  REJECT: { status: 'REJECTED', auditAction: 'REFUND_REJECTED' },
  MARK_PAID: { status: 'PAID', auditAction: 'REFUND_PAID' },
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
  // Apenas PATCH
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Autenticação JWT + role ADMIN
  const auth = requireRole(req, res, 'ADMIN');
  if (!auth) return; // 401/403 já enviado

  // ID do refund
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'ID do estorno é obrigatório' });
  }

  // Body com action
  const body: PatchRequestBody = req.body || {};
  const { action, notes, rejectionReason, proofUrl } = body;

  // Validar action
  if (!action || !ACTION_CONFIG[action]) {
    return res.status(400).json({
      ok: false,
      error: 'Ação inválida. Use: REVIEW, APPROVE, REJECT ou MARK_PAID',
    });
  }

  // Validar rejectionReason para REJECT
  if (action === 'REJECT' && !rejectionReason?.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'Motivo da rejeição é obrigatório',
    });
  }

  try {
    // Buscar refund
    const refund = await prisma.refundRequest.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            room: {
              select: { name: true },
            },
          },
        },
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!refund) {
      return res.status(404).json({ ok: false, error: 'Pedido de estorno não encontrado' });
    }

    // Validar transições de status
    const currentStatus = refund.status;
    const newStatus = ACTION_CONFIG[action].status;

    // Regras de transição (state machine)
    // APPROVED é ponto de não retorno - só pode ir para PAID
    const validTransitions: Record<RefundStatus, RefundStatus[]> = {
      REQUESTED: ['REVIEWING', 'APPROVED', 'REJECTED'],
      REVIEWING: ['APPROVED', 'REJECTED'],
      APPROVED: ['PAID'], // Aprovado = compromisso, só pode pagar
      PAID: [], // Estado final
      REJECTED: [], // Estado final
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return res.status(400).json({
        ok: false,
        error: `Transição inválida: ${currentStatus} → ${newStatus}`,
      });
    }

    // Atualizar refund
    const updateData: {
      status: RefundStatus;
      reviewedBy: string;
      reviewedAt: Date;
      reviewNotes?: string;
      rejectionReason?: string;
      proofUrl?: string;
      paidAt?: Date;
    } = {
      status: newStatus,
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
    };

    if (notes?.trim()) {
      updateData.reviewNotes = notes.trim();
    }

    if (action === 'REJECT' && rejectionReason) {
      updateData.rejectionReason = rejectionReason.trim();
    }

    if (action === 'MARK_PAID') {
      updateData.paidAt = new Date();
      if (proofUrl?.trim()) {
        updateData.proofUrl = proofUrl.trim();
      }
    }

    const updatedRefund = await prisma.refundRequest.update({
      where: { id },
      data: updateData,
    });

    // Log audit
    await logAudit({
      action: ACTION_CONFIG[action].auditAction,
      source: 'ADMIN',
      actorId: auth.userId,
      actorIp: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      targetType: 'RefundRequest',
      targetId: id,
      metadata: {
        previousStatus: currentStatus,
        newStatus,
        notes: notes || null,
        rejectionReason: rejectionReason || null,
        proofUrl: proofUrl || null,
        userId: refund.userId,
        amount: refund.amount,
      },
    });

    // Enviar email para usuário (REVIEWING, APPROVED, REJECTED, PAID)
    if (['REVIEW', 'APPROVE', 'REJECT', 'MARK_PAID'].includes(action)) {
      const emailData: RefundEmailData = {
        refundId: refund.id,
        bookingId: refund.bookingId,
        userName: refund.user.name,
        userEmail: refund.user.email,
        roomName: refund.booking.room.name,
        bookingDate: refund.booking.startTime.toLocaleDateString('pt-BR'),
        bookingTime: refund.booking.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        amount: refund.amount,
        pixKeyType: refund.pixKeyType,
        pixKey: refund.pixKey,
        status: newStatus,
        rejectionReason: action === 'REJECT' ? rejectionReason : undefined,
        proofUrl: action === 'MARK_PAID' ? proofUrl : undefined,
      };

      // Fire and forget
      sendRefundStatusEmailToUser(emailData).catch((err) => {
        console.error('❌ [ADMIN/REFUNDS] Erro ao enviar email:', err);
      });
    }

    console.log(`✅ [ADMIN/REFUNDS] Estorno ${id} atualizado: ${currentStatus} → ${newStatus} por ${auth.userId}`);

    const statusMessages: Record<string, string> = {
      REVIEW: 'Estorno marcado como em análise',
      APPROVE: 'Estorno aprovado com sucesso',
      REJECT: 'Estorno rejeitado',
      MARK_PAID: 'Estorno marcado como pago',
    };

    return res.status(200).json({
      ok: true,
      message: statusMessages[action],
      status: updatedRefund.status,
    });

  } catch (error) {
    console.error('❌ [API /admin/refunds/[id]] Erro:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
}
