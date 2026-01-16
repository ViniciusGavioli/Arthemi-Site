// ===========================================================
// LIB: Test Override - Override de preço para testes em produção
// ===========================================================
// OBJETIVO: Permitir que DEV/ADMIN teste fluxo de pagamento com R$5
// SEM usar sistema de cupons comerciais.
//
// REGRAS:
// - Override NÃO é desconto - é substituição do valor final
// - Override só funciona com sessão válida + email na whitelist
// - Override ignora créditos (não consome, não aplica)
// - Override NÃO registra CouponUsage (não "queima" cupom)
// - Log estruturado sem PII

// ===========================================================
// CONFIGURAÇÃO VIA ENV
// ===========================================================

/**
 * Flag global para habilitar override de teste
 * Default: false (desligado)
 */
export function isTestOverrideEnabled(): boolean {
  return process.env.ENABLE_TEST_OVERRIDE === 'true';
}

/**
 * Lista de emails autorizados para override de teste
 * Formato: "email1@x.com,email2@y.com"
 */
function getTestOverrideAdminEmails(): string[] {
  const envValue = process.env.TEST_OVERRIDE_ADMIN_EMAILS || '';
  if (!envValue.trim()) return [];
  return envValue.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// ===========================================================
// CONSTANTES
// ===========================================================

/** Código especial para ativar override R$5 */
export const TEST_OVERRIDE_CODE = 'TESTE5';

/** Valor final em centavos (R$5,00) */
export const TEST_OVERRIDE_AMOUNT_CENTS = 500;

// ===========================================================
// ERRO CUSTOMIZADO
// ===========================================================

/**
 * Erro de acesso negado para override de teste
 * Lançado quando tentativa de usar TESTE5 sem permissão
 */
export class TestOverrideAccessError extends Error {
  public readonly code: string;
  public readonly statusCode: number = 403;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'TestOverrideAccessError';
    this.code = code;
    Object.setPrototypeOf(this, TestOverrideAccessError.prototype);
  }
}

// ===========================================================
// FUNÇÕES PRINCIPAIS
// ===========================================================

export interface TestOverrideResult {
  /** Se override está ativo para este request */
  enabled: boolean;
  /** Valor final a pagar em centavos (500 se enabled) */
  finalPayableCents: number;
  /** Razão (para logs) */
  reason: string;
}

/**
 * Verifica se o código fornecido é um override de teste
 * NÃO valida autorização - apenas parsing
 */
export function parseTestOverride(code: string | undefined | null): {
  isOverride: boolean;
  code: string | null;
} {
  if (!code) return { isOverride: false, code: null };
  
  const normalized = code.toUpperCase().trim();
  
  if (normalized === TEST_OVERRIDE_CODE) {
    return { isOverride: true, code: TEST_OVERRIDE_CODE };
  }
  
  return { isOverride: false, code: null };
}

/**
 * Valida se usuário tem permissão para usar override de teste
 * Lança TestOverrideAccessError se não autorizado
 * 
 * @param sessionEmail Email da SESSÃO (não do body)
 * @param isAdmin Se usuário é admin (role)
 * @param requestId Para log
 * @throws TestOverrideAccessError se não autorizado
 */
export function validateTestOverrideAccess(
  sessionEmail: string | null | undefined,
  isAdmin: boolean,
  requestId: string
): void {
  // 1. Flag global desligada
  if (!isTestOverrideEnabled()) {
    console.log(`[TEST_OVERRIDE] ${requestId} | blocked=true | reason=DISABLED`);
    throw new TestOverrideAccessError(
      'Override de teste não está habilitado.',
      'TEST_OVERRIDE_DISABLED'
    );
  }
  
  // 2. Requer sessão
  if (!sessionEmail) {
    console.log(`[TEST_OVERRIDE] ${requestId} | blocked=true | reason=NO_SESSION`);
    throw new TestOverrideAccessError(
      'Override de teste requer login.',
      'TEST_OVERRIDE_NO_SESSION'
    );
  }
  
  // 3. Admin role sempre passa
  if (isAdmin) {
    console.log(`[TEST_OVERRIDE] ${requestId} | allowed=true | reason=ADMIN_ROLE`);
    return;
  }
  
  // 4. Verificar whitelist
  const allowedEmails = getTestOverrideAdminEmails();
  const emailLower = sessionEmail.toLowerCase();
  
  if (allowedEmails.includes(emailLower)) {
    console.log(`[TEST_OVERRIDE] ${requestId} | allowed=true | reason=WHITELIST`);
    return;
  }
  
  // 5. Não autorizado
  console.log(`[TEST_OVERRIDE] ${requestId} | blocked=true | reason=NOT_IN_WHITELIST | whitelistCount=${allowedEmails.length}`);
  throw new TestOverrideAccessError(
    'Você não tem permissão para usar override de teste.',
    'TEST_OVERRIDE_NOT_ALLOWED'
  );
}

/**
 * Processa override de teste completo
 * Retorna se override está ativo e valores finais
 * 
 * @param code Código do "cupom" (pode ser TESTE5)
 * @param sessionEmail Email da sessão
 * @param isAdmin Se é admin
 * @param requestId Para log
 * @returns TestOverrideResult
 */
export function processTestOverride(
  code: string | undefined | null,
  sessionEmail: string | null | undefined,
  isAdmin: boolean,
  requestId: string
): TestOverrideResult {
  // 1. Verificar se é código de override
  const parsed = parseTestOverride(code);
  
  if (!parsed.isOverride) {
    return {
      enabled: false,
      finalPayableCents: 0,
      reason: 'NOT_OVERRIDE_CODE',
    };
  }
  
  // 2. Validar acesso (lança erro se não autorizado)
  validateTestOverrideAccess(sessionEmail, isAdmin, requestId);
  
  // 3. Override autorizado
  console.log(`[TEST_OVERRIDE] ${requestId} | enabled=true | finalPayable=${TEST_OVERRIDE_AMOUNT_CENTS} | endpoint=booking`);
  
  return {
    enabled: true,
    finalPayableCents: TEST_OVERRIDE_AMOUNT_CENTS,
    reason: 'AUTHORIZED',
  };
}
