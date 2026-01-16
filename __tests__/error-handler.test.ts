// ===========================================================
// TESTES: Sistema de Erros Padronizado
// ===========================================================

import {
  BusinessError,
  isBusinessError,
  errorToHttpResponse,
  BusinessErrorCode,
  ErrorCodeToStatus,
  isPrismaError,
  prismaErrorToBusinessError,
} from '@/lib/errors';

// ============================================================
// TESTES: BusinessError (Classe base)
// ============================================================

describe('BusinessError', () => {
  describe('Construtor', () => {
    it('cria erro com código e mensagem padrão', () => {
      const error = new BusinessError('COUPON_INVALID');
      
      expect(error.code).toBe('COUPON_INVALID');
      expect(error.status).toBe(400);
      expect(error.message).toBe('Cupom inválido ou não encontrado.');
      expect(error.isBusinessError).toBe(true);
    });

    it('cria erro com mensagem customizada', () => {
      const error = new BusinessError('COUPON_INVALID', 'Cupom ARTHEMI10 expirou');
      
      expect(error.code).toBe('COUPON_INVALID');
      expect(error.message).toBe('Cupom ARTHEMI10 expirou');
    });

    it('cria erro com details', () => {
      const error = new BusinessError('INSUFFICIENT_CREDITS', 'Saldo insuficiente', {
        availableCents: 5000,
        requiredCents: 10000,
      });
      
      expect(error.details).toEqual({
        availableCents: 5000,
        requiredCents: 10000,
      });
    });
  });

  describe('Factory methods', () => {
    it('couponInvalid()', () => {
      const error = BusinessError.couponInvalid('Cupom expirado');
      
      expect(error.code).toBe('COUPON_INVALID');
      expect(error.status).toBe(400);
      expect(error.message).toBe('Cupom expirado');
    });

    it('couponAlreadyUsed()', () => {
      const error = BusinessError.couponAlreadyUsed('ARTHEMI10');
      
      expect(error.code).toBe('COUPON_ALREADY_USED');
      expect(error.status).toBe(400);
      expect(error.details?.couponCode).toBe('ARTHEMI10');
    });

    it('insufficientCredits()', () => {
      const error = BusinessError.insufficientCredits(5000, 10000);
      
      expect(error.code).toBe('INSUFFICIENT_CREDITS');
      expect(error.status).toBe(400);
      expect(error.message).toContain('R$ 50.00');
      expect(error.message).toContain('R$ 100.00');
      expect(error.details).toEqual({
        availableCents: 5000,
        requiredCents: 10000,
      });
    });

    it('creditConsumedByAnother()', () => {
      const error = BusinessError.creditConsumedByAnother('credit-123');
      
      expect(error.code).toBe('CREDIT_CONSUMED_BY_ANOTHER');
      expect(error.status).toBe(409);
      expect(error.details?.creditId).toBe('credit-123');
    });

    it('bookingConflict()', () => {
      const error = BusinessError.bookingConflict();
      
      expect(error.code).toBe('BOOKING_CONFLICT');
      expect(error.status).toBe(409);
    });

    it('emailNotVerified()', () => {
      const error = BusinessError.emailNotVerified();
      
      expect(error.code).toBe('EMAIL_NOT_VERIFIED');
      expect(error.status).toBe(403);
    });

    it('paymentMinAmount()', () => {
      const error = BusinessError.paymentMinAmount(500, 300, 'PIX');
      
      expect(error.code).toBe('PAYMENT_MIN_AMOUNT');
      expect(error.status).toBe(400);
      expect(error.message).toContain('R$ 3.00');
      expect(error.message).toContain('R$ 5.00');
      expect(error.message).toContain('PIX');
    });

    it('rateLimited()', () => {
      const resetAt = new Date('2026-01-15T14:30:00');
      const error = BusinessError.rateLimited(resetAt);
      
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.status).toBe(429);
      expect(error.message).toContain('14:30:00');
    });
  });

  describe('toJSON()', () => {
    it('serializa corretamente sem requestId', () => {
      const error = new BusinessError('COUPON_INVALID', 'Cupom expirou');
      const json = error.toJSON();
      
      expect(json).toEqual({
        success: false,
        code: 'COUPON_INVALID',
        error: 'Cupom expirou',
      });
    });

    it('serializa corretamente com requestId', () => {
      const error = new BusinessError('COUPON_INVALID', 'Cupom expirou');
      const json = error.toJSON('req-123');
      
      expect(json).toEqual({
        success: false,
        code: 'COUPON_INVALID',
        error: 'Cupom expirou',
        requestId: 'req-123',
      });
    });

    it('inclui details quando presente', () => {
      const error = BusinessError.insufficientCredits(5000, 10000);
      const json = error.toJSON('req-123');
      
      expect(json).toHaveProperty('details');
      expect((json as { details: object }).details).toEqual({
        availableCents: 5000,
        requiredCents: 10000,
      });
    });
  });

  describe('isBusinessError()', () => {
    it('retorna true para BusinessError', () => {
      const error = new BusinessError('COUPON_INVALID');
      expect(isBusinessError(error)).toBe(true);
    });

    it('retorna false para Error comum', () => {
      const error = new Error('Erro qualquer');
      expect(isBusinessError(error)).toBe(false);
    });

    it('retorna false para null/undefined', () => {
      expect(isBusinessError(null)).toBe(false);
      expect(isBusinessError(undefined)).toBe(false);
    });
  });
});

