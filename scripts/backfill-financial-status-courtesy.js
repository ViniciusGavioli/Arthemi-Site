/**
 * Backfill B — Reservas manuais antigas
 * 
 * Onde isManual = true e paymentStatus != APPROVED
 * → setar:
 *   - origin = ADMIN_COURTESY
 *   - financialStatus = COURTESY
 *   - courtesyReason = "Backfill automático (reservas manuais antigas)"
 * 
 * Script idempotente: pode rodar múltiplas vezes sem efeito colateral
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Backfill B — Reservas Manuais (Cortesia)');
  console.log('='.repeat(50));

  // Busca reservas que precisam de atualização
  const bookingsToUpdate = await prisma.booking.findMany({
    where: {
      isManual: true,
      paymentStatus: { not: 'APPROVED' },
      origin: 'COMMERCIAL', // Ainda não foi atualizado
    },
    select: {
      id: true,
      paymentStatus: true,
      financialStatus: true,
      origin: true,
      isManual: true,
      createdAt: true,
    },
  });

  console.log(`📊 Encontradas ${bookingsToUpdate.length} reservas manuais para atualizar`);

  if (bookingsToUpdate.length === 0) {
    console.log('✅ Nenhuma reserva pendente de backfill');
    return;
  }

  // Atualiza em batch
  const result = await prisma.booking.updateMany({
    where: {
      isManual: true,
      paymentStatus: { not: 'APPROVED' },
      origin: 'COMMERCIAL',
    },
    data: {
      origin: 'ADMIN_COURTESY',
      financialStatus: 'COURTESY',
      courtesyReason: 'Backfill automático (reservas manuais antigas)',
    },
  });

  console.log(`✅ ${result.count} reservas atualizadas para:`);
  console.log('   - origin = ADMIN_COURTESY');
  console.log('   - financialStatus = COURTESY');
  console.log('   - courtesyReason preenchido');
  console.log('='.repeat(50));
}

main()
  .catch((error) => {
    console.error('❌ Erro no backfill:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
