// ===========================================================
// Testes: Validações
// ===========================================================

import { createBookingSchema, createUserSchema, mockPaymentSchema } from '@/lib/validations';

describe('Validations', () => {
  describe('createBookingSchema', () => {
    const validBooking = {
      roomId: 'room-123',
      startTime: '2025-12-17T10:00:00.000Z',
      endTime: '2025-12-17T11:00:00.000Z',
      userEmail: 'test@example.com',
      userName: 'Test User',
      userPhone: '(31) 99999-9999', // Formato brasileiro válido
      notes: 'Test booking',
    };

    it('deve validar dados corretos', () => {
      const result = createBookingSchema.safeParse(validBooking);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar roomId vazio', () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        roomId: '',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar email inválido', () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        userEmail: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar startTime inválido', () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        startTime: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar endTime antes de startTime', () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        startTime: '2025-12-17T12:00:00.000Z',
        endTime: '2025-12-17T10:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar campos opcionais vazios', () => {
      const result = createBookingSchema.safeParse({
        roomId: 'room-123',
        startTime: '2025-12-17T10:00:00.000Z',
        endTime: '2025-12-17T11:00:00.000Z',
        userEmail: 'test@example.com',
        userName: 'Test User',
        userPhone: '(31) 99999-9999',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createUserSchema', () => {
    it('deve validar usuário correto', () => {
      const result = createUserSchema.safeParse({
        email: 'user@example.com',
        name: 'John Doe',
        phone: '(11) 99999-9999', // Formato brasileiro válido
      });
      expect(result.success).toBe(true);
    });

    it('deve validar usuário sem telefone (opcional)', () => {
      const result = createUserSchema.safeParse({
        email: 'user@example.com',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar telefone inválido', () => {
      const result = createUserSchema.safeParse({
        email: 'user@example.com',
        name: 'John Doe',
        phone: '123', // muito curto
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar nome muito curto', () => {
      const result = createUserSchema.safeParse({
        email: 'user@example.com',
        name: 'J',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('mockPaymentSchema', () => {
    it('deve validar approve', () => {
      const result = mockPaymentSchema.safeParse({
        bookingId: 'booking-123',
        action: 'approve',
      });
      expect(result.success).toBe(true);
    });

    it('deve validar reject', () => {
      const result = mockPaymentSchema.safeParse({
        bookingId: 'booking-123',
        action: 'reject',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar action inválida', () => {
      const result = mockPaymentSchema.safeParse({
        bookingId: 'booking-123',
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });
});
