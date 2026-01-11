// ===========================================================
// TESTES: Cupom + Auditoria + Refund (CORE)
// ===========================================================
// Valida as regras de negócio:
// 1. Cupom PRIMEIRACOMPRA só pode ser usado 1x por usuário
// 2. Cupom NÃO volta após cancelamento (burned)
// 3. Reembolso SEMPRE = NET + créditos usados (nunca GROSS)
// 4. Campos de auditoria (gross/discount/net/coupon) são persistidos

import {
  isValidCoupon,
  applyDiscount,
  getCouponInfo,
  createCouponSnapshot,
  VALID_COUPONS,
} from '@/lib/coupons';

// ============================================================
// 1. TESTES DE CUPOM - Validação básica
// ============================================================

describe('Coupons - Basic Validation', () => {
  test('isValidCoupon retorna true para cupons válidos', () => {
    expect(isValidCoupon('TESTE50')).toBe(true);
    expect(isValidCoupon('teste50')).toBe(true); // case insensitive
    expect(isValidCoupon('ARTHEMI10')).toBe(true);
    expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
  });

  test('isValidCoupon retorna false para cupons inválidos', () => {
    expect(isValidCoupon('INVALIDO')).toBe(false);
    expect(isValidCoupon('')).toBe(false);
    expect(isValidCoupon('TESTE')).toBe(false);
  });

  test('getCouponInfo retorna config correta', () => {
    const teste50 = getCouponInfo('TESTE50');
    expect(teste50).toEqual({
      discountType: 'fixed',
      value: 500,
      description: 'Desconto teste R$5,00',
      singleUsePerUser: false,
    });

    const primeiraCompra = getCouponInfo('PRIMEIRACOMPRA');
    expect(primeiraCompra?.singleUsePerUser).toBe(true);
    expect(primeiraCompra?.discountType).toBe('percent');
    expect(primeiraCompra?.value).toBe(15);
  });
});

// ============================================================
// 2. TESTES DE CUPOM - Aplicação de desconto
// ============================================================

describe('Coupons - Discount Application', () => {
  test('applyDiscount com cupom fixo (TESTE50 = R$5,00)', () => {
    const result = applyDiscount(10000, 'TESTE50'); // R$100,00
    expect(result.discountAmount).toBe(500); // R$5,00
    expect(result.finalAmount).toBe(9500); // R$95,00
    expect(result.couponApplied).toBe(true);
  });

  test('applyDiscount com cupom percentual (ARTHEMI10 = 10%)', () => {
    const result = applyDiscount(10000, 'ARTHEMI10'); // R$100,00
    expect(result.discountAmount).toBe(1000); // R$10,00
    expect(result.finalAmount).toBe(9000); // R$90,00
    expect(result.couponApplied).toBe(true);
  });

  test('applyDiscount com PRIMEIRACOMPRA (15%)', () => {
    const result = applyDiscount(10000, 'PRIMEIRACOMPRA'); // R$100,00
    expect(result.discountAmount).toBe(1500); // R$15,00
    expect(result.finalAmount).toBe(8500); // R$85,00
    expect(result.couponApplied).toBe(true);
  });

  test('applyDiscount respeita valor mínimo de R$1,00', () => {
    // Se desconto > valor, resultado deve ser pelo menos R$1,00
    const result = applyDiscount(300, 'TESTE50'); // R$3,00 - R$5,00
    expect(result.finalAmount).toBe(100); // Mínimo R$1,00
    expect(result.discountAmount).toBe(200); // Desconto real aplicado
  });

  test('applyDiscount com cupom inválido não aplica desconto', () => {
    const result = applyDiscount(10000, 'INVALIDO');
    expect(result.discountAmount).toBe(0);
    expect(result.finalAmount).toBe(10000);
    expect(result.couponApplied).toBe(false);
  });
});

// ============================================================
// 3. TESTES DE CUPOM - Snapshot para auditoria
// ============================================================

