// ===========================================================
// Testes: Regras de Negócio
// ===========================================================

import { 
  applyValidity,
  calculatePackageExpiry, 
  isWithinBusinessHours,
  generateTimeSlots,
  canReschedule,
  canCancelWithRefund,
  isBookingInPast,
  PACKAGE_VALIDITY,
  BUSINESS_HOURS,
  MIN_RESCHEDULE_HOURS,
  MIN_CANCELLATION_HOURS,
  SUBLET_CREDIT_PERCENTAGE,
} from '@/lib/business-rules';
import { addDays, addHours, subHours } from 'date-fns';

describe('Business Rules', () => {
  describe('applyValidity / calculatePackageExpiry', () => {
    it('deve calcular validade de 90 dias para pacote de 10h', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry = applyValidity('PACKAGE_10H', purchaseDate);
      
      expect(expiry.getTime()).toBe(addDays(purchaseDate, 90).getTime());
    });

    it('deve calcular validade de 90 dias para pacote de 20h', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry = applyValidity('PACKAGE_20H', purchaseDate);
      
      expect(expiry.getTime()).toBe(addDays(purchaseDate, 90).getTime());
    });

    it('deve calcular validade de 180 dias para pacote de 40h', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry = applyValidity('PACKAGE_40H', purchaseDate);
      
      expect(expiry.getTime()).toBe(addDays(purchaseDate, 180).getTime());
    });

    it('deve calcular validade de 180 dias para turno fixo', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry = applyValidity('SHIFT_FIXED', purchaseDate);
      
      expect(expiry.getTime()).toBe(addDays(purchaseDate, 180).getTime());
    });

    it('deve calcular validade de 1 dia para diária', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry = applyValidity('DAY_PASS', purchaseDate);
      
      expect(expiry.getTime()).toBe(addDays(purchaseDate, 1).getTime());
    });

    it('deve usar data atual se não informada', () => {
      const before = new Date();
      const expiry = applyValidity('PACKAGE_10H');
      const after = new Date();
      
      expect(expiry.getTime()).toBeGreaterThanOrEqual(
        addDays(before, PACKAGE_VALIDITY.PACKAGE_10H).getTime()
      );
      expect(expiry.getTime()).toBeLessThanOrEqual(
        addDays(after, PACKAGE_VALIDITY.PACKAGE_10H).getTime() + 1000
      );
    });

    it('alias calculatePackageExpiry deve funcionar igual', () => {
      const purchaseDate = new Date('2025-01-01');
      const expiry1 = applyValidity('PACKAGE_10H', purchaseDate);
      const expiry2 = calculatePackageExpiry('PACKAGE_10H', purchaseDate);
      
      expect(expiry1.getTime()).toBe(expiry2.getTime());
    });
  });

  describe('isWithinBusinessHours', () => {
    it('deve retornar true para horário comercial', () => {
      const date = new Date('2025-12-17T10:00:00');
      expect(isWithinBusinessHours(date)).toBe(true);
    });

    it('deve retornar true para limite inferior (8h)', () => {
      const date = new Date('2025-12-17T08:00:00');
      expect(isWithinBusinessHours(date)).toBe(true);
    });

    it('deve retornar false para antes das 8h', () => {
      const date = new Date('2025-12-17T07:59:00');
      expect(isWithinBusinessHours(date)).toBe(false);
    });

    it('deve retornar false para 20h ou depois', () => {
      const date = new Date('2025-12-17T20:00:00');
      expect(isWithinBusinessHours(date)).toBe(false);
    });

    it('deve retornar true para 19:59', () => {
      const date = new Date('2025-12-17T19:59:00');
      expect(isWithinBusinessHours(date)).toBe(true);
    });
  });

  describe('generateTimeSlots', () => {
    it('deve gerar slots de horário para o dia', () => {
      const date = new Date('2025-12-17');
      const slots = generateTimeSlots(date);
      
      // Deve ter slots das 8h às 19h (12 slots)
      expect(slots.length).toBe(BUSINESS_HOURS.end - BUSINESS_HOURS.start);
    });

    it('deve ter slots de 1 hora cada', () => {
      const date = new Date('2025-12-17');
      const slots = generateTimeSlots(date);
      
      slots.forEach(slot => {
        const diffMs = slot.end.getTime() - slot.start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        expect(diffHours).toBe(1);
      });
    });

    it('primeiro slot deve começar às 8h', () => {
      const date = new Date('2025-12-17');
      const slots = generateTimeSlots(date);
      
      expect(slots[0].start.getHours()).toBe(BUSINESS_HOURS.start);
    });

    it('último slot deve terminar às 20h', () => {
      const date = new Date('2025-12-17');
      const slots = generateTimeSlots(date);
      
      expect(slots[slots.length - 1].end.getHours()).toBe(BUSINESS_HOURS.end);
    });
  });

  describe('canReschedule', () => {
    it('deve permitir reagendamento com mais de 24h de antecedência', () => {
      const bookingTime = addHours(new Date(), 25);
      expect(canReschedule(bookingTime)).toBe(true);
    });

    it('deve permitir reagendamento com exatamente 24h de antecedência', () => {
      const bookingTime = addHours(new Date(), 24);
      expect(canReschedule(bookingTime)).toBe(true);
    });

    it('não deve permitir reagendamento com menos de 24h de antecedência', () => {
      const bookingTime = addHours(new Date(), 23);
      expect(canReschedule(bookingTime)).toBe(false);
    });

    it('não deve permitir reagendamento para reservas passadas', () => {
      const bookingTime = subHours(new Date(), 1);
      expect(canReschedule(bookingTime)).toBe(false);
    });
  });

  describe('canCancelWithRefund', () => {
    it('deve permitir cancelamento com reembolso com mais de 24h de antecedência', () => {
      const bookingTime = addHours(new Date(), 49);
      expect(canCancelWithRefund(bookingTime)).toBe(true);
    });

    it('não deve permitir cancelamento com reembolso com menos de 24h', () => {
      const bookingTime = addHours(new Date(), 23);
      expect(canCancelWithRefund(bookingTime)).toBe(false);
    });
  });

  describe('isBookingInPast', () => {
    it('deve retornar true para reservas no passado', () => {
      const pastBooking = subHours(new Date(), 1);
      expect(isBookingInPast(pastBooking)).toBe(true);
    });

    it('deve retornar false para reservas futuras', () => {
      const futureBooking = addHours(new Date(), 1);
      expect(isBookingInPast(futureBooking)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('PACKAGE_VALIDITY deve ter valores corretos', () => {
      expect(PACKAGE_VALIDITY.PACKAGE_10H).toBe(90);
      expect(PACKAGE_VALIDITY.PACKAGE_20H).toBe(90);
      expect(PACKAGE_VALIDITY.PACKAGE_40H).toBe(180);
      expect(PACKAGE_VALIDITY.SHIFT_FIXED).toBe(180);
      expect(PACKAGE_VALIDITY.DAY_PASS).toBe(1);
      expect(PACKAGE_VALIDITY.SATURDAY_PASS).toBe(1);
    });

    it('MIN_RESCHEDULE_HOURS deve ser 24', () => {
      expect(MIN_RESCHEDULE_HOURS).toBe(24);
    });

    it('MIN_CANCELLATION_HOURS deve ser 48', () => {
      expect(MIN_CANCELLATION_HOURS).toBe(48);
    });

    it('SUBLET_CREDIT_PERCENTAGE deve ser 50%', () => {
      expect(SUBLET_CREDIT_PERCENTAGE).toBe(0.5);
    });

    it('BUSINESS_HOURS deve ter horários corretos', () => {
      expect(BUSINESS_HOURS.start).toBe(8);
      expect(BUSINESS_HOURS.end).toBe(20);
    });
  });
});
