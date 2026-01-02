const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'viniciusgavioli528@gmail.com';
  
  const user = await prisma.user.findUnique({ 
    where: { email } 
  });
  
  if (user) {
    await prisma.user.delete({ 
      where: { email } 
    });
    console.log('✅ Usuário apagado:', email);
  } else {
    console.log('❌ Usuário não encontrado:', email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
