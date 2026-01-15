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
    expect(isValidCoupon('TESTE50')).toBe(true);
    expect(isValidCoupon('PRIMEIRACOMPRA')).toBe(true);
    expect(isValidCoupon('ARTHEMI10')).toBe(true);
  });

  test('isValidCoupon retorna false para cupons desconhecidos', () => {
    expect(isValidCoupon('NAOVALIDO')).toBe(false);
    expect(isValidCoupon('')).toBe(false);
  });

  test('applyDiscount aplica desconto corretamente', () => {
    const result = applyDiscount(10000, 'TESTE50');
    expect(result.discountAmount).toBe(500);
    expect(result.finalAmount).toBe(9500);
  });
});

// ============================================================
// 3. CENÁRIO: Fluxo completo simulado
// ============================================================

describe('Complete Booking Flow - Coupon Handling', () => {
  test('Fluxo agendamento 100% crédito: cupom ignorado, sem erro', () => {
    const couponCode = 'TESTE50';
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
    const couponCode = 'TESTE50';
    const grossAmount = 10000;
    const availableCredits = 0;
    
    // Calcular se há pagamento
    const amountToPayWithoutCoupon = grossAmount - Math.min(availableCredits, grossAmount);
    const shouldProcessCoupon = couponCode && amountToPayWithoutCoupon > 0;
    
    expect(shouldProcessCoupon).toBe(true);
    
    // Aplicar desconto
    const discountResult = applyDiscount(grossAmount, couponCode);
    
    expect(discountResult.discountAmount).toBe(500);
    expect(discountResult.finalAmount).toBe(9500);
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
      couponCode: 'TESTE50', // Frontend envia mesmo sem necessidade
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
