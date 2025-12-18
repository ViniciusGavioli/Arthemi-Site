// ===========================================================
// Validação de Variáveis de Ambiente
// ===========================================================
// Garante que variáveis críticas estão configuradas antes do boot
// FASE 0.4: Robustez para produção

// ============================================================
// TIPOS
// ============================================================

type EnvVarConfig = {
  name: string;
  required: boolean;
  sensitive?: boolean; // Não mostrar valor no log
  devDefault?: string; // Valor padrão apenas em dev
  validator?: (value: string) => boolean;
  errorMessage?: string;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ============================================================
// CONFIGURAÇÃO DAS VARIÁVEIS
// ============================================================

const ENV_CONFIG: EnvVarConfig[] = [
  // === CRÍTICAS (obrigatórias em produção) ===
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
  
  // === PAGAMENTOS (obrigatórias se MOCK_PAYMENTS=false) ===
  {
    name: 'MERCADOPAGO_ACCESS_TOKEN',
    required: false, // Validado condicionalmente
    sensitive: true,
  },
  {
    name: 'MERCADOPAGO_PUBLIC_KEY',
    required: false, // Validado condicionalmente
    sensitive: true,
  },
  
  // === CONFIGURAÇÃO ===
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
  
  // === EMAIL (opcional, mas recomendado em produção) ===
  {
    name: 'RESEND_API_KEY',
    required: false,
    sensitive: true,
    validator: (v) => v.startsWith('re_'),
    errorMessage: 'RESEND_API_KEY deve começar com "re_"',
  },
  {
    name: 'EMAIL_FROM',
    required: false,
    devDefault: 'Espaço Arthemi <noreply@arthemi.com.br>',
  },
  {
    name: 'EMAIL_REPLY_TO',
    required: false,
    devDefault: 'contato@arthemi.com.br',
  },
];

// ============================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Valida uma variável de ambiente individual
 */
function validateEnvVar(config: EnvVarConfig): { error?: string; warning?: string } {
  const value = process.env[config.name];
  
  // Verificar se existe
  if (!value || value.trim() === '') {
    // Em dev, usar default se disponível
    if (isDevelopment && config.devDefault) {
      return { warning: `${config.name} não definida, usando default: "${config.devDefault}"` };
    }
    
    if (config.required) {
      return { error: `❌ ${config.name} é obrigatória mas não está definida` };
    }
    
    return {};
  }
  
  // Executar validador customizado
  if (config.validator && !config.validator(value)) {
    return { error: `❌ ${config.name}: ${config.errorMessage || 'valor inválido'}` };
  }
  
  return {};
}

/**
 * Validação especial para MercadoPago
 * Só é obrigatório se MOCK_PAYMENTS=false
 */
function validateMercadoPago(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const mockPayments = process.env.MOCK_PAYMENTS;
  const isMockMode = mockPayments === 'true' || !process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  if (isMockMode) {
    warnings.push('⚠️  MOCK_PAYMENTS ativo - pagamentos simulados');
    return { errors, warnings };
  }
  
  // Modo real - validar credenciais
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    errors.push('❌ MERCADOPAGO_ACCESS_TOKEN obrigatório quando MOCK_PAYMENTS=false');
  } else if (!process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('APP_USR-') &&
             !process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
    errors.push('❌ MERCADOPAGO_ACCESS_TOKEN inválido (deve começar com APP_USR- ou TEST-)');
  }
  
  if (!process.env.MERCADOPAGO_PUBLIC_KEY) {
    warnings.push('⚠️  MERCADOPAGO_PUBLIC_KEY não definida (necessária para checkout frontend)');
  }
  
  return { errors, warnings };
}

/**
 * Executa validação completa de todas as variáveis
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🔍 Validando variáveis de ambiente...\n');
  
  // Validar cada variável configurada
  for (const config of ENV_CONFIG) {
    // Pular MercadoPago (validação especial)
    if (config.name.startsWith('MERCADOPAGO_')) continue;
    
    const result = validateEnvVar(config);
    if (result.error) errors.push(result.error);
    if (result.warning) warnings.push(result.warning);
  }
  
  // Validação especial MercadoPago
  const mpResult = validateMercadoPago();
  errors.push(...mpResult.errors);
  warnings.push(...mpResult.warnings);
  
  // Mostrar resultados
  if (warnings.length > 0) {
    console.log('⚠️  AVISOS:');
    warnings.forEach(w => console.log(`   ${w}`));
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('❌ ERROS:');
    errors.forEach(e => console.log(`   ${e}`));
    console.log('');
  }
  
  const valid = errors.length === 0;
  
  if (valid) {
    console.log('✅ Todas as variáveis de ambiente estão configuradas\n');
  }
  
  return { valid, errors, warnings };
}

/**
 * Valida e falha rápido em produção se houver erros
 */
export function validateEnvOrFail(): void {
  const result = validateEnv();
  
  if (!result.valid) {
    console.error('\n🚫 FALHA NA VALIDAÇÃO DE AMBIENTE\n');
    console.error('Configure as variáveis acima no arquivo .env e reinicie.\n');
    
    if (isProduction) {
      console.error('❌ Encerrando aplicação (produção)\n');
      process.exit(1);
    } else {
      console.error('⚠️  Continuando em modo desenvolvimento (com erros)\n');
    }
  }
}

// ============================================================
// GETTERS TIPADOS (uso seguro das variáveis)
// ============================================================

export const env = {
  // Database
  get DATABASE_URL(): string {
    return process.env.DATABASE_URL || '';
  },
  
  // Admin
  get ADMIN_PASSWORD(): string {
    return process.env.ADMIN_PASSWORD || '';
  },
  get ADMIN_SESSION_SECRET(): string {
    return process.env.ADMIN_SESSION_SECRET || 'dev-secret-change-in-production';
  },
  
  // MercadoPago
  get MERCADOPAGO_ACCESS_TOKEN(): string {
    return process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  },
  get MERCADOPAGO_PUBLIC_KEY(): string {
    return process.env.MERCADOPAGO_PUBLIC_KEY || '';
  },
  
  // App
  get NEXT_PUBLIC_APP_URL(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  },
  get MOCK_PAYMENTS(): boolean {
    return process.env.MOCK_PAYMENTS === 'true' || !process.env.MERCADOPAGO_ACCESS_TOKEN;
  },
  
  // Meta
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
  get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  },
};

// ============================================================
// AUTO-VALIDAÇÃO NO IMPORT (server-side only)
// ============================================================

// Executar validação apenas no servidor e apenas uma vez
if (typeof window === 'undefined') {
  // Flag para evitar validação duplicada
  const globalAny = global as Record<string, unknown>;
  
  if (!globalAny.__ENV_VALIDATED__) {
    globalAny.__ENV_VALIDATED__ = true;
    validateEnvOrFail();
  }
}
