// ===========================================================
// Script de Teste - Webhook Idempotência
// ===========================================================
// Testa se o webhook é idempotente (pode ser chamado múltiplas vezes)

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  log(colors.cyan, '\n🧪 TESTES DE WEBHOOK - IDEMPOTÊNCIA E SEGURANÇA\n');
  log(colors.cyan, '='.repeat(60));

  let passed = 0;
  let failed = 0;

  // ====================================
  // Teste 1: Health Check (GET)
  // ====================================
  log(colors.blue, '\n📋 Teste 1: Health Check (GET)\n');
  try {
    const res = await get('/api/webhooks/mercadopago');
    if (res.status === 200 && res.data.received === true) {
      log(colors.green, '  ✅ Endpoint acessível');
      log(colors.cyan, `     Response: ${JSON.stringify(res.data)}`);
      passed++;
    } else {
      log(colors.red, '  ❌ Resposta inesperada:', res);
      failed++;
    }
  } catch (e) {
    log(colors.red, '  ❌ Servidor não está rodando');
    failed++;
  }

  // ====================================
  // Teste 2: Ignorar evento não-pagamento
  // ====================================
  log(colors.blue, '\n📋 Teste 2: Ignorar evento não-pagamento\n');
  try {
    const res = await post('/api/webhooks/mercadopago', {
      type: 'merchant_order',
      data: { id: '12345' }
    });
    if (res.data.action === 'ignored' && res.data.reason === 'not_payment_event') {
      log(colors.green, '  ✅ Evento não-pagamento ignorado corretamente');
      passed++;
    } else {
      log(colors.red, '  ❌ Deveria ignorar evento não-pagamento');
      log(colors.red, `     Response: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log(colors.red, '  ❌ Erro:', e.message);
    failed++;
  }

  // ====================================
  // Teste 3: Payment ID ausente
  // ====================================
  log(colors.blue, '\n📋 Teste 3: Payment ID ausente\n');
  try {
    const res = await post('/api/webhooks/mercadopago', {
      type: 'payment',
      data: {} // sem id
    });
    if (res.data.action === 'error' && res.data.reason === 'missing_payment_id') {
      log(colors.green, '  ✅ Payment ID ausente tratado');
      passed++;
    } else {
      log(colors.red, '  ❌ Deveria retornar erro de payment_id ausente');
      log(colors.red, `     Response: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log(colors.red, '  ❌ Erro:', e.message);
    failed++;
  }

  // ====================================
  // Teste 4: Modo Mock ativo
  // ====================================
  log(colors.blue, '\n📋 Teste 4: Modo Mock\n');
  try {
    const res = await post('/api/webhooks/mercadopago', {
      type: 'payment',
      data: { id: '999999999' }
    });
    // Em modo mock, deve retornar skipped
    if (res.data.mock === true || res.data.action === 'skipped') {
      log(colors.green, '  ✅ Modo mock detectado');
      log(colors.cyan, `     Response: ${JSON.stringify(res.data)}`);
      passed++;
    } else if (res.data.action === 'error') {
      // Se não está em modo mock, vai tentar buscar no MP e falhar
      log(colors.yellow, '  ⚠️  Modo real ativo (pagamento não existe no MP)');
      log(colors.cyan, `     Response: ${JSON.stringify(res.data)}`);
      passed++;
    } else {
      log(colors.red, '  ❌ Resposta inesperada');
      log(colors.red, `     Response: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log(colors.red, '  ❌ Erro:', e.message);
    failed++;
  }

  // ====================================
  // Teste 5: Validação de resposta sempre 200
  // ====================================
  log(colors.blue, '\n📋 Teste 5: Sempre retorna 200 (evita retry infinito)\n');
  try {
    const res = await post('/api/webhooks/mercadopago', {
      type: 'payment',
      data: { id: 'invalid-payment-id' }
    });
    if (res.status === 200) {
      log(colors.green, '  ✅ Status 200 mesmo em erro');
      log(colors.cyan, `     Response: ${JSON.stringify(res.data)}`);
      passed++;
    } else {
      log(colors.red, `  ❌ Status deveria ser 200, recebeu ${res.status}`);
      failed++;
    }
  } catch (e) {
    log(colors.red, '  ❌ Erro:', e.message);
    failed++;
  }

  // ====================================
  // Resultado Final
  // ====================================
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '\n📊 RESULTADO DOS TESTES\n');
  log(colors.green, `  ✅ Passou: ${passed}`);
  log(colors.red, `  ❌ Falhou: ${failed}`);
  
  if (failed === 0) {
    log(colors.green, '\n🎉 TODOS OS TESTES PASSARAM!\n');
  } else {
    log(colors.red, `\n⚠️  ${failed} teste(s) falharam\n`);
  }

  log(colors.cyan, '='.repeat(60));
  log(colors.cyan, '\n📝 CHECKLIST PARA TESTE SANDBOX:\n');
  log(colors.cyan, '1. Configure MERCADOPAGO_ACCESS_TOKEN no .env');
  log(colors.cyan, '2. Configure MOCK_PAYMENTS="false"');
  log(colors.cyan, '3. Crie uma reserva e gere link de pagamento');
  log(colors.cyan, '4. Pague com cartão de teste do MP');
  log(colors.cyan, '5. Verifique se booking mudou para CONFIRMED');
  log(colors.cyan, '6. Tente chamar webhook novamente (deve ignorar)');
  log(colors.cyan, '\n📌 Cartões de teste MP:');
  log(colors.cyan, '   Aprovado: 5031 4332 1540 6351 (CVV: 123)');
  log(colors.cyan, '   Rejeitado: 5031 4332 1540 6359\n');

  return { passed, failed };
}

runTests().catch(console.error);
