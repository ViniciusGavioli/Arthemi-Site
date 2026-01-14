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
 * Registra o uso de um cupom de forma IDEMPOTENTE usando UPSERT
 * 
 * PROBLEMA RESOLVIDO:
 * Postgres aborta transações inteiras após P2002, causando 25P02 em queries subsequentes.
 * 
 * SOLUÇÃO:
 * Usar findUnique + upsert que é atômico e NUNCA causa P2002 dentro de transações.
 * Verificar estado do registro ANTES do upsert para detectar conflitos.
 * 
 * @returns { ok: boolean, mode?: string, code?: string, existingBookingId?: string }
 */
export interface RecordCouponUsageResult {
  ok: boolean;          // true se registro foi criado/claimed com sucesso
  reused?: boolean;     // true se reativou registro RESTORED
  idempotent?: boolean; // true se era chamada duplicada (mesmo booking/credit)
  mode?: 'CREATED' | 'CLAIMED_RESTORED' | 'CLAIMED_AFTER_RACE' | 'IDEMPOTENT';
  code?: string;        // Código de erro (ex: COUPON_ALREADY_USED)
  existingBookingId?: string | null; // BookingId do registro existente (para diagnóstico)
}

/**
 * Helper para detectar erro P2002 (unique constraint)
 */
function isPrismaP2002(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
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
  
  // ==================================================================
  // STEP 1: Tentar "claim" de registro RESTORED existente via updateMany
  // updateMany com WHERE condicional é atômico - não sobrescreve USED
  // ==================================================================
  const claimedRestored = await tx.couponUsage.updateMany({
    where: {
      userId,
      couponCode: normalizedCode,
      context,
      status: CouponUsageStatus.RESTORED, // SÓ claim se status é RESTORED
    },
    data: {
      status: CouponUsageStatus.USED,
      bookingId: context === 'BOOKING' ? bookingId : null,
      creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
      restoredAt: null,
    },
  });
  
  if (claimedRestored.count > 0) {
    return { ok: true, reused: true, idempotent: false, mode: 'CLAIMED_RESTORED' };
  }
  
  // ==================================================================
  // STEP 2: Tentar criar novo registro USED
  // Se der P2002 (unique), outra transação criou primeiro
  // ==================================================================
  try {
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
    return { ok: true, reused: false, idempotent: false, mode: 'CREATED' };
  } catch (error) {
    // ==================================================================
    // STEP 3: P2002 - Registro já existe, verificar estado
    // ==================================================================
    if (isPrismaP2002(error)) {
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
        // Impossível: P2002 mas não existe? Re-throw
        throw error;
      }
      
      // Verificar se é a MESMA operação (idempotência verdadeira)
      if (existing.status === CouponUsageStatus.USED) {
        const isSameOperation = 
          (context === 'BOOKING' && existing.bookingId === bookingId) ||
          (context === 'CREDIT_PURCHASE' && existing.creditId === creditId);
        
        if (isSameOperation) {
          // Chamada duplicada para o mesmo booking/credit → sucesso (idempotente)
          return { ok: true, reused: false, idempotent: true, mode: 'IDEMPOTENT' };
        }
        
        // Cupom já usado por OUTRA operação → NÃO sobrescrever, retornar erro
        return { 
          ok: false, 
          code: 'COUPON_ALREADY_USED', 
          existingBookingId: existing.bookingId ?? null 
        };
      }
      
      // Status é RESTORED - tentar claim novamente (race condition)
      if (existing.status === CouponUsageStatus.RESTORED) {
        const claimedAfterRace = await tx.couponUsage.updateMany({
          where: {
            userId,
            couponCode: normalizedCode,
            context,
            status: CouponUsageStatus.RESTORED, // Condição atômica
          },
          data: {
            status: CouponUsageStatus.USED,
            bookingId: context === 'BOOKING' ? bookingId : null,
            creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
            restoredAt: null,
          },
        });
        
        if (claimedAfterRace.count > 0) {
          return { ok: true, reused: true, idempotent: false, mode: 'CLAIMED_AFTER_RACE' };
        }
        
        // Se não conseguiu claim, alguém usou entre o findUnique e o updateMany
        // Re-buscar para verificar estado final
        const finalState = await tx.couponUsage.findUnique({
          where: {
            userId_couponCode_context: {
              userId,
              couponCode: normalizedCode,
              context,
            },
          },
        });
        
        if (finalState?.status === CouponUsageStatus.USED) {
          // Verificar se foi a mesma operação (idempotência)
          const isSame = 
            (context === 'BOOKING' && finalState.bookingId === bookingId) ||
            (context === 'CREDIT_PURCHASE' && finalState.creditId === creditId);
          
          if (isSame) {
            return { ok: true, reused: false, idempotent: true, mode: 'IDEMPOTENT' };
          }
          
          return { 
            ok: false, 
            code: 'COUPON_ALREADY_USED', 
            existingBookingId: finalState.bookingId ?? null 
          };
        }
        
        // Estado inconsistente
        return { ok: false, code: 'COUPON_INVALID_STATE' };
      }
      
      // Status desconhecido → erro conservador
      return { ok: false, code: 'COUPON_INVALID_STATE' };
    }
    
    // Não é P2002, re-throw erro original
    throw error;
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
  // Buscar o uso do cupom - usa AND para garantir que é o cupom certo
  // IMPORTANTE: Só restaura se o cupom está USED E apontando para ESTE booking/credit específico
  const usage = await tx.couponUsage.findFirst({
    where: {
      // Condição específica: o cupom deve estar apontando para este booking/credit
      ...(bookingId ? { bookingId } : {}),
      ...(creditId ? { creditId } : {}),
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
