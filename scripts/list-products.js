const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const products = await p.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, roomId: true },
    orderBy: [{ roomId: 'asc' }, { type: 'asc' }]
  });
  console.log(JSON.stringify(products, null, 2));
}

main().finally(() => p.$disconnect());
