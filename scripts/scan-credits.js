// Script: scan-credits.js
// Analisa o sistema de créditos e pacotes

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('             SCAN COMPLETO: Sistema de Créditos/Pacotes        ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. SALAS
  console.log('📦 1. SALAS NO BANCO');
  console.log('─────────────────────────────────────────────────────────────────');
  const rooms = await prisma.room.findMany({
    select: { id: true, name: true, slug: true, hourlyRate: true, tier: true }
  });
  
  rooms.forEach(r => {
    console.log(`  ${r.name} (${r.slug})`);
    console.log(`    hourlyRate: ${r.hourlyRate} (centavos) = R$ ${(r.hourlyRate/100).toFixed(2)}`);
    console.log(`    tier: ${r.tier}`);
    console.log('');
  });

  // 2. PRODUTOS
  console.log('\n📦 2. PRODUTOS (Product) NO BANCO');
  console.log('─────────────────────────────────────────────────────────────────');
  const products = await prisma.product.findMany({
    include: { room: { select: { name: true, slug: true } } },
    orderBy: [{ roomId: 'asc' }, { type: 'asc' }]
  });

  let currentRoom = '';
  products.forEach(p => {
    if (p.room?.name !== currentRoom) {
      currentRoom = p.room?.name || 'Sem sala';
      console.log(`\n  🏠 ${currentRoom}`);
    }
    console.log(`    ${p.type.padEnd(15)} | ${p.name.padEnd(25)} | R$ ${(p.price/100).toFixed(2).padStart(8)} | ${p.hoursIncluded}h | ${p.isActive ? '✅' : '❌'}`);
  });

  // 3. CRÉDITOS RECENTES
  console.log('\n\n📦 3. CRÉDITOS (Credit) RECENTES (últimos 10)');
  console.log('─────────────────────────────────────────────────────────────────');
  const credits = await prisma.credit.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { 
      user: { select: { email: true, name: true } },
      room: { select: { name: true } }
    }
  });

  credits.forEach(c => {
    console.log(`\n  ID: ${c.id.slice(0,8)}...`);
    console.log(`    Usuário: ${c.user?.name || 'N/A'} (${c.user?.email})`);
    console.log(`    Sala: ${c.room?.name || 'N/A'}`);
    console.log(`    amount: ${c.amount} (centavos) = R$ ${(c.amount/100).toFixed(2)}`);
    console.log(`    remainingAmount: ${c.remainingAmount} (centavos) = R$ ${(c.remainingAmount/100).toFixed(2)}`);
    console.log(`    hours: ${c.hours || 'null'}`);
    console.log(`    usageType: ${c.usageType}`);
    console.log(`    status: ${c.status}`);
    console.log(`    type: ${c.type}`);
  });

  // 4. ANÁLISE DO CÁLCULO
  console.log('\n\n📦 4. ANÁLISE DO CÁLCULO DE CRÉDITO');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const sala1 = rooms.find(r => r.slug === 'sala-a');
  if (sala1) {
    console.log('\n  Exemplo: Pacote 40h Consultório 1');
    console.log(`    room.hourlyRate = ${sala1.hourlyRate} centavos`);
    console.log(`    creditHours = 40`);
    console.log(`    creditAmount = creditHours * room.hourlyRate`);
    console.log(`    creditAmount = 40 * ${sala1.hourlyRate} = ${40 * sala1.hourlyRate} centavos`);
    console.log(`    creditAmount = R$ ${((40 * sala1.hourlyRate)/100).toFixed(2)}`);
    
    console.log('\n  ⚠️  PROBLEMA IDENTIFICADO:');
    console.log('      O "amount" do crédito está sendo calculado como:');
    console.log('        HORAS × VALOR_HORA_EM_CENTAVOS');
    console.log('      Mas isso NÃO representa "créditos monetários".');
    console.log('      O usuário comprou 40 HORAS, não R$ 2.399,60 em créditos.');
  }

  // 5. BUSCAR O CRÉDITO ESPECÍFICO DO USUÁRIO (40h)
  console.log('\n\n📦 5. BUSCANDO CRÉDITOS DE 40H');
  console.log('─────────────────────────────────────────────────────────────────');
  const credits40h = await prisma.credit.findMany({
    where: { hours: 40 },
    include: { 
      user: { select: { email: true, name: true } },
      room: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (credits40h.length === 0) {
    console.log('  Nenhum crédito de 40h encontrado');
  } else {
    credits40h.forEach(c => {
      console.log(`\n  ID: ${c.id}`);
      console.log(`    Usuário: ${c.user?.name} (${c.user?.email})`);
      console.log(`    Sala: ${c.room?.name}`);
      console.log(`    hours: ${c.hours}`);
      console.log(`    amount: ${c.amount} centavos = R$ ${(c.amount/100).toFixed(2)}`);
      console.log(`    remainingAmount: ${c.remainingAmount} centavos = R$ ${(c.remainingAmount/100).toFixed(2)}`);
      console.log(`    status: ${c.status}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                         FIM DO SCAN                           ');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
