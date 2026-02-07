// ===========================================================
// API: GET /api/admin/coupons - Lista cupons
// API: POST /api/admin/coupons - Cria cupom
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

// GET: Listar cupons
async function handleGet(req: NextApiRequest, res: NextApiResponse<CouponResponse>) {
  try {
    const { search, isActive, isDevCoupon, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const where: Record<string, unknown> = {};

    // Busca por código
    if (search && typeof search === 'string') {
      where.code = { contains: search, mode: 'insensitive' };
    }

    // Filtro por status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Filtro por tipo (dev ou produção)
    if (isDevCoupon !== undefined) {
      where.isDevCoupon = isDevCoupon === 'true';
    }

    // Buscar cupons
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.coupon.count({ where }),
    ]);

    // Buscar usos de cada cupom
    const couponsWithUsage = await Promise.all(
      coupons.map(async (coupon) => {
        const usageCount = await prisma.couponUsage.count({
          where: { couponCode: coupon.code },
        });

        return {
          ...coupon,
          actualUses: usageCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        coupons: couponsWithUsage,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('[COUPONS API] Erro ao listar cupons:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar cupons',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

// POST: Criar cupom
async function handlePost(req: NextApiRequest, res: NextApiResponse<CouponResponse>) {
  try {
    const {
      code,
      discountType,
      value,
      description,
      singleUsePerUser = false,
      isDevCoupon = false,
      isActive = true,
      validFrom,
      validUntil,
      minAmountCents,
      maxUses,
    } = req.body;

    // Validações obrigatórias
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Código do cupom é obrigatório',
      });
    }

    if (!discountType || !['fixed', 'percent', 'priceOverride'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de desconto inválido. Use: fixed, percent ou priceOverride',
      });
    }

    if (value === undefined || value === null || typeof value !== 'number' || value < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor do desconto é obrigatório e deve ser >= 0',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Descrição é obrigatória',
      });
    }

    // Validações específicas por tipo
    if (discountType === 'percent' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Percentual deve estar entre 0 e 100',
      });
    }

    // Validar datas
    let validFromDate: Date | null = null;
    let validUntilDate: Date | null = null;

    if (validFrom) {
      validFromDate = new Date(validFrom);
      if (isNaN(validFromDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Data de início inválida',
        });
      }
    }

    if (validUntil) {
      validUntilDate = new Date(validUntil);
      if (isNaN(validUntilDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Data de fim inválida',
        });
      }
    }

    // Validar que validFrom < validUntil
    if (validFromDate && validUntilDate && validFromDate >= validUntilDate) {
      return res.status(400).json({
        success: false,
        error: 'Data de início deve ser anterior à data de fim',
      });
    }

    // Validar minAmountCents
    if (minAmountCents !== undefined && minAmountCents !== null) {
      if (typeof minAmountCents !== 'number' || minAmountCents < 0) {
        return res.status(400).json({
          success: false,
          error: 'Valor mínimo deve ser >= 0',
        });
      }
    }

    // Validar maxUses
    if (maxUses !== undefined && maxUses !== null) {
      if (typeof maxUses !== 'number' || maxUses < 1) {
        return res.status(400).json({
          success: false,
          error: 'Número máximo de usos deve ser >= 1',
        });
      }
    }

    // Normalizar código (uppercase, sem espaços)
    const normalizedCode = code.toUpperCase().trim();

    // Verificar se código já existe
    const existing = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Cupom com código "${normalizedCode}" já existe`,
      });
    }

    // Criar cupom
    const coupon = await prisma.coupon.create({
      data: {
        code: normalizedCode,
        discountType,
        value: Math.round(value), // Garantir inteiro
        description: description.trim(),
        singleUsePerUser: Boolean(singleUsePerUser),
        isDevCoupon: Boolean(isDevCoupon),
        isActive: Boolean(isActive),
        validFrom: validFromDate,
        validUntil: validUntilDate,
        minAmountCents: minAmountCents !== undefined && minAmountCents !== null ? Math.round(minAmountCents) : null,
        maxUses: maxUses !== undefined && maxUses !== null ? Math.round(maxUses) : null,
        currentUses: 0,
        updatedAt: new Date(),
      },
    });

    // Log de auditoria
    await logAudit({
      action: 'COUPON_CREATED',
      source: 'ADMIN',
      targetType: 'coupon',
      targetId: coupon.id,
      actorEmail: 'admin@arthemi.com.br',
      metadata: {
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error('[COUPONS API] Erro ao criar cupom:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar cupom',
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

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({
    success: false,
    error: 'Método não permitido',
  });
}
