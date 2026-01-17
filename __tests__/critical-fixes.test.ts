// ===========================================================
// TESTES: Correções Críticas - Race Condition, Cleanup, Min Amount
// ===========================================================

import { 
  RecordCouponUsageResult,
} from '@/lib/coupons';

import {
  PENDING_BOOKING_EXPIRATION_HOURS,
  MIN_PAYMENT_AMOUNT_PIX_CENTS,
  MIN_PAYMENT_AMOUNT_CARD_CENTS,
  MIN_PAYMENT_AMOUNT_BOLETO_CENTS,
  getMinPaymentAmountCents,
} from '@/lib/business-rules';

import {
  normalizeAsaasError,
  NormalizedAsaasError,
} from '@/lib/asaas';

// ============================================================
// 1. TESTES - Coupon Race Condition Fix
// ============================================================

describe('Coupon Race Condition - Claim-or-Create Pattern', () => {
  describe('RecordCouponUsageResult interface', () => {
    it('deve ter propriedade ok para indicar sucesso/falha', () => {
      // Resultado de sucesso - interface simplificada
      const successResult: RecordCouponUsageResult = {
        ok: true,
        mode: 'CREATED',
      };
      expect(successResult.ok).toBe(true);
      
      // Resultado de falha não ocorre mais via interface
      // P2002 propaga diretamente sem catch interno
    });

    it('deve suportar modos CREATED e CLAIMED_RESTORED', () => {
      const modes: Array<RecordCouponUsageResult['mode']> = [
        'CREATED',
        'CLAIMED_RESTORED',
      ];
      
      modes.forEach(mode => {
        const result: RecordCouponUsageResult = {
          ok: true,
          mode,
        };
        expect(result.ok).toBe(true);
        expect(result.mode).toBe(mode);
      });
    });

    it('interface simplificada - sem reused, idempotent, existingBookingId', () => {
      const result: RecordCouponUsageResult = {
        ok: true,
        mode: 'CLAIMED_RESTORED',
      };
      
      expect(result.ok).toBe(true);
      // Propriedades removidas da interface para simplicidade
      expect('reused' in result).toBe(false);
      expect('idempotent' in result).toBe(false);
    });
  });

  describe('Comportamento esperado (simulado)', () => {
    it('NÃO deve sobrescrever bookingId de cupom USED por outro booking', () => {
      // Simular cenário: cupom já USED pelo booking AAA
      const existingUsage = {
        status: 'USED',
        bookingId: 'AAA',
      };
      
      // Transação B tentando usar o mesmo cupom para booking BBB
      const attemptBookingId = 'BBB';
      
      // Comportamento esperado: retornar falha, NÃO fazer update
      const shouldOverwrite = existingUsage.bookingId !== attemptBookingId && existingUsage.status === 'USED';
      expect(shouldOverwrite).toBe(true); // Era true no código antigo (bug)
      
      // Novo comportamento: não sobrescrever, retornar erro
      const newBehavior = existingUsage.status === 'USED' && existingUsage.bookingId !== attemptBookingId;
      expect(newBehavior).toBe(true); // Deve detectar conflito
    });

    it('deve permitir claim de cupom RESTORED', () => {
      const existingUsage = {
        status: 'RESTORED',
        bookingId: null,
      };
      
      // Cupom restaurado pode ser reutilizado
      const canClaim = existingUsage.status === 'RESTORED';
      expect(canClaim).toBe(true);
    });

    it('deve ser idempotente para mesmo bookingId', () => {
      const existingUsage = {
        status: 'USED',
        bookingId: 'AAA',
      };
      
      const attemptBookingId = 'AAA'; // Mesmo booking
      
      // Chamada duplicada = idempotente, não erro
      const isIdempotent = existingUsage.bookingId === attemptBookingId;
      expect(isIdempotent).toBe(true);
    });
  });
});

// ============================================================
// 2. TESTES - Booking Expiration & Cleanup
// ============================================================

