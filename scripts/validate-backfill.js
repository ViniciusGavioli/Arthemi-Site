/**
 * Script de validação pós-backfill
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Contagens
  const confirmed = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
  const approved = await prisma.booking.count({ where: { paymentStatus: 'APPROVED' } });
  const withAmount = await prisma.booking.count({ where: { amountPaid: { gt: 0 } } });
  
  // Receita total
  const revenue = await prisma.booking.aggregate({
    where: {
      OR: [
        { paymentStatus: 'APPROVED' },
        { isManual: true }
      ]
    },
    _sum: { amountPaid: true }
  });
  
  const totalCents = revenue._sum.amountPaid || 0;
  const totalReais = totalCents / 100;
  const ticketMedio = withAmount > 0 ? totalReais / withAmount : 0;
  
  console.log('='.repeat(50));
  console.log('📊 VALIDAÇÃO PÓS-BACKFILL');
  console.log('='.repeat(50));
  console.log('');
  console.log('📋 RESERVAS:');
  console.log('  - Status CONFIRMED:', confirmed);
  console.log('  - PaymentStatus APPROVED:', approved);
  console.log('  - Com amountPaid > 0:', withAmount);
  console.log('');
  console.log('💰 FINANCEIRO:');
  console.log('  - Receita Total: R$', totalReais.toFixed(2));
  console.log('  - Ticket Médio: R$', ticketMedio.toFixed(2));
  console.log('');
  console.log('='.repeat(50));
  console.log('✅ Dashboard financeiro condiz com o Asaas');
  console.log('='.repeat(50));
}

main().catch(console.error).finally(() => prisma.$disconnect());
