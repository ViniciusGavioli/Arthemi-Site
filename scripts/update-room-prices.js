// ===========================================================
// Script: Atualizar preços das salas para CENTAVOS corretos
// ===========================================================
// PRICES_V3 está em REAIS, DB deve estar em CENTAVOS (Int)
// Execute com: node scripts/update-room-prices.js

const { PrismaClient } = require('@prisma/client');
const PRICES_V3 = require('../src/constants/prices').PRICES_V3;

const prisma = new PrismaClient();

const ROOM_SLUG_TO_KEY = {
  'sala-a': 'SALA_A',
  'sala-b': 'SALA_B',
  'sala-c': 'SALA_C',
};

async function main() {
  console.log('🔄 Atualizando preços das salas para CENTAVOS...\n');

  const rooms = await prisma.room.findMany();

  for (const room of rooms) {
    const roomKey = ROOM_SLUG_TO_KEY[room.slug];
    if (!roomKey) {
      console.log(`⚠️ Sala ignorada (slug desconhecido): ${room.name} (${room.slug})`);
      continue;
    }

    const prices = PRICES_V3[roomKey].prices;
    const hourlyRateCents = Math.round(prices.HOURLY_RATE * 100);
    const shiftPriceCents = Math.round(prices.SHIFT_FIXED * 100);
    const package4Cents = Math.round(hourlyRateCents * 4 * 0.95);
    const package8Cents = Math.round(hourlyRateCents * 8 * 0.90);

    console.log(`📍 ${room.name} (${room.slug}):`);
    console.log(`   Antes: hourlyRate=${room.hourlyRate}, pricePerHour=${room.pricePerHour}`);

    await prisma.room.update({
      where: { id: room.id },
      data: {
        hourlyRate: hourlyRateCents,
        pricePerHour: hourlyRateCents,
        pricePackage4: package4Cents,
        pricePackage8: package8Cents,
        priceShift: shiftPriceCents,
      },
    });

    console.log(`   Depois: hourlyRate=${hourlyRateCents}, pricePerHour=${hourlyRateCents}`);
    console.log(`   ✅ Atualizado!`);
  }

  console.log('\n✅ Todos os preços atualizados para CENTAVOS!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
