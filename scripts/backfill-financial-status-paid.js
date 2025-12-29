/**
 * Backfill A — Reservas pagas
 * 
 * Onde paymentStatus = APPROVED e financialStatus = PENDING_PAYMENT
 * → setar financialStatus = PAID
 * 
 * Script idempotente: pode rodar múltiplas vezes sem efeito colateral
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Backfill A — Reservas Pagas');
  console.log('='.repeat(50));

  // Busca reservas que precisam de atualização
  const bookingsToUpdate = await prisma.booking.findMany({
    where: {
      paymentStatus: 'APPROVED',
      financialStatus: 'PENDING_PAYMENT',
    },
    select: {
      id: true,
      paymentStatus: true,
      financialStatus: true,
      isManual: true,
      createdAt: true,
    },
  });

  console.log(`📊 Encontradas ${bookingsToUpdate.length} reservas para atualizar`);

  if (bookingsToUpdate.length === 0) {
    console.log('✅ Nenhuma reserva pendente de backfill');
    return;
  }

  // Atualiza em batch
  const result = await prisma.booking.updateMany({
    where: {
      paymentStatus: 'APPROVED',
      financialStatus: 'PENDING_PAYMENT',
    },
    data: {
      financialStatus: 'PAID',
    },
  });

  console.log(`✅ ${result.count} reservas atualizadas para financialStatus = PAID`);
  console.log('='.repeat(50));
}

main()
  .catch((error) => {
    console.error('❌ Erro no backfill:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
