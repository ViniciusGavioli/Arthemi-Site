// ===========================================================
// Testes: Blindagem de Produção
// ===========================================================
// Valida:
// - Timeout de operações
// - Mensagens de erro seguras
// - Helper de verificação de duplicidade

import {
  withTimeout,
  getSafeErrorMessage,
  paymentExists,
  bookingWithPaymentExists,
  cpfInUseByOther,
  checkSlotConflict,
  TIMEOUTS,
} from '@/lib/production-safety';

// Mock do Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findFirst: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

// ===========================================================
// TESTES: withTimeout
// ===========================================================

describe('withTimeout', () => {
  it('deve resolver quando operação completa antes do timeout', async () => {
    const fastOperation = () => Promise.resolve('success');
    
    const result = await withTimeout(fastOperation(), 1000, 'operação rápida');
    
    expect(result).toBe('success');
  });

  it('deve rejeitar quando operação excede timeout', async () => {
    const slowOperation = () => new Promise((resolve) => 
      setTimeout(() => resolve('late'), 500)
    );
    
    await expect(
      withTimeout(slowOperation(), 100, 'operação lenta')
    ).rejects.toThrow('Timeout: operação lenta excedeu 100ms');
  });

  it('deve propagar erro original se operação falhar antes do timeout', async () => {
    const failingOperation = () => Promise.reject(new Error('Erro original'));
    
    await expect(
      withTimeout(failingOperation(), 1000, 'operação falha')
    ).rejects.toThrow('Erro original');
  });
});

// ===========================================================
// TESTES: getSafeErrorMessage
// ===========================================================

describe('getSafeErrorMessage', () => {
  beforeEach(() => {
    // Silenciar console.error nos testes
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve retornar mensagem segura para CONFLICT', () => {
    const error = new Error('CONFLICT');
    const result = getSafeErrorMessage(error, 'test');
    
    expect(result).toBe('Horário não disponível. Já existe uma reserva neste período.');
  });

  it('deve retornar mensagem segura para timeout', () => {
    const error = new Error('Timeout: operação excedeu 15000ms');
    const result = getSafeErrorMessage(error, 'test');
    
    expect(result).toBe('Operação demorou muito. Tente novamente.');
  });

  it('deve retornar mensagem segura para CPF inválido', () => {
    const error = new Error('CPF_INVALIDO');
    const result = getSafeErrorMessage(error, 'test');
    
    expect(result).toBe('CPF inválido. Verifique os dados e tente novamente.');
  });

  it('deve retornar mensagem genérica para erros desconhecidos', () => {
    const error = new Error('Prisma Internal Error XYZ123');
    const result = getSafeErrorMessage(error, 'test');
    
    expect(result).toBe('Erro ao processar solicitação. Tente novamente.');
  });

  it('NÃO deve expor detalhes internos', () => {
    const error = new Error('P2002: Unique constraint failed on field: email');
    const result = getSafeErrorMessage(error, 'test');
    
    expect(result).not.toContain('P2002');
    expect(result).not.toContain('constraint');
    expect(result).not.toContain('email');
  });

  it('deve logar erro completo no servidor', () => {
    const error = new Error('Erro detalhado interno');
    getSafeErrorMessage(error, 'contexto-teste');
    
    expect(console.error).toHaveBeenCalledWith(
      '❌ [contexto-teste] ERRO:',
      expect.objectContaining({
        message: 'Erro detalhado interno',
      })
    );
  });
});

// ===========================================================
// TESTES: paymentExists
// ===========================================================

describe('paymentExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar true se pagamento existe', async () => {
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'pay-123' });
    
    const result = await paymentExists('ext-123');
    
    expect(result).toBe(true);
    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { externalId: 'ext-123' },
      select: { id: true },
    });
  });

  it('deve retornar false se pagamento não existe', async () => {
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    
    const result = await paymentExists('ext-999');
    
    expect(result).toBe(false);
  });
});

// ===========================================================
// TESTES: bookingWithPaymentExists
// ===========================================================

describe('bookingWithPaymentExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar true se booking com paymentId existe', async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ id: 'book-123' });
    
    const result = await bookingWithPaymentExists('pay-123');
    
    expect(result).toBe(true);
  });

  it('deve retornar false se não existe', async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
    
    const result = await bookingWithPaymentExists('pay-999');
    
    expect(result).toBe(false);
  });
});

// ===========================================================
// TESTES: cpfInUseByOther
// ===========================================================

describe('cpfInUseByOther', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar false para CPF vazio', async () => {
    const result = await cpfInUseByOther('');
    
    expect(result).toBe(false);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('deve retornar true se CPF está em uso por outro usuário', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'other-user' });
    
    const result = await cpfInUseByOther('12345678909', 'my-user-id');
    
    expect(result).toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        cpf: '12345678909',
        id: { not: 'my-user-id' },
      },
      select: { id: true },
    });
  });

  it('deve retornar false se CPF não está em uso', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    
    const result = await cpfInUseByOther('12345678909');
    
    expect(result).toBe(false);
  });
});

// ===========================================================
// TESTES: TIMEOUTS constantes
// ===========================================================

describe('TIMEOUTS', () => {
  it('deve ter valores razoáveis definidos', () => {
    expect(TIMEOUTS.BOOKING_CREATE).toBeGreaterThanOrEqual(10000);
    expect(TIMEOUTS.PAYMENT_CREATE).toBeGreaterThanOrEqual(15000);
    expect(TIMEOUTS.DB_SIMPLE).toBeGreaterThanOrEqual(3000);
    expect(TIMEOUTS.DB_TRANSACTION).toBeGreaterThanOrEqual(20000);
  });
});

// ===========================================================
// TESTES: checkSlotConflict
// ===========================================================

describe('checkSlotConflict', () => {
  it('deve retornar hasConflict=false quando não há conflito', async () => {
    const mockTx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    
    const result = await checkSlotConflict(
      mockTx as any,
      'room-1',
      new Date('2026-01-10T10:00:00Z'),
      new Date('2026-01-10T11:00:00Z')
    );
    
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingBookingId).toBeUndefined();
  });

  it('deve retornar hasConflict=true com ID quando há conflito', async () => {
    const mockTx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conflict-booking' }),
      },
    };
    
    const result = await checkSlotConflict(
      mockTx as any,
      'room-1',
      new Date('2026-01-10T10:00:00Z'),
      new Date('2026-01-10T11:00:00Z')
    );
    
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingBookingId).toBe('conflict-booking');
  });
});
