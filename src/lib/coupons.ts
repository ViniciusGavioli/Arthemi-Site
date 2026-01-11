// ===========================================================
// lib/coupons.ts - Gerenciamento centralizado de cupons
// ===========================================================
// P1-5: Lógica de cupons em um único lugar (backend)
// Usado por: /api/credits/purchase.ts, /api/admin/credits/create.ts, /api/bookings/index.ts

import { PrismaClient, Prisma, CouponUsageContext, CouponUsageStatus } from '@prisma/client';

export interface CouponConfig {
  discountType: 'fixed' | 'percent';
  value: number; // Em centavos para 'fixed', em % para 'percent'
  description: string;
  singleUsePerUser?: boolean; // true = cupom só pode ser usado 1x por usuário (ex: PRIMEIRACOMPRA)
}

// Cupons válidos - ÚNICA FONTE DE VERDADE
export const VALID_COUPONS: Record<string, CouponConfig> = {
  'TESTE50': { discountType: 'fixed', value: 500, description: 'Desconto teste R$5,00', singleUsePerUser: false },
  'ARTHEMI10': { discountType: 'percent', value: 10, description: '10% de desconto', singleUsePerUser: false },
  'PRIMEIRACOMPRA': { discountType: 'percent', value: 15, description: '15% primeira compra', singleUsePerUser: true },
};

/**
 * Valida se um cupom existe
 */
export function isValidCoupon(code: string): boolean {
  if (!code) return false;
  return !!VALID_COUPONS[code.toUpperCase().trim()];
}

/**
 * Retorna as informações do cupom ou null
 */
export function getCouponInfo(code: string): CouponConfig | null {
  if (!code) return null;
  return VALID_COUPONS[code.toUpperCase().trim()] || null;
}

/**
 * Aplica desconto do cupom em um valor
 * @param amount Valor original em centavos
 * @param couponCode Código do cupom
 * @returns Valor com desconto aplicado (mínimo 100 centavos = R$1)
 */
export function applyDiscount(amount: number, couponCode: string): { 
  finalAmount: number; 
  discountAmount: number; 
  couponApplied: boolean;
} {
  const coupon = getCouponInfo(couponCode);
  
  if (!coupon) {
    return { finalAmount: amount, discountAmount: 0, couponApplied: false };
  }
  
  let discountAmount = 0;
  
  if (coupon.discountType === 'fixed') {
    discountAmount = coupon.value;
  } else if (coupon.discountType === 'percent') {
    discountAmount = Math.round(amount * (coupon.value / 100));
  }
  
  // Garantir valor mínimo de R$1,00
  const finalAmount = Math.max(100, amount - discountAmount);
  const actualDiscount = amount - finalAmount;
  
  return { 
    finalAmount, 
    discountAmount: actualDiscount, 
    couponApplied: true 
  };
}

// ===========================================================
// RASTREAMENTO DE USO DE CUPONS (Anti-Fraude)
// ===========================================================

/**
 * Verifica se um cupom pode ser usado por um usuário
 * @param prisma Instância do Prisma (pode ser tx para transações)
 * @param userId ID do usuário
 * @param couponCode Código do cupom
 * @param context Contexto de uso (BOOKING ou CREDIT_PURCHASE)
 * @returns { canUse: boolean, reason?: string }
 */
export async function checkCouponUsage(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  couponCode: string,
  context: CouponUsageContext
): Promise<{ canUse: boolean; reason?: string }> {
  const normalizedCode = couponCode.toUpperCase().trim();
  const coupon = getCouponInfo(normalizedCode);
  
  if (!coupon) {
    return { canUse: false, reason: 'Cupom inválido' };
  }
  
  // Se cupom não é single-use, sempre pode usar
  if (!coupon.singleUsePerUser) {
    return { canUse: true };
  }
  
  // Verificar se usuário já usou este cupom
  const existingUsage = await prisma.couponUsage.findFirst({
    where: {
      userId,
      couponCode: normalizedCode,
      status: CouponUsageStatus.USED, // Só bloqueia se status USED (não RESTORED)
    },
  });
  
  if (existingUsage) {
    return { 
      canUse: false, 
      reason: `Cupom ${normalizedCode} já foi utilizado. Este cupom só pode ser usado uma vez.` 
    };
  }
  
  return { canUse: true };
}

/**
 * Registra o uso de um cupom (DEVE ser chamado dentro de $transaction)
 * @param tx Transação Prisma
 * @param userId ID do usuário
 * @param couponCode Código do cupom
 * @param context Contexto de uso
 * @param bookingId ID do booking (se contexto = BOOKING)
 * @param creditId ID do crédito (se contexto = CREDIT_PURCHASE)
 */
export async function recordCouponUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  couponCode: string,
  context: CouponUsageContext,
  bookingId?: string,
  creditId?: string
): Promise<void> {
  const normalizedCode = couponCode.toUpperCase().trim();
  
  await tx.couponUsage.create({
    data: {
      userId,
      couponCode: normalizedCode,
      context,
      bookingId: context === 'BOOKING' ? bookingId : null,
      creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
      status: CouponUsageStatus.USED,
    },
  });
}

/**
 * Gera o snapshot do cupom para auditoria
 */
export function createCouponSnapshot(couponCode: string): object | null {
  const coupon = getCouponInfo(couponCode);
  if (!coupon) return null;
  
  return {
    code: couponCode.toUpperCase().trim(),
    discountType: coupon.discountType,
    value: coupon.value,
    description: coupon.description,
    singleUsePerUser: coupon.singleUsePerUser || false,
    appliedAt: new Date().toISOString(),
  };
}

/**
 * IMPORTANTE: Cupons NÃO são restaurados após cancelamento
 * Esta função existe apenas para cupons reutilizáveis em casos especiais
 * PRIMEIRACOMPRA NUNCA deve ser restaurado (burned on use)
 */
export async function restoreCouponUsage(
  tx: Prisma.TransactionClient,
  bookingId?: string,
  creditId?: string
): Promise<{ restored: boolean; couponCode?: string }> {
  // Buscar o uso do cupom
  const usage = await tx.couponUsage.findFirst({
    where: {
      OR: [
        { bookingId: bookingId || undefined },
        { creditId: creditId || undefined },
      ],
      status: CouponUsageStatus.USED,
    },
  });
  
  if (!usage) {
    return { restored: false };
  }
  
  // REGRA: PRIMEIRACOMPRA NUNCA é restaurado
  const coupon = getCouponInfo(usage.couponCode);
  if (coupon?.singleUsePerUser) {
    // Cupom burned - não restaurar
    return { restored: false, couponCode: usage.couponCode };
  }
  
  // Para cupons reutilizáveis, marcar como restaurado
  await tx.couponUsage.update({
    where: { id: usage.id },
    data: {
      status: CouponUsageStatus.RESTORED,
      restoredAt: new Date(),
    },
  });
  
  return { restored: true, couponCode: usage.couponCode };
}
