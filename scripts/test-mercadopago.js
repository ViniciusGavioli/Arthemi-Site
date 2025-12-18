// ===========================================================
// Script de Teste - MercadoPago Integration
// ===========================================================
// Testa se a integração com MercadoPago está funcionando

const https = require('https');
const http = require('http');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function runTests() {
  log(colors.cyan, '\n🧪 TESTES DE INTEGRAÇÃO MERCADOPAGO\n');
  log(colors.cyan, '='.repeat(50));

  let passed = 0;
  let failed = 0;

  // ====================================
  // Teste 1: Verificar variáveis de ambiente
  // ====================================
  log(colors.blue, '\n📋 Teste 1: Variáveis de Ambiente\n');
  
  const envVars = {
    MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    MOCK_PAYMENTS: process.env.MOCK_PAYMENTS,
  };

  const hasToken = !!envVars.MERCADOPAGO_ACCESS_TOKEN;
  const isMockMode = envVars.MOCK_PAYMENTS === 'true' || !hasToken;

  if (hasToken) {
    log(colors.green, '  ✅ MERCADOPAGO_ACCESS_TOKEN configurado');
    log(colors.yellow, `     Token começa com: ${envVars.MERCADOPAGO_ACCESS_TOKEN.substring(0, 20)}...`);
    passed++;
  } else {
    log(colors.yellow, '  ⚠️  MERCADOPAGO_ACCESS_TOKEN não configurado (modo mock ativo)');
  }

  log(colors.cyan, `  ℹ️  Modo atual: ${isMockMode ? 'MOCK 🎭' : 'REAL 💳'}`);
  log(colors.cyan, `  ℹ️  URL base: ${envVars.NEXT_PUBLIC_APP_URL || 'não definida'}`);

  // ====================================
  // Teste 2: API de criar pagamento (mock)
  // ====================================
  log(colors.blue, '\n📋 Teste 2: Estrutura da API de Pagamento\n');

  try {
    // Testar com bookingId inválido para verificar validação
    const response = await fetchJSON(`${BASE_URL}/api/payments/create`, {
      method: 'POST',
      body: { bookingId: '' },
    });

    if (response.status === 400 && response.data.error) {
      log(colors.green, '  ✅ Validação de input funcionando');
      log(colors.cyan, `     Erro retornado: "${response.data.error}"`);
      passed++;
    } else {
      log(colors.red, '  ❌ Validação não funcionou como esperado');
      log(colors.red, `     Status: ${response.status}, Body: ${JSON.stringify(response.data)}`);
      failed++;
    }
  } catch (error) {
    log(colors.yellow, '  ⚠️  Servidor não está rodando (npm run dev)');
    log(colors.cyan, '     Execute o servidor para testar a API');
  }

  // ====================================
  // Teste 3: Webhook endpoint
  // ====================================
  log(colors.blue, '\n📋 Teste 3: Webhook Endpoint\n');

  try {
    // GET para verificar se endpoint existe
    const response = await fetchJSON(`${BASE_URL}/api/webhooks/mercadopago`);
    
    if (response.status === 200) {
      log(colors.green, '  ✅ Endpoint webhook acessível');
      passed++;
    } else {
      log(colors.yellow, `  ⚠️  Webhook retornou status ${response.status}`);
    }
  } catch (error) {
    log(colors.yellow, '  ⚠️  Servidor não está rodando');
  }

  // ====================================
  // Resultado Final
  // ====================================
  log(colors.cyan, '\n' + '='.repeat(50));
  log(colors.cyan, '\n📊 RESULTADO DOS TESTES\n');
  
  if (isMockMode) {
    log(colors.yellow, '⚠️  MODO MOCK ATIVO - Pagamentos são simulados\n');
    log(colors.cyan, 'Para usar MercadoPago REAL, configure no .env:');
    log(colors.cyan, '  MERCADOPAGO_ACCESS_TOKEN="APP_USR-xxxxx"');
    log(colors.cyan, '  MOCK_PAYMENTS="false"\n');
  } else {
    log(colors.green, '💳 MODO REAL ATIVO - Usando MercadoPago Sandbox\n');
  }

  log(colors.green, `  Passou: ${passed}`);
  log(colors.red, `  Falhou: ${failed}`);
  
  log(colors.cyan, '\n' + '='.repeat(50));
  log(colors.cyan, '\n📚 PRÓXIMOS PASSOS PARA TESTE SANDBOX:\n');
  log(colors.cyan, '1. Acesse: https://www.mercadopago.com.br/developers/panel');
  log(colors.cyan, '2. Crie uma aplicação de teste');
  log(colors.cyan, '3. Copie as credenciais SANDBOX (Access Token e Public Key)');
  log(colors.cyan, '4. Cole no arquivo .env');
  log(colors.cyan, '5. Reinicie o servidor (npm run dev)');
  log(colors.cyan, '6. Teste criando uma reserva\n');

  return { passed, failed };
}

runTests().catch(console.error);
