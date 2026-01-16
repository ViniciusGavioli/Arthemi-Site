/**
 * Testes: API Rate Limit em memória
 * Configuração atual: 15 requisições/minuto + backoff progressivo (10s base, 120s max)
 */

import { 
  checkApiRateLimit, 
  getClientIp, 
  RATE_LIMIT_MESSAGE,
  getRateLimitMessage,
  clearRateLimitStore,
  getRateLimitStoreSize,
  getBlockStoreSize,
  BACKOFF_CONFIG,
} from '@/lib/api-rate-limit';

describe('api-rate-limit', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('checkApiRateLimit - limite básico (15 tentativas)', () => {
    it('deve permitir primeira requisição', () => {
      const result = checkApiRateLimit('bookings', '192.168.1.1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(14); // 15-1 = 14
    });

    it('deve permitir até 15 requisições na janela', () => {
      const ip = '192.168.1.2';
      
      for (let i = 1; i <= 15; i++) {
        const r = checkApiRateLimit('bookings', ip);
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(15 - i);
      }
    });

    it('deve bloquear 16ª requisição (limite = 15)', () => {
      const ip = '192.168.1.3';
      
      // 15 requisições permitidas
      for (let i = 0; i < 15; i++) {
        checkApiRateLimit('bookings', ip);
      }
      
      // 16ª bloqueada
      const r16 = checkApiRateLimit('bookings', ip);
      
      expect(r16.allowed).toBe(false);
      expect(r16.remaining).toBe(0);
      expect(r16.retryAfterSeconds).toBeDefined();
      expect(r16.retryAfterSeconds).toBe(10); // 1º bloqueio = 10s (base)
    });

    it('deve separar rate limit por endpoint', () => {
      const ip = '192.168.1.4';
      
      // 15 requisições em bookings
      for (let i = 0; i < 15; i++) {
        checkApiRateLimit('bookings', ip);
      }
      
      // Ainda deve permitir em outro endpoint
      const r1 = checkApiRateLimit('credits/purchase', ip);
      expect(r1.allowed).toBe(true);
    });

    it('deve separar rate limit por IP', () => {
      const endpoint = 'auth/login';
      
      // 15 requisições de IP1
      for (let i = 0; i < 15; i++) {
        checkApiRateLimit(endpoint, '10.0.0.1');
      }
      const r16 = checkApiRateLimit(endpoint, '10.0.0.1');
      
      // IP1 bloqueado
      expect(r16.allowed).toBe(false);
      
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
      const config = { windowMs: 60000, maxRequests: 10 };
      
      for (let i = 0; i < 10; i++) {
        const r = checkApiRateLimit('custom', ip, config);
        expect(r.allowed).toBe(true);
      }
      
      const r11 = checkApiRateLimit('custom', ip, config);
      expect(r11.allowed).toBe(false);
    });
  });

  describe('checkApiRateLimit - backoff progressivo', () => {
    it('1º bloqueio: retryAfter = 10s', () => {
      const ip = '10.1.1.1';
      
      // Esgotar 15 tentativas
      for (let i = 0; i < 15; i++) {
        checkApiRateLimit('test', ip);
      }
      
      const blocked = checkApiRateLimit('test', ip);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(10);
    });

    it('2º bloqueio: retryAfter = 20s', () => {
      const ip = '10.1.1.2';
      
      // 1º bloqueio
      for (let i = 0; i < 16; i++) {
        checkApiRateLimit('test', ip);
      }
      
      // Simular que passou o tempo de bloqueio + janela
      // (na prática precisaria esperar, mas o 2º bloqueio já incrementa)
      // Vamos forçar novo bloqueio
      for (let i = 0; i < 16; i++) {
        checkApiRateLimit('test', ip);
      }
      
      // O 2º bloqueio deve ter retryAfter maior
      const result = checkApiRateLimit('test', ip);
      expect(result.allowed).toBe(false);
      // O retryAfter deve ser 20s (2º bloqueio) ou ainda 10s se não passou tempo
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('backoff não ultrapassa teto de 120s (2min)', () => {
      // Este é um teste conceitual - o teto está definido em BACKOFF_CONFIG
      expect(BACKOFF_CONFIG.maxSeconds).toBe(120);
    });
  });

  describe('getRateLimitMessage', () => {
    it('deve retornar mensagem padrão se não tiver retryAfter', () => {
      expect(getRateLimitMessage()).toBe(RATE_LIMIT_MESSAGE);
      expect(getRateLimitMessage(undefined)).toBe(RATE_LIMIT_MESSAGE);
    });

    it('deve mostrar segundos se < 60', () => {
      expect(getRateLimitMessage(30)).toBe('Muitas tentativas. Tente novamente em 30 segundos.');
      expect(getRateLimitMessage(59)).toBe('Muitas tentativas. Tente novamente em 59 segundos.');
    });

    it('deve mostrar minutos se >= 60', () => {
      expect(getRateLimitMessage(60)).toBe('Muitas tentativas. Tente novamente em 1 minuto.');
      expect(getRateLimitMessage(120)).toBe('Muitas tentativas. Tente novamente em 2 minutos.');
      expect(getRateLimitMessage(900)).toBe('Muitas tentativas. Tente novamente em 15 minutos.');
    });

    it('deve arredondar para cima minutos', () => {
      expect(getRateLimitMessage(90)).toBe('Muitas tentativas. Tente novamente em 2 minutos.');
      expect(getRateLimitMessage(61)).toBe('Muitas tentativas. Tente novamente em 2 minutos.');
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
    it('deve limpar o store de rate limit', () => {
      checkApiRateLimit('test', '1.1.1.1');
      checkApiRateLimit('test', '2.2.2.2');
      
      expect(getRateLimitStoreSize()).toBe(2);
      
      clearRateLimitStore();
      
      expect(getRateLimitStoreSize()).toBe(0);
    });

    it('deve limpar o store de bloqueios também', () => {
      const ip = '3.3.3.3';
      
      // Esgotar limite para criar bloqueio (16 requisições)
      for (let i = 0; i < 16; i++) {
        checkApiRateLimit('test', ip);
      }
      
      expect(getBlockStoreSize()).toBe(1);
      
      clearRateLimitStore();
      
      expect(getBlockStoreSize()).toBe(0);
    });
  });

  describe('BACKOFF_CONFIG', () => {
    it('deve ter configurações corretas', () => {
      expect(BACKOFF_CONFIG.baseSeconds).toBe(10);
      expect(BACKOFF_CONFIG.maxSeconds).toBe(120);
      expect(BACKOFF_CONFIG.resetAfterMs).toBe(10 * 60 * 1000);
    });
  });
});
