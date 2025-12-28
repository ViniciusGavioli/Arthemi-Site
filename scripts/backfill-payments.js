/**
 * Script de Backfill - Reprocessa pagamentos perdidos
 * 
 * CONTEXTO:
 * Um bug no webhook (if req.method !== 'GET' ao invés de !== 'POST')
 * fazia com que todos os webhooks da Asaas fossem rejeitados.
 * 
 * Este script:
 * 1. Busca todas as reservas PENDING que têm paymentId
 * 2. Consulta o status real do pagamento na Asaas
 * 3. Atualiza o banco de dados se o pagamento foi confirmado
 * 
 * USO:
 * npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-payments.js
 * ou
 * node scripts/backfill-payments.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuração
const ASAAS_API_URL = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://api-sandbox.asaas.com/v3'
  : 'https://api.asaas.com/v3';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  console.error('❌ ASAAS_API_KEY não configurada!');
  process.exit(1);
}

/**
 * Busca pagamento na Asaas
 */
async function getPaymentFromAsaas(paymentId) {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`⚠️  Pagamento ${paymentId} não encontrado na Asaas`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Erro ao buscar pagamento ${paymentId}:`, error.message);
    return null;
  }
}

/**
 * Verifica se o status indica pagamento confirmado
 */
function isPaymentConfirmed(status) {
  return status === 'RECEIVED' || status === 'CONFIRMED';
}

/**
 * Converte status Asaas para PaymentStatus do Prisma
 */
function mapAsaasStatusToPaymentStatus(asaasStatus) {
  switch (asaasStatus) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'APPROVED';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return 'REFUNDED';
    case 'OVERDUE':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
      return 'REJECTED';
    default:
      return 'PENDING';
  }
}

/**
 * Processa uma reserva
 */
async function processBooking(booking) {
  console.log(`\n📋 Processando: ${booking.id}`);
  console.log(`   PaymentId: ${booking.paymentId}`);
  console.log(`   Status atual: ${booking.status} | PaymentStatus: ${booking.paymentStatus}`);

  // Busca na Asaas
  const asaasPayment = await getPaymentFromAsaas(booking.paymentId);
  
  if (!asaasPayment) {
    console.log(`   ⏭️  Pulando - pagamento não encontrado na Asaas`);
    return { skipped: true, reason: 'not_found' };
  }

  console.log(`   Status Asaas: ${asaasPayment.status}`);
  console.log(`   Valor: R$ ${asaasPayment.value.toFixed(2)}`);

  // Verifica se precisa atualizar
  const newPaymentStatus = mapAsaasStatusToPaymentStatus(asaasPayment.status);
  const needsUpdate = newPaymentStatus !== booking.paymentStatus;
  const isConfirmed = isPaymentConfirmed(asaasPayment.status);

  if (!needsUpdate && !isConfirmed) {
    console.log(`   ⏭️  Sem alterações necessárias`);
    return { skipped: true, reason: 'no_changes' };
  }

  // Prepara atualização
  const updateData = {
    paymentStatus: newPaymentStatus,
  };

  if (isConfirmed) {
    // Converte valor para centavos
    updateData.amountPaid = Math.round(asaasPayment.value * 100);
    
    // Se estava PENDING, atualiza para CONFIRMED
    if (booking.status === 'PENDING') {
      updateData.status = 'CONFIRMED';
    }
  }

  console.log(`   🔄 Atualizando:`, updateData);

  // Atualiza no banco
  try {
    await prisma.booking.update({
      where: { id: booking.id },
      data: updateData,
    });
    console.log(`   ✅ Atualizado com sucesso!`);
    return { updated: true, payment: asaasPayment };
  } catch (error) {
    console.error(`   ❌ Erro ao atualizar:`, error.message);
    return { error: true, message: error.message };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🔄 Backfill de Pagamentos - Início');
  console.log('=' .repeat(50));
  console.log(`API: ${ASAAS_API_URL}`);
  console.log('');

  // Busca reservas PENDING com paymentId
  const pendingBookings = await prisma.booking.findMany({
    where: {
      paymentId: { not: null },
      OR: [
        { status: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { amountPaid: 0 },
      ],
    },
    select: {
      id: true,
      paymentId: true,
      status: true,
      paymentStatus: true,
      amountPaid: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  console.log(`📊 Encontradas ${pendingBookings.length} reservas para processar`);

  if (pendingBookings.length === 0) {
    console.log('✅ Nenhuma reserva pendente encontrada');
    return;
  }

  // Estatísticas
  const stats = {
    total: pendingBookings.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    totalRevenue: 0,
  };

  // Processa cada reserva (com delay para rate limit)
  for (let i = 0; i < pendingBookings.length; i++) {
    const booking = pendingBookings[i];
    
    // Rate limit - 1 request por segundo
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const result = await processBooking(booking);

    if (result.updated) {
      stats.updated++;
      stats.totalRevenue += result.payment.value;
    } else if (result.error) {
      stats.errors++;
    } else {
      stats.skipped++;
    }
  }

  // Resumo final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO DO BACKFILL');
  console.log('='.repeat(50));
  console.log(`Total processadas: ${stats.total}`);
  console.log(`✅ Atualizadas: ${stats.updated}`);
  console.log(`⏭️  Ignoradas: ${stats.skipped}`);
  console.log(`❌ Erros: ${stats.errors}`);
  console.log(`💰 Receita recuperada: R$ ${stats.totalRevenue.toFixed(2)}`);
  console.log('='.repeat(50));
}

// Executa
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
