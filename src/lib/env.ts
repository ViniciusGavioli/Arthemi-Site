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
  
  // === PAGAMENTOS ASAAS (obrigatórias se ASAAS_MOCK_MODE=false) ===
  {
    name: 'ASAAS_API_KEY',
    required: false, // Validado condicionalmente
    sensitive: true,
  },
  {
    name: 'ASAAS_WEBHOOK_TOKEN',
    required: false,
    sensitive: true,
  },
  {
    name: 'ASAAS_SANDBOX',
    required: false,
    devDefault: 'true',
    validator: (v) => v === 'true' || v === 'false',
    errorMessage: 'ASAAS_SANDBOX deve ser "true" ou "false"',
  },
  {
    name: 'ASAAS_MOCK_MODE',
    required: false,
    devDefault: 'true',
    validator: (v) => v === 'true' || v === 'false',
    errorMessage: 'ASAAS_MOCK_MODE deve ser "true" ou "false"',
  },
  
  // === CONFIGURAÇÃO ===
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    devDefault: 'http://localhost:3000',
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    errorMessage: 'NEXT_PUBLIC_APP_URL deve ser uma URL válida',
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
 * Validação especial para Asaas
 * Só é obrigatório se ASAAS_MOCK_MODE=false
 */
function validateAsaas(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const isMockMode = process.env.ASAAS_MOCK_MODE === 'true' || !process.env.ASAAS_API_KEY;
  
  if (isMockMode) {
    warnings.push('⚠️  ASAAS_MOCK_MODE ativo - pagamentos simulados (PIX mock)');
    return { errors, warnings };
  }
  
  // Modo real - validar credenciais
  if (!process.env.ASAAS_API_KEY) {
    errors.push('❌ ASAAS_API_KEY obrigatório quando ASAAS_MOCK_MODE=false');
  } else if (!process.env.ASAAS_API_KEY.startsWith('$aact_')) {
    warnings.push('⚠️  ASAAS_API_KEY parece inválida (deve começar com $aact_)');
  }
  
  if (!process.env.ASAAS_WEBHOOK_TOKEN) {
    warnings.push('⚠️  ASAAS_WEBHOOK_TOKEN não definido - webhooks não autenticados');
  }
  
  if (process.env.ASAAS_SANDBOX === 'true') {
    warnings.push('⚠️  ASAAS_SANDBOX ativo - usando ambiente de testes');
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
    // Pular Asaas (validação especial)
    if (config.name.startsWith('ASAAS_')) continue;
    
    const result = validateEnvVar(config);
    if (result.error) errors.push(result.error);
    if (result.warning) warnings.push(result.warning);
  }
  
  // Validação especial Asaas
  const asaasResult = validateAsaas();
  errors.push(...asaasResult.errors);
  warnings.push(...asaasResult.warnings);
  
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
  
  // Asaas
  get ASAAS_API_KEY(): string {
    return process.env.ASAAS_API_KEY || '';
  },
  get ASAAS_WEBHOOK_TOKEN(): string {
    return process.env.ASAAS_WEBHOOK_TOKEN || '';
  },
  get ASAAS_SANDBOX(): boolean {
    return process.env.ASAAS_SANDBOX === 'true';
  },
  get ASAAS_MOCK_MODE(): boolean {
    return process.env.ASAAS_MOCK_MODE === 'true' || !process.env.ASAAS_API_KEY;
  },
  
  // App
  get NEXT_PUBLIC_APP_URL(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
