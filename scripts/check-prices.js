const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    select: { name: true, pricePerHour: true, slug: true }
  });
  console.log('Room prices in DB:');
  console.log(JSON.stringify(rooms, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
