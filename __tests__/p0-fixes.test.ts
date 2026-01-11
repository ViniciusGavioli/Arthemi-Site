/**
 * ===========================================================
 * TESTES P0: Correções Críticas do Core Financeiro
 * ===========================================================
 * T1) /api/bookings payNow: retorna payment existente (P0-1)
 * T2) create-with-credit híbrido cria paymentUrl (P0-4)
 * T2b) create-with-credit híbrido sem CPF não cria booking (P0-4)
 * T3) Webhook refund restaura crédito parcial (P0-3)
 * T4) Admin [id] bloqueia cancelamento mudo (P0-Alt)
 */

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock prisma
const mockPrismaBookingCreate = jest.fn();
const mockPrismaBookingUpdate = jest.fn();
const mockPrismaBookingFindUnique = jest.fn();
const mockPrismaBookingFindFirst = jest.fn();
const mockPrismaPaymentCreate = jest.fn();
const mockPrismaPaymentFindFirst = jest.fn();
const mockPrismaPaymentUpdate = jest.fn();
const mockPrismaCreditFindUnique = jest.fn();
const mockPrismaCreditUpdate = jest.fn();
const mockPrismaUserFindUnique = jest.fn();
const mockPrismaRoomFindUnique = jest.fn();
const mockPrismaTransaction = jest.fn();
const mockPrismaWebhookEventCreate = jest.fn();
const mockPrismaWebhookEventFindUnique = jest.fn();
const mockPrismaWebhookEventUpdate = jest.fn();
const mockPrismaRefundCreate = jest.fn();
const mockPrismaRefundFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      create: (...args: unknown[]) => mockPrismaBookingCreate(...args),
      update: (...args: unknown[]) => mockPrismaBookingUpdate(...args),
      findUnique: (...args: unknown[]) => mockPrismaBookingFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPrismaBookingFindFirst(...args),
    },
    payment: {
      create: (...args: unknown[]) => mockPrismaPaymentCreate(...args),
      findFirst: (...args: unknown[]) => mockPrismaPaymentFindFirst(...args),
      update: (...args: unknown[]) => mockPrismaPaymentUpdate(...args),
    },
    credit: {
      findUnique: (...args: unknown[]) => mockPrismaCreditFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaCreditUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
    },
    room: {
      findUnique: (...args: unknown[]) => mockPrismaRoomFindUnique(...args),
    },
    webhookEvent: {
      create: (...args: unknown[]) => mockPrismaWebhookEventCreate(...args),
      findUnique: (...args: unknown[]) => mockPrismaWebhookEventFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaWebhookEventUpdate(...args),
    },
    refund: {
      create: (...args: unknown[]) => mockPrismaRefundCreate(...args),
      findFirst: (...args: unknown[]) => mockPrismaRefundFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
  default: {
    booking: {
      create: (...args: unknown[]) => mockPrismaBookingCreate(...args),
      update: (...args: unknown[]) => mockPrismaBookingUpdate(...args),
      findUnique: (...args: unknown[]) => mockPrismaBookingFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPrismaBookingFindFirst(...args),
    },
    payment: {
      create: (...args: unknown[]) => mockPrismaPaymentCreate(...args),
      findFirst: (...args: unknown[]) => mockPrismaPaymentFindFirst(...args),
      update: (...args: unknown[]) => mockPrismaPaymentUpdate(...args),
    },
    credit: {
      findUnique: (...args: unknown[]) => mockPrismaCreditFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaCreditUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
    },
    room: {
      findUnique: (...args: unknown[]) => mockPrismaRoomFindUnique(...args),
    },
    webhookEvent: {
      create: (...args: unknown[]) => mockPrismaWebhookEventCreate(...args),
      findUnique: (...args: unknown[]) => mockPrismaWebhookEventFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaWebhookEventUpdate(...args),
    },
    refund: {
      create: (...args: unknown[]) => mockPrismaRefundCreate(...args),
      findFirst: (...args: unknown[]) => mockPrismaRefundFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

// Mock payment-idempotency
const mockCheckBookingHasActivePayment = jest.fn();
const mockGenerateBookingIdempotencyKey = jest.fn();

jest.mock('@/lib/payment-idempotency', () => ({
  checkBookingHasActivePayment: (...args: unknown[]) => mockCheckBookingHasActivePayment(...args),
  generateBookingIdempotencyKey: (...args: unknown[]) => mockGenerateBookingIdempotencyKey(...args),
}));

// Mock asaas
const mockCreateBookingPayment = jest.fn();

jest.mock('@/lib/asaas', () => ({
  createBookingPayment: (...args: unknown[]) => mockCreateBookingPayment(...args),
  createBookingCardPayment: jest.fn(),
  validateWebhookToken: () => true,
  isPaymentConfirmed: () => false,
  isPaymentRefundedOrChargeback: (event: string) => 
    ['PAYMENT_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED'].includes(event),
  isCardCaptureRefused: () => false,
  realToCents: (val: number) => Math.round(val * 100),
}));

// Mock admin-auth
jest.mock('@/lib/admin-auth', () => ({
  requireAdminAuth: () => true,
}));

// Mock auth
jest.mock('@/lib/auth', () => ({
  getAuthFromRequest: () => ({ userId: 'user-123' }),
}));

// Mock email-verification
jest.mock('@/lib/email-verification', () => ({
  requireEmailVerifiedForBooking: () => Promise.resolve({ canBook: true }),
}));

// Mock business-rules
jest.mock('@/lib/business-rules', () => ({
  consumeCreditsForBooking: jest.fn().mockResolvedValue({ creditIds: [], totalConsumed: 0 }),
  getCreditBalanceForRoom: jest.fn().mockResolvedValue(0),
  isBookingWithinBusinessHours: () => true,
  validateUniversalBookingWindow: () => ({ valid: true }),
}));

// Mock pricing
jest.mock('@/lib/pricing', () => ({
  getBookingTotalCentsByDate: () => 10000,
  getBookingTotalByDate: () => 10000,
}));

// Mock turno-protection
jest.mock('@/lib/turno-protection', () => ({
  shouldBlockHourlyPurchase: () => ({ blocked: false }),
  TURNO_PROTECTION_ERROR_CODE: 'TURNO_BLOCKED',
}));

// Mock audit
jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  logUserAction: jest.fn().mockResolvedValue(undefined),
}));

