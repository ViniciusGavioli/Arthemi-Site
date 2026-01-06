// Script para desativar produtos descontinuados no banco
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Desativando produtos descontinuados...\n');
  
  // Desativar produtos descontinuados (um por um devido ao enum do Prisma)
  const discontinuedTypes = ['DAY_PASS', 'SHIFT_FIXED', 'SATURDAY_5H'];
  let totalDeactivated = 0;
  
  for (const type of discontinuedTypes) {
    const result = await prisma.product.updateMany({
      where: { type },
      data: { isActive: false }
    });
    console.log(`  ${type}: ${result.count} desativados`);
    totalDeactivated += result.count;
  }
  
  console.log(`\nTotal de produtos desativados: ${totalDeactivated}`);
  
  // Verificar estado atual
  const products = await prisma.product.findMany({
    select: { type: true, isActive: true },
    orderBy: { type: 'asc' }
  });
  
  console.log('\nEstado atual dos produtos:');
  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.type]) grouped[p.type] = { active: 0, inactive: 0 };
    if (p.isActive) grouped[p.type].active++;
    else grouped[p.type].inactive++;
  });
  
  Object.entries(grouped).forEach(([type, counts]) => {
    const status = counts.active > 0 ? '✅ ATIVO' : '❌ INATIVO';
    console.log(`  ${type}: ${status} (${counts.active} ativos, ${counts.inactive} inativos)`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
