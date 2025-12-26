// ===========================================================
// Testes: Validações
// ===========================================================

import { createBookingSchema, createUserSchema, mockPaymentSchema, validateCPF } from '@/lib/validations';

describe('Validations', () => {
  // ===========================================================
  // Testes: validateCPF
  // ===========================================================
  describe('validateCPF', () => {
    // CPFs válidos para teste (gerados por algoritmo)
    it('deve aceitar CPF válido', () => {
      expect(validateCPF('52998224725')).toBe(true); // CPF válido de teste
    });

    it('deve aceitar CPF válido com formatação', () => {
      expect(validateCPF('529.982.247-25')).toBe(true);
    });

    it('deve aceitar CPF válido com espaços', () => {
      expect(validateCPF(' 529 982 247 25 ')).toBe(true);
    });

    // CPFs inválidos
    it('deve rejeitar CPF com dígitos verificadores errados', () => {
      expect(validateCPF('52998224700')).toBe(false); // Dígitos verificadores incorretos
    });

    it('deve rejeitar CPF com menos de 11 dígitos', () => {
      expect(validateCPF('123456789')).toBe(false);
    });

    it('deve rejeitar CPF com mais de 11 dígitos', () => {
      expect(validateCPF('123456789012')).toBe(false);
    });

    it('deve rejeitar CPF vazio', () => {
      expect(validateCPF('')).toBe(false);
    });

    // CPFs inválidos conhecidos (sequências repetidas)
    it('deve rejeitar CPF 00000000000', () => {
      expect(validateCPF('00000000000')).toBe(false);
    });

    it('deve rejeitar CPF 11111111111', () => {
      expect(validateCPF('11111111111')).toBe(false);
    });

    it('deve rejeitar CPF 22222222222', () => {
      expect(validateCPF('22222222222')).toBe(false);
    });

    it('deve rejeitar CPF 33333333333', () => {
      expect(validateCPF('33333333333')).toBe(false);
    });

    it('deve rejeitar CPF 44444444444', () => {
      expect(validateCPF('44444444444')).toBe(false);
    });

    it('deve rejeitar CPF 55555555555', () => {
      expect(validateCPF('55555555555')).toBe(false);
    });

    it('deve rejeitar CPF 66666666666', () => {
      expect(validateCPF('66666666666')).toBe(false);
    });

    it('deve rejeitar CPF 77777777777', () => {
      expect(validateCPF('77777777777')).toBe(false);
    });

    it('deve rejeitar CPF 88888888888', () => {
      expect(validateCPF('88888888888')).toBe(false);
    });

    it('deve rejeitar CPF 99999999999', () => {
      expect(validateCPF('99999999999')).toBe(false);
    });

    // Mais CPFs válidos para garantir algoritmo
    it('deve aceitar outros CPFs válidos', () => {
      expect(validateCPF('11144477735')).toBe(true); // CPF válido de teste
      expect(validateCPF('12345678909')).toBe(true); // CPF válido de teste
    });
  });

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