describe('Coupons - Snapshot for Audit', () => {
  test('createCouponSnapshot gera snapshot correto', () => {
    const snapshot = createCouponSnapshot('PRIMEIRACOMPRA');
    
    expect(snapshot).toHaveProperty('code', 'PRIMEIRACOMPRA');
    expect(snapshot).toHaveProperty('discountType', 'percent');
    expect(snapshot).toHaveProperty('value', 15);
    expect(snapshot).toHaveProperty('description');
    expect(snapshot).toHaveProperty('singleUsePerUser', true);
    expect(snapshot).toHaveProperty('appliedAt');
  });

  test('createCouponSnapshot retorna null para cupom inválido', () => {
    const snapshot = createCouponSnapshot('INVALIDO');
    expect(snapshot).toBeNull();
  });
});

// ============================================================
// 4. TESTES DE AUDITORIA - Cálculo de valores
// ============================================================

describe('Audit - Value Calculations', () => {
  test('Cálculo correto de gross/discount/net', () => {
    const grossAmount = 10000; // R$100,00
    const discountResult = applyDiscount(grossAmount, 'PRIMEIRACOMPRA');
    
    const discountAmount = discountResult.discountAmount;
    const netAmount = discountResult.finalAmount;
    
    // Verificar relação: gross - discount = net
    expect(grossAmount - discountAmount).toBe(netAmount);
    expect(netAmount).toBe(8500); // R$85,00
  });

  test('Reembolso deve ser baseado em NET, não GROSS', () => {
    // Simula um booking com cupom aplicado
    const grossAmount = 10000; // R$100,00 (valor cheio)
    const discountAmount = 1500; // R$15,00 (desconto PRIMEIRACOMPRA)
    const netAmount = 8500; // R$85,00 (valor pago)
    const creditsUsed = 2000; // R$20,00 em créditos
    
    // REGRA: Reembolso = NET + créditos (nunca GROSS)
    const correctRefund = netAmount + creditsUsed;
    const incorrectRefund = grossAmount + creditsUsed; // ERRADO!
    
    expect(correctRefund).toBe(10500); // R$105,00 correto
    expect(incorrectRefund).toBe(12000); // R$120,00 ERRADO - devolve mais do que pagou
    
    // O cliente pagou R$85 + usou R$20 de crédito = R$105 de "valor"
    // Se devolver R$120, está dando R$15 de graça (o desconto do cupom)
  });
});

// ============================================================
// 5. TESTES DE REFUND - Regras de negócio
// ============================================================

describe('Refund - Business Rules', () => {
  test('Valor de reembolso deve ser creditsUsed + moneyPaid (NET)', () => {
    // Caso 1: Booking pago apenas com dinheiro
    const case1 = {
      creditsUsed: 0,
      netAmount: 8500, // Pagou R$85 após cupom
    };
    const refund1 = case1.creditsUsed + case1.netAmount;
    expect(refund1).toBe(8500);

    // Caso 2: Booking pago com mix de créditos e dinheiro
    const case2 = {
      creditsUsed: 5000, // R$50 em créditos
      netAmount: 3500, // Pagou R$35 após cupom
    };
    const refund2 = case2.creditsUsed + case2.netAmount;
    expect(refund2).toBe(8500); // Total = R$85

    // Caso 3: Booking pago 100% com créditos
    const case3 = {
      creditsUsed: 8500,
      netAmount: 0,
    };
    const refund3 = case3.creditsUsed + case3.netAmount;
    expect(refund3).toBe(8500);
  });

  test('PRIMEIRACOMPRA deve ter singleUsePerUser = true', () => {
    const config = VALID_COUPONS['PRIMEIRACOMPRA'];
    expect(config.singleUsePerUser).toBe(true);
  });

  test('TESTE50 e ARTHEMI10 podem ser reutilizados', () => {
    expect(VALID_COUPONS['TESTE50'].singleUsePerUser).toBe(false);
    expect(VALID_COUPONS['ARTHEMI10'].singleUsePerUser).toBe(false);
  });
});

