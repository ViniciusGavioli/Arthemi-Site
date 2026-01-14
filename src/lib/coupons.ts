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
 * @returns Valor com desconto aplicado
 * 
 * REGRA DE PISO (Asaas exige mínimo R$1,00 para PIX):
 * - Se amount >= 100: piso = 100 centavos
 * - Se amount < 100: sem piso (valor original já é menor que R$1)
 * 
 * INVARIANTES:
 * - finalAmount >= 0
 * - discountAmount >= 0
 * - finalAmount + discountAmount = amount (sempre)
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
  
  // Calcular desconto bruto
  let calculatedDiscount = 0;
  
  if (coupon.discountType === 'fixed') {
    calculatedDiscount = coupon.value;
  } else if (coupon.discountType === 'percent') {
    calculatedDiscount = Math.round(amount * (coupon.value / 100));
  }
  
  // Aplicar piso de R$1,00 APENAS se amount >= 100
  // Se amount < 100, usuário já está pagando menos que R$1, não faz sentido forçar piso
  const minAmount = amount >= 100 ? 100 : 0;
  
  // Calcular valor final respeitando piso
  const finalAmount = Math.max(minAmount, amount - calculatedDiscount);
  
  // Desconto efetivo = diferença entre original e final
  // INVARIANTE: amount = finalAmount + discountAmount
  const discountAmount = amount - finalAmount;
  
  return { 
    finalAmount, 
    discountAmount, 
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
 * Registra o uso de um cupom de forma IDEMPOTENTE (optimistic approach)
 * 
 * Estratégia:
 * 1. Tenta CREATE diretamente (caso comum: cupom novo)
 * 2. Se P2002 (unique violation): busca registro existente
 *    - Se USED + mesmo bookingId/creditId → sucesso (idempotência verdadeira)
 *    - Se USED + outro bookingId/creditId → 400 COUPON_ALREADY_USED
 *    - Se RESTORED → update para USED (reuso válido)
 * 
 * @returns { reused: boolean, idempotent: boolean }
 */
export interface RecordCouponUsageResult {
  reused: boolean;      // true se reativou registro RESTORED
  idempotent: boolean;  // true se era chamada duplicada (mesmo booking/credit)
}

export async function recordCouponUsageIdempotent(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    couponCode: string;
    context: CouponUsageContext;
    bookingId?: string;
    creditId?: string;
  }
): Promise<RecordCouponUsageResult> {
  const { userId, couponCode, context, bookingId, creditId } = params;
  const normalizedCode = couponCode.toUpperCase().trim();
  
  try {
    // Caso comum: cupom nunca usado neste contexto → CREATE
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
    return { reused: false, idempotent: false };
  } catch (error) {
    // P2002 = unique constraint violation (já existe registro)
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error; // Erro inesperado → propagar
    }
    
    // Buscar registro existente para decidir ação
    const existing = await tx.couponUsage.findUnique({
      where: {
        userId_couponCode_context: {
          userId,
          couponCode: normalizedCode,
          context,
        },
      },
    });
    
    if (!existing) {
      // P2002 mas não encontrou? Situação impossível → rethrow
      throw error;
    }
    
    if (existing.status === CouponUsageStatus.USED) {
      // Verificar se é a MESMA operação (idempotência verdadeira)
      const isSameOperation = 
        (context === 'BOOKING' && existing.bookingId === bookingId) ||
        (context === 'CREDIT_PURCHASE' && existing.creditId === creditId);
      
      if (isSameOperation) {
        // Chamada duplicada para o mesmo booking/credit → sucesso (idempotente)
        return { reused: false, idempotent: true };
      }
      
      // Cupom já usado por OUTRA operação → erro controlado 400
      throw new Error(`COUPON_ALREADY_USED:${normalizedCode}`);
    }
    
    if (existing.status === CouponUsageStatus.RESTORED) {
      // Cupom restaurado → reativar para USED
      await tx.couponUsage.update({
        where: { id: existing.id },
        data: {
          status: CouponUsageStatus.USED,
          bookingId: context === 'BOOKING' ? bookingId : null,
          creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
          restoredAt: null,
        },
      });
      return { reused: true, idempotent: false };
    }
    
    // Status desconhecido → tratar como USED (segurança)
    throw new Error(`COUPON_ALREADY_USED:${normalizedCode}`);
  }
}

/**
 * @deprecated Use recordCouponUsageIdempotent para garantir idempotência
 */
export async function recordCouponUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  couponCode: string,
  context: CouponUsageContext,
  bookingId?: string,
  creditId?: string
): Promise<void> {
  await recordCouponUsageIdempotent(tx, { userId, couponCode, context, bookingId, creditId });
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
