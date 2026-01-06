// Script para verificar estado atual dos produtos no banco
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { type: true, name: true, price: true, hoursIncluded: true, isActive: true, roomId: true },
    orderBy: [{ type: 'asc' }, { roomId: 'asc' }]
  });
  
  console.log('=== PRODUTOS NO BANCO ===\n');
  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.type]) grouped[p.type] = [];
    grouped[p.type].push(p);
  });
  
  Object.entries(grouped).forEach(([type, items]) => {
    const active = items.filter(i => i.isActive).length;
    const inactive = items.filter(i => !i.isActive).length;
    const status = active > 0 ? '✅ ATIVO' : '❌ INATIVO';
    console.log(`${type}: ${status} (${active} ativos, ${inactive} inativos)`);
    if (items.length > 0) {
      console.log(`  Preço: R$ ${(items[0].price / 100).toFixed(2)}, Horas: ${items[0].hoursIncluded || 'N/A'}`);
    }
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
