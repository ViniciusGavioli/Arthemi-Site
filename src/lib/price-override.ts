// ===========================================================
// lib/price-override.ts - Gerenciamento de PRICE_OVERRIDE (Admin/Dev)
// ===========================================================
// 
// PRICE_OVERRIDE é diferente de CUPOM:
// - CUPOM = desconto % ou fixo, stacka com créditos
// - OVERRIDE = preço final fixo, NÃO stacka com créditos nem cupons
//
// Regras:
// 1. Override ativo => amountToPay = overrideFinalCents
// 2. Override ignora créditos e cupons
// 3. Apenas admin (whitelist ou role ADMIN) pode usar
// 4. Audit obrigatório
// ===========================================================

import { getMinPaymentAmountCents } from './business-rules';

// Lista de emails de admin que podem usar PRICE_OVERRIDE
// Reutiliza a mesma whitelist de DEV_COUPON_ADMIN_EMAILS
const OVERRIDE_ADMIN_EMAILS_RAW = (
  process.env.DEV_COUPON_ADMIN_EMAILS ||
  'admin@arthemisaude.com,administrativo@arthemisaude.com,dev@arthemisaude.com,vinicius@arthemisaude.com'
).split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export const OVERRIDE_ADMIN_EMAILS = OVERRIDE_ADMIN_EMAILS_RAW;

/**
 * Verifica se um email está na whitelist de admin para PRICE_OVERRIDE
 */
export function isOverrideAdmin(email?: string | null): boolean {
  if (!email) return false;
  return OVERRIDE_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Verifica se é ambiente de produção
 */
function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export interface OverrideRequest {
  overrideFinalCents: number; // Preço final em centavos
  overrideReason: string;     // Motivo obrigatório
}

export interface OverrideValidationResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  finalCents?: number; // Valor final ajustado (com piso se necessário)
}

/**
 * Valida se um usuário pode usar PRICE_OVERRIDE
 * 
 * @param sessionEmail Email da SESSÃO (não do body)
 * @param userRole Role do usuário (ADMIN ou CUSTOMER)
 * @param override Dados do override
 * @param requestId ID da request para logs
 */
export function validateOverrideAccess(
  sessionEmail: string | null | undefined,
  userRole: string | null | undefined,
  override: OverrideRequest | null | undefined,
  requestId: string
): OverrideValidationResult {
  // Sem override: passa direto
  if (!override) {
    return { allowed: true };
  }

  // Validar campos obrigatórios
  if (typeof override.overrideFinalCents !== 'number' || override.overrideFinalCents < 0) {
    return {
      allowed: false,
      reason: 'overrideFinalCents deve ser um número >= 0',
      code: 'OVERRIDE_INVALID_AMOUNT',
    };
  }

  if (!override.overrideReason || override.overrideReason.trim().length < 3) {
    return {
      allowed: false,
      reason: 'overrideReason é obrigatório (mín 3 caracteres)',
      code: 'OVERRIDE_MISSING_REASON',
    };
  }

  // Em produção: verificar permissão
  const isProduction = isProductionEnv();
  const isAdmin = userRole === 'ADMIN';
  const isWhitelisted = isOverrideAdmin(sessionEmail);
  const hasPermission = isAdmin || isWhitelisted;

  // Log estruturado (sem PII)
  console.log(`[PRICE_OVERRIDE] ${requestId} | hasSession=${!!sessionEmail} | isAdmin=${isAdmin} | isWhitelisted=${isWhitelisted} | isProduction=${isProduction} | hasPermission=${hasPermission}`);

  if (isProduction && !hasPermission) {
    return {
      allowed: false,
      reason: 'Preço administrativo não disponível para esta conta.',
      code: 'OVERRIDE_NOT_ALLOWED',
    };
  }

  // Em dev: permitir para todos (facilita testes)
  if (!isProduction && !hasPermission) {
    console.log(`[PRICE_OVERRIDE] ${requestId} | DEV_MODE | allowing override without permission`);
  }

  // Aplicar piso mínimo do gateway (Asaas exige R$1,00 para PIX)
  // Se override > 0, garantir que seja >= MIN_AMOUNT
  const minAmount = getMinPaymentAmountCents('PIX');
  let finalCents = override.overrideFinalCents;
  
  if (finalCents > 0 && finalCents < minAmount) {
    console.log(`[PRICE_OVERRIDE] ${requestId} | adjusting from ${finalCents} to ${minAmount} (minimum)`);
    finalCents = minAmount;
  }

  return {
    allowed: true,
    finalCents,
  };
}

/**
 * Códigos de override especiais para testes
 * Formato: OVERRIDE_<valor_em_reais>
 * Ex: OVERRIDE_5 = R$5,00 = 500 centavos
 */
export function parseOverrideCode(code: string | null | undefined): OverrideRequest | null {
  if (!code) return null;
  
  const upper = code.toUpperCase().trim();
  
  // Formato: OVERRIDE_<valor>
  const match = upper.match(/^OVERRIDE_(\d+)$/);
  if (!match) return null;
  
  const valueReais = parseInt(match[1], 10);
  if (isNaN(valueReais) || valueReais < 0) return null;
  
  return {
    overrideFinalCents: valueReais * 100, // Converter para centavos
    overrideReason: `Código administrativo: ${upper}`,
  };
}

/**
 * Verifica se um código de cupom é na verdade um OVERRIDE
 */
export function isOverrideCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return /^OVERRIDE_\d+$/i.test(code.trim());
}
