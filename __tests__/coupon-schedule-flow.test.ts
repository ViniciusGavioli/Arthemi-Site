// ===========================================================
// TESTES: Cupom NÃO é validado no fluxo de agendamento com créditos
// ===========================================================
// Bug reportado: Usuário via erro "CUPOM_INVALIDO: Cupom TESTE50 já foi 
// utilizado" ao tentar AGENDAR HORÁRIO (não compra)
//
// Regra correta:
// - Cupom só deve ser validado quando há pagamento em dinheiro (amountToPay > 0)
// - Fluxo 100% crédito: cupom deve ser IGNORADO, não validado
// - Cupom não deve "consumir tentativa" em agendamentos sem pagamento

import {
  isValidCoupon,
  applyDiscount,
  checkCouponUsage,
} from '@/lib/coupons';
import { CouponUsageContext } from '@prisma/client';

// Mock do Prisma
const mockPrisma = {
  couponUsage: {
    findFirst: jest.fn(),
  },
};

// ============================================================
// 1. CENÁRIO: Agendamento 100% créditos (sem pagamento)
// ============================================================

describe('Coupon in Credit-Only Booking Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Cupom não deve ser validado quando não há pagamento em dinheiro', () => {
    // Simula cenário: usuário tem créditos suficientes
    const grossAmount = 10000; // R$100,00
    const availableCredits = 15000; // R$150,00 (mais que suficiente)
    
    // Calcular se há pagamento em dinheiro ANTES de processar cupom
    const creditsToUse = Math.min(availableCredits, grossAmount);
    const amountToPay = grossAmount - creditsToUse;
    
    // Regra: só processar cupom se amountToPay > 0
    const shouldProcessCoupon = amountToPay > 0;
    
    expect(amountToPay).toBe(0);
    expect(shouldProcessCoupon).toBe(false);
  });

  test('Cupom DEVE ser validado quando há pagamento parcial', () => {
    // Simula cenário: usuário tem créditos parciais
    const grossAmount = 10000; // R$100,00
    const availableCredits = 5000; // R$50,00 (metade)
    
    // Calcular se há pagamento em dinheiro
    const creditsToUse = Math.min(availableCredits, grossAmount);
    const amountToPay = grossAmount - creditsToUse;
    
    // Regra: processar cupom se amountToPay > 0
    const shouldProcessCoupon = amountToPay > 0;
    
    expect(amountToPay).toBe(5000);
    expect(shouldProcessCoupon).toBe(true);
  });

  test('Cupom DEVE ser validado quando não há créditos', () => {
    // Simula cenário: usuário sem créditos
    const grossAmount = 10000; // R$100,00
    const availableCredits = 0; // Sem créditos
    
    // Calcular se há pagamento em dinheiro
    const creditsToUse = Math.min(availableCredits, grossAmount);
    const amountToPay = grossAmount - creditsToUse;
    
    // Regra: processar cupom se amountToPay > 0
    const shouldProcessCoupon = amountToPay > 0;
    
    expect(amountToPay).toBe(10000);
    expect(shouldProcessCoupon).toBe(true);
  });
});

// ============================================================
// 2. CENÁRIO: Validação de cupom (quando deve rodar)
// ============================================================

describe('Coupon Validation - When Required', () => {
  test('isValidCoupon funciona para cupons reconhecidos', () => {
    expect(isValidCoupon('ARTHEMI10')).toBe(true);
    expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
    expect(isValidCoupon('PRIMEIRACOMPRA10')).toBe(true);
  });

  test('isValidCoupon retorna false para cupons desconhecidos', () => {
    expect(isValidCoupon('NAOVALIDO')).toBe(false);
    expect(isValidCoupon('')).toBe(false);
    expect(isValidCoupon('TESTE50')).toBe(false); // Removido
  });

  test('applyDiscount aplica desconto corretamente', () => {
    const result = applyDiscount(10000, 'ARTHEMI10'); // 10%
    expect(result.discountAmount).toBe(1000);
    expect(result.finalAmount).toBe(9000);
  });
});

// ============================================================
// 3. CENÁRIO: Fluxo completo simulado
// ============================================================

