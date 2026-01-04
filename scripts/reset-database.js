// Script para resetar banco de produção (limpar dados de teste)
// Uso: node scripts/reset-database.js
// ⚠️ CUIDADO: Isso apaga TODOS os dados de usuários, agendamentos, créditos, etc.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const readline = require('readline');

async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's');
    });
  });
}

async function main() {
  console.log('\n🚨 RESET DE BANCO DE DADOS 🚨\n');
  console.log('Este script irá APAGAR:');
  console.log('  - Todos os agendamentos (bookings)');
  console.log('  - Todos os créditos');
  console.log('  - Todos os usuários');
  console.log('  - Todos os pagamentos registrados');
  console.log('  - Todos os webhooks');
  console.log('  - Todos os logs de auditoria');
  console.log('  - Todas as sessões e tokens');
  console.log('');
  console.log('Será MANTIDO:');
  console.log('  - Salas (rooms)');
  console.log('  - Produtos (products)');
  console.log('  - Configurações (settings)');
  console.log('');

  const confirmed = await confirm('⚠️  Tem certeza? Digite "sim" para continuar: ');
  
  if (!confirmed) {
    console.log('❌ Operação cancelada.');
    return;
  }

  console.log('\n🗑️  Iniciando limpeza...\n');

  // Ordem de deleção respeitando foreign keys
  const tables = [
    { name: 'WebhookEvent', fn: () => prisma.webhookEvent.deleteMany() },
    { name: 'AuditLog', fn: () => prisma.auditLog.deleteMany() },
    { name: 'AuditEvent', fn: () => prisma.auditEvent.deleteMany() },
    { name: 'RateLimit', fn: () => prisma.rateLimit.deleteMany() },
    { name: 'RefundRequest', fn: () => prisma.refundRequest.deleteMany() },
    { name: 'Booking', fn: () => prisma.booking.deleteMany() },
    { name: 'Credit', fn: () => prisma.credit.deleteMany() },
    { name: 'MagicLink', fn: () => prisma.magicLink.deleteMany() },
    { name: 'Session', fn: () => prisma.session.deleteMany() },
    { name: 'ActivationToken', fn: () => prisma.activationToken.deleteMany() },
    { name: 'User', fn: () => prisma.user.deleteMany() },
  ];

  for (const table of tables) {
    try {
      const result = await table.fn();
      console.log(`  ✅ ${table.name}: ${result.count} registros deletados`);
    } catch (error) {
      // Tabela pode não existir
      if (error.code === 'P2021') {
        console.log(`  ⏭️  ${table.name}: tabela não existe (ok)`);
      } else {
        console.log(`  ❌ ${table.name}: ${error.message}`);
      }
    }
  }

  console.log('\n✅ Banco de dados resetado!\n');
  console.log('Próximos passos:');
  console.log('  1. Acesse o site e crie uma nova conta');
  console.log('  2. Faça login no admin e configure se necessário');
  console.log('  3. Teste o fluxo de compra de créditos');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
