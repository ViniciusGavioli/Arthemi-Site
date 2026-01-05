// ===========================================================
// Testes: Janela de Reserva de 30 Dias
// ===========================================================
// Valida que nenhuma reserva pode ser feita além de 30 dias

import { 
  validateUniversalBookingWindow,
  getUniversalMaxBookingDate,
  MAX_BOOKING_WINDOW_DAYS,
} from '@/lib/business-rules';
import { addDays, startOfDay, subDays } from 'date-fns';

describe('Booking Window - 30 Days Limit', () => {
  describe('validateUniversalBookingWindow', () => {
    it('deve permitir reserva para amanhã (dentro de 30 dias)', () => {
      const tomorrow = addDays(startOfDay(new Date()), 1);
      const result = validateUniversalBookingWindow(tomorrow);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve permitir reserva para daqui a 15 dias (dentro de 30 dias)', () => {
      const in15Days = addDays(startOfDay(new Date()), 15);
      const result = validateUniversalBookingWindow(in15Days);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve permitir reserva para exatamente 30 dias (limite)', () => {
      const in30Days = addDays(startOfDay(new Date()), 30);
      const result = validateUniversalBookingWindow(in30Days);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve BLOQUEAR reserva para 31 dias (além do limite)', () => {
      const in31Days = addDays(startOfDay(new Date()), 31);
      const result = validateUniversalBookingWindow(in31Days);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('30 dias');
    });

    it('deve BLOQUEAR reserva para 45 dias (muito além do limite)', () => {
      const in45Days = addDays(startOfDay(new Date()), 45);
      const result = validateUniversalBookingWindow(in45Days);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('30 dias');
    });

    it('deve BLOQUEAR reserva para 1 ano no futuro', () => {
      const in365Days = addDays(startOfDay(new Date()), 365);
      const result = validateUniversalBookingWindow(in365Days);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('30 dias');
    });

    it('deve BLOQUEAR reserva para o passado', () => {
      const yesterday = subDays(startOfDay(new Date()), 1);
      const result = validateUniversalBookingWindow(yesterday);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('passado');
    });

    it('deve retornar maxDate corretamente', () => {
      const tomorrow = addDays(startOfDay(new Date()), 1);
      const result = validateUniversalBookingWindow(tomorrow);
      
      const expectedMaxDate = addDays(startOfDay(new Date()), MAX_BOOKING_WINDOW_DAYS);
      expect(result.maxDate.getTime()).toBe(expectedMaxDate.getTime());
    });
  });

  describe('getUniversalMaxBookingDate', () => {
    it('deve retornar data 30 dias a partir de hoje', () => {
      const maxDate = getUniversalMaxBookingDate();
      const expected = addDays(startOfDay(new Date()), MAX_BOOKING_WINDOW_DAYS);
      
      expect(maxDate.getTime()).toBe(expected.getTime());
    });
  });

  describe('Constantes', () => {
    it('MAX_BOOKING_WINDOW_DAYS deve ser 30', () => {
      expect(MAX_BOOKING_WINDOW_DAYS).toBe(30);
    });
  });
});
