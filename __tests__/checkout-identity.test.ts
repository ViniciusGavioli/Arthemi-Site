// ===========================================================
// Testes: Regra de Identidade no Checkout
// ===========================================================
// Valida:
// - LOGADO: usa session.userId, NÃO chama resolveOrCreateUser
// - NÃO LOGADO: chama resolveOrCreateUser(email > phone)

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mocks
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    room: { findUnique: jest.fn() },
    booking: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    credit: { create: jest.fn(), delete: jest.fn() },
    product: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  getAuthFromRequest: jest.fn(),
}));

jest.mock('@/lib/user-resolve', () => ({
  resolveOrCreateUser: jest.fn(),
}));

jest.mock('@/lib/asaas', () => ({
  createBookingPayment: jest.fn(),
  createBookingCardPayment: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
}));

jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn(),
}));

jest.mock('@/lib/business-rules', () => ({
  getCreditBalanceForRoom: jest.fn().mockResolvedValue(0),
  consumeCreditsForBooking: jest.fn(),
  isBookingWithinBusinessHours: jest.fn().mockReturnValue(true),
  validateBookingWindow: jest.fn(),
  getAvailableCreditsForRoom: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/booking-notifications', () => ({
  sendBookingConfirmationNotification: jest.fn(),
}));

jest.mock('@/lib/email', () => ({
  sendPixPendingEmail: jest.fn(),
}));

// Imports após mocks
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { resolveOrCreateUser } from '@/lib/user-resolve';
import { createBookingPayment } from '@/lib/asaas';

// ===========================================================
// TESTES: /api/bookings (checkout público)
// ===========================================================

describe('/api/bookings - Regra de Identidade', () => {
  const mockRoom = {
    id: 'room-1',
    name: 'Sala A',
    isActive: true,
    hourlyRate: 5000, // R$ 50/h
    tier: 1,
  };

  const mockBooking = {
    id: 'booking-123',
    userId: 'session-user-id',
    roomId: 'room-1',
    startTime: new Date('2026-01-10T10:00:00Z'),
    endTime: new Date('2026-01-10T11:00:00Z'),
    status: 'PENDING',
    paymentStatus: 'PENDING',
  };

  const validBody = {
    userName: 'João Silva',
    userPhone: '11999999999',
    userEmail: 'joao@email.com',
    userCpf: '12345678909', // CPF válido fake
    roomId: 'room-1',
    startAt: '2026-01-10T10:00:00.000Z',
    endAt: '2026-01-10T11:00:00.000Z',
    paymentMethod: 'PIX',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup padrão do Prisma
    (prisma.room.findUnique as jest.Mock).mockResolvedValue(mockRoom);
    (createBookingPayment as jest.Mock).mockResolvedValue({
      paymentId: 'pay-123',
      invoiceUrl: 'https://asaas.com/pay',
      pixCopiaECola: 'pix-code',
    });
  });

  describe('Usuário LOGADO (session.userId existe)', () => {
    beforeEach(() => {
      // Simular usuário logado
      (getAuthFromRequest as jest.Mock).mockReturnValue({ 
        userId: 'session-user-id',
        role: 'CUSTOMER',
      });

      // Transaction mock
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          booking: {
            findFirst: jest.fn().mockResolvedValue(null), // Sem conflito
            create: jest.fn().mockResolvedValue({ ...mockBooking, userId: 'session-user-id' }),
          },
          product: { findUnique: jest.fn() },
        };
        return callback(tx);
      });
    });

    it('deve usar userId da sessão diretamente', async () => {
      // Importar handler após mocks
      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // Verificar que getAuthFromRequest foi chamado
      expect(getAuthFromRequest).toHaveBeenCalledWith(req);
    });

    it('NÃO deve chamar resolveOrCreateUser quando logado', async () => {
      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // resolveOrCreateUser NÃO deve ser chamado
      expect(resolveOrCreateUser).not.toHaveBeenCalled();
    });

    it('deve criar booking com userId da sessão', async () => {
      let capturedUserId: string | undefined;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(({ data }) => {
              capturedUserId = data.userId;
              return { ...mockBooking, userId: data.userId };
            }),
          },
          product: { findUnique: jest.fn() },
        };
        return callback(tx);
      });

      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // userId deve vir da sessão, não do body
      expect(capturedUserId).toBe('session-user-id');
    });
  });

  describe('Usuário NÃO LOGADO (sem sessão)', () => {
    const mockResolvedUser = { id: 'resolved-user-id', email: 'joao@email.com' };

    beforeEach(() => {
      // Simular usuário NÃO logado
      (getAuthFromRequest as jest.Mock).mockReturnValue(null);

      // resolveOrCreateUser retorna usuário
      (resolveOrCreateUser as jest.Mock).mockResolvedValue({ 
        user: mockResolvedUser, 
        isNew: false,
      });

      // Transaction mock
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ ...mockBooking, userId: mockResolvedUser.id }),
          },
          product: { findUnique: jest.fn() },
          user: { findUnique: jest.fn() },
        };
        return callback(tx);
      });
    });

    it('deve chamar resolveOrCreateUser quando não logado', async () => {
      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // resolveOrCreateUser DEVE ser chamado
      expect(resolveOrCreateUser).toHaveBeenCalled();
    });

    it('deve passar email e phone para resolveOrCreateUser', async () => {
      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // Verificar parâmetros
      expect(resolveOrCreateUser).toHaveBeenCalledWith(
        expect.anything(), // tx
        expect.objectContaining({
          name: 'João Silva',
          email: 'joao@email.com',
          phone: '11999999999',
          cpf: '12345678909',
        })
      );
    });

    it('deve criar booking com userId do resolveOrCreateUser', async () => {
      let capturedUserId: string | undefined;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(({ data }) => {
              capturedUserId = data.userId;
              return { ...mockBooking, userId: data.userId };
            }),
          },
          product: { findUnique: jest.fn() },
          user: { findUnique: jest.fn() },
        };
        return callback(tx);
      });

      const handler = (await import('@/pages/api/bookings/index')).default;

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: validBody,
      });

      await handler(req, res);

      // userId deve vir do resolveOrCreateUser
      expect(capturedUserId).toBe('resolved-user-id');
    });
  });
});

// ===========================================================
// TESTES: /api/credits/purchase (checkout de créditos)
// ===========================================================
// NOTA: A lógica de identidade em credits/purchase é idêntica à de bookings
// Os testes abaixo validam que o código foi alterado corretamente
// através de verificação estática do código-fonte

describe('/api/credits/purchase - Regra de Identidade', () => {
  it('deve ter a mesma lógica de identidade que bookings (verificação estática)', async () => {
    // Lê o código-fonte para verificar que a lógica foi implementada
    const fs = await import('fs');
    const path = await import('path');
    
    const purchasePath = path.join(process.cwd(), 'src/pages/api/credits/purchase.ts');
    const content = fs.readFileSync(purchasePath, 'utf8');
    
    // Verifica que getAuthFromRequest é importado
    expect(content).toContain("import { getAuthFromRequest } from '@/lib/auth'");
    
    // Verifica que a lógica de sessão está presente
    expect(content).toContain('const auth = getAuthFromRequest(req)');
    expect(content).toContain('if (auth?.userId)');
    expect(content).toContain('userId = auth.userId');
    
    // Verifica que resolveOrCreateUser é usado no else (não logado)
    expect(content).toContain('resolveOrCreateUser(tx, {');
    expect(content).toContain('userId = user.id');
    
    // Verifica que userId é usado na criação do crédito
    expect(content).toContain('userId: userId,');
  });
});
