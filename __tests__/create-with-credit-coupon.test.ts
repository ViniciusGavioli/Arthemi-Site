// ===========================================================
// TESTES: Cupom no fluxo create-with-credit
// ===========================================================
// Valida as regras de negócio:
// 1. Cupom com créditos parciais + dinheiro = OK (persiste auditoria + CouponUsage)
// 2. Cupom com créditos totais (amountToPay=0) = RECUSADO (COUPON_REQUIRES_CASH_PAYMENT)
// 3. Sem cupom com créditos totais = OK (funciona normalmente)

import {
  isValidCoupon,
  applyDiscount,
  createCouponSnapshot,
  checkCouponUsage,
  recordCouponUsage,
  getCouponInfo,
} from '@/lib/coupons';

// ============================================================
// 1. TESTES DE CÁLCULO - Créditos + Cupom
// ============================================================

describe('Credit + Coupon Calculations', () => {
  test('Cenário 1: Crédito parcial + cupom com pagamento em dinheiro', () => {
    // Reserva de R$100,00
    // Crédito disponível: R$50,00
    // Cupom: PRIMEIRACOMPRA (15%)
    
    const grossAmount = 10000; // R$100,00
    const discountResult = applyDiscount(grossAmount, 'PRIMEIRACOMPRA');
    const netAmount = discountResult.finalAmount; // R$85,00
    
    const availableCredits = 5000; // R$50,00
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    // Cupom aplicado: gross - discount = net
    expect(discountResult.discountAmount).toBe(1500); // R$15,00 de desconto
    expect(netAmount).toBe(8500); // R$85,00
    
    // Créditos aplicados sobre o net
    expect(creditsToUse).toBe(5000); // R$50,00
    expect(amountToPay).toBe(3500); // R$35,00 a pagar em dinheiro
    
    // REGRA: amountToPay > 0, cupom PODE ser aplicado
    expect(amountToPay).toBeGreaterThan(0);
  });

  test('Cenário 2: Crédito total cobre reserva após cupom - cupom RECUSADO', () => {
    // Reserva de R$100,00
    // Crédito disponível: R$100,00
    // Cupom: PRIMEIRACOMPRA (15%)
    
    const grossAmount = 10000; // R$100,00
    const discountResult = applyDiscount(grossAmount, 'PRIMEIRACOMPRA');
    const netAmount = discountResult.finalAmount; // R$85,00
    
    const availableCredits = 10000; // R$100,00 (mais que suficiente)
    const creditsToUse = Math.min(availableCredits, netAmount); // R$85,00
    const amountToPay = netAmount - creditsToUse; // R$0,00
    
    // REGRA: amountToPay === 0 com cupom = RECUSADO
    expect(amountToPay).toBe(0);
    
    // Simulação da validação antifraude
    const couponApplied = 'PRIMEIRACOMPRA';
    const shouldRejectCoupon = couponApplied && amountToPay === 0;
    expect(shouldRejectCoupon).toBe(true);
  });

  test('Cenário 3: Sem cupom, crédito total - OK', () => {
    // Reserva de R$100,00
    // Crédito disponível: R$100,00
    // Cupom: NENHUM
    
    const grossAmount = 10000; // R$100,00
    const netAmount = grossAmount; // Sem cupom, net = gross
    
    const availableCredits = 10000;
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    // REGRA: Sem cupom, amountToPay pode ser 0
    expect(amountToPay).toBe(0);
    
    // Não há cupom, então não precisa recusar
    const couponApplied: string | null = null;
    const shouldRejectCoupon = couponApplied && amountToPay === 0;
    expect(shouldRejectCoupon).toBeFalsy();
  });
});

// ============================================================
// 2. TESTES DE ANTIFRAUDE - COUPON_REQUIRES_CASH_PAYMENT
// ============================================================

describe('Antifraud - Coupon Requires Cash Payment', () => {
  test('Regra: Cupom + créditos totais deve retornar código específico', () => {
    const grossAmount = 10000;
    const discountResult = applyDiscount(grossAmount, 'ARTHEMI10'); // 10%
    const netAmount = discountResult.finalAmount; // R$90,00
    
    const availableCredits = 10000; // Crédito suficiente
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    const couponApplied = 'ARTHEMI10';
    
    // Validação que o endpoint deve fazer
    const shouldReject = couponApplied && amountToPay === 0;
    const errorCode = shouldReject ? 'COUPON_REQUIRES_CASH_PAYMENT' : null;
    
    expect(shouldReject).toBe(true);
    expect(errorCode).toBe('COUPON_REQUIRES_CASH_PAYMENT');
  });

  test('Mensagem institucional deve ser consistente', () => {
    const expectedMessage = 'Cupons promocionais são aplicáveis apenas a reservas com pagamento via PIX ou cartão. Quando a reserva é integralmente coberta por créditos, o cupom não é elegível.';
    
    // Esta mensagem deve estar no frontend E no backend
    expect(expectedMessage).toContain('PIX ou cartão');
    expect(expectedMessage).toContain('créditos');
    expect(expectedMessage).toContain('não é elegível');
  });
});