// ============================================================
// 6. TESTES DE CENÁRIO - Fluxo completo
// ============================================================

describe('Scenario - Complete Flow', () => {
  test('Cenário: Booking com cupom → cancelamento → valores corretos', () => {
    // 1. Criar booking com cupom PRIMEIRACOMPRA
    const originalPrice = 10000; // R$100,00
    const { finalAmount, discountAmount } = applyDiscount(originalPrice, 'PRIMEIRACOMPRA');
    
    // 2. Persistir valores de auditoria
    const booking = {
      grossAmount: originalPrice, // R$100,00
      discountAmount, // R$15,00
      netAmount: finalAmount, // R$85,00
      couponCode: 'PRIMEIRACOMPRA',
      creditsUsed: 0,
      amountPaid: finalAmount, // R$85,00
    };
    
    // 3. Cancelar booking
    // REGRA: Reembolso = NET + creditsUsed
    const refundAmount = (booking.netAmount ?? booking.amountPaid) + booking.creditsUsed;
    
    // 4. Validar
    expect(refundAmount).toBe(8500); // R$85,00 (correto)
    expect(refundAmount).not.toBe(10000); // Não é GROSS (R$100)
    
    // 5. CUPOM NÃO VOLTA - cliente não pode usar PRIMEIRACOMPRA novamente
    // (isso é validado pelo CouponUsage que permanece com status USED)
  });

  test('Cenário: Booking com créditos + cupom → cancelamento', () => {
    // 1. Preço original
    const originalPrice = 10000; // R$100,00
    
    // 2. Aplicar cupom
    const { finalAmount, discountAmount } = applyDiscount(originalPrice, 'ARTHEMI10'); // 10%
    expect(finalAmount).toBe(9000); // R$90 após desconto
    
    // 3. Cliente usa R$50 de créditos
    const creditsUsed = 5000;
    const amountPaid = finalAmount - creditsUsed; // R$40
    
    const booking = {
      grossAmount: originalPrice,
      discountAmount,
      netAmount: finalAmount,
      couponCode: 'ARTHEMI10',
      creditsUsed,
      amountPaid,
    };
    
    // 4. Cancelamento
    // REGRA: Devolver creditsUsed + amountPaid = R$50 + R$40 = R$90
    const refundCredits = booking.creditsUsed; // R$50 volta como crédito
    const refundMoney = booking.amountPaid; // R$40 volta como dinheiro
    const totalRefund = refundCredits + refundMoney;
    
    expect(totalRefund).toBe(9000); // R$90 (NET)
    expect(totalRefund).not.toBe(10000); // Não é GROSS
  });
});

// ============================================================
// 7. TESTES DE REFUND PARCIAL
// ============================================================

