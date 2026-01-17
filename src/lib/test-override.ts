// ===========================================================
// lib/test-override.ts - Override de Teste R$5 (MVP)
// ===========================================================
// 
// PROPÓSITO: Permitir testar fluxo de pagamento em produção com valor fixo R$5.
// NÃO É CUPOM/DESCONTO - é um OVERRIDE do valor final.
//
// REGRAS:
// 1. Só funciona se ENABLE_TEST_OVERRIDE=true
// 2. Só funciona para usuários autenticados
// 3. Só funciona para admin OU email na whitelist TEST_OVERRIDE_ADMIN_EMAILS
// 4. Não consome créditos, não registra CouponUsage
// 5. Valor fixo: R$5,00 (500 centavos)
// ===========================================================

/**
 * Código de override de teste
 */
export const TEST_OVERRIDE_CODE = 'TESTE5';

/**
 * Valor fixo do override em centavos (R$5,00)
 */
export const TEST_OVERRIDE_AMOUNT_CENTS = 500;

/**
 * Erro customizado para acesso negado ao test override
 */
export class TestOverrideAccessError extends Error {
  public readonly statusCode: number = 403;
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TestOverrideAccessError';
    this.code = code;
    
    // Fix prototype chain for instanceof
    Object.setPrototypeOf(this, TestOverrideAccessError.prototype);
  }
}

/**
 * Verifica se o feature flag de test override está habilitado
 */
export function isTestOverrideEnabled(): boolean {
  return process.env.ENABLE_TEST_OVERRIDE === 'true';
}

/**
 * Retorna lista de emails autorizados para test override
 */
function getTestOverrideAdminEmails(): string[] {
  const raw = process.env.TEST_OVERRIDE_ADMIN_EMAILS || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Verifica se email está na whitelist de test override
 */
function isInTestOverrideWhitelist(email: string | null | undefined): boolean {
  if (!email) return false;
  const whitelist = getTestOverrideAdminEmails();
  return whitelist.includes(email.toLowerCase().trim());
}

/**
 * Parseia código de cupom para verificar se é test override
 * 
 * @returns { isOverride: boolean, code: string | null }
 */
export function parseTestOverride(code: string | null | undefined): {
  isOverride: boolean;
  code: string | null;
} {
  if (!code) {
    return { isOverride: false, code: null };
  }
  
  const normalized = code.toUpperCase().trim();
  
  if (normalized === TEST_OVERRIDE_CODE) {
    return { isOverride: true, code: TEST_OVERRIDE_CODE };
  }
  
  return { isOverride: false, code: null };
}

/**
 * Valida se o usuário tem acesso ao test override
 * Lança TestOverrideAccessError se não autorizado.
 * 
 * @param sessionEmail Email da sessão autenticada
 * @param isAdmin Se o usuário é admin
 * @param requestId ID da request para logs
 * @throws TestOverrideAccessError
 */
export function validateTestOverrideAccess(
  sessionEmail: string | null | undefined,
  isAdmin: boolean,
  requestId: string
): void {
  // 1. Feature flag deve estar habilitado
  if (!isTestOverrideEnabled()) {
    console.log(`[TEST_OVERRIDE] ${requestId} | denied=true | reason=FEATURE_DISABLED`);
    throw new TestOverrideAccessError(
      'Override de teste não está habilitado.',
      'TEST_OVERRIDE_DISABLED'
    );
  }
  
  // 2. Deve ter sessão autenticada
  if (!sessionEmail) {
    console.log(`[TEST_OVERRIDE] ${requestId} | denied=true | reason=NO_SESSION`);
    throw new TestOverrideAccessError(
      'Override de teste requer login.',
      'TEST_OVERRIDE_NO_SESSION'
    );
  }
  
  // 3. Deve ser admin OU estar na whitelist
  const inWhitelist = isInTestOverrideWhitelist(sessionEmail);
  
  if (!isAdmin && !inWhitelist) {
    console.log(`[TEST_OVERRIDE] ${requestId} | denied=true | reason=NOT_AUTHORIZED | isAdmin=${isAdmin} | inWhitelist=${inWhitelist}`);
    throw new TestOverrideAccessError(
      'Override de teste não autorizado para esta conta.',
      'TEST_OVERRIDE_NOT_AUTHORIZED'
    );
  }
  
  // Autorizado
  console.log(`[TEST_OVERRIDE] ${requestId} | allowed=true | isAdmin=${isAdmin} | inWhitelist=${inWhitelist}`);
}

/**
 * Resultado do processamento de test override
 */
export interface TestOverrideResult {
  /** Se o override foi aplicado */
  enabled: boolean;
  /** Valor final a pagar em centavos (500 = R$5) */
  finalPayableCents: number;
  /** Motivo/código */
  reason: string;
}

/**
 * Processa possível test override
 * 
 * Se o código é TESTE5 e usuário está autorizado, retorna override ativo.
 * Se não é código de override, retorna enabled=false sem erro.
 * Se é código de override mas não autorizado, LANÇA ERRO.
 * 
 * @param couponCode Código do cupom/override
 * @param sessionEmail Email da sessão
 * @param isAdmin Se é admin
 * @param requestId ID da request
 */
export function processTestOverride(
  couponCode: string | null | undefined,
  sessionEmail: string | null | undefined,
  isAdmin: boolean,
  requestId: string
): TestOverrideResult {
  // 1. Parsear código
  const parsed = parseTestOverride(couponCode);
  
  if (!parsed.isOverride) {
    // Não é código de override - retornar sem erro
    return {
      enabled: false,
      finalPayableCents: 0,
      reason: 'NOT_OVERRIDE_CODE',
    };
  }
  
  // 2. É código de override - validar acesso (pode lançar erro)
  validateTestOverrideAccess(sessionEmail, isAdmin, requestId);
  
  // 3. Autorizado - retornar override ativo
  console.log(`[TEST_OVERRIDE] ${requestId} | enabled=true | finalPayable=${TEST_OVERRIDE_AMOUNT_CENTS} | code=${TEST_OVERRIDE_CODE}`);
  
  return {
    enabled: true,
    finalPayableCents: TEST_OVERRIDE_AMOUNT_CENTS,
    reason: 'OVERRIDE_APPLIED',
  };
}