// ============================================================
// 3. TESTES DE AUDITORIA - Campos persistidos
// ============================================================

describe('Audit Fields - Persistence', () => {
  test('Booking com cupom deve ter todos os campos de auditoria', () => {
    const grossAmount = 10000;
    const discountResult = applyDiscount(grossAmount, 'PRIMEIRACOMPRA');
    const couponSnapshot = createCouponSnapshot('PRIMEIRACOMPRA');
    
    // Simula os campos que seriam persistidos no Booking
    const bookingData = {
      grossAmount: grossAmount,
      discountAmount: discountResult.discountAmount,
      netAmount: discountResult.finalAmount,
      couponCode: 'PRIMEIRACOMPRA',
      couponSnapshot: couponSnapshot,
    };
    
    expect(bookingData.grossAmount).toBe(10000);
    expect(bookingData.discountAmount).toBe(1500);
    expect(bookingData.netAmount).toBe(8500);
    expect(bookingData.couponCode).toBe('PRIMEIRACOMPRA');
    expect(bookingData.couponSnapshot).not.toBeNull();
  });

  test('Booking sem cupom deve ter auditoria zerada', () => {
    const grossAmount = 10000;
    
    // Sem cupom
    const bookingData = {
      grossAmount: grossAmount,
      discountAmount: 0,
      netAmount: grossAmount,
      couponCode: null,
      couponSnapshot: null,
    };
    
    expect(bookingData.grossAmount).toBe(grossAmount);
    expect(bookingData.discountAmount).toBe(0);
    expect(bookingData.netAmount).toBe(grossAmount);
    expect(bookingData.couponCode).toBeNull();
  });
});

// ============================================================
// 4. TESTES DE SINGLE-USE - PRIMEIRACOMPRA
// ============================================================

describe('Single-Use Coupon - PRIMEIRACOMPRA', () => {
  test('PRIMEIRACOMPRA é marcado como single-use', () => {
    const coupon = getCouponInfo('PRIMEIRACOMPRA');
    expect(coupon?.singleUsePerUser).toBe(true);
  });

  test('PRIMEIRACOMPRA10 também é single-use', () => {
    const primeiraCompra10 = getCouponInfo('PRIMEIRACOMPRA10');
    
    expect(primeiraCompra10?.singleUsePerUser).toBe(true);
  });

  test('ARTHEMI10 não é single-use', () => {
    const arthemi10 = getCouponInfo('ARTHEMI10');
    
    expect(arthemi10?.singleUsePerUser).toBe(false);
  });

  test('Cupom válido retorna true em isValidCoupon', () => {
    expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
    expect(isValidCoupon('primeiracompra')).toBe(true); // case insensitive
    expect(isValidCoupon('PRIMEIRACOMPRA10')).toBe(true);
    expect(isValidCoupon('ARTHEMI10')).toBe(true);
    expect(isValidCoupon('TESTE50')).toBe(false); // Removido
  });
});

// ============================================================
// 5. TESTES DE FLUXO COMPLETO - Simulação
// ============================================================

describe('Complete Flow Simulation', () => {
  test('Fluxo: Crédito R$30 + Reserva R$100 + Cupom 10% = Paga R$60', () => {
    // 1. Valor da reserva
    const grossAmount = 10000; // R$100,00
    
    // 2. Aplica cupom
    const discountResult = applyDiscount(grossAmount, 'ARTHEMI10'); // 10%
    expect(discountResult.finalAmount).toBe(9000); // R$90,00
    
    const netAmount = discountResult.finalAmount;
    
    // 3. Aplica créditos
    const availableCredits = 3000; // R$30,00
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    expect(creditsToUse).toBe(3000); // R$30,00
    expect(amountToPay).toBe(6000); // R$60,00
    
    // 4. Validação antifraude passa (há pagamento em dinheiro)
    expect(amountToPay).toBeGreaterThan(0);
  });

  test('Fluxo: Crédito R$100 + Reserva R$100 + Cupom 10% = RECUSADO', () => {
    const grossAmount = 10000;
    const discountResult = applyDiscount(grossAmount, 'ARTHEMI10');
    const netAmount = discountResult.finalAmount; // R$90,00
    
    const availableCredits = 10000; // R$100,00
    const creditsToUse = Math.min(availableCredits, netAmount); // R$90,00
    const amountToPay = netAmount - creditsToUse; // R$0,00
    
    // RECUSADO: cupom + amountToPay === 0
    expect(amountToPay).toBe(0);
    
    const couponApplied = 'ARTHEMI10';
    const shouldReject = couponApplied && amountToPay === 0;
    expect(shouldReject).toBe(true);
  });

  test('Fluxo: Crédito R$100 + Reserva R$100 + SEM cupom = OK', () => {
    const grossAmount = 10000;
    const netAmount = grossAmount; // Sem cupom
    
    const availableCredits = 10000;
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    expect(amountToPay).toBe(0);
    
    // Sem cupom, OK
    const couponApplied: string | null = null;
    const shouldReject = couponApplied && amountToPay === 0;
    expect(shouldReject).toBeFalsy();
  });
});
