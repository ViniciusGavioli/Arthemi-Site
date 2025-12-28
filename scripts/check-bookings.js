const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      amountPaid: true,
      isManual: true,
      paymentId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.log('=== ULTIMAS 10 RESERVAS ===');
  bookings.forEach(b => {
    console.log('ID:', b.id.slice(0,8), '| Status:', b.status, '| PaymentStatus:', b.paymentStatus, '| Amount:', b.amountPaid, '| Manual:', b.isManual, '| PaymentId:', b.paymentId || 'NULL');
  });
  
  const webhooks = await prisma.webhookEvent.findMany({
    take: 5,
  });
  
  console.log('\n=== WEBHOOKS ===');
  console.log('Total registros:', webhooks.length);
  
  const counts = await Promise.all([
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.booking.count({ where: { status: 'CONFIRMED' } }),
    prisma.booking.count({ where: { paymentStatus: 'APPROVED' } }),
    prisma.booking.count({ where: { amountPaid: { gt: 0 } } }),
  ]);
  
  console.log('\n=== CONTAGENS ===');
  console.log('PENDING:', counts[0]);
  console.log('CONFIRMED:', counts[1]);
  console.log('PaymentStatus APPROVED:', counts[2]);
  console.log('AmountPaid > 0:', counts[3]);
  
  await prisma.$disconnect();
}

check().catch(console.error);