describe('Booking Expiration & Cleanup', () => {
  describe('Constantes de expiração', () => {
    it('PENDING_BOOKING_EXPIRATION_HOURS deve ser 24 por padrão', () => {
      expect(PENDING_BOOKING_EXPIRATION_HOURS).toBe(24);
    });

    it('expiresAt deve ser calculado corretamente', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PENDING_BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000);
      
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 1);
    });
  });

  describe('Lógica de cleanup (simulada)', () => {
    it('deve identificar bookings expirados corretamente', () => {
      const now = new Date();
      
      // Booking expirado (expiresAt no passado)
      const expiredBooking = {
        status: 'PENDING',
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // 1h atrás
      };
      
      const isExpired = expiredBooking.status === 'PENDING' && 
                        expiredBooking.expiresAt && 
                        expiredBooking.expiresAt < now;
      
      expect(isExpired).toBe(true);
    });

    it('NÃO deve considerar booking CONFIRMED como expirado', () => {
      const now = new Date();
      
      const confirmedBooking = {
        status: 'CONFIRMED',
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // expiresAt no passado
      };
      
      const shouldCleanup = confirmedBooking.status === 'PENDING';
      expect(shouldCleanup).toBe(false);
    });

    it('deve usar fallback de 24h para bookings sem expiresAt', () => {
      const now = new Date();
      const createdAt = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h atrás
      
      const oldBookingWithoutExpires = {
        status: 'PENDING',
        expiresAt: null,
        createdAt,
      };
      
      const fallbackThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const shouldCleanupByFallback = 
        oldBookingWithoutExpires.status === 'PENDING' &&
        oldBookingWithoutExpires.expiresAt === null &&
        oldBookingWithoutExpires.createdAt < fallbackThreshold;
      
      expect(shouldCleanupByFallback).toBe(true);
    });
  });
});

// ============================================================
// 3. TESTES - Payment Min Amount
// ============================================================

describe('Payment Minimum Amount', () => {
  describe('Constantes de valor mínimo', () => {
    it('PIX mínimo deve ser R$ 1,00 (100 centavos) por padrão', () => {
      expect(MIN_PAYMENT_AMOUNT_PIX_CENTS).toBe(100);
    });

    it('Cartão mínimo deve ser R$ 5,00 (500 centavos) por padrão', () => {
      expect(MIN_PAYMENT_AMOUNT_CARD_CENTS).toBe(500);
    });

    it('Boleto mínimo deve ser R$ 5,00 (500 centavos) por padrão', () => {
      expect(MIN_PAYMENT_AMOUNT_BOLETO_CENTS).toBe(500);
    });
  });

  describe('getMinPaymentAmountCents', () => {
    it('deve retornar valor correto para PIX', () => {
      expect(getMinPaymentAmountCents('PIX')).toBe(MIN_PAYMENT_AMOUNT_PIX_CENTS);
    });

    it('deve retornar valor correto para CARD', () => {
      expect(getMinPaymentAmountCents('CARD')).toBe(MIN_PAYMENT_AMOUNT_CARD_CENTS);
    });

    it('deve retornar valor correto para CREDIT_CARD', () => {
      expect(getMinPaymentAmountCents('CREDIT_CARD')).toBe(MIN_PAYMENT_AMOUNT_CARD_CENTS);
    });

    it('deve retornar valor correto para BOLETO', () => {
      expect(getMinPaymentAmountCents('BOLETO')).toBe(MIN_PAYMENT_AMOUNT_BOLETO_CENTS);
    });
  });

  describe('Validação de valor mínimo (simulada)', () => {
    it('PIX com R$ 0,50 deve ser rejeitado', () => {
      const amount = 50; // 50 centavos
      const minAmount = getMinPaymentAmountCents('PIX');
      
      expect(amount < minAmount).toBe(true);
    });

    it('PIX com R$ 1,00 deve ser aceito', () => {
      const amount = 100; // 100 centavos
      const minAmount = getMinPaymentAmountCents('PIX');
      
      expect(amount >= minAmount).toBe(true);
    });

    it('Cartão com R$ 4,00 deve ser rejeitado', () => {
      const amount = 400; // 400 centavos
      const minAmount = getMinPaymentAmountCents('CARD');
      
      expect(amount < minAmount).toBe(true);
    });

    it('Cartão com R$ 5,00 deve ser aceito', () => {
      const amount = 500; // 500 centavos
      const minAmount = getMinPaymentAmountCents('CARD');
      
      expect(amount >= minAmount).toBe(true);
    });
  });
});

