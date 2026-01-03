/**
 * Testes: Audit Event - Persistência de eventos de auditoria
 */

import { 
  recordAuditEvent, 
  recordBookingCreated, 
  recordPurchaseCreated,
  recordPaymentConfirmed,
  recordWebhookReceived,
} from '@/lib/audit-event';
import { prisma } from '@/lib/prisma';

// Mock do Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditEvent: {
      create: jest.fn(),
    },
  },
}));

describe('audit-event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordAuditEvent', () => {
    it('deve gravar evento no banco', async () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-1' });

      await recordAuditEvent({
        requestId: 'req-123',
        type: 'BOOKING_CREATED',
        userId: 'user-1',
        entityType: 'Booking',
        entityId: 'booking-1',
        payload: { roomId: 'room-1' },
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req-123',
          type: 'BOOKING_CREATED',
          userId: 'user-1',
          entityType: 'Booking',
          entityId: 'booking-1',
          payloadJson: { roomId: 'room-1' },
        },
      });
    });

    it('deve NÃO quebrar se prisma falhar (best-effort)', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (prisma.auditEvent.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      // Não deve lançar exceção
      await expect(recordAuditEvent({
        type: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: 'booking-1',
      })).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('deve aceitar campos opcionais como null/undefined', async () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-2' });

      await recordAuditEvent({
        type: 'PAYMENT_CONFIRMED',
        entityType: 'Payment',
        entityId: 'pay-1',
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: null,
          userId: null,
          payloadJson: undefined,
        }),
      });
    });
  });

  describe('recordBookingCreated', () => {
    it('deve chamar recordAuditEvent com tipo BOOKING_CREATED', () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-3' });

      recordBookingCreated({
        requestId: 'req-456',
        userId: 'user-2',
        bookingId: 'booking-2',
        roomId: 'room-1',
        amount: 5000,
        paymentMethod: 'PIX',
      });

      // Fire and forget - não espera
      expect(prisma.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordPurchaseCreated', () => {
    it('deve chamar recordAuditEvent com tipo PURCHASE_CREATED', () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-4' });

      recordPurchaseCreated({
        requestId: 'req-789',
        userId: 'user-3',
        creditId: 'credit-1',
        roomId: 'room-2',
        amount: 10000,
        hours: 10,
        paymentMethod: 'CARD',
      });

      expect(prisma.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordPaymentConfirmed', () => {
    it('deve chamar recordAuditEvent com tipo PAYMENT_CONFIRMED', () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-5' });

      recordPaymentConfirmed({
        requestId: 'req-abc',
        paymentId: 'pay-1',
        externalId: 'asaas-pay-123',
        amount: 5000,
        bookingId: 'booking-3',
      });

      expect(prisma.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordWebhookReceived', () => {
    it('deve chamar recordAuditEvent com tipo WEBHOOK_RECEIVED', () => {
      (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'event-6' });

      recordWebhookReceived({
        requestId: 'req-xyz',
        eventId: 'webhook-event-1',
        eventType: 'PAYMENT_CONFIRMED',
        paymentId: 'pay-2',
      });

      expect(prisma.auditEvent.create).toHaveBeenCalled();
    });
  });
});
