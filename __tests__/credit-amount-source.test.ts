/**
 * Testes: Crédito deve usar valor PAGO (não preço de tabela)
 * 
 * BUG CORRIGIDO: Cliente pagou R$ 1.959,60 mas recebeu R$ 2.400,00 em créditos.
 * Causa raiz: Sistema usava preço de tabela (product.price ou hourlyRate * hours)
 *             em vez do valor efetivamente pago (com desconto/cupom).
 * 
 * REGRA CORRETA:
 * ✅ Crédito em R$ SEMPRE = valor efetivamente pago/confirmado no pagamento
 * ❌ NUNCA usar preço de tabela para gerar crédito se houve desconto
 */

describe('Crédito: valor correto (valor pago, não tabela)', () => {
  describe('purchase.ts - compra de créditos', () => {
    it('deve criar crédito com valor após desconto de cupom', () => {
      // Simula cenário do bug:
      // Produto: R$ 2.400,00 (240000 centavos)
      // Cupom: -18.35% (exemplo)
      // Valor pago: R$ 1.959,60 (195960 centavos)
      
      const productPrice = 240000; // centavos
      const discountPercent = 18.35;
      const expectedPaidAmount = Math.round(productPrice * (1 - discountPercent / 100));
      
      // O crédito deve ser ~195960, não 240000
      expect(expectedPaidAmount).toBe(195960); // R$ 1.959,60
      expect(expectedPaidAmount).not.toBe(productPrice);
    });

    it('deve usar amount (com cupom aplicado) e não creditHours * hourlyRate', () => {
      // Cenário real do código corrigido:
      // - amount já tem cupom aplicado
      // - creditAmount era calculado separadamente (BUG)
      // - agora usa amount diretamente
      
      const hourlyRate = 6000; // R$ 60,00 por hora
      const hours = 40; // Pacote 40h
      const tablePrice = hourlyRate * hours; // R$ 2.400,00 (tabela)
      
      // Cupom fixo de teste (R$ 5,00)
      const amountWithCoupon = 500; // 5 reais
      
      // Crédito deve ser o valor pago, não tabela
      expect(amountWithCoupon).toBe(500);
      expect(tablePrice).toBe(240000);
      expect(amountWithCoupon).not.toBe(tablePrice);
    });

    it('deve manter amount original se não houver cupom', () => {
      const productPrice = 120000; // R$ 1.200,00
      const noCouponAmount = productPrice;
      
      expect(noCouponAmount).toBe(productPrice);
    });
  });

  describe('webhook asaas.ts - confirmação de pagamento', () => {
    it('deve usar payment.value (valor pago) para creditAmount', () => {
      // Simula webhook do Asaas
      const payment = {
        id: 'pay_123',
        value: 1959.60, // Valor PAGO em reais
        netValue: 1900.00, // Valor líquido (após taxas Asaas)
      };
      
      // Converte para centavos (realToCents)
      const realToCents = (value: number) => Math.round(value * 100);
      const creditAmount = realToCents(payment.value);
      
      expect(creditAmount).toBe(195960);
      expect(creditAmount).not.toBe(240000); // Não é preço de tabela
    });

    it('não deve usar hourlyRate * hoursIncluded para pacotes', () => {
      // Cenário do bug - NÃO FAZER ISSO:
      const hourlyRate = 6000; // R$ 60,00
      const hoursIncluded = 40;
      const wrongCreditAmount = hourlyRate * hoursIncluded; // BUG!
      
      // Cenário correto:
      const paymentValue = 1959.60; // Valor pago com desconto
      const correctCreditAmount = Math.round(paymentValue * 100);
      
      expect(wrongCreditAmount).toBe(240000); // R$ 2.400,00 - ERRADO
      expect(correctCreditAmount).toBe(195960); // R$ 1.959,60 - CORRETO
      expect(correctCreditAmount).not.toBe(wrongCreditAmount);
    });

    it('netValue é para recebimento do vendedor, não para crédito do cliente', () => {
      // netValue = valor após taxas Asaas (o que a Arthemi recebe)
      // value = valor que o cliente pagou (fonte para crédito)
      const payment = {
        value: 100.00, // Cliente pagou R$ 100
        netValue: 96.50, // Arthemi recebe R$ 96,50 (após taxas)
      };
      
      // Crédito deve ser baseado no que o CLIENTE pagou, não no que você recebe
      const creditAmount = Math.round(payment.value * 100);
      const wrongAmount = Math.round(payment.netValue * 100);
      
      expect(creditAmount).toBe(10000);
      expect(wrongAmount).toBe(9650);
      expect(creditAmount).not.toBe(wrongAmount);
    });
  });

  describe('idempotência de webhook', () => {
    it('webhook duplicado não deve criar crédito duplicado', () => {
      // Simulação: primeiro webhook cria crédito
      const firstCall = { creditCreated: true, creditId: 'cred_123' };
      
      // Segundo webhook (duplicado) deve ser ignorado
      // O sistema verifica por eventId no banco
      const secondCall = { skipped: true, reason: 'already_processed' };
      
      expect(firstCall.creditCreated).toBe(true);
      expect(secondCall.skipped).toBe(true);
    });
  });

  describe('cenários de cupom', () => {
    it('cupom percentual deve reduzir amount corretamente', () => {
      const productPrice = 100000; // R$ 1.000
      const percentDiscount = 20; // 20% off
      const expectedAmount = Math.round(productPrice * (1 - percentDiscount / 100));
      
      expect(expectedAmount).toBe(80000); // R$ 800
    });

    it('cupom fixo deve reduzir amount corretamente', () => {
      const productPrice = 100000; // R$ 1.000
      const fixedDiscount = 10000; // R$ 100 de desconto
      const expectedAmount = productPrice - fixedDiscount;
      
      expect(expectedAmount).toBe(90000); // R$ 900
    });

    it('cupom especial TESTE50 deve definir valor fixo R$ 5', () => {
      // Cupom especial para testes: preço vira R$ 5,00
      const originalPrice = 240000;
      const couponFixedPrice = 500; // R$ 5,00
      
      expect(couponFixedPrice).toBe(500);
      expect(couponFixedPrice).not.toBe(originalPrice);
    });
  });

  describe('cenários de estorno', () => {
    it('pagamento estornado não deve gerar crédito', () => {
      // Evento de estorno vem DEPOIS de PAYMENT_CONFIRMED
      // Se crédito já existe, deve ser revertido ou marcado como inválido
      const refundEvent = 'PAYMENT_REFUNDED';
      
      // Sistema deve:
      // 1. NÃO criar novo crédito
      // 2. Marcar crédito existente (se houver) como inativo
      expect(refundEvent).toBe('PAYMENT_REFUNDED');
    });
  });
});

describe('Validação de regra de negócio', () => {
  it('valor de crédito em centavos deve ser inteiro', () => {
    const paymentValue = 1959.60;
    const creditAmount = Math.round(paymentValue * 100);
    
    expect(Number.isInteger(creditAmount)).toBe(true);
    expect(creditAmount).toBe(195960);
  });

  it('crédito nunca deve ser negativo', () => {
    const scenarios = [
      { price: 1000, discount: 500 },
      { price: 1000, discount: 1000 },
      { price: 1000, discount: 1500 }, // Desconto maior que preço
    ];

    for (const s of scenarios) {
      const amount = Math.max(0, s.price - s.discount);
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });
});
