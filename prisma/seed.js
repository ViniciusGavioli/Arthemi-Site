// ===========================================================
// Seed - Espaço Arthemi V3 (VALORES OFICIAIS)
// ===========================================================
// IMPORTANTE: Os preços abaixo são os valores OFICIAIS V3
// NÃO ALTERE SEM AUTORIZAÇÃO
// Execute: npm run seed

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================
// VALORES OFICIAIS V3 - NÃO ALTERAR
// ============================================
const PRICES_V3 = {
  SALA_A: {
    name: 'Consultório 1',
    subtitle: 'Grande (com maca)',
    description: 'Consultório amplo com maca profissional, ideal para procedimentos e atendimentos que requerem mais espaço. Ambiente climatizado com decoração terapêutica.',
    slug: 'sala-a',
    imageUrl: '/images/sala-a.jpg',
    capacity: 4,
    size: 20,
    tier: 1, // Consultório premium (hierarquia: pode usar crédito em 1, 2 ou 3)
    amenities: ['Maca profissional', 'Ar-condicionado', 'Wi-Fi', 'Pia com água quente', 'Armário', 'Espelho'],
    prices: {
      HOURLY_RATE: 5999,      // R$ 59,99
      PACKAGE_10H: 55990,     // R$ 559,90
      PACKAGE_20H: 103980,    // R$ 1.039,80
      PACKAGE_40H: 195960,    // R$ 1.959,60
      SHIFT_FIXED: 72899,     // R$ 728,99 - Turno fixo mensal (16h)
      DAY_PASS: 36999,        // R$ 369,99 - Diária (8h seguidas)
      SATURDAY_HOUR: 6499,    // R$ 64,99
      SATURDAY_5H: 29995,     // R$ 299,95
    },
  },
  SALA_B: {
    name: 'Consultório 2',
    subtitle: 'Média (com maca)',
    description: 'Consultório de tamanho médio com maca, perfeito para consultas e procedimentos padrão. Ambiente confortável e bem equipado.',
    slug: 'sala-b',
    imageUrl: '/images/sala-b.jpg',
    capacity: 3,
    size: 15,
    tier: 2, // Consultório intermediário (pode usar crédito em 2 ou 3)
    amenities: ['Maca profissional', 'Ar-condicionado', 'Wi-Fi', 'Pia', 'Armário'],
    prices: {
      HOURLY_RATE: 4999,      // R$ 49,99
      PACKAGE_10H: 45990,     // R$ 459,90
      PACKAGE_20H: 83980,     // R$ 839,80
      PACKAGE_40H: 155960,    // R$ 1.559,60
      SHIFT_FIXED: 58099,     // R$ 580,99 - Turno fixo mensal (16h)
      DAY_PASS: 29999,        // R$ 299,99 - Diária (8h seguidas)
      SATURDAY_HOUR: 5399,    // R$ 53,99
      SATURDAY_5H: 24995,     // R$ 249,95
    },
  },
  SALA_C: {
    name: 'Consultório 3',
    subtitle: 'Pequena (sem maca)',
    description: 'Consultório compacto ideal para consultas, psicoterapia e atendimentos que não requerem maca. Ambiente acolhedor e silencioso.',
    slug: 'sala-c',
    imageUrl: '/images/sala-c.jpg',
    capacity: 2,
    size: 10,
    tier: 3, // Consultório básico (só pode usar crédito em 3)
    amenities: ['Ar-condicionado', 'Wi-Fi', 'Mesa de atendimento', 'Cadeiras confortáveis', 'Armário'],
    prices: {
      HOURLY_RATE: 3999,      // R$ 39,99
      PACKAGE_10H: 35990,     // R$ 359,90
      PACKAGE_20H: 65980,     // R$ 659,80
      PACKAGE_40H: 119960,    // R$ 1.199,60
      SHIFT_FIXED: 44699,     // R$ 446,99 - Turno fixo mensal (16h)
      DAY_PASS: 22999,        // R$ 229,99 - Diária (8h seguidas)
      SATURDAY_HOUR: 4299,    // R$ 42,99
      SATURDAY_5H: 19995,     // R$ 199,95
    },
  },
};

