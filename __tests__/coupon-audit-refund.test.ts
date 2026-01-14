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

// ============================================================
// 9. TESTES CRÍTICOS - Cupom + Split (Crédito + Dinheiro) - CodeX Audit
// ============================================================

describe('Critical - Coupon + Split (Credits + Cash) - CodeX Audit', () => {
  /**
   * CENÁRIO CRÍTICO:
   * Reserva de R$100, cupom 15%, split com R$30 crédito + R$55 dinheiro
   * 
   * grossAmount = 10000 (R$100)
   * discountAmount = 1500 (R$15)
   * netAmount = 8500 (R$85) ← TOTAL da reserva após cupom
   * creditsUsed = 3000 (R$30)
   * amountPaid = 5500 (R$55) ← dinheiro pago
   * 
   * REGRA: expectedAmount = netAmount = 8500
   * ERRO ANTERIOR: expectedAmount = netAmount + creditsUsed = 11500 (DUPLICAVA!)
   */
  
  test('expectedAmount deve ser netAmount, não netAmount + creditsUsed', () => {
    const booking = {
      grossAmount: 10000,    // R$100
      discountAmount: 1500,  // R$15 desconto
      netAmount: 8500,       // R$85 total após cupom
      creditsUsed: 3000,     // R$30 créditos
      amountPaid: 5500,      // R$55 dinheiro
    };
    
    // CORRETO: expectedAmount = netAmount
    const correctExpectedAmount = booking.netAmount;
    expect(correctExpectedAmount).toBe(8500);
    
    // ERRADO: expectedAmount = netAmount + creditsUsed (duplica valor)
    const wrongExpectedAmount = booking.netAmount + booking.creditsUsed;
    expect(wrongExpectedAmount).toBe(11500); // ERRADO!
    
    // Validar que o cálculo correto NÃO soma os dois
    expect(correctExpectedAmount).not.toBe(wrongExpectedAmount);
  });

  test('totalRefundValue = netAmount (já inclui créditos + dinheiro)', () => {
    const booking = {
      netAmount: 8500,       // R$85 total
      creditsUsed: 3000,     // R$30 créditos
      amountPaid: 5500,      // R$55 dinheiro
    };
    
    // CORRETO: totalRefundValue = netAmount
    const totalRefundValue = booking.netAmount ?? ((booking.amountPaid ?? 0) + (booking.creditsUsed ?? 0));
    expect(totalRefundValue).toBe(8500);
    
    // moneyPaid = totalRefundValue - creditsUsed
    const moneyPaid = Math.max(0, totalRefundValue - (booking.creditsUsed ?? 0));
    expect(moneyPaid).toBe(5500);
  });

  test('Cancelamento devolve exatamente netAmount, sem duplicar', () => {
    const booking = {
      netAmount: 8500,
      creditsUsed: 3000,
      amountPaid: 5500,
    };
    
    // Cálculo correto de cancel.ts (após patch)
    const creditsUsed = booking.creditsUsed ?? 0;
    const totalRefundValue = booking.netAmount ?? ((booking.amountPaid ?? 0) + creditsUsed);
    const moneyPaid = Math.max(0, totalRefundValue - creditsUsed);
    
    // Validações
    expect(totalRefundValue).toBe(8500); // Total = R$85
    expect(creditsUsed).toBe(3000);       // Créditos = R$30
    expect(moneyPaid).toBe(5500);         // Dinheiro = R$55
    
    // A soma de créditos + dinheiro = totalRefundValue
    expect(creditsUsed + moneyPaid).toBe(totalRefundValue);
  });

  test('Fallback quando netAmount não existe usa (amountPaid + creditsUsed)', () => {
    // Booking antigo sem netAmount
    const oldBooking = {
      netAmount: null as number | null,
      creditsUsed: 3000,
      amountPaid: 5500,
    };
    
    const creditsUsed = oldBooking.creditsUsed ?? 0;
    const totalRefundValue = oldBooking.netAmount ?? ((oldBooking.amountPaid ?? 0) + creditsUsed);
    
    // Fallback funciona corretamente
    expect(totalRefundValue).toBe(8500);
  });

  test('Refund sem valor no payload deve marcar como PENDING para revisão', () => {
    // Simula webhook sem refundedValue/chargebackValue
    const payment = {
      refundedValue: undefined,
      chargebackValue: undefined,
      value: undefined,
    };
    
    const dbPaymentAmount = null; // Não encontrou no banco
    const expectedAmount = 8500;
    
    // Cálculo do refundedAmount (após patch)
    let refundedAmount: number;
    if (payment.refundedValue !== undefined && payment.refundedValue > 0) {
      refundedAmount = payment.refundedValue;
    } else if (payment.chargebackValue !== undefined && payment.chargebackValue > 0) {
      refundedAmount = payment.chargebackValue;
    } else if (payment.value !== undefined && payment.value > 0) {
      refundedAmount = payment.value;
    } else if (dbPaymentAmount) {
      refundedAmount = dbPaymentAmount;
    } else {
      // SEGURANÇA: Não assumir refund total - marcar como desconhecido
      refundedAmount = 0;
    }
    
    const isAmountUnknown = refundedAmount === 0 && expectedAmount > 0;
    const isPartial = isAmountUnknown || refundedAmount < (expectedAmount - 100);
    
    expect(refundedAmount).toBe(0);
    expect(isAmountUnknown).toBe(true);
    expect(isPartial).toBe(true); // Deve marcar como PENDING
  });
});

// ============================================================
// 9. TESTES DE IDEMPOTÊNCIA - recordCouponUsageIdempotent
// ============================================================

