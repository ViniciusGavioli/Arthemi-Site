// ===========================================================
// Script: Atualizar preços das salas para CENTAVOS corretos
// ===========================================================
// PRICES_V3 está em REAIS, DB deve estar em CENTAVOS (Int)
// 
// IDEMPOTENTE: Detecta se valores já estão em centavos e pula
// SEGURO: Roda em transação, rollback automático em erro
//
// USO:
//   node scripts/update-room-prices.js           # Executa
//   node scripts/update-room-prices.js --dry-run # Apenas simula
//
// ===========================================================

const { PrismaClient } = require('@prisma/client');
const { PRICES_V3 } = require('./prices-v3');

const prisma = new PrismaClient();

const ROOM_SLUG_TO_KEY = {
  'sala-a': 'SALA_A',
  'sala-b': 'SALA_B',
  'sala-c': 'SALA_C',
};

// Threshold: valores >= 1000 já estão em centavos (R$ 10,00+)
const CENTAVOS_THRESHOLD = 1000;

const DRY_RUN = process.argv.includes('--dry-run');

function isAlreadyCentavos(value, expectedCents) {
  // Se o valor atual é >= threshold E está próximo do esperado (±5%), já está em centavos
  if (value >= CENTAVOS_THRESHOLD) {
    const diff = Math.abs(value - expectedCents) / expectedCents;
    return diff < 0.05; // 5% de tolerância
  }
  // Se valor < 100, claramente está em reais (ex: 59.99 ou 60)
  return false;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  HOTFIX: Atualizar preços das salas para CENTAVOS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (simulação)' : '⚡ EXECUÇÃO REAL'}`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const rooms = await prisma.room.findMany();
  const changes = [];
  const skipped = [];

  for (const room of rooms) {
    const roomKey = ROOM_SLUG_TO_KEY[room.slug];
    if (!roomKey) {
      console.log(`⚠️  IGNORADO: ${room.name} (slug desconhecido: ${room.slug})`);
      skipped.push({ id: room.id, name: room.name, reason: 'slug desconhecido' });
      continue;
    }

    const prices = PRICES_V3[roomKey].prices;
    const expectedCents = {
      hourlyRate: Math.round(prices.HOURLY_RATE * 100),
      pricePerHour: Math.round(prices.HOURLY_RATE * 100),
      pricePackage4: Math.round(prices.HOURLY_RATE * 100 * 4 * 0.95),
      pricePackage8: Math.round(prices.HOURLY_RATE * 100 * 8 * 0.90),
      priceShift: Math.round(prices.SHIFT_FIXED * 100),
    };

    // Verificar se já está em centavos
    if (isAlreadyCentavos(room.pricePerHour, expectedCents.pricePerHour)) {
      console.log(`✓  PULAR: ${room.name} - já está em centavos (${room.pricePerHour})`);
      skipped.push({ id: room.id, name: room.name, reason: 'já em centavos', value: room.pricePerHour });
      continue;
    }

    const change = {
      id: room.id,
      name: room.name,
      slug: room.slug,
      before: {
        hourlyRate: room.hourlyRate,
        pricePerHour: room.pricePerHour,
        pricePackage4: room.pricePackage4,
        pricePackage8: room.pricePackage8,
        priceShift: room.priceShift,
      },
      after: expectedCents,
    };
    changes.push(change);

    console.log(`\n📍 ${room.name} (${room.slug}) [${room.id}]`);
    console.log(`   ANTES:  hourlyRate=${room.hourlyRate}, pricePerHour=${room.pricePerHour}, priceShift=${room.priceShift}`);
    console.log(`   DEPOIS: hourlyRate=${expectedCents.hourlyRate}, pricePerHour=${expectedCents.pricePerHour}, priceShift=${expectedCents.priceShift}`);
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`  RESUMO: ${changes.length} alterações, ${skipped.length} ignorados`);
  console.log('───────────────────────────────────────────────────────────');

  if (changes.length === 0) {
    console.log('\n✅ Nenhuma alteração necessária. Todos os valores já estão corretos.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN: Nenhuma alteração foi aplicada.');
    console.log('   Para executar: node scripts/update-room-prices.js');
    return;
  }

  // Executar em transação
  console.log('\n⏳ Aplicando alterações em transação...');
  
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.room.update({
        where: { id: change.id },
        data: change.after,
      });
    }
  });

  console.log('\n✅ SUCESSO! Alterações aplicadas:');
  for (const change of changes) {
    console.log(`   ✓ ${change.name}: ${change.before.pricePerHour} → ${change.after.pricePerHour}`);
  }

  // Log JSON para auditoria
  console.log('\n📋 LOG JSON (para auditoria):');
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), changes, skipped }, null, 2));
}

main()
  .catch((err) => {
    console.error('\n❌ ERRO:', err.message);
    console.error('   Nenhuma alteração foi aplicada (rollback automático).');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
