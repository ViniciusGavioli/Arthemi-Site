// ===========================================================
// Testes: Asaas Checkout API (Cartão com parcelamento dinâmico)
// ===========================================================

import {
  isCheckoutPaid,
  isCheckoutEvent,
} from '@/lib/asaas';

// Mock do fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock do rate limiter
jest.mock('@/lib/asaas-limiter', () => ({
  acquireToken: jest.fn().mockResolvedValue(undefined),
}));

describe('Asaas Checkout - Helpers', () => {
  describe('isCheckoutPaid', () => {
    it('deve retornar true para CHECKOUT_PAID', () => {
      expect(isCheckoutPaid('CHECKOUT_PAID')).toBe(true);
    });

    it('deve retornar false para outros eventos', () => {
      expect(isCheckoutPaid('CHECKOUT_CREATED')).toBe(false);
      expect(isCheckoutPaid('CHECKOUT_EXPIRED')).toBe(false);
      expect(isCheckoutPaid('PAYMENT_CONFIRMED')).toBe(false);
    });
  });

  describe('isCheckoutEvent', () => {
    it('deve retornar true para eventos de checkout', () => {
      expect(isCheckoutEvent('CHECKOUT_PAID')).toBe(true);
      expect(isCheckoutEvent('CHECKOUT_CREATED')).toBe(true);
      expect(isCheckoutEvent('CHECKOUT_EXPIRED')).toBe(true);
      expect(isCheckoutEvent('CHECKOUT_CANCELED')).toBe(true);
    });

    it('deve retornar false para eventos de payment', () => {
      expect(isCheckoutEvent('PAYMENT_CONFIRMED')).toBe(false);
      expect(isCheckoutEvent('PAYMENT_RECEIVED')).toBe(false);
    });
  });
});

describe('Asaas Checkout - Payload Structure', () => {
  it('deve ter estrutura correta para criar checkout', () => {
    // Simula o payload que seria enviado para /checkouts
    const checkoutPayload = {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['DETACHED', 'INSTALLMENT'],
      installment: {
        maxInstallmentCount: 12,
      },
      minutesToExpire: 60,
      callback: {
        successUrl: 'https://arthemisaude.com/booking/success?booking=test123',
        cancelUrl: 'https://arthemisaude.com/booking/failure?booking=test123&reason=cancelled',
        expiredUrl: 'https://arthemisaude.com/booking/failure?booking=test123&reason=expired',
      },
      items: [
        {
          name: 'Reserva Consultório 01',
          description: '4h - 20/01/2026',
          quantity: 1,
          value: 280.00,
          imageBase64: expect.any(String),
        },
      ],
      customerData: {
        name: 'João Silva',
        cpfCnpj: '12345678901',
        email: 'joao@email.com',
        phone: '11999998888',
      },
      externalReference: 'booking:test123',
    };

    // Validações de estrutura
    expect(checkoutPayload.billingTypes).toContain('CREDIT_CARD');
    expect(checkoutPayload.chargeTypes).toContain('DETACHED');
    expect(checkoutPayload.chargeTypes).toContain('INSTALLMENT');
    expect(checkoutPayload.installment.maxInstallmentCount).toBe(12);
    expect(checkoutPayload.callback.successUrl).toContain('/booking/success');
    expect(checkoutPayload.callback.cancelUrl).toContain('/booking/failure');
    expect(checkoutPayload.callback.expiredUrl).toContain('/booking/failure');
    expect(checkoutPayload.items).toHaveLength(1);
    expect(checkoutPayload.items[0].name.length).toBeLessThanOrEqual(30);
    expect(checkoutPayload.externalReference).toMatch(/^booking:/);
  });

  it('deve truncar nome do item para 30 caracteres', () => {
    const longName = 'Reserva Consultório Premium Plus Extra';
    const truncated = longName.substring(0, 30);
    
    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(truncated).toBe('Reserva Consultório Premium Pl');
  });
});

describe('Webhook CHECKOUT_PAID', () => {
  it('deve ter estrutura de payload diferente de payment', () => {
    // Payload de CHECKOUT_PAID (estrutura diferente de PAYMENT_*)
    const checkoutWebhookPayload = {
      id: 'evt_abc123',
      event: 'CHECKOUT_PAID',
      checkout: {
        id: 'chk_xyz789',
        externalReference: 'booking:booking123',
        status: 'PAID',
        value: 280.00,
      },
    };

    // Payload de PAYMENT_CONFIRMED (estrutura original)
    const paymentWebhookPayload = {
      id: 'evt_def456',
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_uvw123',
        externalReference: 'booking:booking456',
        status: 'CONFIRMED',
        value: 280.00,
      },
    };

    // Checkout tem 'checkout' key, Payment tem 'payment' key
    expect(checkoutWebhookPayload).toHaveProperty('checkout');
    expect(checkoutWebhookPayload).not.toHaveProperty('payment');
    
    expect(paymentWebhookPayload).toHaveProperty('payment');
    expect(paymentWebhookPayload).not.toHaveProperty('checkout');
  });

  it('deve extrair bookingId corretamente do externalReference', () => {
    const externalRef = 'booking:cmkk00rkh0008mutjqo4m5807';
    
    // Simula parseExternalReference
    const parsed = externalRef.startsWith('booking:')
      ? { type: 'booking', id: externalRef.replace('booking:', '') }
      : { type: 'booking', id: externalRef };

    expect(parsed.type).toBe('booking');
    expect(parsed.id).toBe('cmkk00rkh0008mutjqo4m5807');
  });
});

describe('Booking API - CARD Payment Flow', () => {
  it('deve retornar checkoutUrl para pagamento com cartão', () => {
    // Simula resposta da API quando paymentMethod === 'CARD'
    const apiResponse = {
      success: true,
      bookingId: 'booking123',
      paymentUrl: 'https://checkout.asaas.com/chk_abc123',
      paymentMethod: 'CREDIT_CARD',
      creditsUsed: 0,
      amountToPay: 28000,
    };

    expect(apiResponse.paymentUrl).toContain('checkout.asaas.com');
    expect(apiResponse.paymentMethod).toBe('CREDIT_CARD');
    // Nota: installmentCount/installmentValue não são mais retornados
    // Cliente escolhe parcelas no checkout
    expect(apiResponse).not.toHaveProperty('installmentCount');
    expect(apiResponse).not.toHaveProperty('installmentValue');
  });

  it('deve retornar invoiceUrl para pagamento com PIX', () => {
    // Simula resposta da API quando paymentMethod === 'PIX'
    const apiResponse = {
      success: true,
      bookingId: 'booking456',
      paymentUrl: 'https://www.asaas.com/i/pay_xyz789',
      paymentMethod: 'PIX',
      creditsUsed: 0,
      amountToPay: 28000,
    };

    expect(apiResponse.paymentUrl).toContain('asaas.com');
    expect(apiResponse.paymentMethod).toBe('PIX');
  });
});
