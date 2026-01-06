// ===========================================================
// Testes: Catálogo Oficial de Produtos
// ===========================================================
// Garante que o catálogo oficial tenha 7 tipos de produtos
// e que produtos descontinuados sejam bloqueados

import {
  OFFICIAL_PRODUCT_TYPES,
  DISCONTINUED_PRODUCTS,
  getAllProductsForRoom,
  getUsageTypeForProduct,
  PRODUCT_HOURS,
  SHIFT_BLOCKS,
  SATURDAY_SHIFT_BLOCK,
} from '@/constants/prices';

describe('Catálogo Oficial', () => {
  describe('OFFICIAL_PRODUCT_TYPES', () => {
    it('deve conter exatamente 7 tipos de produtos', () => {
      expect(OFFICIAL_PRODUCT_TYPES.length).toBe(7);
    });

    it('deve incluir produtos de dias úteis', () => {
      expect(OFFICIAL_PRODUCT_TYPES).toContain('HOURLY_RATE');
      expect(OFFICIAL_PRODUCT_TYPES).toContain('PACKAGE_10H');
      expect(OFFICIAL_PRODUCT_TYPES).toContain('PACKAGE_20H');
      expect(OFFICIAL_PRODUCT_TYPES).toContain('PACKAGE_40H');
      expect(OFFICIAL_PRODUCT_TYPES).toContain('SHIFT_FIXED');
    });

    it('deve incluir produtos de sábado', () => {
      expect(OFFICIAL_PRODUCT_TYPES).toContain('SATURDAY_HOUR');
      expect(OFFICIAL_PRODUCT_TYPES).toContain('SATURDAY_SHIFT');
    });

    it('NÃO deve incluir produtos descontinuados', () => {
      expect(OFFICIAL_PRODUCT_TYPES).not.toContain('DAY_PASS');
      expect(OFFICIAL_PRODUCT_TYPES).not.toContain('SATURDAY_5H');
    });
  });

  describe('DISCONTINUED_PRODUCTS', () => {
    it('deve conter DAY_PASS e SATURDAY_5H', () => {
      expect(DISCONTINUED_PRODUCTS).toContain('DAY_PASS');
      expect(DISCONTINUED_PRODUCTS).toContain('SATURDAY_5H');
    });

    it('NÃO deve conter SHIFT_FIXED ou SATURDAY_SHIFT', () => {
      expect(DISCONTINUED_PRODUCTS).not.toContain('SHIFT_FIXED');
      expect(DISCONTINUED_PRODUCTS).not.toContain('SATURDAY_SHIFT');
    });
  });

  describe('getAllProductsForRoom', () => {
    it('deve retornar 7 produtos para SALA_A', () => {
      const products = getAllProductsForRoom('SALA_A');
      expect(products.length).toBe(7);
    });

    it('deve retornar 7 produtos para SALA_B', () => {
      const products = getAllProductsForRoom('SALA_B');
      expect(products.length).toBe(7);
    });

    it('deve retornar 7 produtos para SALA_C', () => {
      const products = getAllProductsForRoom('SALA_C');
      expect(products.length).toBe(7);
    });

    it('deve incluir SHIFT_FIXED nos produtos', () => {
      const products = getAllProductsForRoom('SALA_A');
      const shiftFixed = products.find(p => p.type === 'SHIFT_FIXED');
      expect(shiftFixed).toBeDefined();
      expect(shiftFixed?.hoursIncluded).toBe(4);
    });

    it('deve incluir SATURDAY_SHIFT nos produtos', () => {
      const products = getAllProductsForRoom('SALA_A');
      const saturdayShift = products.find(p => p.type === 'SATURDAY_SHIFT');
      expect(saturdayShift).toBeDefined();
      expect(saturdayShift?.hoursIncluded).toBe(4);
    });

    it('NÃO deve incluir DAY_PASS', () => {
      const products = getAllProductsForRoom('SALA_A');
      const dayPass = products.find(p => p.type === 'DAY_PASS');
      expect(dayPass).toBeUndefined();
    });

    it('NÃO deve incluir SATURDAY_5H', () => {
      const products = getAllProductsForRoom('SALA_A');
      const saturday5h = products.find(p => p.type === 'SATURDAY_5H');
      expect(saturday5h).toBeUndefined();
    });
  });

  describe('PRODUCT_HOURS', () => {
    it('SHIFT_FIXED deve ser 4 horas', () => {
      expect(PRODUCT_HOURS.SHIFT_FIXED).toBe(4);
    });

    it('SATURDAY_SHIFT deve ser 4 horas', () => {
      expect(PRODUCT_HOURS.SATURDAY_SHIFT).toBe(4);
    });
  });

  describe('Blocos de Turno', () => {
    it('deve ter 3 blocos de turno para dias úteis', () => {
      expect(SHIFT_BLOCKS.length).toBe(3);
    });

    it('blocos de turno devem ser 08-12, 12-16, 16-20', () => {
      expect(SHIFT_BLOCKS[0]).toEqual({ start: 8, end: 12, label: '08:00 - 12:00' });
      expect(SHIFT_BLOCKS[1]).toEqual({ start: 12, end: 16, label: '12:00 - 16:00' });
      expect(SHIFT_BLOCKS[2]).toEqual({ start: 16, end: 20, label: '16:00 - 20:00' });
    });

    it('turno de sábado deve ser 08-12', () => {
      expect(SATURDAY_SHIFT_BLOCK).toEqual({ start: 8, end: 12, label: '08:00 - 12:00' });
    });
  });

  describe('getUsageTypeForProduct', () => {
    it('SHIFT_FIXED deve retornar SHIFT', () => {
      expect(getUsageTypeForProduct('SHIFT_FIXED')).toBe('SHIFT');
    });

    it('SATURDAY_SHIFT deve retornar SATURDAY_SHIFT', () => {
      expect(getUsageTypeForProduct('SATURDAY_SHIFT')).toBe('SATURDAY_SHIFT');
    });

    it('SATURDAY_HOUR deve retornar SATURDAY_HOURLY', () => {
      expect(getUsageTypeForProduct('SATURDAY_HOUR')).toBe('SATURDAY_HOURLY');
    });

    it('PACKAGE_10H deve retornar HOURLY', () => {
      expect(getUsageTypeForProduct('PACKAGE_10H')).toBe('HOURLY');
    });

    it('PACKAGE_20H deve retornar HOURLY', () => {
      expect(getUsageTypeForProduct('PACKAGE_20H')).toBe('HOURLY');
    });

    it('PACKAGE_40H deve retornar HOURLY', () => {
      expect(getUsageTypeForProduct('PACKAGE_40H')).toBe('HOURLY');
    });

    it('HOURLY_RATE deve retornar HOURLY', () => {
      expect(getUsageTypeForProduct('HOURLY_RATE')).toBe('HOURLY');
    });
  });
});
