// Script de correção: remove "Pia com água quente" do Consultório 1
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const room = await prisma.room.findFirst({ where: { slug: 'sala-a' } });
    if (!room) { console.log('❌ Sala A não encontrada'); return; }

    console.log('Amenities atuais:', room.amenities);

    const updated = room.amenities.filter(a => a !== 'Pia com água quente');

    await prisma.room.update({
        where: { id: room.id },
        data: { amenities: updated },
    });

    console.log('✅ Amenities atualizados:', updated);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
