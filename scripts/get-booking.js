// Quick test - get or create a booking for testing
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Get user and room
  const user = await p.user.findFirst();
  const room = await p.room.findFirst();
  
  console.log('User:', user?.id, user?.email);
  console.log('Room:', room?.id, room?.name);
  
  if (!user || !room) {
    console.log('❌ Precisa rodar seed primeiro: npx prisma db seed');
    await p.$disconnect();
    return;
  }
  
  // Check existing booking
  let booking = await p.booking.findFirst({ where: { status: 'PENDING' } });
  
  if (!booking) {
    // Create a test booking
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1); // 1 hour from now
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2); // 2 hours duration
    
    booking = await p.booking.create({
      data: {
        userId: user.id,
        roomId: room.id,
        startTime,
        endTime,
        status: 'PENDING',
      },
    });
    console.log('✅ Booking criado para teste');
  }
  
  console.log('\n📋 BOOKING PARA TESTE:');
  console.log('ID:', booking.id);
  console.log(JSON.stringify(booking, null, 2));
  
  await p.$disconnect();
}

run();
