/**
 * Testes: Operation Logger
 */

import { 
  logOperation,
  logOperationError,
  logBookingCreated,
  logPurchaseCreated,
  logPaymentConfirmed,
  logWebhookReceived,
} from '@/lib/operation-logger';

describe('operation-logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logOperation', () => {
    it('deve logar operação com formato estruturado', () => {
      logOperation({
        operation: 'BOOKING_CREATED',
        targetId: 'booking-123',
        userId: 'user-456',
        email: 'test@test.com',
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('[OP]');
      expect(logCall).toContain('BOOKING_CREATED');
      expect(logCall).toContain('booking-123');
    });

    it('deve incluir timestamp ISO', () => {
      logOperation({
        operation: 'PURCHASE_CREATED',
        targetId: 'credit-789',
      });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('logOperationError', () => {
    it('deve logar erro com stack trace', () => {
      const error = new Error('Test error');
      logOperationError('PAYMENT_FAILED', 'payment-123', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('[OP_ERROR]');
      expect(logCall).toContain('PAYMENT_FAILED');
      expect(logCall).toContain('Test error');
    });

    it('deve tratar erro não-Error', () => {
      logOperationError('PAYMENT_FAILED', 'payment-456', 'String error');

      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('String error');
    });
  });

  describe('logBookingCreated', () => {
    it('deve logar booking criado com todos os campos', () => {
      logBookingCreated({
        bookingId: 'book-001',
        userId: 'user-001',
        email: 'cliente@email.com',
        ip: '192.168.1.1',
        amount: 12000,
        paymentMethod: 'PIX',
        roomId: 'room-a',
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('BOOKING_CREATED');
      expect(logCall).toContain('book-001');
      expect(logCall).toContain('cliente@email.com');
      expect(logCall).toContain('PIX');
    });
  });

  describe('logPurchaseCreated', () => {
    it('deve logar purchase criado com horas', () => {
      logPurchaseCreated({
        creditId: 'credit-001',
        userId: 'user-002',
        email: 'comprador@email.com',
        ip: '10.0.0.1',
        amount: 60000,
        paymentMethod: 'CARD',
        hours: 10,
        roomId: 'room-b',
      });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('PURCHASE_CREATED');
      expect(logCall).toContain('credit-001');
      expect(logCall).toContain('10');
    });
  });

  describe('logPaymentConfirmed', () => {
    it('deve logar pagamento confirmado', () => {
      logPaymentConfirmed({
        paymentId: 'pay-001',
        externalId: 'asaas-xyz',
        amount: 15000,
        bookingId: 'book-002',
      });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('PAYMENT_CONFIRMED');
      expect(logCall).toContain('pay-001');
      expect(logCall).toContain('asaas-xyz');
    });

    it('deve logar pagamento de crédito', () => {
      logPaymentConfirmed({
        paymentId: 'pay-002',
        externalId: 'asaas-abc',
        amount: 50000,
        creditId: 'credit-003',
      });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('credit-003');
    });
  });

  describe('logWebhookReceived', () => {
    it('deve logar webhook recebido', () => {
      logWebhookReceived({
        externalId: 'asaas-event-123',
        event: 'PAYMENT_CONFIRMED',
        ip: '200.100.50.25',
      });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('PAYMENT_WEBHOOK_RECEIVED');
      expect(logCall).toContain('asaas-event-123');
      expect(logCall).toContain('PAYMENT_CONFIRMED');
    });
  });
});
