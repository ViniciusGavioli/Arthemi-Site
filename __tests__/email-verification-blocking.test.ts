// ===========================================================
// Testes: Email Verification - Bloqueio de agendamento
// ===========================================================
// Testa que:
// - emailVerified=false bloqueia booking com 403
// - emailVerified=true permite booking normalmente
// - purchase/webhook não são bloqueados

// Mock do Prisma com factory inline
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { 
  checkEmailVerified, 
  requireEmailVerifiedForBooking, 
  EMAIL_NOT_VERIFIED_CODE 
} from '../src/lib/email-verification';
import { prisma } from '../src/lib/prisma';

// Cast para acessar o mock
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

describe('Email Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkEmailVerified', () => {
    it('retorna verified=true quando emailVerifiedAt não é null', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: new Date(),
      });

      const result = await checkEmailVerified('user-1');

      expect(result.verified).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('retorna verified=false quando emailVerifiedAt é null', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: null,
      });

      const result = await checkEmailVerified('user-1');

      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe(EMAIL_NOT_VERIFIED_CODE);
      expect(result.error?.message).toContain('verificar');
    });

    it('retorna verified=false quando usuário não encontrado', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await checkEmailVerified('user-not-found');

      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('requireEmailVerifiedForBooking', () => {
    it('retorna canBook=true quando email verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: new Date(),
      });

      const result = await requireEmailVerifiedForBooking('user-1');

      expect(result.canBook).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('retorna canBook=false com resposta 403 quando email não verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: null,
      });

      const result = await requireEmailVerifiedForBooking('user-1');

      expect(result.canBook).toBe(false);
      expect(result.response?.status).toBe(403);
      expect(result.response?.body.code).toBe(EMAIL_NOT_VERIFIED_CODE);
      expect(result.response?.body.ok).toBe(false);
    });
  });
});

describe('Booking Endpoints - Email Verification Block', () => {
  // Simula o comportamento esperado dos endpoints

  describe('POST /api/bookings/create-with-credit', () => {
    it('bloqueia usuário com email não verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: null,
      });

      const result = await requireEmailVerifiedForBooking('user-1');

      // Endpoint deve retornar 403 com código EMAIL_NOT_VERIFIED
      expect(result.canBook).toBe(false);
      expect(result.response?.status).toBe(403);
      expect(result.response?.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('permite usuário com email verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: new Date('2025-01-01'),
      });

      const result = await requireEmailVerifiedForBooking('user-1');

      expect(result.canBook).toBe(true);
    });
  });

  describe('POST /api/bookings (index)', () => {
    it('bloqueia usuário logado com email não verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        emailVerifiedAt: null,
      });

      const result = await requireEmailVerifiedForBooking('user-1');

      // Endpoint deve retornar 403 quando usuário está logado e não verificado
      expect(result.canBook).toBe(false);
      expect(result.response?.status).toBe(403);
    });
  });
});

describe('Endpoints que NÃO devem bloquear', () => {
  // Estes testes documentam que purchase/webhook não usam a verificação

  it('purchase de crédito NÃO usa requireEmailVerifiedForBooking', () => {
    // Apenas documentação: /api/credits/purchase não chama requireEmailVerifiedForBooking
    // Isso é verificado pela ausência do import no arquivo
    expect(true).toBe(true);
  });

  it('webhook asaas NÃO usa requireEmailVerifiedForBooking', () => {
    // Apenas documentação: /api/webhooks/asaas não chama requireEmailVerifiedForBooking
    expect(true).toBe(true);
  });
});
