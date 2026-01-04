// Listar últimos webhooks recebidos
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const webhooks = await prisma.webhookEvent.findMany({
    take: 20,
    orderBy: { processedAt: 'desc' },
  });

  console.log(`\n📥 Últimos ${webhooks.length} webhooks:\n`);
  
  if (webhooks.length === 0) {
    console.log('⚠️  Nenhum webhook registrado no banco.');
    console.log('   Isso significa que o Asaas nunca enviou webhook para este sistema,');
    console.log('   ou os webhooks não estão sendo autenticados corretamente.');
    return;
  }

  webhooks.forEach((w, i) => {
    console.log(`${i + 1}. ${w.eventType}`);
    console.log(`   Event ID: ${w.eventId}`);
    console.log(`   Payment ID: ${w.paymentId || 'N/A'}`);
    console.log(`   Booking/Credit: ${w.bookingId || 'N/A'}`);
    console.log(`   Status: ${w.status}`);
    console.log(`   Data: ${w.processedAt.toISOString()}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
