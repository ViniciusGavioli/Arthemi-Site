// ===========================================================
// Script de Teste de Banco de Dados - Espaço Arthemi
// ===========================================================
// Testa todas as operações CRUD e conexões com o banco

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  console.log('🧪 INICIANDO TESTES DE BANCO DE DADOS...\n');
  console.log('═'.repeat(60));
  
  let passed = 0;
  let failed = 0;

  // ============================================
  // TESTE 1: Conexão básica
  // ============================================
  try {
    await prisma.$connect();
    console.log('✅ TESTE 1: Conexão com banco de dados - OK');
    passed++;
  } catch (error) {
    console.log('❌ TESTE 1: Conexão com banco de dados - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
    process.exit(1);
  }

  // ============================================
  // TESTE 2: Listar Salas
  // ============================================
  try {
    const rooms = await prisma.room.findMany();
    if (rooms.length === 3) {
      console.log('✅ TESTE 2: Listar salas (3 salas encontradas) - OK');
      rooms.forEach(r => console.log(`   → ${r.name}: R$ ${(r.hourlyRate / 100).toFixed(2)}/hora`));
      passed++;
    } else {
      console.log(`❌ TESTE 2: Esperava 3 salas, encontrou ${rooms.length}`);
      failed++;
    }
  } catch (error) {
    console.log('❌ TESTE 2: Listar salas - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 3: Listar Produtos
  // ============================================
  try {
    const products = await prisma.product.findMany();
    if (products.length >= 24) {
      console.log(`✅ TESTE 3: Listar produtos (${products.length} produtos) - OK`);
      passed++;
    } else {
      console.log(`❌ TESTE 3: Esperava 24+ produtos, encontrou ${products.length}`);
      failed++;
    }
  } catch (error) {
    console.log('❌ TESTE 3: Listar produtos - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 4: Listar Usuários
  // ============================================
  try {
    const users = await prisma.user.findMany();
    console.log(`✅ TESTE 4: Listar usuários (${users.length} usuários) - OK`);
    users.forEach(u => console.log(`   → ${u.name} (${u.email}) - ${u.role}`));
    passed++;
  } catch (error) {
    console.log('❌ TESTE 4: Listar usuários - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 5: Buscar sala por slug
  // ============================================
  try {
    const salaA = await prisma.room.findUnique({
      where: { slug: 'sala-a' },
      include: { products: true }
    });
    if (salaA && salaA.products.length > 0) {
      console.log(`✅ TESTE 5: Buscar Sala A com produtos (${salaA.products.length} produtos) - OK`);
      passed++;
    } else {
      console.log('❌ TESTE 5: Sala A não encontrada ou sem produtos');
      failed++;
    }
  } catch (error) {
    console.log('❌ TESTE 5: Buscar sala por slug - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 6: Criar reserva de teste
  // ============================================
  let testBookingId = null;
  try {
    const room = await prisma.room.findFirst();
    const user = await prisma.user.findFirst();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);
    
    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        userId: user.id,
        startTime: tomorrow,
        endTime: endTime,
        status: 'PENDING',
        bookingType: 'HOURLY',
        notes: 'Reserva de teste - pode deletar'
      }
    });
    testBookingId = booking.id;
    console.log('✅ TESTE 6: Criar reserva de teste - OK');
    console.log(`   → Reserva ID: ${booking.id}`);
    passed++;
  } catch (error) {
    console.log('❌ TESTE 6: Criar reserva - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 7: Listar reservas
  // ============================================
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        room: true,
        user: true
      }
    });
    console.log(`✅ TESTE 7: Listar reservas (${bookings.length} reservas) - OK`);
    passed++;
  } catch (error) {
    console.log('❌ TESTE 7: Listar reservas - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 8: Atualizar reserva
  // ============================================
  try {
    if (testBookingId) {
      const updated = await prisma.booking.update({
        where: { id: testBookingId },
        data: { status: 'CONFIRMED' }
      });
      console.log('✅ TESTE 8: Atualizar status da reserva - OK');
      console.log(`   → Status alterado para: ${updated.status}`);
      passed++;
    }
  } catch (error) {
    console.log('❌ TESTE 8: Atualizar reserva - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 9: Deletar reserva de teste
  // ============================================
  try {
    if (testBookingId) {
      await prisma.booking.delete({
        where: { id: testBookingId }
      });
      console.log('✅ TESTE 9: Deletar reserva de teste - OK');
      passed++;
    }
  } catch (error) {
    console.log('❌ TESTE 9: Deletar reserva - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // TESTE 10: Verificar preços V3
  // ============================================
  try {
    const salaA = await prisma.room.findUnique({ where: { slug: 'sala-a' } });
    const salaB = await prisma.room.findUnique({ where: { slug: 'sala-b' } });
    const salaC = await prisma.room.findUnique({ where: { slug: 'sala-c' } });
    
    const expectedA = 5999; // R$ 59.99 em centavos
    const expectedB = 4999; // R$ 49.99 em centavos
    const expectedC = 3999; // R$ 39.99 em centavos
    
    if (salaA.hourlyRate === expectedA && salaB.hourlyRate === expectedB && salaC.hourlyRate === expectedC) {
      console.log('✅ TESTE 10: Verificar preços V3 - OK');
      console.log(`   → Sala A: R$ ${(salaA.hourlyRate/100).toFixed(2)} ✓`);
      console.log(`   → Sala B: R$ ${(salaB.hourlyRate/100).toFixed(2)} ✓`);
      console.log(`   → Sala C: R$ ${(salaC.hourlyRate/100).toFixed(2)} ✓`);
      passed++;
    } else {
      console.log('❌ TESTE 10: Preços V3 não conferem');
      console.log(`   → Sala A: R$ ${(salaA.hourlyRate/100).toFixed(2)} (esperado: R$ 59.99)`);
      console.log(`   → Sala B: R$ ${(salaB.hourlyRate/100).toFixed(2)} (esperado: R$ 49.99)`);
      console.log(`   → Sala C: R$ ${(salaC.hourlyRate/100).toFixed(2)} (esperado: R$ 39.99)`);
      failed++;
    }
  } catch (error) {
    console.log('❌ TESTE 10: Verificar preços V3 - FALHOU');
    console.log('   Erro:', error.message);
    failed++;
  }

  // ============================================
  // RESULTADO FINAL
  // ============================================
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTADO DOS TESTES:');
  console.log('═'.repeat(60));
  console.log(`   ✅ Passaram: ${passed}`);
  console.log(`   ❌ Falharam: ${failed}`);
  console.log(`   📈 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! Banco de dados está 100% funcional.\n');
  } else {
    console.log('\n⚠️  Alguns testes falharam. Verifique os erros acima.\n');
  }

  await prisma.$disconnect();
}

testDatabase().catch(async (e) => {
  console.error('Erro fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
