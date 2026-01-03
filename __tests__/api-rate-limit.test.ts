/**
 * Testes: API Rate Limit em memória
 */

import { 
  checkApiRateLimit, 
  getClientIp, 
  RATE_LIMIT_MESSAGE, 
  clearRateLimitStore,
  getRateLimitStoreSize,
} from '@/lib/api-rate-limit';

describe('api-rate-limit', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('checkApiRateLimit', () => {
    it('deve permitir primeira requisição', () => {
      const result = checkApiRateLimit('bookings', '192.168.1.1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 3-1 = 2
    });

    it('deve permitir requisições abaixo do limite', () => {
      const ip = '192.168.1.2';
      
      const r1 = checkApiRateLimit('bookings', ip);
      const r2 = checkApiRateLimit('bookings', ip);
      const r3 = checkApiRateLimit('bookings', ip);
      
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it('deve bloquear 4ª requisição (limite = 3)', () => {
      const ip = '192.168.1.3';
      
      checkApiRateLimit('bookings', ip);
      checkApiRateLimit('bookings', ip);
      checkApiRateLimit('bookings', ip);
      const r4 = checkApiRateLimit('bookings', ip);
      
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it('deve separar rate limit por endpoint', () => {
      const ip = '192.168.1.4';
      
      // 3 requisições em bookings
      checkApiRateLimit('bookings', ip);
      checkApiRateLimit('bookings', ip);
      checkApiRateLimit('bookings', ip);
      
      // Ainda deve permitir em outro endpoint
      const r1 = checkApiRateLimit('credits/purchase', ip);
      expect(r1.allowed).toBe(true);
    });

    it('deve separar rate limit por IP', () => {
      const endpoint = 'auth/login';
      
      // 3 requisições de IP1
      checkApiRateLimit(endpoint, '10.0.0.1');
      checkApiRateLimit(endpoint, '10.0.0.1');
      checkApiRateLimit(endpoint, '10.0.0.1');
      const r4 = checkApiRateLimit(endpoint, '10.0.0.1');
      
      // IP1 bloqueado
      expect(r4.allowed).toBe(false);
      
      // IP2 ainda liberado
      const r1_ip2 = checkApiRateLimit(endpoint, '10.0.0.2');
      expect(r1_ip2.allowed).toBe(true);
    });

    it('deve retornar resetAt no futuro', () => {
      const now = Date.now();
      const result = checkApiRateLimit('bookings', '192.168.1.5');
      
      expect(result.resetAt.getTime()).toBeGreaterThan(now);
    });

    it('deve aceitar config customizada', () => {
      const ip = '192.168.1.6';
      const config = { windowMs: 60000, maxRequests: 5 };
      
      for (let i = 0; i < 5; i++) {
        const r = checkApiRateLimit('custom', ip, config);
        expect(r.allowed).toBe(true);
      }
      
      const r6 = checkApiRateLimit('custom', ip, config);
      expect(r6.allowed).toBe(false);
    });
  });

  describe('getClientIp', () => {
    it('deve extrair IP do x-forwarded-for', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('deve usar x-real-ip se x-forwarded-for não existir', () => {
      const req = {
        headers: { 'x-real-ip': '198.51.100.178' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      
      expect(getClientIp(req)).toBe('198.51.100.178');
    });

    it('deve usar socket.remoteAddress como fallback', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      };
      
      expect(getClientIp(req)).toBe('192.168.1.100');
    });

    it('deve retornar "unknown" se nenhum IP disponível', () => {
      const req = {
        headers: {},
      };
      
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('RATE_LIMIT_MESSAGE', () => {
    it('deve ter mensagem genérica segura', () => {
      expect(RATE_LIMIT_MESSAGE).toBe('Muitas tentativas. Aguarde um momento antes de tentar novamente.');
    });
  });

  describe('clearRateLimitStore', () => {
    it('deve limpar o store', () => {
      checkApiRateLimit('test', '1.1.1.1');
      checkApiRateLimit('test', '2.2.2.2');
      
      expect(getRateLimitStoreSize()).toBe(2);
      
      clearRateLimitStore();
      
      expect(getRateLimitStoreSize()).toBe(0);
    });
  });
});