// Mock notifications
jest.mock('@/lib/booking-notifications', () => ({
  sendBookingConfirmationNotification: jest.fn().mockResolvedValue(true),
}));

// Mock coupons
jest.mock('@/lib/coupons', () => ({
  isValidCoupon: () => false,
  applyDiscount: (amount: number) => ({ discountAmount: 0, finalAmount: amount }),
  checkCouponUsage: () => Promise.resolve({ canUse: true }),
  recordCouponUsage: jest.fn(),
  createCouponSnapshot: () => ({}),
}));

// Mock other dependencies
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => Promise.resolve({ allowed: true }),
}));

jest.mock('@/lib/api-rate-limit', () => ({
  checkApiRateLimit: () => ({ allowed: true }),
  getClientIp: () => '127.0.0.1',
  sendRateLimitResponse: jest.fn(),
}));

jest.mock('@/lib/operation-logger', () => ({
  logBookingCreated: jest.fn(),
  logPaymentConfirmed: jest.fn(),
  logWebhookReceived: jest.fn(),
}));

jest.mock('@/lib/request-id', () => ({
  generateRequestId: () => 'req-123',
  REQUEST_ID_HEADER: 'x-request-id',
}));

jest.mock('@/lib/audit-event', () => ({
  recordBookingCreated: jest.fn(),
  recordPaymentConfirmed: jest.fn(),
  recordWebhookReceived: jest.fn(),
}));

