const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Conectando ao banco...');
    
    // Buscar todas as rooms (sem filtro)
    const allRooms = await prisma.room.findMany();
    console.log('\n=== TODAS AS ROOMS ===');
    console.log('Total:', allRooms.length);
    allRooms.forEach(r => {
      console.log(`  - ${r.name} | slug: ${r.slug} | isActive: ${r.isActive}`);
    });
    
    // Buscar rooms ativas
    const activeRooms = await prisma.room.findMany({
      where: { isActive: true }
    });
    console.log('\n=== ROOMS ATIVAS ===');
    console.log('Total:', activeRooms.length);
    activeRooms.forEach(r => {
      console.log(`  - ${r.name} | slug: ${r.slug}`);
    });
    
  } catch (error) {
    console.error('ERRO:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
