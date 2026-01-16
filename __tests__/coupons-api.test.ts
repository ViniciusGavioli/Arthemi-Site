// ===========================================================
// Testes: API /api/coupons/validate
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/coupons/validate';

// Helper para criar mock request
function createMockRequest(body: Record<string, unknown>, method = 'POST'): NextApiRequest {
  return {
    method,
    body,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest;
}

// Helper para criar mock response
function createMockResponse(): NextApiResponse & { 
  _statusCode: number; 
  _json: Record<string, unknown>;
} {
  const res: { 
    _statusCode: number; 
    _json: Record<string, unknown>; 
    status: (code: number) => typeof res;
    json: (data: Record<string, unknown>) => typeof res;
    setHeader: () => typeof res;
  } = {
    _statusCode: 200,
    _json: {},
    status(code: number) {
      res._statusCode = code;
      return res;
    },
    json(data: Record<string, unknown>) {
      res._json = data;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  
  return res as unknown as NextApiResponse & { _statusCode: number; _json: Record<string, unknown> };
}

describe('API /api/coupons/validate', () => {
  describe('método HTTP', () => {
    it('rejeita GET com 405', async () => {
      const req = createMockRequest({}, 'GET');
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(405);
      expect(res._json.error).toBeDefined();
    });

    it('rejeita PUT com 405', async () => {
      const req = createMockRequest({}, 'PUT');
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(405);
    });
  });

  describe('validação de parâmetros', () => {
    it('requer code', async () => {
      const req = createMockRequest({ grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(400);
      expect(res._json.message).toBeDefined();
    });

    it('requer grossAmount', async () => {
      const req = createMockRequest({ code: 'ARTHEMI10' });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(400);
      expect(res._json.message).toBeDefined();
    });

    it('grossAmount deve ser número positivo', async () => {
      const req = createMockRequest({ code: 'ARTHEMI10', grossAmount: -100 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(400);
    });
  });

  describe('validação de cupom', () => {
    it('retorna sucesso para cupom válido ARTHEMI10 (10%)', async () => {
      const req = createMockRequest({ code: 'ARTHEMI10', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.valid).toBe(true);
      expect(res._json.code).toBe('ARTHEMI10');
      expect(res._json.grossAmount).toBe(10000);
      expect(res._json.discountAmount).toBe(1000); // 10% de R$100
      expect(res._json.netAmount).toBe(9000);
    });

    it('retorna sucesso para cupom TESTE50 (DEV coupon R$5)', async () => {
      const req = createMockRequest({ code: 'TESTE50', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.valid).toBe(true);
      expect(res._json.discountAmount).toBe(500); // R$5,00 fixo
      expect(res._json.netAmount).toBe(9500);
    });

    it('retorna sucesso para cupom PRIMEIRACOMPRA (15%)', async () => {
      const req = createMockRequest({ code: 'PRIMEIRACOMPRA', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.valid).toBe(true);
      expect(res._json.discountAmount).toBe(1500); // 15%
      expect(res._json.netAmount).toBe(8500);
    });

    it('retorna erro para cupom inválido', async () => {
      const req = createMockRequest({ code: 'NAOVALIDO', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(400);
      expect(res._json.valid).toBe(false);
      expect(res._json.message).toContain('inválido');
    });

    it('normaliza código do cupom (case insensitive)', async () => {
      const req = createMockRequest({ code: 'arthemi10', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.valid).toBe(true);
      expect(res._json.code).toBe('ARTHEMI10'); // Normalizado
    });

    it('normaliza código com espaços', async () => {
      const req = createMockRequest({ code: '  ARTHEMI10  ', grossAmount: 10000 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.valid).toBe(true);
      expect(res._json.code).toBe('ARTHEMI10');
    });
  });

  describe('cálculos', () => {
    it('calcula desconto para valor grande (R$839,80)', async () => {
      const req = createMockRequest({ code: 'ARTHEMI10', grossAmount: 83980 });
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      expect(res._json.grossAmount).toBe(83980);
      expect(res._json.discountAmount).toBe(8398); // 10%
      expect(res._json.netAmount).toBe(75582);
    });

    it('respeita valor mínimo R$1,00', async () => {
      const req = createMockRequest({ code: 'PRIMEIRACOMPRA', grossAmount: 300 }); // R$3,00
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      // Desconto de 15% de R$3 = R$0,45
      // netAmount = R$3 - R$0,45 = R$2,55 = 255 centavos
      expect(res._json.netAmount).toBeGreaterThanOrEqual(100); // Mínimo R$1,00
    });

    it('valor < R$1 sem piso: netAmount pode ser 0', async () => {
      const req = createMockRequest({ code: 'PRIMEIRACOMPRA', grossAmount: 50 }); // R$0,50
      const res = createMockResponse();
      
      await handler(req, res);
      
      expect(res._statusCode).toBe(200);
      // 15% de 50 = 7 centavos de desconto
      expect(res._json.netAmount).toBeGreaterThanOrEqual(0);
    });
  });
});