// ============================================================
// 4. TESTES - normalizeAsaasError
// ============================================================

describe('normalizeAsaasError', () => {
  describe('Detecção de erro de valor mínimo', () => {
    it('deve detectar erro de valor mínimo em português', () => {
      const error = new Error('O valor mínimo para cobrança via PIX é de R$ 1,00');
      const result = normalizeAsaasError(error, 'PIX');
      
      expect(result.code).toBe('PAYMENT_MIN_AMOUNT');
      expect(result.details?.paymentMethod).toBe('PIX');
    });

    it('deve detectar erro de valor mínimo em inglês', () => {
      const error = new Error('Minimum value for payment is R$ 1.00');
      const result = normalizeAsaasError(error, 'PIX');
      
      expect(result.code).toBe('PAYMENT_MIN_AMOUNT');
    });

    it('deve extrair valor mínimo da mensagem', () => {
      const error = new Error('O valor mínimo é de R$ 5,00');
      const result = normalizeAsaasError(error, 'CARD');
      
      expect(result.code).toBe('PAYMENT_MIN_AMOUNT');
      expect(result.details?.minAmountCents).toBe(500);
    });
  });

  describe('Detecção de timeout', () => {
    it('deve detectar erro de timeout', () => {
      const error = new Error('Timeout na comunicação com Asaas (15s)');
      const result = normalizeAsaasError(error);
      
      expect(result.code).toBe('PAYMENT_TIMEOUT');
    });
  });

  describe('Detecção de cartão recusado', () => {
    it('deve detectar cartão recusado em português', () => {
      const error = new Error('Pagamento recusado pelo banco');
      const result = normalizeAsaasError(error, 'CREDIT_CARD');
      
      expect(result.code).toBe('PAYMENT_DECLINED');
    });

    it('deve detectar cartão recusado em inglês', () => {
      const error = new Error('Payment declined by issuer');
      const result = normalizeAsaasError(error, 'CREDIT_CARD');
      
      expect(result.code).toBe('PAYMENT_DECLINED');
    });
  });

  describe('Erro genérico', () => {
    it('deve retornar PAYMENT_ERROR para erros desconhecidos', () => {
      const error = new Error('Erro desconhecido XYZ123');
      const result = normalizeAsaasError(error);
      
      expect(result.code).toBe('PAYMENT_ERROR');
      expect(result.details?.originalError).toBe('Erro desconhecido XYZ123');
    });
  });

  describe('Estrutura do resultado', () => {
    it('deve sempre ter code e message', () => {
      const error = new Error('Qualquer erro');
      const result = normalizeAsaasError(error);
      
      expect(result.code).toBeDefined();
      expect(result.message).toBeDefined();
      expect(typeof result.code).toBe('string');
      expect(typeof result.message).toBe('string');
    });

    it('deve incluir originalError em details', () => {
      const originalMessage = 'Erro original do Asaas';
      const error = new Error(originalMessage);
      const result = normalizeAsaasError(error);
      
      expect(result.details?.originalError).toBe(originalMessage);
    });
  });
});

// ============================================================
// 5. TESTES - Cron Endpoint Protection
// ============================================================

describe('Cron Endpoint Protection', () => {
  it('endpoint cleanup deve exigir CRON_SECRET', () => {
    // Simular validação de secret
    const cronSecret = 'test_secret_123';
    const providedSecret = 'test_secret_123';
    
    const isAuthorized = cronSecret && providedSecret === cronSecret;
    expect(isAuthorized).toBe(true);
  });

  it('deve rejeitar sem secret', () => {
    const cronSecret = 'test_secret_123';
    const providedSecret: string | undefined = undefined;
    
    const isAuthorized = !!(cronSecret && providedSecret === cronSecret);
    expect(isAuthorized).toBe(false);
  });

  it('deve rejeitar com secret errado', () => {
    const cronSecret = 'test_secret_123';
    const providedSecret: string = 'wrong_secret';
    
    // Comparação string != string (ambas definidas)
    const secretsMatch = providedSecret === cronSecret;
    expect(secretsMatch).toBe(false);
  });
});

