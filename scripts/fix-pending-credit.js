// Script para diagnosticar e corrigir compra de crédito pendente
// Uso: node scripts/fix-pending-credit.js <creditId ou asaasPaymentId>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const searchTerm = process.argv[2];
  
  if (!searchTerm) {
    console.log('Uso: node scripts/fix-pending-credit.js <creditId ou asaasPaymentId>');
    console.log('');
    console.log('Exemplos:');
    console.log('  node scripts/fix-pending-credit.js cm...abc    # busca por creditId');
    console.log('  node scripts/fix-pending-credit.js pay_123    # busca por asaasPaymentId');
    console.log('');
    console.log('Para buscar por fatura Asaas, primeiro encontre o payment ID no painel Asaas.');
    process.exit(1);
  }

  console.log(`\n🔍 Buscando por: ${searchTerm}\n`);

  // 1. Verificar se existe webhook processado com esse payment
  const webhooks = await prisma.webhookEvent.findMany({
    where: {
      OR: [
        { paymentId: searchTerm },
        { bookingId: { contains: searchTerm } },
      ]
    },
    orderBy: { processedAt: 'desc' },
  });

  if (webhooks.length > 0) {
    console.log('📥 Webhooks encontrados:');
    webhooks.forEach(w => {
      console.log(`  - ${w.eventId}`);
      console.log(`    Tipo: ${w.eventType}`);
      console.log(`    Status: ${w.status}`);
      console.log(`    PaymentId: ${w.paymentId}`);
      console.log(`    BookingId: ${w.bookingId}`);
      console.log(`    Data: ${w.processedAt.toISOString()}`);
      console.log('');
    });
  } else {
    console.log('⚠️  Nenhum webhook encontrado para este termo.');
    console.log('    Isso pode significar:');
    console.log('    - Webhook não foi enviado pelo Asaas');
    console.log('    - URL do webhook incorreta no painel Asaas');
    console.log('    - Token de autenticação incorreto');
    console.log('');
  }

  // 2. Buscar crédito diretamente
  let credit = await prisma.credit.findUnique({
    where: { id: searchTerm },
    include: { user: true, room: true },
  });

  // Se não achou por ID, buscar créditos pendentes recentes
  if (!credit) {
    console.log('🔍 Buscando créditos PENDING recentes...\n');
    const pendingCredits = await prisma.credit.findMany({
      where: { status: 'PENDING' },
      include: { user: true, room: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pendingCredits.length === 0) {
      console.log('✅ Nenhum crédito pendente encontrado.');
      return;
    }

    console.log('📋 Créditos PENDING encontrados:');
    pendingCredits.forEach((c, i) => {
      const hoursValue = c.amount / (c.room?.hourlyRate || 7000); // fallback 70 reais/hora
      console.log(`  ${i + 1}. ID: ${c.id}`);
      console.log(`     Usuário: ${c.user?.name || 'N/A'} (${c.user?.email || c.user?.phone || 'N/A'})`);
      console.log(`     Sala: ${c.room?.name || 'N/A'}`);
      console.log(`     Valor: R$ ${(c.amount / 100).toFixed(2)} (~${hoursValue.toFixed(0)}h)`);
      console.log(`     Status: ${c.status}`);
      console.log(`     RemainingAmount: ${c.remainingAmount} (${c.remainingAmount === 0 ? '⚠️  ZERO!' : 'OK'})`);
      console.log(`     Criado em: ${c.createdAt.toISOString()}`);
      console.log('');
    });

    // Perguntar qual corrigir (para script interativo)
    console.log('Para corrigir um crédito específico, rode:');
    console.log('  node scripts/fix-pending-credit.js <creditId>');
    return;
  }

  // 3. Mostrar detalhes do crédito encontrado
  console.log('💳 Crédito encontrado:');
  console.log(`  ID: ${credit.id}`);
  console.log(`  Usuário: ${credit.user?.name || 'N/A'} (${credit.user?.email || credit.user?.phone || 'N/A'})`);
  console.log(`  Sala: ${credit.room?.name || 'N/A'}`);
  console.log(`  Valor (amount): R$ ${(credit.amount / 100).toFixed(2)}`);
  console.log(`  Saldo (remainingAmount): R$ ${(credit.remainingAmount / 100).toFixed(2)}`);
  console.log(`  Status: ${credit.status}`);
  console.log(`  Criado em: ${credit.createdAt.toISOString()}`);
  console.log('');

  // 4. Verificar se precisa correção
  if (credit.status === 'CONFIRMED' && credit.remainingAmount > 0) {
    console.log('✅ Crédito já está confirmado e com saldo. Nada a fazer.');
    return;
  }

  if (credit.status === 'PENDING') {
    console.log('⚠️  Crédito ainda PENDING.');
    console.log('    Verifique:');
    console.log('    1. Se o pagamento foi confirmado no Asaas');
    console.log('    2. Se o webhook foi enviado (ver logs Vercel)');
    console.log('    3. Se a URL do webhook está correta: https://www.arthemisaude.com/api/webhooks/asaas');
    console.log('');
    console.log('Para confirmar manualmente (APENAS SE PAGAMENTO FOI CONFIRMADO NO ASAAS):');
    console.log(`  node scripts/fix-pending-credit.js ${credit.id} --confirm`);
    
    if (process.argv[3] === '--confirm') {
      console.log('\n🔧 Confirmando crédito manualmente...');
      
      await prisma.credit.update({
        where: { id: credit.id },
        data: {
          status: 'CONFIRMED',
          remainingAmount: credit.amount,
        },
      });
      
      console.log(`✅ Crédito ${credit.id} confirmado!`);
      console.log(`   Status: CONFIRMED`);
      console.log(`   Saldo liberado: R$ ${(credit.amount / 100).toFixed(2)}`);
    }
    return;
  }

  if (credit.status === 'CONFIRMED' && credit.remainingAmount === 0) {
    console.log('🐛 BUG DETECTADO: Crédito CONFIRMED mas remainingAmount = 0');
    console.log('   Este é o bug que foi corrigido no webhook.');
    console.log('');
    console.log('🔧 Corrigindo...');
    
    await prisma.credit.update({
      where: { id: credit.id },
      data: {
        remainingAmount: credit.amount,
      },
    });
    
    console.log(`✅ Crédito ${credit.id} corrigido!`);
    console.log(`   Saldo liberado: R$ ${(credit.amount / 100).toFixed(2)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
