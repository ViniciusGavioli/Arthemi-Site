// ===========================================================
// Script: Verificar preços no banco de dados
// ===========================================================
// Mostra valores atuais e indica se estão em REAIS ou CENTAVOS
//
// USO: node scripts/check-prices.js
// ===========================================================

const { PrismaClient } = require('@prisma/client');
const { PRICES_V3 } = require('./prices-v3');

const prisma = new PrismaClient();

const ROOM_SLUG_TO_KEY = {
  'sala-a': 'SALA_A',
  'sala-b': 'SALA_B',
  'sala-c': 'SALA_C',
};

function formatCurrency(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function detectUnit(value, expectedCents) {
  if (value >= 1000 && Math.abs(value - expectedCents) / expectedCents < 0.05) {
    return { unit: 'CENTAVOS', status: '✅ OK' };
  }
  if (value < 100) {
    return { unit: 'REAIS', status: '❌ ERRO - precisa corrigir' };
  }
  return { unit: '???', status: '⚠️ VERIFICAR' };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO: Preços no Banco de Dados');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ============ SALAS ============
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  SALAS (rooms)                                          │');
  console.log('└─────────────────────────────────────────────────────────┘');

  const rooms = await prisma.room.findMany({ orderBy: { tier: 'asc' } });
  let roomsOK = 0;
  let roomsERRO = 0;

  for (const room of rooms) {
    const roomKey = ROOM_SLUG_TO_KEY[room.slug];
    const expectedCents = roomKey ? Math.round(PRICES_V3[roomKey].prices.HOURLY_RATE * 100) : 0;
    const { unit, status } = detectUnit(room.pricePerHour, expectedCents);

    console.log(`\n  ${room.name} (${room.slug})`);
    console.log(`    pricePerHour: ${room.pricePerHour} (${unit}) → ${formatCurrency(room.pricePerHour)} ${status}`);
    console.log(`    hourlyRate:   ${room.hourlyRate}`);
    console.log(`    priceShift:   ${room.priceShift}`);
    console.log(`    Esperado:     ${expectedCents} centavos = ${formatCurrency(expectedCents)}`);

    if (status.includes('OK')) roomsOK++;
    else roomsERRO++;
  }

  // ============ PRODUTOS ============
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  PRODUTOS (products)                                    │');
  console.log('└─────────────────────────────────────────────────────────┘');

  const products = await prisma.product.findMany({
    include: { room: true },
    orderBy: { name: 'asc' },
  });

  let prodsOK = 0;
  let prodsERRO = 0;

  for (const product of products) {
    const roomKey = product.room ? ROOM_SLUG_TO_KEY[product.room.slug] : null;
    const priceReais = roomKey ? PRICES_V3[roomKey]?.prices?.[product.type] : null;
    const expectedCents = priceReais ? Math.round(priceReais * 100) : 0;
    const { unit, status } = expectedCents ? detectUnit(product.price, expectedCents) : { unit: 'N/A', status: '⚠️' };

    console.log(`\n  ${product.name}`);
    console.log(`    price: ${product.price} (${unit}) → ${formatCurrency(product.price)} ${status}`);
    if (expectedCents) {
      console.log(`    Esperado: ${expectedCents} centavos = ${formatCurrency(expectedCents)}`);
    }

    if (status.includes('OK')) prodsOK++;
    else prodsERRO++;
  }

  // ============ RESUMO ============
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Salas:    ${roomsOK} OK, ${roomsERRO} com erro`);
  console.log(`  Produtos: ${prodsOK} OK, ${prodsERRO} com erro`);
  console.log('═══════════════════════════════════════════════════════════');

  if (roomsERRO === 0 && prodsERRO === 0) {
    console.log('\n✅ TODOS OS PREÇOS ESTÃO CORRETOS (em centavos)!\n');
  } else {
    console.log('\n❌ AÇÃO NECESSÁRIA: Execute os scripts de correção:\n');
    console.log('   node scripts/update-room-prices.js');
    console.log('   node scripts/update-product-prices.js\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