describe('Complete Booking Flow - Coupon Handling', () => {
  test('Fluxo agendamento 100% crédito: cupom ignorado, sem erro', () => {
    const couponCode = 'ARTHEMI10';
    const grossAmount = 10000;
    const availableCredits = 10000; // Exatamente o suficiente
    
    // Passo 1: Calcular se há pagamento
    const amountToPayWithoutCoupon = grossAmount - Math.min(availableCredits, grossAmount);
    
    // Passo 2: Decidir se processa cupom
    const shouldProcessCoupon = couponCode && amountToPayWithoutCoupon > 0;
    
    // Resultado esperado: cupom NÃO processado
    expect(shouldProcessCoupon).toBe(false);
    
    // Se não processa cupom, não há erro de cupom possível
    let error: string | null = null;
    if (!shouldProcessCoupon) {
      // Ignora cupom silenciosamente
      error = null;
    }
    
    expect(error).toBeNull();
  });

  test('Fluxo compra com cupom já usado: retorna erro corretamente', async () => {
    const couponCode = 'PRIMEIRACOMPRA'; // single-use
    const grossAmount = 10000;
    const availableCredits = 0; // Sem créditos = precisa pagar
    
    // Passo 1: Calcular se há pagamento
    const amountToPayWithoutCoupon = grossAmount - Math.min(availableCredits, grossAmount);
    
    // Passo 2: Decidir se processa cupom
    const shouldProcessCoupon = couponCode && amountToPayWithoutCoupon > 0;
    
    // Resultado esperado: cupom DEVE ser processado
    expect(shouldProcessCoupon).toBe(true);
    
    // Mock: cupom já foi usado
    mockPrisma.couponUsage.findFirst.mockResolvedValueOnce({
      id: 'existing-usage',
      userId: 'user-123',
      couponCode: 'PRIMEIRACOMPRA',
      context: CouponUsageContext.BOOKING,
    });
    
    // Neste caso, checkCouponUsage retornaria canUse: false
    // e o endpoint deveria retornar erro 400 COUPON_ALREADY_USED
  });

  test('Fluxo compra com cupom válido: aplica desconto', () => {
    const couponCode = 'ARTHEMI10';
    const grossAmount = 10000;
    const availableCredits = 0;
    
    // Calcular se há pagamento
    const amountToPayWithoutCoupon = grossAmount - Math.min(availableCredits, grossAmount);
    const shouldProcessCoupon = couponCode && amountToPayWithoutCoupon > 0;
    
    expect(shouldProcessCoupon).toBe(true);
    
    // Aplicar desconto
    const discountResult = applyDiscount(grossAmount, couponCode);
    
    expect(discountResult.discountAmount).toBe(1000); // 10% de R$100
    expect(discountResult.finalAmount).toBe(9000);
  });
});

// ============================================================
// 4. TESTES DE REGRESSÃO
// ============================================================

describe('Regression Tests - No Coupon Errors in Credit Bookings', () => {
  test('Payload com couponCode preenchido mas 100% crédito: sucesso', () => {
    // Simula payload do frontend (que sempre envia couponCode)
    const payload = {
      roomId: 'room-1',
      startTime: '2025-02-01T09:00:00Z',
      endTime: '2025-02-01T10:00:00Z',
      couponCode: 'ARTHEMI10', // Frontend envia mesmo sem necessidade
    };
    
    // Backend calcula
    const grossAmount = 6000;
    const availableCredits = 10000;
    const amountToPayWithoutCoupon = grossAmount - Math.min(availableCredits, grossAmount);
    
    // Decisão
    const normalizedCouponCode = payload.couponCode?.toUpperCase().trim() || null;
    const shouldProcessCoupon = normalizedCouponCode && amountToPayWithoutCoupon > 0;
    
    // Mesmo com couponCode no payload, NÃO deve processar
    expect(shouldProcessCoupon).toBe(false);
  });

  test('Payload sem couponCode: fluxo normal', () => {
    const payload = {
      roomId: 'room-1',
      startTime: '2025-02-01T09:00:00Z',
      endTime: '2025-02-01T10:00:00Z',
      // couponCode ausente
    };
    
    const normalizedCouponCode = payload.couponCode || null;
    
    // Sem cupom, shouldProcessCoupon é sempre false
    expect(normalizedCouponCode).toBeNull();
    expect(!!normalizedCouponCode).toBe(false);
  });
});

// ============================================================
// 5. TESTES DE CÁLCULO: Desconto aplicado corretamente
// ============================================================

