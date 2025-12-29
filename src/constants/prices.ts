// ===========================================================
// Valores Oficiais V3 - Espaço Arthemi
// ===========================================================
// FONTE ÚNICA DE VERDADE PARA TODOS OS PREÇOS
// NÃO ALTERE ESTES VALORES SEM AUTORIZAÇÃO

export const PRICES_V3 = {
  // ============================================
  // CONSULTÓRIO 1 – GRANDE (com maca)
  // ============================================
  SALA_A: {
    name: 'Consultório 1',
    subtitle: 'Grande (com maca)',
    description: 'Consultório amplo com maca profissional, ideal para procedimentos e atendimentos que requerem mais espaço.',
    capacity: 4,
    size: 20, // m²
    amenities: ['Maca profissional', 'Ar-condicionado', 'Wi-Fi', 'Pia com água quente', 'Armário', 'Espelho'],
    image: '/images/sala-a.jpg',
    prices: {
      HOURLY_RATE: 59.99,
      PACKAGE_10H: 559.90,
      PACKAGE_20H: 1039.80,
      PACKAGE_40H: 1959.60,
      SHIFT_FIXED: 728.99,    // Turno fixo mensal (16h)
      DAY_PASS: 369.99,       // Diária (8h seguidas)
      SATURDAY_HOUR: 64.99,
      SATURDAY_5H: 299.95,
      SATURDAY_SHIFT: 959.99, // Turno fixo sábado (16h/mês)
    },
  },

  // ============================================
  // CONSULTÓRIO 2 – MÉDIA (com maca)
  // ============================================
  SALA_B: {
    name: 'Consultório 2',
    subtitle: 'Média (com maca)',
    description: 'Consultório de tamanho médio com maca, perfeito para consultas e procedimentos padrão.',
    capacity: 3,
    size: 15, // m²
    amenities: ['Maca profissional', 'Ar-condicionado', 'Wi-Fi', 'Pia', 'Armário'],
    image: '/images/sala-b.jpg',
    prices: {
      HOURLY_RATE: 49.99,
      PACKAGE_10H: 459.90,
      PACKAGE_20H: 839.80,
      PACKAGE_40H: 1559.60,
      SHIFT_FIXED: 580.99,    // Turno fixo mensal (16h)
      DAY_PASS: 299.99,       // Diária (8h seguidas)
      SATURDAY_HOUR: 53.99,
      SATURDAY_5H: 249.95,
      SATURDAY_SHIFT: 799.99, // Turno fixo sábado (16h/mês)
    },
  },

  // ============================================
  // CONSULTÓRIO 3 – PEQUENA (sem maca)
  // ============================================
  SALA_C: {
    name: 'Consultório 3',
    subtitle: 'Pequena (sem maca)',
    description: 'Consultório compacto ideal para consultas, psicoterapia e atendimentos que não requerem maca.',
    capacity: 2,
    size: 10, // m²
    amenities: ['Ar-condicionado', 'Wi-Fi', 'Mesa de atendimento', 'Cadeiras confortáveis', 'Armário'],
    image: '/images/sala-c.jpg',
    prices: {
      HOURLY_RATE: 39.99,
      PACKAGE_10H: 359.90,
      PACKAGE_20H: 659.80,
      PACKAGE_40H: 1199.60,
      SHIFT_FIXED: 446.99,    // Turno fixo mensal (16h)
      DAY_PASS: 229.99,       // Diária (8h seguidas)
      SATURDAY_HOUR: 42.99,
      SATURDAY_5H: 199.95,
      SATURDAY_SHIFT: 629.99, // Turno fixo sábado (16h/mês)
    },
  },
} as const;

// Tipos para tipagem forte
export type RoomKey = keyof typeof PRICES_V3;
export type PriceType = keyof typeof PRICES_V3.SALA_A.prices;

// Helper para obter preço formatado
export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Helper para obter preço de um consultório
export function getRoomPrice(room: RoomKey, priceType: PriceType): number {
  return PRICES_V3[room].prices[priceType];
}

// Mapeamento de slug para key
export const ROOM_SLUG_MAP: Record<string, RoomKey> = {
  'sala-a': 'SALA_A',
  'sala-b': 'SALA_B',
  'sala-c': 'SALA_C',
};

// Descrições dos tipos de produto
export const PRODUCT_DESCRIPTIONS = {
  HOURLY_RATE: 'Hora avulsa',
  PACKAGE_10H: 'Pacote 10 horas',
  PACKAGE_20H: 'Pacote 20 horas',
  PACKAGE_40H: 'Pacote 40 horas',
  SHIFT_FIXED: 'Turno fixo mensal (16h)',
  DAY_PASS: 'Diária (8h seguidas)',
  SATURDAY_HOUR: 'Sábado - Hora avulsa',
  SATURDAY_5H: 'Sábado - Pacote 5h',
} as const;

// Validades em dias
export const PRODUCT_VALIDITY = {
  HOURLY_RATE: 1,
  PACKAGE_10H: 90,
  PACKAGE_20H: 90,
  PACKAGE_40H: 180,
  SHIFT_FIXED: 30,    // Mensal
  DAY_PASS: 1,
  SATURDAY_HOUR: 1,
  SATURDAY_5H: 1,
} as const;

// Horas incluídas em cada produto
export const PRODUCT_HOURS = {
  HOURLY_RATE: 1,
  PACKAGE_10H: 10,
  PACKAGE_20H: 20,
  PACKAGE_40H: 40,
  SHIFT_FIXED: 16,
  DAY_PASS: 8,
  SATURDAY_HOUR: 1,
  SATURDAY_5H: 5,
} as const;
