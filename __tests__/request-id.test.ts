/**
 * Testes: Observabilidade - Request ID e API Logging
 */

import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';

describe('request-id', () => {
  describe('generateRequestId', () => {
    it('deve gerar um ID único', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('deve ter formato timestamp-random', () => {
      const id = generateRequestId();
      
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });

    it('deve ter tamanho razoável', () => {
      const id = generateRequestId();
      
      expect(id.length).toBeGreaterThan(10);
      expect(id.length).toBeLessThan(30);
    });
  });

  describe('REQUEST_ID_HEADER', () => {
    it('deve ser x-request-id', () => {
      expect(REQUEST_ID_HEADER).toBe('x-request-id');
    });
  });
});