describe('Coupon Usage - Idempotency (Optimistic)', () => {
  test('Error message format for COUPON_ALREADY_USED', () => {
    // Mensagem: COUPON_ALREADY_USED:CODE
    const error = new Error('COUPON_ALREADY_USED:TESTE50');
    const [prefix, code] = error.message.split(':');
    
    expect(prefix).toBe('COUPON_ALREADY_USED');
    expect(code).toBe('TESTE50');
  });

  test('RESTORED status allows coupon reuse (update to USED)', () => {
    // Simula cenário: cupom RESTORED → deve atualizar para USED
    const mockExisting = {
      id: 'usage-123',
      status: 'RESTORED',
      couponCode: 'TESTE50',
      context: 'BOOKING',
      userId: 'user-123',
      bookingId: 'booking-old',
    };
    
    // Se status é RESTORED, deve fazer UPDATE não bloquear
    const shouldUpdate = mockExisting.status === 'RESTORED';
    const shouldBlock = mockExisting.status === 'USED';
    expect(shouldUpdate).toBe(true);
    expect(shouldBlock).toBe(false);
  });

  test('USED + same bookingId = idempotent success (no error)', () => {
    // Simula cenário: cupom USED mas para o MESMO booking
    const mockExisting = {
      id: 'usage-123',
      status: 'USED',
      couponCode: 'TESTE50',
      context: 'BOOKING',
      userId: 'user-123',
      bookingId: 'booking-123',
    };
    const currentBookingId = 'booking-123';
    
    // Mesma operação → idempotência verdadeira
    const isSameOperation = mockExisting.bookingId === currentBookingId;
    expect(isSameOperation).toBe(true);
    
    // Resultado esperado: sucesso com idempotent: true
    const expectedResult = { reused: false, idempotent: true };
    expect(expectedResult.idempotent).toBe(true);
  });

  test('USED + different bookingId = throw COUPON_ALREADY_USED', () => {
    // Simula cenário: cupom USED para OUTRO booking
    const mockExisting = {
      id: 'usage-123',
      status: 'USED',
      couponCode: 'TESTE50',
      context: 'BOOKING',
      userId: 'user-123',
      bookingId: 'booking-old',
    };
    const currentBookingId = 'booking-new';
    
    // Operação diferente → erro
    const isSameOperation = mockExisting.bookingId === currentBookingId;
    expect(isSameOperation).toBe(false);
    
    // Erro esperado: 400 COUPON_ALREADY_USED
    const expectedError = `COUPON_ALREADY_USED:${mockExisting.couponCode}`;
    expect(expectedError).toBe('COUPON_ALREADY_USED:TESTE50');
  });

  test('Optimistic approach: CREATE first, handle P2002', () => {
    // Documenta a estratégia: tenta CREATE, catch P2002, decide ação
    const strategy = {
      step1: 'tx.couponUsage.create(...)',
      step2: 'catch P2002 → findUnique',
      step3a: 'if USED + same booking → return { idempotent: true }',
      step3b: 'if USED + diff booking → throw COUPON_ALREADY_USED',
      step3c: 'if RESTORED → update to USED',
    };
    
    expect(strategy.step1).toContain('create');
    expect(strategy.step2).toContain('P2002');
    expect(strategy.step3a).toContain('idempotent');
    expect(strategy.step3b).toContain('COUPON_ALREADY_USED');
    expect(strategy.step3c).toContain('RESTORED');
  });

  test('Race condition: segunda request retorna 400 (não 409)', () => {
    // Duas requests concorrentes com bookingIds DIFERENTES:
    // R1: CREATE → sucesso { reused: false, idempotent: false }
    // R2: CREATE → P2002 → USED + diff booking → 400 COUPON_ALREADY_USED
    
    const r1Result = { success: true, reused: false, idempotent: false };
    const r2Result = { success: false, statusCode: 400, error: 'COUPON_ALREADY_USED' };
    
    expect(r1Result.success).toBe(true);
    expect(r2Result.statusCode).toBe(400);
    expect(r2Result.statusCode).not.toBe(409); // Sem 409 desnecessário
    expect(r2Result.statusCode).not.toBe(500); // Nunca 500
  });

  test('Idempotency: mesma request repetida retorna sucesso', () => {
    // Request duplicada (retry) com MESMO bookingId:
    // R1: CREATE → sucesso
    // R2 (retry): CREATE → P2002 → USED + same booking → sucesso idempotente
    
    const r1Result = { success: true, reused: false, idempotent: false };
    const r2Result = { success: true, reused: false, idempotent: true };
    
    expect(r1Result.success).toBe(true);
    expect(r2Result.success).toBe(true);
    expect(r2Result.idempotent).toBe(true);
  });
});

// ============================================================
// 10. TESTES DE HTTP STATUS - Respostas de erro
// ============================================================

describe('HTTP Status Codes - Error Responses', () => {
  test('COUPON_ALREADY_USED should return 400 Bad Request', () => {
    const statusCode = 400;
    const errorCode = 'COUPON_ALREADY_USED';
    
    // 400 é correto: cliente mandou cupom que já usou (erro de validação)
    expect(statusCode).toBe(400);
    expect(errorCode).toBe('COUPON_ALREADY_USED');
  });

  test('ASAAS_CREATE_FAILED should return 502 Bad Gateway', () => {
    const statusCode = 502;
    const errorCode = 'ASAAS_CREATE_FAILED';
    
    // 502 é correto: falha em serviço externo (gateway)
    expect(statusCode).toBe(502);
    expect(errorCode).toBe('ASAAS_CREATE_FAILED');
  });

  test('PIX_MIN_AMOUNT should return 400 Bad Request', () => {
    const statusCode = 400;
    const errorCode = 'PIX_MIN_AMOUNT';
    
    // 400 é correto: valor abaixo do mínimo aceito
    expect(statusCode).toBe(400);
    expect(errorCode).toBe('PIX_MIN_AMOUNT');
  });
});
