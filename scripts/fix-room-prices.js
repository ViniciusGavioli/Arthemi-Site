#!/usr/bin/env node

/**
 * Script para corrigir preços das salas no banco de dados
 * Os preços devem estar em CENTAVOS:
 * - Consultório 1: 5999 (R$ 59,99)
 * - Consultório 2: 4999 (R$ 49,99)
 * - Consultório 3: 3999 (R$ 39,99)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CORRECT_PRICES = {
  'sala-a': {
    name: 'Consultório 1',
    pricePerHour: 5999, // R$ 59,99 em centavos
    hourlyRate: 5999,
  },
  'sala-b': {
    name: 'Consultório 2',
    pricePerHour: 4999, // R$ 49,99 em centavos
    hourlyRate: 4999,
  },
  'sala-c': {
    name: 'Consultório 3',
    pricePerHour: 3999, // R$ 39,99 em centavos
    hourlyRate: 3999,
  },
};

function formatPrice(cents) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

async function main() {
  console.log('\n🔍 Verificando preços das salas no banco de dados...\n');

  try {
    // Buscar todas as salas
    const rooms = await prisma.room.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        pricePerHour: true,
        hourlyRate: true,
      },
    });

    console.log('📋 Salas encontradas:\n');

    let hasErrors = false;
    const updates = [];

    for (const room of rooms) {
      const expected = CORRECT_PRICES[room.slug];
      
      if (!expected) {
        console.log(`⚠️  ${room.name} (${room.slug}): Slug não reconhecido`);
        continue;
      }

      const currentPriceDisplay = formatPrice(room.pricePerHour);
      const expectedPriceDisplay = formatPrice(expected.pricePerHour);
      const isCorrect = room.pricePerHour === expected.pricePerHour && 
                       room.hourlyRate === expected.hourlyRate;

      if (isCorrect) {
        console.log(`✅ ${room.name}: ${currentPriceDisplay} (correto)`);
      } else {
        console.log(`❌ ${room.name}:`);
        console.log(`   Atual: pricePerHour=${room.pricePerHour} (${formatPrice(room.pricePerHour)}), hourlyRate=${room.hourlyRate}`);
        console.log(`   Esperado: pricePerHour=${expected.pricePerHour} (${expectedPriceDisplay}), hourlyRate=${expected.hourlyRate}`);
        hasErrors = true;

        updates.push({
          id: room.id,
          name: room.name,
          slug: room.slug,
          data: {
            pricePerHour: expected.pricePerHour,
            hourlyRate: expected.hourlyRate,
          },
        });
      }
    }

    if (!hasErrors) {
      console.log('\n✅ Todos os preços estão corretos!\n');
      process.exit(0);
    }

    console.log('\n⚠️  Alguns preços estão incorretos.\n');

    // Perguntar se quer corrigir (se tiver updates)
    if (updates.length === 0) {
      console.log('Nenhuma atualização necessária.\n');
      process.exit(0);
    }

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Deseja corrigir automaticamente? (s/N): ', async (answer) => {
      if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim') {
        console.log('\n🔧 Corrigindo preços...\n');

        for (const update of updates) {
          try {
            await prisma.room.update({
              where: { id: update.id },
              data: update.data,
            });
            console.log(`✅ ${update.name} atualizado: ${formatPrice(update.data.pricePerHour)}`);
          } catch (error) {
            console.error(`❌ Erro ao atualizar ${update.name}:`, error.message);
          }
        }

        console.log('\n✅ Preços corrigidos com sucesso!\n');
      } else {
        console.log('\n❌ Operação cancelada.\n');
        console.log('💡 Para corrigir manualmente, execute:\n');
        for (const update of updates) {
          console.log(`UPDATE rooms SET "pricePerHour" = ${update.data.pricePerHour}, "hourlyRate" = ${update.data.hourlyRate} WHERE slug = '${update.slug}';`);
        }
        console.log('');
      }

      await prisma.$disconnect();
      rl.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
