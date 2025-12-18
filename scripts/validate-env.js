// ===========================================================
// Script de Teste - Validação de Variáveis de Ambiente
// ===========================================================
// Simula a validação que roda no boot da aplicação

// Carregar variáveis do .env
require('dotenv').config();

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

// ============================================================
// CONFIGURAÇÃO DAS VARIÁVEIS
// ============================================================

const ENV_CONFIG = [
  {
    name: 'DATABASE_URL',
    required: true,
    sensitive: true,
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    errorMessage: 'DATABASE_URL deve ser uma URL PostgreSQL válida',
  },
  {
    name: 'ADMIN_PASSWORD',
    required: true,
    sensitive: true,
    validator: (v) => v.length >= 8,
    errorMessage: 'ADMIN_PASSWORD deve ter pelo menos 8 caracteres',
  },
  {
    name: 'ADMIN_SESSION_SECRET',
    required: true,
    sensitive: true,
    validator: (v) => v.length >= 16,
    errorMessage: 'ADMIN_SESSION_SECRET deve ter pelo menos 16 caracteres',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    devDefault: 'http://localhost:3000',
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    errorMessage: 'NEXT_PUBLIC_APP_URL deve ser uma URL válida',
  },
  {
    name: 'MOCK_PAYMENTS',
    required: false,
    devDefault: 'true',
    validator: (v) => v === 'true' || v === 'false',
    errorMessage: 'MOCK_PAYMENTS deve ser "true" ou "false"',
  },
  {
    name: 'MERCADOPAGO_ACCESS_TOKEN',
    required: false,
    sensitive: true,
  },
  {
    name: 'MERCADOPAGO_PUBLIC_KEY',
    required: false,
    sensitive: true,
  },
];

// ============================================================
// VALIDAÇÃO
// ============================================================

function validateEnv() {
  log(colors.cyan, '\n🔍 VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE\n');
  log(colors.cyan, '='.repeat(60));

  const errors = [];
  const warnings = [];
  const configured = [];

  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];
    const hasValue = value && value.trim() !== '';
    
    // Mostrar status
    const maskedValue = config.sensitive && hasValue 
      ? `${value.substring(0, 8)}...` 
      : value;

    if (!hasValue) {
      if (config.required) {
        errors.push(`${config.name} é obrigatória mas não está definida`);
        log(colors.red, `  ❌ ${config.name}: NÃO DEFINIDA`);
      } else if (config.devDefault) {
        warnings.push(`${config.name} não definida, usando default: "${config.devDefault}"`);
        log(colors.yellow, `  ⚠️  ${config.name}: usando default "${config.devDefault}"`);
      } else {
        log(colors.yellow, `  ⏭️  ${config.name}: não definida (opcional)`);
      }
      continue;
    }

    // Validar formato
    if (config.validator && !config.validator(value)) {
      errors.push(`${config.name}: ${config.errorMessage}`);
      log(colors.red, `  ❌ ${config.name}: ${config.errorMessage}`);
      continue;
    }

    configured.push(config.name);
    log(colors.green, `  ✅ ${config.name}: ${maskedValue}`);
  }

  // Validação especial MercadoPago
  log(colors.blue, '\n📦 Modo de Pagamento:');
  const mockPayments = process.env.MOCK_PAYMENTS;
  const hasToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  const isMockMode = mockPayments === 'true' || !hasToken;

  if (isMockMode) {
    warnings.push('MOCK_PAYMENTS ativo - pagamentos simulados');
    log(colors.yellow, '  🎭 MOCK - pagamentos simulados');
  } else {
    if (!hasToken) {
      errors.push('MERCADOPAGO_ACCESS_TOKEN obrigatório quando MOCK_PAYMENTS=false');
    } else if (!process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('APP_USR-') &&
               !process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
      errors.push('MERCADOPAGO_ACCESS_TOKEN inválido');
    } else {
      log(colors.green, '  💳 REAL - MercadoPago configurado');
    }
  }

  // Resultado final
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '\n📊 RESULTADO DA VALIDAÇÃO\n');

  if (configured.length > 0) {
    log(colors.green, `  ✅ Configuradas: ${configured.length}`);
  }
  if (warnings.length > 0) {
    log(colors.yellow, `  ⚠️  Avisos: ${warnings.length}`);
  }
  if (errors.length > 0) {
    log(colors.red, `  ❌ Erros: ${errors.length}`);
  }

  console.log('');

  if (errors.length > 0) {
    log(colors.red, '🚫 VALIDAÇÃO FALHOU\n');
    log(colors.red, 'Erros encontrados:');
    errors.forEach(e => log(colors.red, `  • ${e}`));
    console.log('');
    
    if (process.env.NODE_ENV === 'production') {
      log(colors.red, '❌ Em PRODUÇÃO, a aplicação não iniciaria.\n');
      process.exit(1);
    } else {
      log(colors.yellow, '⚠️  Em DESENVOLVIMENTO, continuaria com erros.\n');
    }
  } else {
    log(colors.green, '✅ VALIDAÇÃO OK - Ambiente configurado corretamente\n');
  }

  // Checklist de produção
  log(colors.cyan, '📋 CHECKLIST PARA PRODUÇÃO:\n');
  const prodChecklist = [
    { name: 'DATABASE_URL', ok: !!process.env.DATABASE_URL },
    { name: 'ADMIN_PASSWORD (8+ chars)', ok: process.env.ADMIN_PASSWORD?.length >= 8 },
    { name: 'ADMIN_SESSION_SECRET (16+ chars)', ok: process.env.ADMIN_SESSION_SECRET?.length >= 16 },
    { name: 'NEXT_PUBLIC_APP_URL (https)', ok: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') },
    { name: 'MOCK_PAYMENTS=false', ok: process.env.MOCK_PAYMENTS === 'false' },
    { name: 'MERCADOPAGO_ACCESS_TOKEN (real)', ok: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('APP_USR-') },
  ];

  prodChecklist.forEach(item => {
    const status = item.ok ? colors.green + '✅' : colors.yellow + '⏳';
    log(status, ` ${item.name}`);
  });

  console.log('');
}

validateEnv();
