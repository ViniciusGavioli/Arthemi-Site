// ===========================================================
// lib/coupons.ts - Gerenciamento centralizado de cupons
// ===========================================================
// P1-5: Lógica de cupons em um único lugar (backend)
// Usado por: /api/credits/purchase.ts, /api/admin/credits/create.ts

export interface CouponConfig {
  discountType: 'fixed' | 'percent';
  value: number; // Em centavos para 'fixed', em % para 'percent'
  description: string;
}

// Cupons válidos - ÚNICA FONTE DE VERDADE
export const VALID_COUPONS: Record<string, CouponConfig> = {
  'TESTE50': { discountType: 'fixed', value: 500, description: 'Desconto teste R$5,00' },
  'ARTHEMI10': { discountType: 'percent', value: 10, description: '10% de desconto' },
  'PRIMEIRACOMPRA': { discountType: 'percent', value: 15, description: '15% primeira compra' },
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
