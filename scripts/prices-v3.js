// ===========================================================
// Preços V3 para scripts Node.js (CommonJS)
// ===========================================================
// CÓPIA de src/constants/prices.ts para uso em scripts
// Manter sincronizado!

const PRICES_V3 = {
  SALA_A: {
    name: 'Consultório 1',
    prices: {
      HOURLY_RATE: 59.99,
      PACKAGE_10H: 559.90,
      PACKAGE_20H: 1039.80,
      PACKAGE_40H: 1959.60,
      SHIFT_FIXED: 189.99,
      DAY_PASS: 369.99,
      SATURDAY_HOUR: 64.99,
      SATURDAY_5H: 299.95,
      SATURDAY_SHIFT: 239.99,
    },
  },
  SALA_B: {
    name: 'Consultório 2',
    prices: {
      HOURLY_RATE: 49.99,
      PACKAGE_10H: 459.90,
      PACKAGE_20H: 839.80,
      PACKAGE_40H: 1559.60,
      SHIFT_FIXED: 159.99,
      DAY_PASS: 299.99,
      SATURDAY_HOUR: 53.99,
      SATURDAY_5H: 249.95,
      SATURDAY_SHIFT: 199.99,
    },
  },
  SALA_C: {
    name: 'Consultório 3',
    prices: {
      HOURLY_RATE: 39.99,
      PACKAGE_10H: 359.90,
      PACKAGE_20H: 659.80,
      PACKAGE_40H: 1199.60,
      SHIFT_FIXED: 129.99,
      DAY_PASS: 229.99,
      SATURDAY_HOUR: 42.99,
      SATURDAY_5H: 199.95,
      SATURDAY_SHIFT: 159.99,
    },
  },
};

module.exports = { PRICES_V3 };
