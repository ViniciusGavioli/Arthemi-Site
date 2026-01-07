// AUDITORIA FORENSE - Dump completo do banco
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AUDITORIA FORENSE - BANCO DE DADOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ROOMS
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  TABELA: rooms                                          │');
  console.log('└─────────────────────────────────────────────────────────┘');
  
  const rooms = await p.room.findMany({
    select: { id: true, name: true, slug: true, hourlyRate: true, pricePerHour: true, priceShift: true, pricePackage4: true, pricePackage8: true }
  });
  
  let roomBugs = 0;
  for (const r of rooms) {
    const isBug = r.pricePerHour < 1000 || r.hourlyRate < 1000;
    const status = isBug ? '❌ BUG' : '✅ OK';
    if (isBug) roomBugs++;
    console.log(`\n  ${r.name} (${r.slug}) ${status}`);
    console.log(`    id:           ${r.id}`);
    console.log(`    hourlyRate:   ${r.hourlyRate} ${r.hourlyRate < 1000 ? '⚠️ SUSPEITO' : ''}`);
    console.log(`    pricePerHour: ${r.pricePerHour} ${r.pricePerHour < 1000 ? '⚠️ SUSPEITO' : ''}`);
    console.log(`    priceShift:   ${r.priceShift}`);
    console.log(`    pricePackage4: ${r.pricePackage4}`);
    console.log(`    pricePackage8: ${r.pricePackage8}`);
  }

  // PRODUCTS
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  TABELA: products                                       │');
  console.log('└─────────────────────────────────────────────────────────┘');
  
  const products = await p.product.findMany({
    select: { id: true, name: true, type: true, price: true, roomId: true },
    orderBy: { name: 'asc' }
  });
  
  let prodBugs = 0;
  for (const pr of products) {
    // Para HOURLY_RATE, esperamos ~4000-6000. Para pacotes, ~35000-200000
    const isBug = pr.price < 1000;
    const status = isBug ? '❌ BUG' : '✅';
    if (isBug) prodBugs++;
    console.log(`  ${status} ${pr.name} | type=${pr.type} | price=${pr.price}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  RESUMO: Rooms com bug: ${roomBugs}, Products com bug: ${prodBugs}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error).finally(() => p.$disconnect());
