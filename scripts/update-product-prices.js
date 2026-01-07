// ===========================================================
// Script: Atualizar preços dos produtos para CENTAVOS corretos
// ===========================================================
// PRICES_V3 está em REAIS, DB deve estar em CENTAVOS (Int)
// 
// IDEMPOTENTE: Detecta se valores já estão em centavos e pula
// SEGURO: Roda em transação, rollback automático em erro
//
// USO:
//   node scripts/update-product-prices.js           # Executa
//   node scripts/update-product-prices.js --dry-run # Apenas simula
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
  console.log('  HOTFIX: Atualizar preços dos produtos para CENTAVOS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (simulação)' : '⚡ EXECUÇÃO REAL'}`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const products = await prisma.product.findMany({
    include: { room: true },
  });

  const changes = [];
  const skipped = [];

  for (const product of products) {
    if (!product.room) {
      skipped.push({ id: product.id, name: product.name, reason: 'sem sala vinculada' });
      continue;
    }

    const roomKey = ROOM_SLUG_TO_KEY[product.room.slug];
    if (!roomKey) {
      skipped.push({ id: product.id, name: product.name, reason: 'sala desconhecida' });
      continue;
    }

    const priceReais = PRICES_V3[roomKey]?.prices?.[product.type];
    if (!priceReais) {
      skipped.push({ id: product.id, name: product.name, reason: `tipo sem preço: ${product.type}` });
      continue;
    }

    const expectedCents = Math.round(priceReais * 100);

    // Verificar se já está em centavos
    if (isAlreadyCentavos(product.price, expectedCents)) {
      skipped.push({ id: product.id, name: product.name, reason: 'já em centavos', value: product.price });
      continue;
    }

    const change = {
      id: product.id,
      name: product.name,
      type: product.type,
      before: product.price,
      after: expectedCents,
    };
    changes.push(change);

    console.log(`📦 ${product.name} [${product.type}]`);
    console.log(`   ANTES:  ${product.price} → DEPOIS: ${expectedCents}`);
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
    console.log('   Para executar: node scripts/update-product-prices.js');
    return;
  }

  // Executar em transação
  console.log('\n⏳ Aplicando alterações em transação...');
  
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.product.update({
        where: { id: change.id },
        data: { price: change.after },
      });
    }
  });

  console.log('\n✅ SUCESSO! Alterações aplicadas:');
  for (const change of changes) {
    console.log(`   ✓ ${change.name}: ${change.before} → ${change.after}`);
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
