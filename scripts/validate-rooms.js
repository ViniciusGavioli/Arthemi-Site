/**
 * Script de Validação de Rooms
 * 
 * Verifica se as salas existem no banco de dados e estão ativas.
 * Use este script para diagnosticar problemas de "Sala não encontrada".
 * 
 * Uso:
 *   node scripts/validate-rooms.js
 *   
 * Variáveis de ambiente necessárias:
 *   DATABASE_URL - URL de conexão com o banco PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Slugs esperados (configurados no seed.js)
const EXPECTED_SLUGS = ['sala-a', 'sala-b', 'sala-c'];

async function validateRooms() {
  console.log('🔍 Validando salas no banco de dados...\n');
  
  try {
    // 1. Buscar todas as salas
    const allRooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        isActive: true,
        hourlyRate: true,
        createdAt: true,
      },
      orderBy: { tier: 'asc' },
    });

    console.log(`📊 Total de salas no banco: ${allRooms.length}\n`);

    if (allRooms.length === 0) {
      console.log('❌ ERRO: Nenhuma sala encontrada no banco!');
      console.log('   Execute: npm run seed');
      process.exit(1);
    }

    // 2. Listar todas as salas
    console.log('📋 Salas encontradas:');
    console.log('─'.repeat(80));
    
    for (const room of allRooms) {
      const status = room.isActive ? '✅ ATIVA' : '❌ INATIVA';
      console.log(`  ${status} | ID: ${room.id}`);
      console.log(`         | Nome: ${room.name}`);
      console.log(`         | Slug: ${room.slug}`);
      console.log(`         | Tier: ${room.tier}`);
      console.log(`         | Preço/hora: R$ ${(room.hourlyRate / 100).toFixed(2)}`);
      console.log(`         | Criada em: ${room.createdAt.toISOString()}`);
      console.log('');
    }

    // 3. Verificar slugs esperados
    console.log('🔍 Verificando slugs esperados:');
    console.log('─'.repeat(80));
    
    const foundSlugs = allRooms.map(r => r.slug);
    let allSlugsOk = true;
    
    for (const slug of EXPECTED_SLUGS) {
      const room = allRooms.find(r => r.slug === slug);
      if (!room) {
        console.log(`  ❌ Slug "${slug}" NÃO ENCONTRADO`);
        allSlugsOk = false;
      } else if (!room.isActive) {
        console.log(`  ⚠️  Slug "${slug}" encontrado mas INATIVO (${room.id})`);
        allSlugsOk = false;
      } else {
        console.log(`  ✅ Slug "${slug}" OK (${room.id})`);
      }
    }

    // 4. Verificar salas ativas
    const activeRooms = allRooms.filter(r => r.isActive);
    console.log(`\n📊 Resumo: ${activeRooms.length}/${allRooms.length} salas ativas`);

    // 5. Verificar se há IDs estáticos problemáticos
    const staticIds = ['sala-a-static', 'sala-b-static', 'sala-c-static'];
    const hasStaticIds = allRooms.some(r => staticIds.includes(r.id));
    
    if (hasStaticIds) {
      console.log('\n⚠️  ATENÇÃO: Encontrados IDs estáticos problemáticos!');
      console.log('   Os IDs devem ser CUIDs gerados automaticamente.');
      console.log('   Execute: npm run seed para recriar as salas.');
    }

    // 6. Status final
    console.log('\n' + '═'.repeat(80));
    if (allSlugsOk && activeRooms.length >= 3) {
      console.log('✅ VALIDAÇÃO OK - Todas as salas esperadas estão ativas');
      console.log('\nSe ainda houver erro "Sala não encontrada", verifique:');
      console.log('  1. O frontend está usando o ID correto (CUID) e não um slug');
      console.log('  2. O DATABASE_URL aponta para o banco correto');
      console.log('  3. Não há cache/build desatualizado (vercel --force)');
    } else {
      console.log('❌ VALIDAÇÃO FALHOU - Problemas encontrados');
      console.log('\nPara corrigir, execute:');
      console.log('  npm run seed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro ao validar salas:', error.message);
    console.error('\nVerifique:');
    console.error('  1. DATABASE_URL está configurado corretamente');
    console.error('  2. O banco de dados está acessível');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
validateRooms();