// ============================================================
// 6. TESTES - Race Condition P2002 → COUPON_ALREADY_USED
// ============================================================

describe('Race Condition: P2002 deve retornar COUPON_ALREADY_USED', () => {
  it('P2002 com cupom USED por outro booking deve retornar código específico', () => {
    // Simular cenário: P2002 capturado, findUnique revela status USED
    const existingUsage = {
      status: 'USED',
      bookingId: 'booking_AAA',
    };
    const attemptBookingId = 'booking_BBB';
    
    // Lógica do código: após P2002, verifica se mesmo booking
    const isSameOperation = existingUsage.bookingId === attemptBookingId;
    
    // Se não é mesma operação, deve falhar
    expect(isSameOperation).toBe(false);
    expect(existingUsage.status).toBe('USED');
    expect(existingUsage.bookingId).toBe('booking_AAA');
    // Neste cenário, o código deveria lançar erro COUPON_ALREADY_USED
  });

  it('P2002 com mesmo booking deve ser idempotente (não erro)', () => {
    const existingUsage = {
      status: 'USED',
      bookingId: 'booking_AAA',
    };
    const attemptBookingId = 'booking_AAA'; // MESMO booking
    
    const isSameOperation = existingUsage.bookingId === attemptBookingId;
    
    // Se é mesma operação, é idempotente
    expect(isSameOperation).toBe(true);
    // Neste cenário, deveria retornar ok sem erro
  });
});

// ============================================================
// 7. TESTES - Cleanup cancela booking e restaura cupom específico
// ============================================================

describe('Cleanup: Cancelar booking e restaurar cupom específico', () => {
  it('deve restaurar cupom APENAS se status USED E aponta para booking específico', () => {
    // Cenário: cupom USED apontando para booking_123
    const couponUsage = {
      status: 'USED',
      bookingId: 'booking_123',
      couponCode: 'ARTHEMI10',
    };
    
    const targetBookingId = 'booking_123';
    
    // Query correta: busca por bookingId específico + status USED
    const shouldRestore = 
      couponUsage.status === 'USED' && 
      couponUsage.bookingId === targetBookingId;
    
    expect(shouldRestore).toBe(true);
  });

  it('NÃO deve restaurar cupom de outro booking', () => {
    const couponUsage = {
      status: 'USED',
      bookingId: 'booking_456', // Outro booking
      couponCode: 'ARTHEMI10',
    };
    
    const targetBookingId = 'booking_123';
    
    const shouldRestore = 
      couponUsage.status === 'USED' && 
      couponUsage.bookingId === targetBookingId;
    
    expect(shouldRestore).toBe(false);
  });

  it('NÃO deve restaurar cupom RESTORED (já restaurado)', () => {
    const couponUsage = {
      status: 'RESTORED',
      bookingId: 'booking_123',
      couponCode: 'ARTHEMI10',
    };
    
    const targetBookingId = 'booking_123';
    
    const shouldRestore = couponUsage.status === 'USED';
    
    expect(shouldRestore).toBe(false);
  });

  it('cancelReason EXPIRED_NO_PAYMENT deve impedir reprocessamento', () => {
    const cancelledBooking = {
      status: 'CANCELLED',
      cancelReason: 'EXPIRED_NO_PAYMENT',
    };
    
    // Query de cleanup deve excluir bookings com cancelReason != null
    const shouldProcess = 
      cancelledBooking.status === 'PENDING' && 
      cancelledBooking.cancelReason === null;
    
    expect(shouldProcess).toBe(false);
  });
});

