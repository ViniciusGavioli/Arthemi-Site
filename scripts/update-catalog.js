// Script para atualizar catálogo oficial no banco de dados
// TURNO FIXO = 4h (bloco único), NÃO 16h
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Preços oficiais por sala (em centavos para banco)
const CATALOG = {
  SALA_A: {
    HOURLY_RATE: { price: 5999, hours: 1 },
    PACKAGE_10H: { price: 55990, hours: 10 },
    PACKAGE_20H: { price: 103980, hours: 20 },
    PACKAGE_40H: { price: 195960, hours: 40 },
    SHIFT_FIXED: { price: 18999, hours: 4 },  // Turno 4h seg-sex (preço avulso, não mensal)
    SATURDAY_HOUR: { price: 6499, hours: 1 },
    SATURDAY_SHIFT: { price: 23999, hours: 4 }, // Turno sábado 4h (preço avulso)
  },
  SALA_B: {
    HOURLY_RATE: { price: 4999, hours: 1 },
    PACKAGE_10H: { price: 45990, hours: 10 },
    PACKAGE_20H: { price: 83980, hours: 20 },
    PACKAGE_40H: { price: 155960, hours: 40 },
    SHIFT_FIXED: { price: 15999, hours: 4 },
    SATURDAY_HOUR: { price: 5399, hours: 1 },
    SATURDAY_SHIFT: { price: 19999, hours: 4 },
  },
  SALA_C: {
    HOURLY_RATE: { price: 3999, hours: 1 },
    PACKAGE_10H: { price: 35990, hours: 10 },
    PACKAGE_20H: { price: 65980, hours: 20 },
    PACKAGE_40H: { price: 119960, hours: 40 },
    SHIFT_FIXED: { price: 12999, hours: 4 },
    SATURDAY_HOUR: { price: 4299, hours: 1 },
    SATURDAY_SHIFT: { price: 15999, hours: 4 },
  },
};

const ROOM_NAMES = {
  SALA_A: 'Consultório 1',
  SALA_B: 'Consultório 2',
  SALA_C: 'Consultório 3',
};

const PRODUCT_NAMES = {
  HOURLY_RATE: 'Hora avulsa',
  PACKAGE_10H: 'Pacote 10 horas',
  PACKAGE_20H: 'Pacote 20 horas',
  PACKAGE_40H: 'Pacote 40 horas',
  SHIFT_FIXED: 'Turno fixo (4h)',
  SATURDAY_HOUR: 'Sábado - Hora avulsa',
  SATURDAY_SHIFT: 'Sábado - Turno fixo (4h)',
};

const OFFICIAL_TYPES = ['HOURLY_RATE', 'PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'SHIFT_FIXED', 'SATURDAY_HOUR', 'SATURDAY_SHIFT'];
const DISCONTINUED_TYPES = ['DAY_PASS', 'SATURDAY_5H'];

async function main() {
  console.log('=== ATUALIZANDO CATÁLOGO OFICIAL ===\n');
  
  // 1. Buscar salas
  const rooms = await prisma.room.findMany({
    select: { id: true, slug: true },
  });
  
  const roomMap = {};
  rooms.forEach(r => {
    if (r.slug === 'sala-a') roomMap['SALA_A'] = r.id;
    if (r.slug === 'sala-b') roomMap['SALA_B'] = r.id;
    if (r.slug === 'sala-c') roomMap['SALA_C'] = r.id;
  });
  
  console.log('Salas encontradas:', Object.keys(roomMap).length);
  
  // 2. Atualizar/criar produtos oficiais
  for (const [salaKey, roomId] of Object.entries(roomMap)) {
    console.log(`\n--- ${ROOM_NAMES[salaKey]} (${salaKey}) ---`);
    
    for (const type of OFFICIAL_TYPES) {
      const catalog = CATALOG[salaKey][type];
      
      // Buscar produto existente
      const existing = await prisma.product.findFirst({
        where: { roomId, type },
      });
      
      if (existing) {
        // Atualizar
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: PRODUCT_NAMES[type],
            price: catalog.price,
            hoursIncluded: catalog.hours,
            isActive: true,
          },
        });
        console.log(`  ✅ ${type}: ATUALIZADO (R$ ${(catalog.price/100).toFixed(2)}, ${catalog.hours}h)`);
      } else {
        // Criar
        await prisma.product.create({
          data: {
            name: PRODUCT_NAMES[type],
            slug: `${type.toLowerCase().replace(/_/g, '-')}-${salaKey.toLowerCase().replace('_', '-')}`,
            type,
            price: catalog.price,
            hoursIncluded: catalog.hours,
            isActive: true,
            sortOrder: OFFICIAL_TYPES.indexOf(type),
            roomId,
          },
        });
        console.log(`  ✨ ${type}: CRIADO (R$ ${(catalog.price/100).toFixed(2)}, ${catalog.hours}h)`);
      }
    }
    
    // 3. Desativar produtos descontinuados
    for (const type of DISCONTINUED_TYPES) {
      const existing = await prisma.product.findFirst({
        where: { roomId, type },
      });
      
      if (existing && existing.isActive) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
        console.log(`  ❌ ${type}: DESATIVADO`);
      }
    }
  }
  
  // 4. Verificação final
  console.log('\n=== VERIFICAÇÃO FINAL ===\n');
  
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { type: true },
  });
  
  const typeCounts = {};
  allProducts.forEach(p => {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  });
  
  console.log('Produtos ATIVOS por tipo:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    const official = OFFICIAL_TYPES.includes(type) ? '✅' : '⚠️';
    console.log(`  ${official} ${type}: ${count} produtos`);
  });
  
  const totalActive = allProducts.length;
  const expected = OFFICIAL_TYPES.length * 3; // 7 tipos x 3 salas = 21
  console.log(`\nTotal ativo: ${totalActive} (esperado: ${expected})`);
  
  if (totalActive === expected) {
    console.log('✅ Catálogo correto!');
  } else {
    console.log('⚠️ Quantidade diferente do esperado');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