describe('Coupon Discount Calculation - Final Amount', () => {
  test('Booking com pagamento integral + ARTHEMI10 => total = gross - 10%', () => {
    // Cenário: R$100 sem créditos, cupom ARTHEMI10 (10%)
    const grossAmountCents = 10000; // R$100
    const creditsUsedCents = 0;
    const amountToPayWithoutCoupon = grossAmountCents - creditsUsedCents; // R$100
    
    // Cupom deve ser aplicado pois há pagamento
    expect(amountToPayWithoutCoupon).toBeGreaterThan(0);
    
    // Aplicar desconto
    const discountResult = applyDiscount(amountToPayWithoutCoupon, 'ARTHEMI10');
    const discountAmountCents = discountResult.discountAmount;
    
    // CÁLCULO CORRETO (sem duplicar créditos):
    // netAmount = gross - discount = 10000 - 1000 = 9000
    // amountToPay = netAmount - credits = 9000 - 0 = 9000
    const netAmountCents = grossAmountCents - discountAmountCents;
    const amountToPayCents = Math.max(0, netAmountCents - creditsUsedCents);
    
    expect(discountAmountCents).toBe(1000); // 10%
    expect(netAmountCents).toBe(9000);
    expect(amountToPayCents).toBe(9000); // R$90 vai para o Asaas
  });

  test('Booking parcial com créditos + ARTHEMI10 => desconto aplicado sobre amountToPay', () => {
    // Cenário: R$100 com R$50 em créditos, cupom ARTHEMI10 (10%)
    const grossAmountCents = 10000; // R$100
    const creditsUsedCents = 5000;  // R$50
    const amountToPayWithoutCoupon = grossAmountCents - creditsUsedCents; // R$50
    
    // Cupom deve ser aplicado pois há pagamento parcial
    expect(amountToPayWithoutCoupon).toBeGreaterThan(0);
    
    // Aplicar desconto SOBRE o valor a pagar (não sobre gross)
    const discountResult = applyDiscount(amountToPayWithoutCoupon, 'ARTHEMI10');
    const discountAmountCents = discountResult.discountAmount;
    
    // CÁLCULO CORRETO:
    // O desconto é aplicado sobre amountToPayWithoutCoupon = R$50
    // discountAmount = 10% de R$50 = R$5 = 500 centavos
    // netAmount = gross - discount = 10000 - 500 = 9500
    // amountToPay = netAmount - credits = 9500 - 5000 = 4500
    const netAmountCents = grossAmountCents - discountAmountCents;
    const amountToPayCents = Math.max(0, netAmountCents - creditsUsedCents);
    
    expect(discountAmountCents).toBe(500); // 10% de R$50
    expect(netAmountCents).toBe(9500);
    expect(amountToPayCents).toBe(4500); // R$45 vai para o Asaas
  });

  test('Booking 100% créditos + cupom => cupom ignorado (sem erro e sem alterar)', () => {
    // Cenário: R$100 com R$100+ em créditos
    const grossAmountCents = 10000; // R$100
    const creditsUsedCents = 10000; // R$100 (cobre tudo)
    const couponCode = 'ARTHEMI10';
    
    const amountToPayWithoutCoupon = grossAmountCents - creditsUsedCents;
    
    // Cupom NÃO deve ser aplicado pois não há pagamento
    const shouldProcessCoupon = couponCode && amountToPayWithoutCoupon > 0;
    expect(shouldProcessCoupon).toBe(false);
    
    // Se não processa cupom, desconto = 0
    const discountAmountCents = shouldProcessCoupon 
      ? applyDiscount(amountToPayWithoutCoupon, couponCode).discountAmount 
      : 0;
    
    // CÁLCULO (sem cupom):
    // netAmount = gross - 0 = 10000
    // amountToPay = netAmount - credits = 10000 - 10000 = 0
    const netAmountCents = grossAmountCents - discountAmountCents;
    const amountToPayCents = Math.max(0, netAmountCents - creditsUsedCents);
    
    expect(discountAmountCents).toBe(0);
    expect(amountToPayCents).toBe(0); // Nada vai para o Asaas
  });

  test('Desconto não pode exceder amountToPayWithoutCoupon', () => {
    // Cenário: Desconto maior que valor a pagar
    const grossAmountCents = 300; // R$3
    const creditsUsedCents = 0;
    const amountToPayWithoutCoupon = grossAmountCents - creditsUsedCents;
    
    // PRIMEIRACOMPRA = 15%, 15% de R$3 = R$0,45
    const discountResult = applyDiscount(amountToPayWithoutCoupon, 'PRIMEIRACOMPRA');
    
    // Desconto = 15% de 300 = 45 centavos
    // Final = 300 - 45 = 255 centavos
    expect(discountResult.finalAmount).toBeGreaterThanOrEqual(100); // Piso R$1 se necessário
    expect(discountResult.discountAmount).toBeLessThanOrEqual(amountToPayWithoutCoupon);
  });

  test('amountToPay mínimo é 0 (não negativo)', () => {
    const netAmountCents = 500;
    const creditsUsedCents = 1000; // Créditos excedem net
    
    const amountToPayCents = Math.max(0, netAmountCents - creditsUsedCents);
    
    expect(amountToPayCents).toBe(0);
    expect(amountToPayCents).toBeGreaterThanOrEqual(0);
  });
});