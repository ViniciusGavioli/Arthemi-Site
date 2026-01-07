// ===========================================================
// Script: Atualizar preços dos produtos para CENTAVOS corretos
// ===========================================================
// PRICES_V3 está em REAIS, DB deve estar em CENTAVOS (Int)
// Execute com: node scripts/update-product-prices.js

const { PrismaClient } = require('@prisma/client');
const PRICES_V3 = require('../src/constants/prices').PRICES_V3;

const prisma = new PrismaClient();

const ROOM_SLUG_TO_KEY = {
  'sala-a': 'SALA_A',
  'sala-b': 'SALA_B',
  'sala-c': 'SALA_C',
};

async function main() {
  console.log('🔄 Atualizando preços dos produtos para CENTAVOS...\n');

  // Buscar produtos com sala
  const products = await prisma.product.findMany({
    include: { room: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    if (!product.room) {
      console.log(`⚠️ Produto sem sala: ${product.name}`);
      skipped++;
      continue;
    }

    const roomKey = ROOM_SLUG_TO_KEY[product.room.slug];
    if (!roomKey) {
      console.log(`⚠️ Sala desconhecida: ${product.room.slug}`);
      skipped++;
      continue;
    }

    const priceReais = PRICES_V3[roomKey].prices[product.type];
    if (!priceReais) {
      console.log(`⚠️ Tipo de produto sem preço em PRICES_V3: ${product.type}`);
      skipped++;
      continue;
    }

    const priceCents = Math.round(priceReais * 100);

    console.log(`📦 ${product.name}:`);
    console.log(`   Antes: price=${product.price}`);

    await prisma.product.update({
      where: { id: product.id },
      data: { price: priceCents },
    });

    console.log(`   Depois: price=${priceCents} (R$ ${priceReais.toFixed(2)})`);
    updated++;
  }

  console.log(`\n✅ ${updated} produtos atualizados!`);
  if (skipped > 0) {
    console.log(`⚠️ ${skipped} produtos ignorados.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
