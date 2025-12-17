// ===========================================================
// Testes: Utilitários
// ===========================================================

import { formatCurrency, formatDate, getHoursDiff, slugify } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('deve formatar valores em centavos para BRL', () => {
      // Intl.NumberFormat usa non-breaking space (U+00A0), normalizamos para comparar
      const normalize = (s: string) => s.replace(/\s/g, ' ');
      expect(normalize(formatCurrency(7000))).toBe('R$ 70,00');
      expect(normalize(formatCurrency(24000))).toBe('R$ 240,00');
      expect(normalize(formatCurrency(0))).toBe('R$ 0,00');
      expect(normalize(formatCurrency(99))).toBe('R$ 0,99');
    });
  });

  describe('formatDate', () => {
    it('deve formatar data para formato brasileiro', () => {
      // Usa horário explícito para evitar problemas de timezone
      const date = new Date(2025, 11, 17); // Mês 11 = Dezembro
      expect(formatDate(date)).toBe('17/12/2025');
    });

    it('deve aceitar string ISO', () => {
      // Usa data no meio do dia para evitar troca de dia por timezone
      expect(formatDate('2025-12-17T12:00:00')).toBe('17/12/2025');
    });
  });

  describe('getHoursDiff', () => {
    it('deve calcular diferença em horas', () => {
      const start = new Date('2025-12-17T08:00:00');
      const end = new Date('2025-12-17T10:00:00');
      expect(getHoursDiff(start, end)).toBe(2);
    });

    it('deve retornar valor absoluto', () => {
      const start = new Date('2025-12-17T10:00:00');
      const end = new Date('2025-12-17T08:00:00');
      expect(getHoursDiff(start, end)).toBe(2);
    });
  });

  describe('slugify', () => {
    it('deve converter texto para slug', () => {
      expect(slugify('Sala A')).toBe('sala-a');
      expect(slugify('Pacote 4 Horas')).toBe('pacote-4-horas');
      expect(slugify('Espaço Arthemi')).toBe('espaco-arthemi');
    });

    it('deve remover acentos', () => {
      expect(slugify('Café')).toBe('cafe');
      expect(slugify('São Paulo')).toBe('sao-paulo');
    });
  });
});