// ============================================================
// TESTES: errorToHttpResponse (Parser central)
// ============================================================

describe('errorToHttpResponse', () => {
  describe('BusinessError (classe nova)', () => {
    it('converte BusinessError corretamente', () => {
      const error = BusinessError.couponAlreadyUsed('ARTHEMI10');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed).toEqual({
        status: 400,
        code: 'COUPON_ALREADY_USED',
        message: 'Este cupom já foi utilizado.',
        details: { couponCode: 'ARTHEMI10' },
      });
    });
  });

  describe('Erros legados (compatibilidade)', () => {
    it('parseia CUPOM_INVALIDO: ...', () => {
      const error = new Error('CUPOM_INVALIDO: Cupom ARTHEMI10 já foi utilizado para este tipo de operação.');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('COUPON_INVALID');
      expect(parsed.message).toBe('Cupom ARTHEMI10 já foi utilizado para este tipo de operação.');
    });

    it('parseia COUPON_ALREADY_USED:CODE', () => {
      const error = new Error('COUPON_ALREADY_USED:ARTHEMI10');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('COUPON_ALREADY_USED');
      expect(parsed.details?.couponCode).toBe('ARTHEMI10');
    });

    it('parseia INSUFFICIENT_CREDITS:available:required', () => {
      const error = new Error('INSUFFICIENT_CREDITS:5000:10000');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('INSUFFICIENT_CREDITS');
      expect(parsed.message).toContain('R$ 50.00');
      expect(parsed.message).toContain('R$ 100.00');
      expect(parsed.details).toEqual({
        availableCents: 5000,
        requiredCents: 10000,
      });
    });

    it('parseia CREDIT_CONSUMED_BY_ANOTHER:creditId', () => {
      const error = new Error('CREDIT_CONSUMED_BY_ANOTHER:credit-123');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(409);
      expect(parsed.code).toBe('CREDIT_CONSUMED_BY_ANOTHER');
      expect(parsed.details?.creditId).toBe('credit-123');
    });

    it('parseia CONFLICT', () => {
      const error = new Error('CONFLICT');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(409);
      expect(parsed.code).toBe('BOOKING_CONFLICT');
    });

    it('parseia TEMPO_INSUFICIENTE', () => {
      const error = new Error('TEMPO_INSUFICIENTE');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('INSUFFICIENT_TIME');
    });

    it('parseia EMAIL_NOT_VERIFIED', () => {
      const error = new Error('EMAIL_NOT_VERIFIED');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(403);
      expect(parsed.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('parseia PRICING_ERROR: ...', () => {
      const error = new Error('PRICING_ERROR: Erro ao calcular preço');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('PRICING_ERROR');
      expect(parsed.message).toBe('Erro ao calcular preço');
    });
  });

  describe('Erros Prisma', () => {
    it('converte P2002 (unique) para DUPLICATE_ENTRY', () => {
      const prismaError = { code: 'P2002', meta: { target: ['email'] } };
      const parsed = errorToHttpResponse(prismaError);
      
      expect(parsed.status).toBe(409);
      expect(parsed.code).toBe('DUPLICATE_ENTRY');
      expect(parsed.message).toContain('e-mail');
    });

    it('converte P2025 (not found) para NOT_FOUND', () => {
      const prismaError = { code: 'P2025' };
      const parsed = errorToHttpResponse(prismaError);
      
      expect(parsed.status).toBe(404);
      expect(parsed.code).toBe('NOT_FOUND');
    });
  });

  describe('Erros genéricos', () => {
    it('converte erro desconhecido para 500 INTERNAL_ERROR', () => {
      const error = new Error('Algo deu errado internamente');
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBe(500);
      expect(parsed.code).toBe('INTERNAL_ERROR');
      // NÃO deve vazar a mensagem original
      expect(parsed.message).toBe('Erro interno. Tente novamente.');
    });

    it('não vaza stack trace', () => {
      const error = new Error('Erro com stack');
      error.stack = 'at someFunction (file.ts:123)';
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.message).not.toContain('file.ts');
      expect(parsed.message).not.toContain('someFunction');
    });
  });
});

// ============================================================
// TESTES: Mapeamento de status HTTP
// ============================================================

describe('ErrorCodeToStatus', () => {
  it('erros de cupom são 400', () => {
    expect(ErrorCodeToStatus.COUPON_INVALID).toBe(400);
    expect(ErrorCodeToStatus.COUPON_ALREADY_USED).toBe(400);
    expect(ErrorCodeToStatus.COUPON_EXPIRED).toBe(400);
  });

  it('erros de crédito insuficiente são 400', () => {
    expect(ErrorCodeToStatus.INSUFFICIENT_CREDITS).toBe(400);
  });

  it('erros de conflito/race condition são 409', () => {
    expect(ErrorCodeToStatus.BOOKING_CONFLICT).toBe(409);
    expect(ErrorCodeToStatus.CREDIT_CONSUMED_BY_ANOTHER).toBe(409);
    expect(ErrorCodeToStatus.DUPLICATE_ENTRY).toBe(409);
  });

  it('erros de permissão são 403', () => {
    expect(ErrorCodeToStatus.EMAIL_NOT_VERIFIED).toBe(403);
    expect(ErrorCodeToStatus.FORBIDDEN).toBe(403);
  });

  it('rate limit é 429', () => {
    expect(ErrorCodeToStatus.RATE_LIMITED).toBe(429);
  });

  it('apenas INTERNAL_ERROR é 500', () => {
    const codes500 = Object.entries(ErrorCodeToStatus)
      .filter(([, status]) => status === 500)
      .map(([code]) => code);
    
    expect(codes500).toEqual(['INTERNAL_ERROR']);
  });
});

// ============================================================
// TESTES: Prisma error handlers
// ============================================================

describe('isPrismaError', () => {
  it('identifica erro Prisma corretamente', () => {
    expect(isPrismaError({ code: 'P2002' })).toBe(true);
    expect(isPrismaError({ code: 'P2025' })).toBe(true);
  });

  it('rejeita erros não-Prisma', () => {
    expect(isPrismaError(new Error('qualquer'))).toBe(false);
    expect(isPrismaError({ code: 'NOT_PRISMA' })).toBe(false);
    expect(isPrismaError(null)).toBe(false);
    expect(isPrismaError('string')).toBe(false);
  });
});

describe('prismaErrorToBusinessError', () => {
  it('converte P2002 com target coupon para COUPON_ALREADY_USED', () => {
    const error = { code: 'P2002', meta: { target: ['coupon_usage'] } };
    const result = prismaErrorToBusinessError(error);
    
    expect(result?.code).toBe('COUPON_ALREADY_USED');
  });

  it('converte P2002 genérico para DUPLICATE_ENTRY', () => {
    const error = { code: 'P2002', meta: { target: ['some_field'] } };
    const result = prismaErrorToBusinessError(error);
    
    expect(result?.code).toBe('DUPLICATE_ENTRY');
  });

  it('converte P2025 para NOT_FOUND', () => {
    const error = { code: 'P2025' };
    const result = prismaErrorToBusinessError(error);
    
    expect(result?.code).toBe('NOT_FOUND');
  });

  it('retorna null para erro não mapeável', () => {
    const error = { code: 'P9999' }; // Código inexistente
    const result = prismaErrorToBusinessError(error);
    
    expect(result).toBeNull();
  });
});

// ============================================================
// TESTES: Snapshot do payload padronizado
// ============================================================

describe('Payload padronizado (snapshot)', () => {
  it('erro de cupom inválido', () => {
    const error = BusinessError.couponInvalid('Cupom ARTHEMI10 já foi utilizado');
    const json = error.toJSON('req-abc-123');
    
    expect(json).toMatchSnapshot();
  });

  it('erro de créditos insuficientes', () => {
    const error = BusinessError.insufficientCredits(5000, 10000);
    const json = error.toJSON('req-def-456');
    
    expect(json).toMatchSnapshot();
  });

  it('erro de conflito de reserva', () => {
    const error = BusinessError.bookingConflict();
    const json = error.toJSON('req-ghi-789');
    
    expect(json).toMatchSnapshot();
  });
});

// ============================================================
// TESTES: Garantias de segurança
// ============================================================

describe('Segurança', () => {
  it('NUNCA vaza stack trace em erros 500', () => {
    const error = new Error('Erro interno com dados sensíveis');
    error.stack = 'at sensitiveFunction\n  password=123\n  cpf=12345678901';
    
    const parsed = errorToHttpResponse(error);
    
    expect(parsed.message).not.toContain('sensitiveFunction');
    expect(parsed.message).not.toContain('password');
    expect(parsed.message).not.toContain('cpf');
    expect(parsed.message).not.toContain('12345678901');
  });

  it('erros de negócio NUNCA viram 500', () => {
    const businessCodes: BusinessErrorCode[] = [
      'COUPON_INVALID',
      'COUPON_ALREADY_USED',
      'INSUFFICIENT_CREDITS',
      'CREDIT_CONSUMED_BY_ANOTHER',
      'BOOKING_CONFLICT',
      'INSUFFICIENT_TIME',
      'EMAIL_NOT_VERIFIED',
      'PRICING_ERROR',
    ];

    businessCodes.forEach(code => {
      const error = new BusinessError(code);
      const parsed = errorToHttpResponse(error);
      
      expect(parsed.status).toBeLessThan(500);
      expect(parsed.code).toBe(code);
    });
  });
});
