/**
 * Validação — Resumo do financialStatus
 * 
 * Agrupa reservas por financialStatus e imprime contagem
 * Confirma existência apenas de: PAID, COURTESY, PENDING_PAYMENT
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Validação de financialStatus');
  console.log('='.repeat(50));

  // Contagem por financialStatus
  const [pending, paid, courtesy] = await Promise.all([
    prisma.booking.count({ where: { financialStatus: 'PENDING_PAYMENT' } }),
    prisma.booking.count({ where: { financialStatus: 'PAID' } }),
    prisma.booking.count({ where: { financialStatus: 'COURTESY' } }),
  ]);

  const total = pending + paid + courtesy;

  console.log('');
  console.log('📋 RESERVAS POR STATUS FINANCEIRO:');
  console.log('');
  console.log(`  PENDING_PAYMENT: ${pending}`);
  console.log(`  PAID:            ${paid}`);
  console.log(`  COURTESY:        ${courtesy}`);
  console.log('  ' + '-'.repeat(25));
  console.log(`  TOTAL:           ${total}`);
  console.log('');

  // Contagem por origin
  const [commercial, adminCourtesy] = await Promise.all([
    prisma.booking.count({ where: { origin: 'COMMERCIAL' } }),
    prisma.booking.count({ where: { origin: 'ADMIN_COURTESY' } }),
  ]);

  console.log('📋 RESERVAS POR ORIGEM:');
  console.log('');
  console.log(`  COMMERCIAL:      ${commercial}`);
  console.log(`  ADMIN_COURTESY:  ${adminCourtesy}`);
  console.log('  ' + '-'.repeat(25));
  console.log(`  TOTAL:           ${commercial + adminCourtesy}`);
  console.log('');

  // Verificação de integridade
  const totalBookings = await prisma.booking.count();
  
  console.log('='.repeat(50));
  
  if (total === totalBookings) {
    console.log('✅ VALIDAÇÃO OK - Todas as reservas têm financialStatus válido');
  } else {
    console.log('❌ ERRO - Existem reservas sem financialStatus válido');
    console.log(`   Total no banco: ${totalBookings}`);
    console.log(`   Total com status: ${total}`);
    console.log(`   Diferença: ${totalBookings - total}`);
  }

  // Verificação de cortesias sem motivo
  const courtesyWithoutReason = await prisma.booking.count({
    where: {
      origin: 'ADMIN_COURTESY',
      courtesyReason: null,
    },
  });

  if (courtesyWithoutReason > 0) {
    console.log(`⚠️  AVISO: ${courtesyWithoutReason} cortesias sem motivo preenchido`);
  }

  console.log('='.repeat(50));
}

main()
  .catch((error) => {
    console.error('❌ Erro na validação:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
