// ===========================================================
// Script para atualizar tiers das salas existentes
// Execute: node scripts/update-room-tiers.js
// ===========================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Atualizando tiers dos consultórios...\n');

  // Atualizar Consultório 1 = tier 1
  const salaA = await prisma.room.updateMany({
    where: { slug: 'sala-a' },
    data: { tier: 1 },
  });
  console.log(`✅ Consultório 1: ${salaA.count} registro(s) atualizado(s) para tier 1`);

  // Atualizar Consultório 2 = tier 2
  const salaB = await prisma.room.updateMany({
    where: { slug: 'sala-b' },
    data: { tier: 2 },
  });
  console.log(`✅ Consultório 2: ${salaB.count} registro(s) atualizado(s) para tier 2`);

  // Atualizar Consultório 3 = tier 3
  const salaC = await prisma.room.updateMany({
    where: { slug: 'sala-c' },
    data: { tier: 3 },
  });
  console.log(`✅ Consultório 3: ${salaC.count} registro(s) atualizado(s) para tier 3`);

  // Verificar resultado
  const rooms = await prisma.room.findMany({
    select: { name: true, slug: true, tier: true },
    orderBy: { tier: 'asc' },
  });

  console.log('\n📋 Resultado:');
  rooms.forEach((room) => {
    console.log(`   ${room.name} (${room.slug}): Tier ${room.tier}`);
  });

  console.log('\n✅ Tiers atualizados com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
