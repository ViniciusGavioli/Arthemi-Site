// ===========================================================
// Testes: Proteção Anti-Canibalização de Turnos
// ===========================================================

import {
  isTurnoDay,
  isWithinTurnoProtectionWindow,
  isHourlyProduct,
  isShiftProduct,
  shouldBlockHourlyPurchase,
  validateDatesForTurnoProtection,
  getMaxHourlyBookingDate,
  TURNO_PROTECTION_WINDOW_DAYS,
  TURNO_PROTECTION_ERROR_CODE,
} from '@/lib/turno-protection';
import { addDays, startOfDay, setDay } from 'date-fns';

describe('Turno Protection', () => {
  // Data de referência para testes: uma segunda-feira
  const getMonday = () => {
    const today = startOfDay(new Date());
    const day = today.getDay();
    const diff = day === 0 ? 1 : (day === 6 ? 2 : 1 - day);
    return addDays(today, diff >= 0 ? diff : 7 + diff);
  };

  const getFriday = () => {
    const monday = getMonday();
    return addDays(monday, 4);
  };

  const getSaturday = () => {
    const monday = getMonday();
    return addDays(monday, 5);
  };

  const getSunday = () => {
    const monday = getMonday();
    return addDays(monday, 6);
  };

  describe('isTurnoDay', () => {
    it('deve retornar true para segunda-feira', () => {
      const monday = setDay(new Date(), 1); // 1 = Monday
      expect(isTurnoDay(monday)).toBe(true);
    });

    it('deve retornar true para terça-feira', () => {
      const tuesday = setDay(new Date(), 2); // 2 = Tuesday
      expect(isTurnoDay(tuesday)).toBe(true);
    });

    it('deve retornar true para quarta-feira', () => {
      const wednesday = setDay(new Date(), 3);
      expect(isTurnoDay(wednesday)).toBe(true);
    });

    it('deve retornar true para quinta-feira', () => {
      const thursday = setDay(new Date(), 4);
      expect(isTurnoDay(thursday)).toBe(true);
    });

    it('deve retornar true para sexta-feira', () => {
      const friday = setDay(new Date(), 5);
      expect(isTurnoDay(friday)).toBe(true);
    });

    it('deve retornar false para sábado', () => {
      const saturday = setDay(new Date(), 6);
      expect(isTurnoDay(saturday)).toBe(false);
    });

    it('deve retornar false para domingo', () => {
      const sunday = setDay(new Date(), 0);
      expect(isTurnoDay(sunday)).toBe(false);
    });
  });

  describe('isWithinTurnoProtectionWindow', () => {
    it('deve retornar true para data dentro de 30 dias', () => {
      const dateIn10Days = addDays(new Date(), 10);
      expect(isWithinTurnoProtectionWindow(dateIn10Days)).toBe(true);
    });

    it('deve retornar true para data exatamente em 30 dias', () => {
      const dateIn30Days = addDays(startOfDay(new Date()), 30);
      expect(isWithinTurnoProtectionWindow(dateIn30Days)).toBe(true);
    });

    it('deve retornar false para data em 31 dias', () => {
      const dateIn31Days = addDays(startOfDay(new Date()), 31);
      expect(isWithinTurnoProtectionWindow(dateIn31Days)).toBe(false);
    });

    it('deve retornar false para data em 45 dias', () => {
      const dateIn45Days = addDays(new Date(), 45);
      expect(isWithinTurnoProtectionWindow(dateIn45Days)).toBe(false);
    });

    it('deve aceitar janela personalizada', () => {
      const dateIn60Days = addDays(new Date(), 60);
      expect(isWithinTurnoProtectionWindow(dateIn60Days, 90)).toBe(true);
      expect(isWithinTurnoProtectionWindow(dateIn60Days, 30)).toBe(false);
    });
  });

  describe('isHourlyProduct', () => {
    it('deve retornar true para HOURLY_RATE', () => {
      expect(isHourlyProduct('HOURLY_RATE')).toBe(true);
    });

    it('deve retornar true para PACKAGE_10H', () => {
      expect(isHourlyProduct('PACKAGE_10H')).toBe(true);
    });

    it('deve retornar true para PACKAGE_20H', () => {
      expect(isHourlyProduct('PACKAGE_20H')).toBe(true);
    });

    it('deve retornar true para PACKAGE_40H', () => {
      expect(isHourlyProduct('PACKAGE_40H')).toBe(true);
    });

    it('deve retornar false para SHIFT_FIXED', () => {
      expect(isHourlyProduct('SHIFT_FIXED')).toBe(false);
    });

    it('deve retornar false para DAY_PASS', () => {
      expect(isHourlyProduct('DAY_PASS')).toBe(false);
    });

    it('deve retornar false para null/undefined', () => {
      expect(isHourlyProduct(null)).toBe(false);
      expect(isHourlyProduct(undefined)).toBe(false);
    });
  });

  describe('isShiftProduct', () => {
    it('deve retornar true para SHIFT_FIXED', () => {
      expect(isShiftProduct('SHIFT_FIXED')).toBe(true);
    });

    it('deve retornar true para SHIFT', () => {
      expect(isShiftProduct('SHIFT')).toBe(true);
    });

    it('deve retornar true para SATURDAY_SHIFT', () => {
      expect(isShiftProduct('SATURDAY_SHIFT')).toBe(true);
    });

    it('deve retornar true para DAY_PASS', () => {
      expect(isShiftProduct('DAY_PASS')).toBe(true);
    });

    it('deve retornar false para HOURLY_RATE', () => {
      expect(isShiftProduct('HOURLY_RATE')).toBe(false);
    });

    it('deve retornar false para PACKAGE_10H', () => {
      expect(isShiftProduct('PACKAGE_10H')).toBe(false);
    });
  });

  describe('shouldBlockHourlyPurchase', () => {
    it('deve bloquear sexta-feira daqui 45 dias', () => {
      // Encontra a próxima sexta-feira daqui 45 dias
      const futureDate = addDays(new Date(), 45);
      const dayOfWeek = futureDate.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const friday45DaysAway = addDays(futureDate, daysUntilFriday);

      const result = shouldBlockHourlyPurchase(friday45DaysAway, 'HOURLY_RATE');
      expect(result.blocked).toBe(true);
      expect(result.code).toBe(TURNO_PROTECTION_ERROR_CODE);
    });

    it('deve permitir sexta-feira daqui 10 dias', () => {
      // Encontra a próxima sexta-feira daqui 10 dias
      const futureDate = addDays(new Date(), 10);
      const dayOfWeek = futureDate.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const fridayIn10Days = addDays(futureDate, daysUntilFriday);

      // Se a sexta estiver dentro de 30 dias, deve permitir
      const daysFromNow = Math.ceil(
        (fridayIn10Days.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysFromNow <= 30) {
        const result = shouldBlockHourlyPurchase(fridayIn10Days, 'HOURLY_RATE');
        expect(result.blocked).toBe(false);
      }
    });

    it('deve permitir sábado daqui 45 dias (não é dia de TURNO)', () => {
      const futureDate = addDays(new Date(), 45);
      const dayOfWeek = futureDate.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
      const saturday45DaysAway = addDays(futureDate, daysUntilSaturday);

      const result = shouldBlockHourlyPurchase(saturday45DaysAway, 'HOURLY_RATE');
      expect(result.blocked).toBe(false);
    });

    it('deve permitir TURNO (SHIFT_FIXED) sempre, mesmo > 30 dias', () => {
      const futureDate = addDays(new Date(), 45);
      const dayOfWeek = futureDate.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const friday45DaysAway = addDays(futureDate, daysUntilFriday);

      const result = shouldBlockHourlyPurchase(friday45DaysAway, 'SHIFT_FIXED');
      expect(result.blocked).toBe(false);
    });

    it('deve permitir DAY_PASS sempre (considerado TURNO)', () => {
      const futureDate = addDays(new Date(), 45);
      const dayOfWeek = futureDate.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const friday45DaysAway = addDays(futureDate, daysUntilFriday);

      const result = shouldBlockHourlyPurchase(friday45DaysAway, 'DAY_PASS');
      expect(result.blocked).toBe(false);
    });

    it('não deve bloquear domingo (fechado, não é dia de TURNO)', () => {
      const futureDate = addDays(new Date(), 45);
      const dayOfWeek = futureDate.getDay();
      const daysUntilSunday = (0 - dayOfWeek + 7) % 7 || 7;
      const sunday45DaysAway = addDays(futureDate, daysUntilSunday);

      const result = shouldBlockHourlyPurchase(sunday45DaysAway, 'HOURLY_RATE');
      expect(result.blocked).toBe(false);
    });
  });

  describe('validateDatesForTurnoProtection', () => {
    it('deve retornar lista vazia quando todas as datas são permitidas', () => {
      const dates = [
        addDays(new Date(), 5),
        addDays(new Date(), 10),
        addDays(new Date(), 15),
      ];

      const blocked = validateDatesForTurnoProtection(dates, 'HOURLY_RATE');
      
      // Todas devem estar dentro de 30 dias
      expect(blocked.every(b => !b.result.blocked)).toBe(true);
    });

    it('deve identificar datas bloqueadas em dias de TURNO > 30 dias', () => {
      const dates = [
        addDays(new Date(), 35), // 35 dias
        addDays(new Date(), 45), // 45 dias
        addDays(new Date(), 60), // 60 dias
      ];

      const blocked = validateDatesForTurnoProtection(dates, 'HOURLY_RATE');
      
      // Filtra apenas dias de semana (seg-sex) que estão bloqueados
      const weekdayBlocked = blocked.filter(b => {
        const day = b.date.getDay();
        return day >= 1 && day <= 5;
      });

      // Todos os dias de semana > 30 dias devem estar bloqueados
      weekdayBlocked.forEach(b => {
        expect(b.result.blocked).toBe(true);
      });
    });
  });

  describe('getMaxHourlyBookingDate', () => {
    it('deve retornar hoje + 30 dias', () => {
      const maxDate = getMaxHourlyBookingDate();
      const expected = addDays(startOfDay(new Date()), TURNO_PROTECTION_WINDOW_DAYS);
      
      expect(maxDate.getTime()).toBe(expected.getTime());
    });
  });

  describe('constantes', () => {
    it('TURNO_PROTECTION_WINDOW_DAYS deve ser 30', () => {
      expect(TURNO_PROTECTION_WINDOW_DAYS).toBe(30);
    });

    it('TURNO_PROTECTION_ERROR_CODE deve ser TURNO_PROTECTION_30D', () => {
      expect(TURNO_PROTECTION_ERROR_CODE).toBe('TURNO_PROTECTION_30D');
    });
  });
});
