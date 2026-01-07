// ===========================================================
// Testes de Integração: Verificar remoção de room.hourlyRate
// ===========================================================
// Valida que P0 fixes usam PRICES_V3 em vez de DB

import {
  getBookingTotalByDate,
  getBookingTotalCentsByDate,
  getRoomHourlyPriceByDate,
} from '@/lib/pricing';
import { PRICES_V3 } from '@/constants/prices';

describe('P0 Integration Tests - PRICES_V3 vs Database', () => {
  // IMPORTANTE: Usar timezone -03:00 para garantir dia correto no Brasil
  const weekdayDate = new Date('2025-01-15T10:00:00-03:00'); // Quarta-feira
  const saturdayDate = new Date('2025-01-18T10:00:00-03:00'); // Sábado

  describe('1. payments/create.ts - Fallback sem produto deve usar PRICES_V3', () => {
    it('deve calcular payment em sábado com SATURDAY_HOUR, não com DB hourlyRate', () => {
      // Simula: booking.product = null, então cai no fallback
      // Antes (BUG): totalAmount = booking.room.hourlyRate * hours (não respeita sábado)
      // Depois (FIXED): totalAmount = getBookingTotalCentsByDate(...) usa PRICES_V3
      
      const roomId = 'room-sala-a';
      const hours = 2;
      
      const totalCents = getBookingTotalCentsByDate(roomId, saturdayDate, hours, 'sala-a');
      const totalReais = totalCents / 100;
      
      // SALA_A no sábado = 64.99/h (de PRICES_V3)
      // 2 horas = 129.98
      expect(totalReais).toBeCloseTo(64.99 * 2, 2);
      expect(totalReais).not.toBeCloseTo(59.99 * 2, 2); // Não deve usar weekday price
    });

    it('deve calcular payment em dia útil com HOURLY_RATE, não DB', () => {
      const roomId = 'room-sala-a';
      const hours = 3;
      
      const totalCents = getBookingTotalCentsByDate(roomId, weekdayDate, hours, 'sala-a');
      const totalReais = totalCents / 100;
      
      // SALA_A weekday = 59.99/h
      const expected = 59.99 * 3;
      expect(totalReais).toBeCloseTo(expected, 2);
    });

    it('deve manter precisão em centavos (não arredondar float)', () => {
      const roomId = 'room-sala-a';
      const hours = 3;
      
      const totalCents = getBookingTotalCentsByDate(roomId, saturdayDate, hours, 'sala-a');
      
      // Deve ser inteiro (centavos), sem casas decimais
      expect(Number.isInteger(totalCents)).toBe(true);
      
      // 64.99 * 3 = 194.97 reais = 19497 centavos
      expect(totalCents).toBe(19497);
    });
  });

  describe('2. credits/purchase.ts - Horas avulsas (data.hours) não deve usar DB', () => {
    it('deve calcular preço de horas avulsas com PRICES_V3 HOURLY_RATE', () => {
      // Simula: data.hours = 2, sem productId/productType
      // Antes (BUG): amount = room.hourlyRate * data.hours (DB fixo)
      // Depois (FIXED): amount = getBookingTotalByDate(realRoomId, new Date(), data.hours, room.slug)
      
      const roomId = 'room-sala-b';
      const hours = 2;
      
      // Usar weekdayDate para garantir preço de dia útil
      const totalReais = getBookingTotalByDate(roomId, weekdayDate, hours, 'sala-b');
      
      // SALA_B weekday = 49.99/h (de PRICES_V3)
      const expected = 49.99 * 2;
      expect(totalReais).toBeCloseTo(expected, 2);
    });

    it('creditAmount armazenado deve usar helper, não DB * creditHours', () => {
      // Simula: creditHours determinado, creditAmount calculado
      // Antes (BUG): creditAmount = creditHours * room.hourlyRate
      // Depois (FIXED): creditAmount = getBookingTotalByDate(...) * 100 (centavos)
      
      const roomId = 'room-sala-a';
      const creditHours = 4;
      
      const totalReais = getBookingTotalByDate(roomId, new Date(), creditHours, 'sala-a');
      const creditAmount = Math.round(totalReais * 100);
      
      // Deve ser centavos inteiros
      expect(Number.isInteger(creditAmount)).toBe(true);
      expect(creditAmount).toBeGreaterThan(0);
      
      // 59.99 * 4 = 239.96 reais = 23996 centavos
      expect(creditAmount).toBe(23996);
    });
  });

  describe('3. admin/bookings/create.ts - Fallback sem amount não usa DB', () => {
    it('deve calcular amount com helper quando data.amount = 0', () => {
      // Simula: data.amount = 0 (não informado)
      // Antes (BUG): calculatedAmount = room.hourlyRate * hours
      // Depois (FIXED): getBookingTotalByDate(data.roomId, startTime, hours, room.slug)
      
      const roomId = 'room-sala-c';
      const hours = 5;
      
      const amount = getBookingTotalByDate(roomId, saturdayDate, hours, 'sala-c');
      
      // SALA_C sábado = 51.99/h
      const expected = 51.99 * 5;
      expect(amount).toBeCloseTo(expected, 2);
    });

    it('deve respeitar sábado em booking criado por admin', () => {
      const roomId = 'room-sala-a';
      const hours = 2;
      
      const weekdayAmount = getBookingTotalByDate(roomId, weekdayDate, hours, 'sala-a');
      const saturdayAmount = getBookingTotalByDate(roomId, saturdayDate, hours, 'sala-a');
      
      // Sábado deve ser mais caro que dia útil
      expect(saturdayAmount).toBeGreaterThan(weekdayAmount);
      
      // Diferença: (64.99 - 59.99) * 2 = 10.00
      expect(saturdayAmount - weekdayAmount).toBeCloseTo(10.0, 1);
    });
  });

  describe('4. admin/bookings/[id].ts - valueDifference usa helper, não DB', () => {
    it('deve calcular valueDifference com preço correto quando edita duração em sábado', () => {
      // Simula: booking atual em sábado 2h, novo em sábado 4h (aumento 2h)
      // Antes (BUG): valueDifference = hoursDifference * booking.room.hourlyRate (DB)
      // Depois (FIXED): newValue - oldValue (ambos via helper)
      
      const roomId = 'room-sala-a';
      const oldHours = 2;
      const newHours = 4;
      const startTime = saturdayDate;
      
      const oldValue = getBookingTotalByDate(roomId, startTime, oldHours, 'sala-a');
      const newValue = getBookingTotalByDate(roomId, startTime, newHours, 'sala-a');
      const valueDifference = newValue - oldValue;
      
      // Diferença deve ser 2h * 64.99 = 129.98
      expect(valueDifference).toBeCloseTo(64.99 * 2, 2);
      
      // Se usasse DB: valordifference seria hoursDifference * room.hourlyRate_db
      // que pode ser diferente (e.g., 59.99 * 2 = 119.98)
    });

    it('deve suportar redução de duração (valueDifference negativo)', () => {
      // Simula: redução de 4h para 2h (ou mudança de data)
      // valueDifference deve ser negativo
      
      const roomId = 'room-sala-b';
      const oldHours = 4;
      const newHours = 2;
      
      const oldValue = getBookingTotalByDate(roomId, weekdayDate, oldHours, 'sala-b');
      const newValue = getBookingTotalByDate(roomId, weekdayDate, newHours, 'sala-b');
      const valueDifference = newValue - oldValue;
      
      // Deve ser negativo
      expect(valueDifference).toBeLessThan(0);
      
      // Deve ser -2h * 53.99 = -107.98
      expect(valueDifference).toBeCloseTo(-53.99 * 2, 2);
    });
  });

  describe('5. Timezone Boundary Cases', () => {
    it('deve respeitar timezone Brasil (UTC-3) para Saturday detection', () => {
      // 2025-01-18 é sábado em São Paulo
      const saturdayBrazil = new Date('2025-01-18T12:00:00Z'); // 09:00 SP
      expect(getRoomHourlyPriceByDate('room-sala-a', saturdayBrazil, 'sala-a')).toBe(64.99);
      
      // 2025-01-17 é sexta em São Paulo (mesmo em UTC já é sábado)
      const fridayBrazil = new Date('2025-01-17T12:00:00Z'); // 09:00 SP
      expect(getRoomHourlyPriceByDate('room-sala-a', fridayBrazil, 'sala-a')).toBe(59.99);
    });
  });
});