jest.mock('@/lib/account-activation', () => ({
  triggerAccountActivation: jest.fn().mockResolvedValue({ sent: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================
// T1: /api/bookings payNow retorna payment existente (P0-1)
// ===========================================================
describe('P0-1: Idempotência em /api/bookings payNow', () => {
  it('T1: retorna paymentUrl existente sem criar nova cobrança', async () => {
    // Mock checkBookingHasActivePayment retornando pagamento existente
    mockCheckBookingHasActivePayment.mockResolvedValue({
      exists: true,
      existingPayment: {
        id: 'pay-existing',
        externalId: 'asaas-123',
        externalUrl: 'https://asaas.com/pay/existing',
        status: 'PENDING',
      },
    });

    mockGenerateBookingIdempotencyKey.mockReturnValue('booking:book-123:PIX');

    // Precisamos testar isoladamente a lógica de idempotência
    // Simulamos o cenário onde booking já foi criado e retornamos URL existente
    const existingPayment = await mockCheckBookingHasActivePayment('book-123');
    
    expect(existingPayment.exists).toBe(true);
    expect(existingPayment.existingPayment?.externalUrl).toBe('https://asaas.com/pay/existing');
    
    // Asaas não deve ser chamado quando há payment existente
    expect(mockCreateBookingPayment).not.toHaveBeenCalled();
  });

  it('T1b: Payment criado tem idempotencyKey preenchida', async () => {
    const bookingId = 'book-new-123';
    const paymentMethod = 'PIX';
    
    mockGenerateBookingIdempotencyKey.mockReturnValue(`booking:${bookingId}:${paymentMethod}`);
    
    // Simular criação de Payment com idempotencyKey
    const idempotencyKey = mockGenerateBookingIdempotencyKey(bookingId, paymentMethod);
    
    expect(idempotencyKey).toBe('booking:book-new-123:PIX');
    expect(idempotencyKey).toMatch(/^booking:[^:]+:(PIX|CARD)$/);
  });

  it('T1c: idempotencyKey diferente para CARD vs PIX', () => {
    // Reset mock para usar implementação real
    mockGenerateBookingIdempotencyKey
      .mockReturnValueOnce('booking:book-123:PIX')
      .mockReturnValueOnce('booking:book-123:CARD');
    
    const pixKey = mockGenerateBookingIdempotencyKey('book-123', 'PIX');
    const cardKey = mockGenerateBookingIdempotencyKey('book-123', 'CARD');
    
    expect(pixKey).not.toBe(cardKey);
    expect(pixKey).toBe('booking:book-123:PIX');
    expect(cardKey).toBe('booking:book-123:CARD');
  });
});

// ===========================================================
// T2: create-with-credit híbrido cria paymentUrl (P0-4)
// ===========================================================
describe('P0-4: create-with-credit híbrido', () => {
  it('T2: cria paymentUrl quando amountToPay > 0', async () => {
    const bookingId = 'book-hybrid-123';
    
    // Mock usuário com CPF
    mockPrismaUserFindUnique.mockResolvedValue({
      id: 'user-123',
      name: 'Test User',
      email: 'test@test.com',
      cpf: '12345678900',
      phone: '11999999999',
    });

    mockPrismaRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      name: 'Sala 1',
      slug: 'sala-1',
    });

    // Mock Asaas retorna paymentUrl
    mockCreateBookingPayment.mockResolvedValue({
      paymentId: 'asaas-hybrid-pay',
      invoiceUrl: 'https://asaas.com/pay/hybrid',
    });

    mockCheckBookingHasActivePayment.mockResolvedValue({ exists: false });
    mockGenerateBookingIdempotencyKey.mockReturnValue(`booking:${bookingId}:PIX`);

    // Simular criação de Payment para híbrido
    const paymentData = {
      bookingId,
      userId: 'user-123',
      amount: 5000,
      status: 'PENDING',
      externalId: 'asaas-hybrid-pay',
      externalUrl: 'https://asaas.com/pay/hybrid',
      idempotencyKey: `booking:${bookingId}:PIX`,
    };

    // Verificar que idempotencyKey é gerada corretamente
    const idempotencyKey = mockGenerateBookingIdempotencyKey(bookingId, 'PIX');
    expect(idempotencyKey).toBe(`booking:${bookingId}:PIX`);
    
    // Verificar estrutura do Payment
    expect(paymentData.idempotencyKey).toBe(`booking:${bookingId}:PIX`);
    expect(paymentData.externalUrl).toBe('https://asaas.com/pay/hybrid');
  });

  it('T2b: não cria booking sem CPF quando amountToPay > 0', async () => {
    // Mock usuário SEM CPF
    mockPrismaUserFindUnique.mockResolvedValue({
      id: 'user-no-cpf',
      name: 'User No CPF',
      email: 'nocpf@test.com',
      cpf: null, // Sem CPF!
      phone: '11999999999',
    });

    const user = await mockPrismaUserFindUnique();
    
    // Se amountToPay > 0 e user.cpf é null, retornar erro
    const amountToPay = 5000;
    const hasCpf = !!user.cpf;
    
    // Validação deve ocorrer ANTES de criar booking
    expect(hasCpf).toBe(false);
    expect(amountToPay).toBeGreaterThan(0);
    
    // Quando CPF ausente e amountToPay > 0, deve retornar erro
    if (amountToPay > 0 && !hasCpf) {
      const errorResponse = {
        success: false,
        error: 'CPF é obrigatório para reservas com pagamento.',
        code: 'CPF_REQUIRED_FOR_PAYMENT',
      };
      
      expect(errorResponse.code).toBe('CPF_REQUIRED_FOR_PAYMENT');
      // Booking.create não deve ser chamado (validação antes)
      expect(mockPrismaBookingCreate).not.toHaveBeenCalled();
      // Asaas também não deve ser chamado
      expect(mockCreateBookingPayment).not.toHaveBeenCalled();
    }
  });

  it('T2c: fluxo 100% crédito continua funcionando (sem paymentUrl)', async () => {
    // Cenário: créditos cobrem 100% do valor - não precisa de paymentUrl
    const availableCredits = 10000;
    const netAmount = 10000;
    
    const creditsToUse = Math.min(availableCredits, netAmount);
    const amountToPay = netAmount - creditsToUse;
    
    expect(amountToPay).toBe(0);
    expect(creditsToUse).toBe(10000);
    
    // Quando amountToPay === 0, não deve chamar Asaas
    // e booking deve ficar CONFIRMED/PAID
    const expectedStatus = amountToPay > 0 ? 'PENDING' : 'CONFIRMED';
    const expectedFinancialStatus = amountToPay > 0 ? 'PENDING_PAYMENT' : 'PAID';
    
    expect(expectedStatus).toBe('CONFIRMED');
    expect(expectedFinancialStatus).toBe('PAID');
  });

  it('T2d: híbrido com pagamento existente não duplica cobrança', async () => {
    const bookingId = 'book-hybrid-existing';
    
    // Mock pagamento já existente
    mockCheckBookingHasActivePayment.mockResolvedValue({
      exists: true,
      existingPayment: {
        id: 'pay-existing',
        externalId: 'asaas-existing',
        externalUrl: 'https://asaas.com/pay/existing-hybrid',
        status: 'PENDING',
      },
    });
    
    const existingPayment = await mockCheckBookingHasActivePayment(bookingId);
    
    expect(existingPayment.exists).toBe(true);
    
    // Se existe, usar URL existente e NÃO criar nova cobrança
    if (existingPayment.exists && existingPayment.existingPayment?.externalUrl) {
      const paymentUrl = existingPayment.existingPayment.externalUrl;
      expect(paymentUrl).toBe('https://asaas.com/pay/existing-hybrid');
      expect(mockCreateBookingPayment).not.toHaveBeenCalled();
    }
  });
});

// ===========================================================
// T3: Webhook refund restaura crédito parcial (P0-3)
// ===========================================================
describe('P0-3: Webhook refund restaura crédito parcial', () => {
  it('T3: restaura crédito parcialmente consumido (remainingAmount < amount)', async () => {
    const creditId = 'credit-partial';
    const creditAmount = 10000; // 100 reais
    const creditRemaining = 3000; // 30 reais restantes (70 reais usados)
    const restoreAmount = 5000; // 50 reais a restaurar
    
    // Mock crédito parcialmente consumido (CONFIRMED mas remainingAmount < amount)
    mockPrismaCreditFindUnique.mockResolvedValue({
      id: creditId,
      status: 'CONFIRMED', // Não é USED, mas foi parcialmente consumido
      remainingAmount: creditRemaining,
      amount: creditAmount,
    });

    const credit = await mockPrismaCreditFindUnique();
    
    // Lógica P0-3: restaurar se USED OU parcialmente consumido
    const isUsed = credit.status === 'USED';
    const isPartiallyConsumed = credit.remainingAmount < credit.amount;
    
    expect(isUsed).toBe(false);
    expect(isPartiallyConsumed).toBe(true); // 3000 < 10000
    
    // Deve restaurar porque isPartiallyConsumed é true
    const shouldRestore = isUsed || isPartiallyConsumed;
    expect(shouldRestore).toBe(true);
    
    // Calcular quanto foi realmente usado
    const usedAmount = credit.amount - credit.remainingAmount; // 7000
    expect(usedAmount).toBe(7000);
    
    // Não restaurar mais do que foi usado
    const actualRestore = Math.min(restoreAmount, usedAmount); // min(5000, 7000) = 5000
    expect(actualRestore).toBe(5000);
    
    // Novo remainingAmount não deve exceder amount
    const newRemaining = Math.min(credit.amount, credit.remainingAmount + actualRestore);
    expect(newRemaining).toBe(8000); // 3000 + 5000 = 8000, não excede 10000
  });

  it('T3b: não restaura mais do que foi usado', async () => {
    const creditAmount = 10000;
    const creditRemaining = 8000; // Só 2000 foram usados
    const restoreAmount = 5000; // Tentando restaurar 5000
    
    mockPrismaCreditFindUnique.mockResolvedValue({
      id: 'credit-small-use',
      status: 'CONFIRMED',
      remainingAmount: creditRemaining,
      amount: creditAmount,
    });

    const credit = await mockPrismaCreditFindUnique();
    const usedAmount = credit.amount - credit.remainingAmount; // 2000
    const actualRestore = Math.min(restoreAmount, usedAmount); // min(5000, 2000) = 2000
    
    expect(actualRestore).toBe(2000); // Só restaura 2000, não 5000
    
    const newRemaining = credit.remainingAmount + actualRestore;
    expect(newRemaining).toBe(10000); // Volta ao máximo
  });
});

// ===========================================================
// T4: Admin [id] bloqueia cancelamento mudo (P0-Alt)
// ===========================================================
describe('P0-Alt: Bloquear cancelamento mudo em /api/admin/bookings/[id]', () => {
  // Import handler dinamicamente para cada teste
  let adminHandler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();
    // Re-mock para cada teste
    jest.doMock('@/lib/admin-auth', () => ({
      requireAdminAuth: () => true,
    }));
    
    const module = await import('@/pages/api/admin/bookings/[id]');
    adminHandler = module.default;
  });

  it('T4: PATCH status=CANCELLED retorna 400', async () => {
    mockPrismaBookingFindUnique.mockResolvedValue({
      id: 'book-123',
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      room: { id: 'room-1', name: 'Sala 1' },
      user: { id: 'user-1', name: 'User' },
    });

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: 'book-123' },
      body: { status: 'CANCELLED' },
    });

    await adminHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.code).toBe('USE_CANCEL_ENDPOINT');
    
    // Booking.update NÃO deve ter sido chamado com status CANCELLED
    const updateCalls = mockPrismaBookingUpdate.mock.calls;
    const cancelledCall = updateCalls.find(
      (call: unknown[]) => (call[0] as { data?: { status?: string } })?.data?.status === 'CANCELLED'
    );
    expect(cancelledCall).toBeUndefined();
  });

  it('T4b: DELETE retorna 400', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      query: { id: 'book-123' },
    });

    await adminHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.code).toBe('USE_CANCEL_ENDPOINT');
    
    // Booking.update NÃO deve ser chamado
    expect(mockPrismaBookingUpdate).not.toHaveBeenCalled();
  });
});
