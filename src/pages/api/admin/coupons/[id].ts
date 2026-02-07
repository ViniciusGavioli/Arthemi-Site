// ===========================================================
// API: GET /api/admin/coupons/[id] - Obter cupom específico
// API: PUT /api/admin/coupons/[id] - Atualizar cupom
// API: DELETE /api/admin/coupons/[id] - Deletar cupom
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

interface CouponResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  details?: unknown;
}

// GET: Obter cupom específico
async function handleGet(req: NextApiRequest, res: NextApiResponse<CouponResponse>) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ID do cupom é obrigatório',
      });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado',
      });
    }

    // Buscar usos do cupom
    const usageCount = await prisma.couponUsage.count({
      where: { couponCode: coupon.code },
    });

    return res.status(200).json({
      success: true,
      data: {
        ...coupon,
        actualUses: usageCount,
      },
    });
  } catch (error) {
    console.error('[COUPONS API] Erro ao obter cupom:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter cupom',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

// PUT: Atualizar cupom
async function handlePut(req: NextApiRequest, res: NextApiResponse<CouponResponse>) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ID do cupom é obrigatório',
      });
    }

    // Verificar se cupom existe
    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado',
      });
    }

    const {
      code,
      discountType,
      value,
      description,
      singleUsePerUser,
      isDevCoupon,
      isActive,
      validFrom,
      validUntil,
      minAmountCents,
      maxUses,
    } = req.body;

    // Preparar dados para atualização (apenas campos fornecidos)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Validar e atualizar código (se fornecido)
    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Código do cupom não pode ser vazio',
        });
      }

      const normalizedCode = code.toUpperCase().trim();

      // Verificar se novo código já existe (e não é o mesmo cupom)
      if (normalizedCode !== existing.code) {
        const codeExists = await prisma.coupon.findUnique({
          where: { code: normalizedCode },
        });

        if (codeExists) {
          return res.status(409).json({
            success: false,
            error: `Cupom com código "${normalizedCode}" já existe`,
          });
        }
      }

      updateData.code = normalizedCode;
    }

    // Validar e atualizar tipo de desconto
    if (discountType !== undefined) {
      if (!['fixed', 'percent', 'priceOverride'].includes(discountType)) {
        return res.status(400).json({
          success: false,
          error: 'Tipo de desconto inválido. Use: fixed, percent ou priceOverride',
        });
      }
      updateData.discountType = discountType;
    }

    // Validar e atualizar valor
    if (value !== undefined) {
      if (typeof value !== 'number' || value < 0) {
        return res.status(400).json({
          success: false,
          error: 'Valor do desconto deve ser >= 0',
        });
      }

      // Validação específica para percentual
      if ((discountType || existing.discountType) === 'percent' && (value < 0 || value > 100)) {
        return res.status(400).json({
          success: false,
          error: 'Percentual deve estar entre 0 e 100',
        });
      }

      updateData.value = Math.round(value);
    }

    // Atualizar descrição
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Descrição não pode ser vazia',
        });
      }
      updateData.description = description.trim();
    }

    // Atualizar flags booleanas
    if (singleUsePerUser !== undefined) {
      updateData.singleUsePerUser = Boolean(singleUsePerUser);
    }
    if (isDevCoupon !== undefined) {
      updateData.isDevCoupon = Boolean(isDevCoupon);
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Validar e atualizar datas
    if (validFrom !== undefined) {
      if (validFrom === null) {
        updateData.validFrom = null;
      } else {
        const validFromDate = new Date(validFrom);
        if (isNaN(validFromDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Data de início inválida',
          });
        }
        updateData.validFrom = validFromDate;
      }
    }

    if (validUntil !== undefined) {
      if (validUntil === null) {
        updateData.validUntil = null;
      } else {
        const validUntilDate = new Date(validUntil);
        if (isNaN(validUntilDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Data de fim inválida',
          });
        }
        updateData.validUntil = validUntilDate;
      }
    }

    // Validar que validFrom < validUntil
    const finalValidFrom = (updateData.validFrom as Date | null) ?? existing.validFrom;
    const finalValidUntil = (updateData.validUntil as Date | null) ?? existing.validUntil;
    if (finalValidFrom && finalValidUntil && finalValidFrom >= finalValidUntil) {
      return res.status(400).json({
        success: false,
        error: 'Data de início deve ser anterior à data de fim',
      });
    }

    // Validar e atualizar minAmountCents
    if (minAmountCents !== undefined) {
      if (minAmountCents === null) {
        updateData.minAmountCents = null;
      } else {
        if (typeof minAmountCents !== 'number' || minAmountCents < 0) {
          return res.status(400).json({
            success: false,
            error: 'Valor mínimo deve ser >= 0',
          });
        }
        updateData.minAmountCents = Math.round(minAmountCents);
      }
    }

    // Validar e atualizar maxUses
    if (maxUses !== undefined) {
      if (maxUses === null) {
        updateData.maxUses = null;
      } else {
        if (typeof maxUses !== 'number' || maxUses < 1) {
          return res.status(400).json({
            success: false,
            error: 'Número máximo de usos deve ser >= 1',
          });
        }
        updateData.maxUses = Math.round(maxUses);
      }
    }

    // Atualizar cupom
    const updated = await prisma.coupon.update({
      where: { id },
      data: updateData,
    });

    // Log de auditoria
    await logAudit({
      action: 'COUPON_UPDATED',
      source: 'ADMIN',
      targetType: 'coupon',
      targetId: updated.id,
      actorEmail: 'admin@arthemi.com.br',
      metadata: {
        code: updated.code,
        changes: Object.keys(updateData),
      },
      req,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[COUPONS API] Erro ao atualizar cupom:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar cupom',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

// DELETE: Deletar cupom
async function handleDelete(req: NextApiRequest, res: NextApiResponse<CouponResponse>) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ID do cupom é obrigatório',
      });
    }

    // Verificar se cupom existe
    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado',
      });
    }

    // Verificar se cupom tem usos
    const usageCount = await prisma.couponUsage.count({
      where: { couponCode: existing.code },
    });

    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Não é possível deletar cupom com ${usageCount} uso(s) registrado(s). Desative o cupom ao invés de deletá-lo.`,
      });
    }

    // Deletar cupom
    await prisma.coupon.delete({
      where: { id },
    });

    // Log de auditoria
    await logAudit({
      action: 'COUPON_DELETED',
      source: 'ADMIN',
      targetType: 'coupon',
      targetId: id,
      actorEmail: 'admin@arthemi.com.br',
      metadata: {
        code: existing.code,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Cupom deletado com sucesso' },
    });
  } catch (error) {
    console.error('[COUPONS API] Erro ao deletar cupom:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao deletar cupom',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CouponResponse>
) {
  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'PUT') {
    return handlePut(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({
    success: false,
    error: 'Método não permitido',
  });
}
