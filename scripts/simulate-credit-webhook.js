// Simula webhook do Asaas para testar confirmação de crédito
// Uso: node scripts/simulate-credit-webhook.js <creditId>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simula o processamento que o webhook faria
async function simulateWebhook(creditId) {
  console.log(`\n🧪 Simulando webhook de confirmação para crédito: ${creditId}\n`);

  // 1. Buscar crédito
  const credit = await prisma.credit.findUnique({
    where: { id: creditId },
    include: { user: true, room: true },
  });

  if (!credit) {
    console.log('❌ Crédito não encontrado');
    return;
  }

  console.log('📋 Crédito encontrado:');
  console.log(`   Usuário: ${credit.user?.name || 'N/A'}`);
  console.log(`   Sala: ${credit.room?.name || 'N/A'}`);
  console.log(`   Valor: R$ ${(credit.amount / 100).toFixed(2)}`);
  console.log(`   Status atual: ${credit.status}`);
  console.log(`   RemainingAmount atual: ${credit.remainingAmount}`);
  console.log('');

  // 2. Verificar se já confirmado
  if (credit.status === 'CONFIRMED' && credit.remainingAmount > 0) {
    console.log('✅ Crédito já está confirmado com saldo. Nada a fazer.');
    return;
  }

  // 3. Simular evento único (idempotência)
  const fakeEventId = `test_${Date.now()}_${creditId}`;
  
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId: fakeEventId },
  });

  if (existingEvent) {
    console.log('⏭️ Evento já processado (simulação de idempotência)');
    return;
  }

  // 4. Criar WebhookEvent (idempotência)
  await prisma.webhookEvent.create({
    data: {
      eventId: fakeEventId,
      eventType: 'PAYMENT_CONFIRMED_SIMULATED',
      paymentId: `sim_${creditId}`,
      bookingId: `purchase:${creditId}`,
      status: 'PROCESSING',
      payload: { simulated: true, creditId },
    },
  });

  // 5. Confirmar crédito (exatamente como o webhook corrigido faz)
  await prisma.credit.update({
    where: { id: creditId },
    data: {
      status: 'CONFIRMED',
      remainingAmount: credit.amount, // ← Esta era a linha que faltava!
    },
  });

  // 6. Marcar webhook como processado
  await prisma.webhookEvent.update({
    where: { eventId: fakeEventId },
    data: { status: 'PROCESSED' },
  });

  console.log('✅ Crédito confirmado com sucesso!');
  console.log(`   Novo status: CONFIRMED`);
  console.log(`   Novo remainingAmount: ${credit.amount} (R$ ${(credit.amount / 100).toFixed(2)})`);
  
  // Calcular horas aproximadas
  const hourlyRate = credit.room?.hourlyRate || 7000;
  const hours = Math.round(credit.amount / hourlyRate);
  console.log(`   Horas liberadas: ~${hours}h`);
}

async function main() {
  const creditId = process.argv[2];

  if (!creditId) {
    console.log('Uso: node scripts/simulate-credit-webhook.js <creditId>');
    console.log('');
    console.log('⚠️  Este script simula o que o webhook do Asaas faria.');
    console.log('    Use APENAS para corrigir créditos onde o pagamento foi confirmado no Asaas');
    console.log('    mas o webhook não foi processado.');
    console.log('');
    
    // Listar créditos pendentes
    const pending = await prisma.credit.findMany({
      where: { status: 'PENDING' },
      include: { user: true, room: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    if (pending.length > 0) {
      console.log('📋 Créditos PENDING disponíveis para corrigir:\n');
      pending.forEach(c => {
        const hours = Math.round(c.amount / (c.room?.hourlyRate || 7000));
        console.log(`  ${c.id}`);
        console.log(`    ${c.user?.name} - ${c.room?.name} - ~${hours}h - R$ ${(c.amount / 100).toFixed(2)}`);
        console.log('');
      });
    }
    return;
  }

  await simulateWebhook(creditId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
