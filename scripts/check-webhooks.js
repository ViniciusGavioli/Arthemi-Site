const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.webhookEvent.findMany({
    take: 10,
    orderBy: { processedAt: 'desc' },
  });
  
  console.log('=== ÚLTIMOS WEBHOOK EVENTS ===');
  events.forEach(e => {
    console.log(`\n[${e.status}] ${e.eventType}`);
    console.log(`  Event ID: ${e.eventId}`);
    console.log(`  Payment ID: ${e.paymentId}`);
    console.log(`  Booking ID: ${e.bookingId}`);
    console.log(`  Processed: ${e.processedAt}`);
  });
  
  if (events.length === 0) {
    console.log('\n⚠️ Nenhum webhook recebido ainda!');
  }
}

main().finally(() => prisma.$disconnect());
