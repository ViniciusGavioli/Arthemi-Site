/**
 * SCRIPT DE AUDITORIA: Discrepâncias entre valor pago e crédito creditado
 * 
 * MODO: REPORT-ONLY (NÃO ALTERA DADOS)
 * 
 * Este script identifica créditos onde:
 * - credit.amount != valor efetivamente pago (baseado em booking.amountPaid ou payment.value)
 * 
 * USO:
 *   node scripts/audit-credit-discrepancies.js
 *   node scripts/audit-credit-discrepancies.js --json > discrepancias.json
 * 
 * SAÍDA:
 * - Lista de discrepâncias com creditId, paymentId, valorPago, valorCreditado, diff
 * - Resumo com total de discrepâncias e valores envolvidos
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Flag para output JSON
const jsonMode = process.argv.includes('--json');

function log(message) {
  if (!jsonMode) {
    console.log(message);
  }
}

function formatCurrency(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

async function main() {
  log('='.repeat(70));
  log('AUDITORIA: Discrepâncias entre valor pago e crédito creditado');
  log('MODO: REPORT-ONLY (nenhum dado será alterado)');
  log('='.repeat(70));
  log('');

  const discrepancies = [];

  // 1. Buscar créditos CONFIRMED que têm relação com pagamentos
  const credits = await prisma.credit.findMany({
    where: {
      status: 'CONFIRMED',
      type: 'MANUAL', // Créditos de compra (não cancelamento, promo, etc)
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      room: { select: { id: true, name: true, hourlyRate: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  log(`📊 Total de créditos CONFIRMED/MANUAL encontrados: ${credits.length}`);
  log('');

  // 2. Para cada crédito, tentar encontrar o pagamento correspondente
  for (const credit of credits) {
    // Buscar booking relacionado via sourceBookingId ou pelo externalReference nos webhooks
    const webhookEvents = await prisma.webhookEvent.findMany({
      where: {
        OR: [
          { bookingId: { contains: credit.id } }, // purchase:creditId
          { bookingId: `purchase:${credit.id}` },
          { bookingId: `credit_${credit.id}` }, // legado
        ],
        eventType: { in: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'] },
        status: 'PROCESSED',
      },
      orderBy: { processedAt: 'asc' },
      take: 1,
    });

    if (webhookEvents.length === 0) {
      // Sem webhook encontrado - pode ser crédito manual admin ou legado
      continue;
    }

    const webhook = webhookEvents[0];
    const payload = webhook.payload;

    if (!payload || typeof payload !== 'object') {
      continue;
    }

    // Extrair valor pago do payload
    const payment = payload.payment;
    if (!payment || typeof payment.value !== 'number') {
      continue;
    }

    const paidAmountCents = Math.round(payment.value * 100);
    const creditedAmount = credit.amount;

    // Verificar discrepância
    if (paidAmountCents !== creditedAmount) {
      const diff = creditedAmount - paidAmountCents;
      const diffPercent = ((diff / paidAmountCents) * 100).toFixed(2);

      discrepancies.push({
        creditId: credit.id,
        userId: credit.userId,
        userName: credit.user?.name || 'N/A',
        userEmail: credit.user?.email || 'N/A',
        roomId: credit.roomId,
        roomName: credit.room?.name || 'N/A',
        paymentId: payment.id,
        eventId: webhook.eventId,
        paidAmountCents,
        creditedAmount,
        diff,
        diffPercent: `${diffPercent}%`,
        createdAt: credit.createdAt,
        webhookProcessedAt: webhook.processedAt,
      });
    }
  }

  // 3. Verificar via tabela Payment (busca simples sem relações)
  const payments = await prisma.payment.findMany({
    where: {
      status: 'APPROVED',
    },
  });

  for (const payment of payments) {
    // Buscar crédito relacionado ao booking do payment
    if (!payment.bookingId) continue;
    
    // Buscar booking para verificar se é pacote
    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: { product: true },
    });
    
    if (!booking?.product) continue;
    
    // Verificar se é pacote de horas
    const isPackage = ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H'].includes(booking.product.type);
    if (!isPackage) continue;

    // Buscar crédito relacionado a este booking
    const relatedCredits = await prisma.credit.findMany({
      where: {
        userId: booking.userId,
        roomId: booking.roomId,
        status: 'CONFIRMED',
        type: 'MANUAL',
        createdAt: {
          gte: new Date(payment.createdAt.getTime() - 60000), // 1 min antes
          lte: new Date(payment.createdAt.getTime() + 300000), // 5 min depois
        },
      },
    });

    for (const credit of relatedCredits) {
      const paidAmountCents = payment.amount || 0;
      const creditedAmount = credit.amount;

      if (paidAmountCents !== creditedAmount && paidAmountCents > 0) {
        const diff = creditedAmount - paidAmountCents;
        const diffPercent = ((diff / paidAmountCents) * 100).toFixed(2);

        // Evitar duplicatas
        if (!discrepancies.find(d => d.creditId === credit.id)) {
          discrepancies.push({
            creditId: credit.id,
            userId: credit.userId,
            userName: 'N/A',
            userEmail: 'N/A',
            roomId: credit.roomId,
            roomName: 'N/A',
            paymentId: payment.externalId,
            eventId: 'via Payment table',
            paidAmountCents,
            creditedAmount,
            diff,
            diffPercent: `${diffPercent}%`,
            createdAt: credit.createdAt,
            webhookCreatedAt: payment.createdAt,
            source: 'Payment table',
          });
        }
      }
    }
  }

  // 4. Gerar relatório
  if (jsonMode) {
    // Output JSON para análise programática
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'REPORT_ONLY',
      totalCreditsAnalyzed: credits.length,
      totalDiscrepancies: discrepancies.length,
      totalOvercredited: discrepancies.reduce((sum, d) => sum + Math.max(0, d.diff), 0),
      totalUndercredited: discrepancies.reduce((sum, d) => sum + Math.abs(Math.min(0, d.diff)), 0),
      discrepancies: discrepancies.map(d => ({
        ...d,
        paidAmount: formatCurrency(d.paidAmountCents),
        creditedAmountFormatted: formatCurrency(d.creditedAmount),
        diffFormatted: formatCurrency(d.diff),
      })),
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Output tabular para humanos
    if (discrepancies.length === 0) {
      log('✅ Nenhuma discrepância encontrada!');
    } else {
      log(`⚠️  DISCREPÂNCIAS ENCONTRADAS: ${discrepancies.length}`);
      log('');
      log('-'.repeat(120));
      log(
        'Credit ID'.padEnd(28) +
        'Pago'.padStart(14) +
        'Creditado'.padStart(14) +
        'Diferença'.padStart(14) +
        '%'.padStart(10) +
        'Payment ID'.padStart(20) +
        'Data'.padStart(20)
      );
      log('-'.repeat(120));

      for (const d of discrepancies) {
        const date = d.createdAt instanceof Date 
          ? d.createdAt.toISOString().slice(0, 10)
          : new Date(d.createdAt).toISOString().slice(0, 10);
        
        log(
          d.creditId.padEnd(28) +
          formatCurrency(d.paidAmountCents).padStart(14) +
          formatCurrency(d.creditedAmount).padStart(14) +
          formatCurrency(d.diff).padStart(14) +
          d.diffPercent.padStart(10) +
          (d.paymentId || 'N/A').slice(0, 18).padStart(20) +
          date.padStart(20)
        );
      }

      log('-'.repeat(120));
      log('');

      // Resumo
      const totalOver = discrepancies.reduce((sum, d) => sum + Math.max(0, d.diff), 0);
      const totalUnder = discrepancies.reduce((sum, d) => sum + Math.abs(Math.min(0, d.diff)), 0);

      log('📊 RESUMO:');
      log(`   Total de discrepâncias: ${discrepancies.length}`);
      log(`   Total creditado a mais: ${formatCurrency(totalOver)}`);
      log(`   Total creditado a menos: ${formatCurrency(totalUnder)}`);
      log(`   Impacto líquido: ${formatCurrency(totalOver - totalUnder)}`);
    }
  }

  log('');
  log('='.repeat(70));
  log('FIM DA AUDITORIA (REPORT-ONLY - Nenhum dado foi alterado)');
  log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