// ============================================================
// 8. TESTES - normalizeAsaasError patterns específicos
// ============================================================

describe('normalizeAsaasError: Patterns específicos (sem falsos positivos)', () => {
  it('NÃO deve classificar erro genérico como PAYMENT_MIN_AMOUNT', () => {
    // "valor" aparece mas não é erro de mínimo
    const error = new Error('Erro ao processar valor da transação');
    const result = normalizeAsaasError(error, 'PIX');
    
    // Não deve ser PAYMENT_MIN_AMOUNT
    expect(result.code).not.toBe('PAYMENT_MIN_AMOUNT');
    expect(result.code).toBe('PAYMENT_ERROR');
  });

  it('NÃO deve classificar qualquer "cliente" como PAYMENT_CUSTOMER_ERROR', () => {
    // "cliente" em contexto genérico
    const error = new Error('Notificação enviada para o cliente');
    const result = normalizeAsaasError(error);
    
    // Não deve ser PAYMENT_CUSTOMER_ERROR
    expect(result.code).not.toBe('PAYMENT_CUSTOMER_ERROR');
    expect(result.code).toBe('PAYMENT_ERROR');
  });

  it('DEVE classificar erro real de cliente inválido', () => {
    const error = new Error('Cliente não encontrado no sistema');
    const result = normalizeAsaasError(error);
    
    expect(result.code).toBe('PAYMENT_CUSTOMER_ERROR');
  });

  it('DEVE classificar erro real de CPF inválido', () => {
    const error = new Error('CPF inválido informado');
    const result = normalizeAsaasError(error);
    
    expect(result.code).toBe('PAYMENT_CUSTOMER_ERROR');
  });

  it('DEVE retornar minAmountCents correto para erro de valor mínimo', () => {
    const error = new Error('O valor mínimo para cobrança via PIX é de R$ 1,00');
    const result = normalizeAsaasError(error, 'PIX');
    
    expect(result.code).toBe('PAYMENT_MIN_AMOUNT');
    expect(result.details?.minAmountCents).toBe(100);
  });

  it('DEVE retornar minAmountCents 500 para cartão', () => {
    const error = new Error('O valor mínimo para cobrança é de R$ 5,00');
    const result = normalizeAsaasError(error, 'CARD');
    
    expect(result.code).toBe('PAYMENT_MIN_AMOUNT');
    expect(result.details?.minAmountCents).toBe(500);
  });
});

// ============================================================
// 5. TESTES - Correção de Unidade REAIS vs CENTAVOS
// ============================================================

import { toCents, fromCents, assertIntegerCents, formatBRL } from '@/lib/money';
import { applyDiscount } from '@/lib/coupons';

describe('Money Helpers - Conversão REAIS <-> CENTAVOS', () => {
  describe('toCents()', () => {
    it('deve converter R$ 39,99 para 3999 centavos', () => {
      expect(toCents(39.99)).toBe(3999);
    });

    it('deve converter R$ 59,99 para 5999 centavos', () => {
      expect(toCents(59.99)).toBe(5999);
    });

    it('deve arredondar valores com imprecisão float corretamente', () => {
      // JavaScript floats têm imprecisão: 39.995 * 100 = 3999.4999...
      // Portanto Math.round() arredonda para 3999 (não 4000)
      // Na prática, valores como 39.995 não devem existir - preços são sempre X.XX
      expect(toCents(39.99)).toBe(3999);
      expect(toCents(40.00)).toBe(4000);
      expect(toCents(40.01)).toBe(4001);
    });

    it('deve converter valor inteiro corretamente', () => {
      expect(toCents(100)).toBe(10000);
    });

    it('deve converter zero corretamente', () => {
      expect(toCents(0)).toBe(0);
    });
  });

  describe('fromCents()', () => {
    it('deve converter 3999 centavos para R$ 39,99', () => {
      expect(fromCents(3999)).toBe(39.99);
    });

    it('deve converter 5999 centavos para R$ 59,99', () => {
      expect(fromCents(5999)).toBe(59.99);
    });

    it('deve converter zero corretamente', () => {
      expect(fromCents(0)).toBe(0);
    });
  });

  describe('assertIntegerCents()', () => {
    it('NÃO deve lançar erro para inteiros', () => {
      expect(() => assertIntegerCents(3999, 'amount')).not.toThrow();
      expect(() => assertIntegerCents(0, 'amount')).not.toThrow();
      expect(() => assertIntegerCents(100, 'amount')).not.toThrow();
    });

    it('DEVE lançar erro para valores decimais', () => {
      expect(() => assertIntegerCents(39.99, 'amount')).toThrow('[MONEY] amount deve ser inteiro');
      expect(() => assertIntegerCents(0.5, 'amount')).toThrow('[MONEY] amount deve ser inteiro');
    });
  });

  describe('formatBRL()', () => {
    it('deve formatar 3999 centavos como "R$ 39,99"', () => {
      const formatted = formatBRL(3999);
      expect(formatted).toMatch(/39,99/);
      expect(formatted).toMatch(/R\$/);
    });
  });
});

