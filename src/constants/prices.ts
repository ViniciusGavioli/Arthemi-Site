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
      SHIFT_FIXED: 189.99,      // Turno fixo 4h seg-sex (preço avulso)
      DAY_PASS: 369.99,         // DESCONTINUADO
      SATURDAY_HOUR: 64.99,
      SATURDAY_5H: 299.95,      // DESCONTINUADO
      SATURDAY_SHIFT: 239.99,   // Turno sábado 4h (preço avulso)
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
      SHIFT_FIXED: 159.99,      // Turno fixo 4h seg-sex (preço avulso)
      DAY_PASS: 299.99,         // DESCONTINUADO
      SATURDAY_HOUR: 53.99,
      SATURDAY_5H: 249.95,      // DESCONTINUADO
      SATURDAY_SHIFT: 199.99,   // Turno sábado 4h (preço avulso)
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
      SHIFT_FIXED: 129.99,      // Turno fixo 4h seg-sex (preço avulso)
      DAY_PASS: 229.99,         // DESCONTINUADO
      SATURDAY_HOUR: 42.99,
      SATURDAY_5H: 199.95,      // DESCONTINUADO
      SATURDAY_SHIFT: 159.99,   // Turno sábado 4h (preço avulso)
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
  SHIFT_FIXED: 'Turno fixo (4h)',
  DAY_PASS: 'Diária (8h seguidas)',     // DESCONTINUADO
  SATURDAY_HOUR: 'Sábado - Hora avulsa',
  SATURDAY_5H: 'Sábado - Pacote 5h',    // DESCONTINUADO
  SATURDAY_SHIFT: 'Sábado - Turno (4h)',
} as const;

// Validades em dias
export const PRODUCT_VALIDITY = {
  HOURLY_RATE: 1,
  PACKAGE_10H: 90,
  PACKAGE_20H: 90,
  PACKAGE_40H: 180,
  SHIFT_FIXED: 30,    // 30 dias para usar
  DAY_PASS: 1,
  SATURDAY_HOUR: 1,
  SATURDAY_5H: 1,
  SATURDAY_SHIFT: 30, // 30 dias para usar
} as const;

// Horas incluídas em cada produto
export const PRODUCT_HOURS = {
  HOURLY_RATE: 1,
  PACKAGE_10H: 10,
  PACKAGE_20H: 20,
  PACKAGE_40H: 40,
  SHIFT_FIXED: 4,       // Turno = 4h (bloco único)
  DAY_PASS: 8,
  SATURDAY_HOUR: 1,
  SATURDAY_5H: 5,
  SATURDAY_SHIFT: 4,    // Turno sábado = 4h (bloco único)
} as const;

// Blocos de turno válidos (seg-sex)
export const SHIFT_BLOCKS = [
  { start: 8, end: 12, label: '08:00 - 12:00' },
  { start: 12, end: 16, label: '12:00 - 16:00' },
  { start: 16, end: 20, label: '16:00 - 20:00' },
] as const;

// Bloco de turno sábado (único válido)
export const SATURDAY_SHIFT_BLOCK = { start: 8, end: 12, label: '08:00 - 12:00' } as const;

// ===========================================================
// CATÁLOGO OFICIAL (fonte única de verdade)
// ===========================================================
// 7 produtos por consultório

// Pacotes de horas (dias úteis)
export const PURCHASABLE_PACKAGES = ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H'] as const;
export type PurchasablePackage = typeof PURCHASABLE_PACKAGES[number];

// Produtos oficiais para dias úteis
export const WEEKDAY_PRODUCTS = ['HOURLY_RATE', 'PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'SHIFT_FIXED'] as const;

// Produtos oficiais para sábado
export const SATURDAY_PRODUCTS = ['SATURDAY_HOUR', 'SATURDAY_SHIFT'] as const;

// Todos os produtos vendáveis (catálogo oficial - 7 tipos)
export const OFFICIAL_PRODUCT_TYPES = [...WEEKDAY_PRODUCTS, ...SATURDAY_PRODUCTS] as const;
export type OfficialProductType = typeof OFFICIAL_PRODUCT_TYPES[number];

// Produtos descontinuados (bloquear venda)
export const DISCONTINUED_PRODUCTS = ['DAY_PASS', 'SATURDAY_5H'] as const;

// Helper para obter pacotes com preços para uma sala
export function getPackagesForRoom(roomKey: RoomKey) {
  const room = PRICES_V3[roomKey];
  const hourlyRate = room.prices.HOURLY_RATE;
  
  return PURCHASABLE_PACKAGES.map(pkgType => {
    const hours = PRODUCT_HOURS[pkgType];
    const price = room.prices[pkgType];
    const pricePerHour = price / hours;
    const discount = Math.round(((hourlyRate - pricePerHour) / hourlyRate) * 100);
    
    return {
      type: pkgType,
      name: PRODUCT_DESCRIPTIONS[pkgType],
      hours,
      price,         // em reais (ex: 559.90)
      priceCents: Math.round(price * 100), // em centavos (ex: 55990)
      pricePerHour,
      discount,
      validity: PRODUCT_VALIDITY[pkgType],
    };
  });
}

// Helper para obter TODOS os produtos oficiais para uma sala
// Retorna os 7 produtos oficiais na ordem correta
export function getAllProductsForRoom(roomKey: RoomKey): Array<{
  id: string;
  name: string;
  slug: string;
  price: number;
  hoursIncluded: number;
  type: string;
  roomId: string | null;
}> {
  const room = PRICES_V3[roomKey];
  const products: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    hoursIncluded: number;
    type: string;
    roomId: string | null;
  }> = [];
  
  // Adicionar todos os produtos oficiais
  OFFICIAL_PRODUCT_TYPES.forEach((productType, index) => {
    const hours = PRODUCT_HOURS[productType];
    const priceReais = room.prices[productType];
    products.push({
      id: `${productType.toLowerCase()}-${roomKey.toLowerCase()}`,
      name: PRODUCT_DESCRIPTIONS[productType],
      slug: `${productType.toLowerCase().replace(/_/g, '-')}-${roomKey.toLowerCase().replace('_', '-')}`,
      price: Math.round(priceReais * 100), // em centavos
      hoursIncluded: hours,
      type: productType,
      roomId: null,
    });
  });
  
  return products;
}

// Mapear tipo de produto para usageType do crédito
export function getUsageTypeForProduct(productType: string): string | null {
  switch (productType) {
    case 'HOURLY_RATE':
      return 'HOURLY';
    case 'PACKAGE_10H':
    case 'PACKAGE_20H':
    case 'PACKAGE_40H':
      return 'HOURLY'; // Pacotes geram créditos de hora avulsa
    case 'SHIFT_FIXED':
      return 'SHIFT';
    case 'SATURDAY_HOUR':
      return 'SATURDAY_HOURLY';
    case 'SATURDAY_SHIFT':
      return 'SATURDAY_SHIFT';
    default:
      return null;
  }
}
