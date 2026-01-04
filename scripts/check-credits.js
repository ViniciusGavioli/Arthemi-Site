#!/usr/bin/env node
// Script para verificar status dos créditos recentes

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== CRÉDITOS RECENTES ===\n');
    
    const credits = await prisma.credit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        amount: true,
        remainingAmount: true,
        createdAt: true,
        user: {
          select: { name: true, email: true }
        }
      }
    });
    
    credits.forEach(c => {
      const statusIcon = c.status === 'CONFIRMED' ? '✅' : c.status === 'PENDING' ? '⏳' : '❌';
      console.log(`[${statusIcon} ${c.status}] ${c.id}`);
      console.log(`  User: ${c.user?.name || 'N/A'} (${c.user?.email || 'N/A'})`);
      console.log(`  Amount: R$ ${(c.amount / 100).toFixed(2)} | Remaining: R$ ${(c.remainingAmount / 100).toFixed(2)}`);
      console.log(`  Created: ${c.createdAt}`);
      console.log('');
    });
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