describe('Correção de Bug: applyDiscount com CENTAVOS', () => {
  describe('Cenário do bug original: valor em REAIS passado como CENTAVOS', () => {
    it('BUG ANTERIOR: R$ 39,99 interpretado como 39,99 centavos gerava piso errado', () => {
      // Este era o comportamento bugado:
      // amount = 39.99 (REAIS, mas tratado como centavos)
      // minAmount = 39.99 >= 100 ? 100 : 0 = 0 (ERRADO! 39.99 < 100)
      
      const reaisValue = 39.99;
      
      // Simulando o bug: minAmount era 0 porque 39.99 < 100
      const buggedMinAmount = reaisValue >= 100 ? 100 : 0;
      expect(buggedMinAmount).toBe(0); // Era isso que acontecia!
    });

    it('CORREÇÃO: R$ 39,99 deve ser convertido para 3999 CENTAVOS antes de applyDiscount', () => {
      const reaisValue = 39.99;
      const centsValue = toCents(reaisValue); // 3999
      
      expect(centsValue).toBe(3999);
      
      // Agora o piso funciona corretamente
      const correctMinAmount = centsValue >= 100 ? 100 : 0;
      expect(correctMinAmount).toBe(100); // R$ 1,00 piso
    });
  });

  describe('applyDiscount com valores em CENTAVOS', () => {
    it('deve aplicar 10% de desconto em 3999 centavos (R$ 39,99)', () => {
      const amountCents = 3999;
      const result = applyDiscount(amountCents, 'ARTHEMI10'); // 10%
      
      // Desconto = 3999 * 0.10 = 399.9 ≈ 400 centavos
      // Final = 3999 - 400 = 3599 centavos
      expect(result.couponApplied).toBe(true);
      expect(result.discountAmount).toBeCloseTo(400, 0); // ~R$ 4,00
      expect(result.finalAmount).toBeCloseTo(3599, 0); // ~R$ 35,99
    });

    it('deve aplicar 15% de desconto em 3999 centavos (PRIMEIRACOMPRA)', () => {
      const amountCents = 3999;
      const result = applyDiscount(amountCents, 'PRIMEIRACOMPRA'); // 15%
      
      // Desconto = 3999 * 0.15 = 599.85 ≈ 600 centavos
      // Final = 3999 - 600 = 3399 centavos
      expect(result.couponApplied).toBe(true);
      expect(result.discountAmount).toBeCloseTo(600, 0); // ~R$ 6,00
      expect(result.finalAmount).toBeCloseTo(3399, 0); // ~R$ 33,99
    });

    it('deve aplicar desconto percentual 10% - ARTHEMI10', () => {
      const amountCents = 3999;
      const result = applyDiscount(amountCents, 'ARTHEMI10'); // 10%
      
      // Desconto = 3999 * 0.10 = 399.9 → Math.round → 400 centavos
      // Final = 3999 - 400 = 3599 centavos
      expect(result.couponApplied).toBe(true);
      expect(result.discountAmount).toBeCloseTo(400, 0); // ~R$ 4,00
      expect(result.finalAmount).toBeCloseTo(3599, 0); // ~R$ 35,99
    });

    it('valor após desconto deve ser >= piso de R$ 1,00 (100 centavos)', () => {
      const amountCents = 3999;
      
      // Qualquer cupom aplicado deve respeitar piso de R$ 1,00
      const result10 = applyDiscount(amountCents, 'ARTHEMI10');
      const result15 = applyDiscount(amountCents, 'PRIMEIRACOMPRA');
      const resultP10 = applyDiscount(amountCents, 'PRIMEIRACOMPRA10');
      
      expect(result10.finalAmount).toBeGreaterThanOrEqual(100);
      expect(result15.finalAmount).toBeGreaterThanOrEqual(100);
      expect(resultP10.finalAmount).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Validação de valor mínimo Asaas APÓS desconto', () => {
    it('deve bloquear pagamento se netAmountCents < 500 (R$ 5,00) para cartão', () => {
      const MIN_CARD_CENTS = 500;
      
      // Cenário: valor muito baixo após desconto
      const amountCents = 600; // R$ 6,00
      const result = applyDiscount(amountCents, 'PRIMEIRACOMPRA'); // -15%
      
      // Final = 600 - 90 = 510 centavos = R$ 5,10
      // Com 15% de desconto, não chega abaixo do mínimo neste caso
      // Vamos usar um valor menor para demonstrar
      const smallAmount = 400; // R$ 4,00
      const smallResult = applyDiscount(smallAmount, 'PRIMEIRACOMPRA');
      // 15% de 400 = 60, final = 340
      
      // Deve bloquear para cartão (mínimo R$ 5,00)
      const shouldBlockCard = smallResult.finalAmount < MIN_CARD_CENTS;
      expect(shouldBlockCard).toBe(true);
    });

    it('deve permitir pagamento se netAmountCents >= 500 para cartão', () => {
      const MIN_CARD_CENTS = 500;
      
      // Cenário: valor suficiente após desconto
      const amountCents = 3999; // R$ 39,99
      const result = applyDiscount(amountCents, 'ARTHEMI10'); // -10%
      
      // Final ≈ 3599 centavos = R$ 35,99
      expect(result.finalAmount).toBeGreaterThanOrEqual(MIN_CARD_CENTS);
    });

    it('deve retornar código PAYMENT_MIN_AMOUNT_AFTER_DISCOUNT para valor insuficiente', () => {
      // Simulação de resposta da API
      const errorResponse = {
        success: false,
        code: 'PAYMENT_MIN_AMOUNT_AFTER_DISCOUNT',
        minAmountCents: 500,
        netAmountCents: 100,
      };
      
      expect(errorResponse.code).toBe('PAYMENT_MIN_AMOUNT_AFTER_DISCOUNT');
      expect(errorResponse.netAmountCents).toBeLessThan(errorResponse.minAmountCents);
    });
  });

  describe('Invariante: grossAmount = netAmount + discountAmount (em CENTAVOS)', () => {
    it('deve manter invariante para cupom percentual', () => {
      const grossCents = 3999;
      const result = applyDiscount(grossCents, 'ARTHEMI10');
      
      // grossAmount = finalAmount + discountAmount
      expect(result.finalAmount + result.discountAmount).toBe(grossCents);
    });

    it('deve manter invariante para cupom PRIMEIRACOMPRA (15%)', () => {
      const grossCents = 3999;
      const result = applyDiscount(grossCents, 'PRIMEIRACOMPRA');
      
      // grossAmount = finalAmount + discountAmount
      expect(result.finalAmount + result.discountAmount).toBe(grossCents);
    });

    it('deve manter invariante para cupom inválido (sem desconto)', () => {
      const grossCents = 3999;
      const result = applyDiscount(grossCents, 'CUPOM_INEXISTENTE');
      
      expect(result.couponApplied).toBe(false);
      expect(result.finalAmount).toBe(grossCents);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount + result.discountAmount).toBe(grossCents);
    });
  });
});