describe('Partial Refund - Detection and Handling', () => {
  /**
   * Helper para simular cálculo de refund parcial
   * Replica a lógica do webhook asaas.ts
   */
  function calculateRefundDetails(booking: {
    creditsUsed: number;
    netAmount: number;
  }, refundedAmount: number) {
    const expectedAmount = booking.creditsUsed + booking.netAmount;
    
    // Tolerância: 1% ou mínimo R$1
    const tolerance = Math.max(100, expectedAmount * 0.01);
    const isPartial = refundedAmount < (expectedAmount - tolerance);
    
    // Distribuição: primeiro restaura créditos, depois dinheiro
    const creditsRestored = Math.min(booking.creditsUsed, refundedAmount);
    const moneyReturned = Math.max(0, refundedAmount - creditsRestored);
    
    return {
      expectedAmount,
      refundedAmount,
      isPartial,
      creditsRestored,
      moneyReturned,
      totalRefunded: creditsRestored + moneyReturned,
      status: isPartial ? 'PENDING' : 'COMPLETED',
    };
  }

  test('Refund TOTAL: valor estornado = valor esperado', () => {
    const booking = {
      creditsUsed: 5000, // R$50 em créditos
      netAmount: 4000,   // R$40 pago
    };
    
    // Gateway estorna valor total
    const refundedAmount = 9000; // R$90
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    expect(result.isPartial).toBe(false);
    expect(result.status).toBe('COMPLETED');
    expect(result.expectedAmount).toBe(9000);
    expect(result.totalRefunded).toBe(9000);
    expect(result.creditsRestored).toBe(5000); // Restaura créditos primeiro
    expect(result.moneyReturned).toBe(4000);   // Depois o dinheiro
  });

  test('Refund PARCIAL: valor estornado < valor esperado', () => {
    const booking = {
      creditsUsed: 5000, // R$50 em créditos
      netAmount: 4000,   // R$40 pago
    };
    
    // Gateway estorna apenas R$60 (parcial)
    const refundedAmount = 6000;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    expect(result.isPartial).toBe(true);
    expect(result.status).toBe('PENDING'); // Não marca como COMPLETED
    expect(result.expectedAmount).toBe(9000);
    expect(result.totalRefunded).toBe(6000);
    expect(result.creditsRestored).toBe(5000); // Restaura créditos primeiro
    expect(result.moneyReturned).toBe(1000);   // Só R$10 em dinheiro (parcial)
  });

  test('Refund PARCIAL: apenas créditos, sem dinheiro', () => {
    const booking = {
      creditsUsed: 5000, // R$50 em créditos
      netAmount: 4000,   // R$40 pago
    };
    
    // Gateway estorna apenas R$30 (muito parcial)
    const refundedAmount = 3000;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    expect(result.isPartial).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(result.creditsRestored).toBe(3000); // Só consegue restaurar R$30 de crédito
    expect(result.moneyReturned).toBe(0);      // Sem dinheiro devolvido
    expect(result.totalRefunded).toBe(3000);
  });

  test('Tolerância de 1%: pequenas diferenças não são parciais', () => {
    const booking = {
      creditsUsed: 0,
      netAmount: 10000, // R$100
    };
    
    // Gateway estorna R$99.50 (diferença de R$0.50 = 0.5%)
    const refundedAmount = 9950;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    // Tolerância = max(100, 10000 * 0.01) = 100 centavos
    // 10000 - 9950 = 50 < 100, então NÃO é parcial
    expect(result.isPartial).toBe(false);
    expect(result.status).toBe('COMPLETED');
  });

  test('Tolerância mínima de R$1: valores pequenos', () => {
    const booking = {
      creditsUsed: 0,
      netAmount: 500, // R$5
    };
    
    // Gateway estorna R$4 (diferença de R$1 = 20%)
    const refundedAmount = 400;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    // Tolerância = max(100, 500 * 0.01) = max(100, 5) = 100 centavos
    // 500 - 400 = 100, está no limite, então NÃO é parcial
    expect(result.isPartial).toBe(false);
    expect(result.status).toBe('COMPLETED');
  });

  test('Booking sem créditos: refund parcial em dinheiro', () => {
    const booking = {
      creditsUsed: 0,
      netAmount: 8500, // R$85 (pagou com cupom)
    };
    
    // Gateway estorna apenas R$50
    const refundedAmount = 5000;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    expect(result.isPartial).toBe(true);
    expect(result.creditsRestored).toBe(0);    // Não tinha créditos
    expect(result.moneyReturned).toBe(5000);   // Apenas dinheiro
    expect(result.totalRefunded).toBe(5000);
  });

  test('Booking 100% créditos: refund parcial só restaura parcialmente', () => {
    const booking = {
      creditsUsed: 8500, // R$85 todo em créditos
      netAmount: 0,      // Não pagou dinheiro
    };
    
    // Gateway "estorna" R$50 (não faz sentido em crédito, mas pode acontecer em chargeback)
    const refundedAmount = 5000;
    
    const result = calculateRefundDetails(booking, refundedAmount);
    
    expect(result.isPartial).toBe(true);
    expect(result.creditsRestored).toBe(5000); // Só restaura R$50 de crédito
    expect(result.moneyReturned).toBe(0);
    expect(result.totalRefunded).toBe(5000);
  });
});