async function main() {
  console.log('🌱 Iniciando seed do Espaço Arthemi V3 (Valores Oficiais)...');

  // ---- Limpar dados existentes ----
  console.log('🧹 Limpando dados existentes...');
  await prisma.credit.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.subletRequest.deleteMany();
  await prisma.userPackage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  // ---- Criar Usuário Admin ----
  console.log('👤 Criando usuários...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@arthemi.com.br',
      name: 'Administrador',
      phone: '11999990000',
      role: 'ADMIN',
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: 'teste@example.com',
      name: 'Usuário Teste',
      phone: '11988888888',
      role: 'CUSTOMER',
    },
  });

  console.log(`✅ Usuários criados: ${admin.email}, ${testUser.email}`);

  // ---- Criar as 3 Salas com Preços V3 ----
  console.log('🏠 Criando salas com preços V3...');

  const roomsData = Object.values(PRICES_V3);
  const rooms = [];

  for (const roomData of roomsData) {
    const room = await prisma.room.create({
      data: {
        name: roomData.name,
        slug: roomData.slug,
        description: roomData.description,
        imageUrl: roomData.imageUrl,
        capacity: roomData.capacity,
        amenities: roomData.amenities,
        tier: roomData.tier, // Hierarquia: 1=A, 2=B, 3=C
        hourlyRate: roomData.prices.HOURLY_RATE,
        // Campos extras para compatibilidade
        pricePerHour: roomData.prices.HOURLY_RATE,
        pricePackage4: Math.round(roomData.prices.HOURLY_RATE * 4 * 0.95), // 5% desconto
        pricePackage8: Math.round(roomData.prices.HOURLY_RATE * 8 * 0.90), // 10% desconto
        priceShift: roomData.prices.SHIFT_FIXED,
      },
    });
    rooms.push(room);
    console.log(`  ✅ ${room.name} (Tier ${roomData.tier}) - Hora: R$ ${(roomData.prices.HOURLY_RATE / 100).toFixed(2)}`);
  }

  console.log(`✅ ${rooms.length} salas criadas`);

  // ---- Criar Produtos por Sala (V3) ----
  console.log('🏷️ Criando produtos V3 por sala...');

  const productTypes = [
    { type: 'HOURLY_RATE', name: 'Hora Avulsa', hours: 1, validity: 1, desc: 'Reserve por hora, ideal para atendimentos esporádicos.' },
    { type: 'PACKAGE_10H', name: 'Pacote 10 Horas', hours: 10, validity: 90, desc: 'Economize! Use em até 90 dias.' },
    { type: 'PACKAGE_20H', name: 'Pacote 20 Horas', hours: 20, validity: 90, desc: 'Melhor custo-benefício! Validade 90 dias.' },
    { type: 'PACKAGE_40H', name: 'Pacote 40 Horas', hours: 40, validity: 180, desc: 'Máxima economia! Validade 180 dias.' },
    { type: 'SHIFT_FIXED', name: 'Turno Fixo Mensal (16h)', hours: 16, validity: 30, desc: '4h/semana fixas por 1 mês.' },
    { type: 'DAY_PASS', name: 'Diária (8h seguidas)', hours: 8, validity: 1, desc: 'Um dia inteiro de atendimento.' },
    { type: 'SATURDAY_HOUR', name: 'Sábado - Hora', hours: 1, validity: 1, desc: 'Atendimento aos sábados.' },
    { type: 'SATURDAY_5H', name: 'Sábado - Pacote 5h', hours: 5, validity: 1, desc: 'Manhã ou tarde de sábado.' },
  ];

  let productCount = 0;
  const roomKeys = ['SALA_A', 'SALA_B', 'SALA_C'];

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const roomKey = roomKeys[i];
    const pricesForRoom = PRICES_V3[roomKey].prices;

    for (const pt of productTypes) {
      const price = pricesForRoom[pt.type];
      if (!price) continue;

      await prisma.product.create({
        data: {
          name: `${pt.name} - ${room.name}`,
          slug: `${pt.type.toLowerCase().replace(/_/g, '-')}-${room.slug}`,
          description: pt.desc,
          type: pt.type,
          price: price,
          hoursIncluded: pt.hours,
          validityDays: pt.validity,
          isActive: true,
          isFeatured: pt.type === 'PACKAGE_10H' || pt.type === 'PACKAGE_20H',
          sortOrder: productCount + 1,
          roomId: room.id,
        },
      });
      productCount++;
    }
  }

  console.log(`✅ ${productCount} produtos criados`);

  // ---- Resumo dos Preços V3 ----
  console.log('\n📊 RESUMO DOS PREÇOS V3:');
  console.log('═'.repeat(60));
  
  for (const roomKey of roomKeys) {
    const roomData = PRICES_V3[roomKey];
    console.log(`\n🏠 ${roomData.name} - ${roomData.subtitle}`);
    console.log('-'.repeat(40));
    console.log(`  Hora avulsa:     R$ ${(roomData.prices.HOURLY_RATE / 100).toFixed(2)}`);
    console.log(`  Pacote 10h:      R$ ${(roomData.prices.PACKAGE_10H / 100).toFixed(2)}`);
    console.log(`  Pacote 20h:      R$ ${(roomData.prices.PACKAGE_20H / 100).toFixed(2)}`);
    console.log(`  Pacote 40h:      R$ ${(roomData.prices.PACKAGE_40H / 100).toFixed(2)}`);
    console.log(`  Turno fixo 16h:  R$ ${(roomData.prices.SHIFT_FIXED / 100).toFixed(2)}`);
    console.log(`  Diária 8h:       R$ ${(roomData.prices.DAY_PASS / 100).toFixed(2)}`);
    console.log(`  Sábado hora:     R$ ${(roomData.prices.SATURDAY_HOUR / 100).toFixed(2)}`);
    console.log(`  Sábado 5h:       R$ ${(roomData.prices.SATURDAY_5H / 100).toFixed(2)}`);
  }

  console.log('\n═'.repeat(60));
  console.log('✅ Seed V3 concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
