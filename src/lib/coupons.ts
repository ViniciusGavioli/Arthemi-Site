// ===========================================================
// lib/coupons.ts - Gerenciamento centralizado de cupons
// ===========================================================
// P1-5: Lógica de cupons em um único lugar (backend)
// Usado por: /api/credits/purchase.ts, /api/admin/credits/create.ts, /api/bookings/index.ts
// 
// ATUALIZAÇÃO: Busca cupons do banco primeiro, com fallback para hardcoded
// para compatibilidade com cupons legados

import { PrismaClient, Prisma, CouponUsageContext, CouponUsageStatus } from '@prisma/client';
import { prisma } from './prisma';

// ===========================================================
// MVP FLAG: DESLIGAR CUPOM COMERCIAL
// ===========================================================
// COUPONS_ENABLED=false → Backend ignora qualquer cupom comercial
// Mantém compatibilidade: tabelas/campos intactos, apenas skip na lógica
// ===========================================================

/**
 * Flag global para habilitar/desabilitar cupons comerciais
 * Default: false (desligado para MVP)
 */
export function areCouponsEnabled(): boolean {
  return process.env.COUPONS_ENABLED === 'true';
}

export interface CouponConfig {
  discountType: 'fixed' | 'percent' | 'priceOverride'; // priceOverride = força valor fixo
  value: number; // Em centavos para 'fixed'/'priceOverride', em % para 'percent'
  description: string;
  singleUsePerUser?: boolean; // true = cupom só pode ser usado 1x por usuário (ex: PRIMEIRACOMPRA)
  isDevCoupon?: boolean; // true = cupom de desenvolvimento (uso infinito, não consome)
  minAmountCents?: number | null; // Valor mínimo em centavos para aplicar o cupom (null = sem mínimo)
}

// ===========================================================
// CUPOM DE DESENVOLVIMENTO (DEV COUPON)
// ===========================================================
// Regras:
// 1. Uso INFINITO - não consome, não bloqueia
// 2. Em PRODUÇÃO: bloqueado para usuários normais
// 3. Em DEV/STAGING: liberado para todos
// 4. Admin (whitelist): sempre liberado
// ===========================================================

// Lista de emails de admin que podem usar cupons DEV em produção
// Parse: trim + lowercase para cada email
const DEV_COUPON_ADMIN_EMAILS_RAW = (
  process.env.DEV_COUPON_ADMIN_EMAILS ||
  'admin@arthemisaude.com,administrativo@arthemisaude.com,dev@arthemisaude.com,vinicius@arthemisaude.com'
).split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Export para testes
export const DEV_COUPON_ADMIN_EMAILS = DEV_COUPON_ADMIN_EMAILS_RAW;

/**
 * Verifica se é ambiente de produção
 */
function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Verifica se um email está na whitelist de admin para cupons DEV
 * @param email Email a verificar (será normalizado para lowercase)
 */
export function isDevCouponAdmin(email?: string | null): boolean {
  if (!email) return false;
  return DEV_COUPON_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Verifica se um cupom DEV pode ser usado
 * @param coupon Config do cupom
 * @param userEmail Email do usuário (opcional)
 * @returns { allowed: boolean, reason?: string }
 */
export function canUseDevCoupon(
  coupon: CouponConfig | null,
  userEmail?: string | null
): { allowed: boolean; reason?: string } {
  if (!coupon?.isDevCoupon) {
    return { allowed: true }; // Não é cupom DEV, passa direto
  }
  
  // Cupom DEV em ambiente não-produção: sempre permitido
  if (!isProductionEnv()) {
    return { allowed: true };
  }
  
  // Cupom DEV em produção: só admin
  if (isDevCouponAdmin(userEmail)) {
    return { allowed: true };
  }
  
  // Cupom DEV em produção para usuário comum: BLOQUEADO
  return { 
    allowed: false, 
    reason: 'Cupom de desenvolvimento não disponível.' 
  };
}

/**
 * Validação segura de DEV coupon para APIs
 * REGRA: DEV coupon em produção REQUER sessão autenticada com email na whitelist
 * 
 * @param couponCode Código do cupom
 * @param sessionEmail Email da SESSÃO (NextAuth) - nunca do body
 * @param requestId ID da request para logs
 * @returns { allowed: boolean, reason?: string, code?: string }
 */
export async function validateDevCouponAccess(
  couponCode: string,
  sessionEmail: string | null | undefined,
  requestId: string
): Promise<{ allowed: boolean; reason?: string; code?: string }> {
  const coupon = await getCouponInfo(couponCode);
  
  // Não é cupom DEV: sempre passa
  if (!coupon?.isDevCoupon) {
    return { allowed: true };
  }
  
  // Ambiente não-produção: sempre permite
  if (!isProductionEnv()) {
    console.log(`[DEV_COUPON] ${requestId} | isDevCoupon=true | env=development | allowed=true`);
    return { allowed: true };
  }
  
  // Produção: REQUER sessão com email
  const hasSessionEmail = !!sessionEmail;
  const isAllowed = hasSessionEmail && isDevCouponAdmin(sessionEmail);
  
  // Log seguro (sem PII - não loga o email)
  console.log(`[DEV_COUPON] ${requestId} | isDevCoupon=true | env=production | hasSessionEmail=${hasSessionEmail} | whitelistCount=${DEV_COUPON_ADMIN_EMAILS.length} | isAllowed=${isAllowed}`);
  
  if (!hasSessionEmail) {
    return {
      allowed: false,
      reason: 'Cupom de teste requer login.',
      code: 'DEV_COUPON_NO_SESSION',
    };
  }
  
  if (!isAllowed) {
    return {
      allowed: false,
      reason: 'Cupom de desenvolvimento não disponível para esta conta.',
      code: 'DEV_COUPON_NOT_ALLOWED',
    };
  }
  
  return { allowed: true };
}

// Cupons válidos - ÚNICA FONTE DE VERDADE
export const VALID_COUPONS: Record<string, CouponConfig> = {
  // === CUPONS DE PRODUÇÃO (DESATIVADOS - areCouponsEnabled() = false) ===
  'ARTHEMI10': { discountType: 'percent', value: 10, description: '10% de desconto', singleUsePerUser: false },
  'PRIMEIRACOMPRA': { discountType: 'percent', value: 15, description: '15% primeira compra', singleUsePerUser: true },
  
  // === CUPONS DE DESENVOLVIMENTO (uso infinito) ===
  'TESTE50': { discountType: 'fixed', value: 500, description: 'DEV: R$5 desconto', singleUsePerUser: false, isDevCoupon: true },
  'DEVTEST': { discountType: 'percent', value: 50, description: 'DEV: 50% desconto', singleUsePerUser: false, isDevCoupon: true },
  
  // === CUPOM DE PAGAMENTO TESTE (força valor R$5,00) ===
  'TESTE5': { discountType: 'priceOverride', value: 500, description: 'TESTE: Força R$5,00', singleUsePerUser: false, isDevCoupon: true },
};

/**
 * Busca cupom do banco de dados
 * Retorna null se não encontrado ou inativo
 */
export async function getCouponFromDB(code: string): Promise<CouponConfig | null> {
  if (!code) return null;
  
  try {
    const normalizedCode = code.toUpperCase().trim();
    const now = new Date();
    
    const coupon = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });
    
    if (!coupon || !coupon.isActive) {
      return null;
    }
    
    // Validar data de validade
    if (coupon.validFrom && now < coupon.validFrom) {
      return null; // Cupom ainda não válido
    }
    
    if (coupon.validUntil && now > coupon.validUntil) {
      return null; // Cupom expirado
    }
    
    // Validar limite de usos
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return null; // Cupom esgotado
    }
    
    // Converter para CouponConfig
    // Nota: minAmountCents será validado no endpoint de validação
    return {
      discountType: coupon.discountType as 'fixed' | 'percent' | 'priceOverride',
      value: coupon.value,
      description: coupon.description,
      singleUsePerUser: coupon.singleUsePerUser,
      isDevCoupon: coupon.isDevCoupon,
      minAmountCents: coupon.minAmountCents,
    };
  } catch (error) {
    console.error('[COUPONS] Erro ao buscar cupom do banco:', error);
    // Fallback para hardcoded em caso de erro
    return null;
  }
}

/**
 * Valida se um cupom existe (banco ou hardcoded)
 */
export async function isValidCoupon(code: string): Promise<boolean> {
  if (!code) return false;
  
  // Tentar buscar do banco primeiro
  const dbCoupon = await getCouponFromDB(code);
  if (dbCoupon) return true;
  
  // Fallback para hardcoded
  return !!VALID_COUPONS[code.toUpperCase().trim()];
}

/**
 * Versão síncrona para compatibilidade (usa apenas hardcoded)
 * @deprecated Use isValidCouponAsync ou getCouponInfoAsync
 */
export function isValidCouponSync(code: string): boolean {
  if (!code) return false;
  return !!VALID_COUPONS[code.toUpperCase().trim()];
}

/**
 * Retorna as informações do cupom ou null (banco ou hardcoded)
 */
export async function getCouponInfo(code: string): Promise<CouponConfig | null> {
  if (!code) return null;
  
  // Tentar buscar do banco primeiro
  const dbCoupon = await getCouponFromDB(code);
  if (dbCoupon) return dbCoupon;
  
  // Fallback para hardcoded
  return VALID_COUPONS[code.toUpperCase().trim()] || null;
}

/**
 * Versão síncrona para compatibilidade (usa apenas hardcoded)
 * @deprecated Use getCouponInfo
 */
export function getCouponInfoSync(code: string): CouponConfig | null {
  if (!code) return null;
  return VALID_COUPONS[code.toUpperCase().trim()] || null;
}

/**
 * Aplica desconto do cupom em um valor (versão assíncrona - busca do banco)
 * @param amount Valor original em centavos
 * @param couponCode Código do cupom
 * @returns Valor com desconto aplicado
 * 
 * REGRA DE PISO (Asaas exige mínimo R$1,00 para PIX):
 * - Se amount >= 100: piso = 100 centavos
 * - Se amount < 100: sem piso (valor original já é menor que R$1)
 * 
 * INVARIANTES:
 * - finalAmount >= 0
 * - discountAmount >= 0
 * - finalAmount + discountAmount = amount (sempre)
 */
export async function applyDiscount(amount: number, couponCode: string): Promise<{ 
  finalAmount: number; 
  discountAmount: number; 
  couponApplied: boolean;
}> {
  const coupon = await getCouponInfo(couponCode);
  
  return applyDiscountInternal(amount, coupon);
}

/**
 * Versão síncrona para compatibilidade (usa apenas hardcoded)
 * @deprecated Use applyDiscount (assíncrona) para buscar do banco
 */
export function applyDiscountSync(amount: number, couponCode: string): { 
  finalAmount: number; 
  discountAmount: number; 
  couponApplied: boolean;
} {
  const coupon = getCouponInfoSync(couponCode);
  return applyDiscountInternal(amount, coupon);
}

/**
 * Lógica interna de aplicação de desconto (reutilizada por sync e async)
 */
function applyDiscountInternal(amount: number, coupon: CouponConfig | null): {
  finalAmount: number;
  discountAmount: number;
  couponApplied: boolean;
} {
  if (!coupon) {
    return { finalAmount: amount, discountAmount: 0, couponApplied: false };
  }
  
  // TIPO ESPECIAL: priceOverride - força valor fixo (ex: TESTE5 → R$5,00)
  if (coupon.discountType === 'priceOverride') {
    const forcedAmount = coupon.value; // valor em centavos
    const discountAmount = Math.max(0, amount - forcedAmount);
    return { 
      finalAmount: forcedAmount, 
      discountAmount, 
      couponApplied: true 
    };
  }
  
  // Calcular desconto bruto
  let calculatedDiscount = 0;
  
  if (coupon.discountType === 'fixed') {
    calculatedDiscount = coupon.value;
  } else if (coupon.discountType === 'percent') {
    calculatedDiscount = Math.round(amount * (coupon.value / 100));
  }
  
  // Aplicar piso de R$1,00 APENAS se amount >= 100
  // Se amount < 100, usuário já está pagando menos que R$1, não faz sentido forçar piso
  const minAmount = amount >= 100 ? 100 : 0;
  
  // Calcular valor final respeitando piso
  const finalAmount = Math.max(minAmount, amount - calculatedDiscount);
  
  // Desconto efetivo = diferença entre original e final
  // INVARIANTE: amount = finalAmount + discountAmount
  const discountAmount = amount - finalAmount;
  
  return { 
    finalAmount, 
    discountAmount, 
    couponApplied: true 
  };
}

// ===========================================================
// RASTREAMENTO DE USO DE CUPONS (Anti-Fraude)
// ===========================================================
// REGRA DE NEGÓCIO: CUPOM PERMANENTE, USO ÚNICO POR CPF
// - Cada CPF pode usar o cupom apenas 1 vez POR CONTEXTO (BOOKING ou CREDIT_PURCHASE)
// - Se a pessoa NÃO PAGAR (cancelamento, expiração): cupom VOLTA (status = RESTORED)
// - Se a pessoa PAGAR: cupom CONSUMIDO PARA SEMPRE (status = USED permanece)
// ===========================================================

/**
 * Verifica se um cupom pode ser usado por um usuário
 * 
 * REGRA: SEMPRE verifica no banco se existe registro para (userId, couponCode, context)
 * - Se existir com status USED → bloquear (código COUPON_ALREADY_USED)
 * - Se existir com status RESTORED → permitir (será reativado)
 * - Se não existir → permitir (será criado novo)
 * 
 * CUPOM DEV: Ignora validação de uso (uso infinito)
 * 
 * @param prisma Instância do Prisma (DEVE ser tx dentro de transação)
 * @param userId ID do usuário
 * @param couponCode Código do cupom
 * @param context Contexto de uso (BOOKING ou CREDIT_PURCHASE)
 * @param userEmail Email do usuário (para validar acesso a cupom DEV em produção)
 * @returns { canUse: boolean, reason?: string, code?: string, isDevCoupon?: boolean }
 */
export async function checkCouponUsage(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  couponCode: string,
  context: CouponUsageContext,
  userEmail?: string | null
): Promise<{ canUse: boolean; reason?: string; code?: string; isDevCoupon?: boolean }> {
  const normalizedCode = couponCode.toUpperCase().trim();
  const coupon = await getCouponInfo(normalizedCode);
  
  if (!coupon) {
    return { canUse: false, reason: 'Cupom inválido', code: 'COUPON_INVALID' };
  }
  
  // ===========================================================
  // CUPOM DEV: Validação especial
  // ===========================================================
  if (coupon.isDevCoupon) {
    const devCheck = canUseDevCoupon(coupon, userEmail);
    if (!devCheck.allowed) {
      return { 
        canUse: false, 
        reason: devCheck.reason || 'Cupom não disponível',
        code: 'DEV_COUPON_BLOCKED',
      };
    }
    // Cupom DEV permitido: SKIP validação de uso (uso infinito)
    return { canUse: true, isDevCoupon: true };
  }
  
  // ===========================================================
  // CUPOM NORMAL: Validação padrão
  // ===========================================================
  
  // SEMPRE verificar no banco - TODOS os cupons seguem regra CPF 1x por contexto
  const existingUsage = await prisma.couponUsage.findUnique({
    where: {
      userId_couponCode_context: {
        userId,
        couponCode: normalizedCode,
        context,
      },
    },
  });
  
  // Se não existe registro, pode usar (será criado)
  if (!existingUsage) {
    return { canUse: true };
  }
  
  // Se existe com status USED → bloquear
  if (existingUsage.status === CouponUsageStatus.USED) {
    return { 
      canUse: false, 
      reason: `Cupom ${normalizedCode} já foi utilizado para este tipo de operação.`,
      code: 'COUPON_ALREADY_USED',
    };
  }
  
  // Se existe com status RESTORED → permitir (será reativado pelo recordCouponUsage)
  if (existingUsage.status === CouponUsageStatus.RESTORED) {
    return { canUse: true };
  }
  
  // Qualquer outro status (ex: PENDING antigo) → permitir com cautela
  return { canUse: true };
}

/**
 * Registra o uso de um cupom de forma SEGURA (sem P2002 dentro de transação)
 * 
 * PROBLEMA ANTERIOR:
 * try/catch de P2002 com query dentro do catch causava 25P02 (transaction aborted)
 * 
 * SOLUÇÃO:
 * 1. updateMany onde status = RESTORED → USED (claim de cupom restaurado)
 * 2. Se count === 0 → create novo registro USED
 * 3. Se create falhar → NÃO catch interno, deixa erro propagar (transaction aborta limpa)
 * 
 * IMPORTANTE: checkCouponUsage DEVE ser chamado ANTES desta função!
 * Se checkCouponUsage retornou canUse:true, o create DEVE funcionar.
 * Se falhar, há race condition - nesse caso é melhor abortar que corromper dados.
 * 
 * @returns { ok: boolean, mode?: string }
 */
export interface RecordCouponUsageResult {
  ok: boolean;
  mode?: 'CREATED' | 'CLAIMED_RESTORED' | 'SKIPPED_DEV';
}

export async function recordCouponUsageIdempotent(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    couponCode: string;
    context: CouponUsageContext;
    bookingId?: string;
    creditId?: string;
    isDevCoupon?: boolean; // Se true, não registra uso (cupom DEV)
  }
): Promise<RecordCouponUsageResult> {
  const { userId, couponCode, context, bookingId, creditId, isDevCoupon } = params;
  const normalizedCode = couponCode.toUpperCase().trim();
  
  // ==================================================================
  // CUPOM DEV: NÃO registra uso (uso infinito)
  // ==================================================================
  if (isDevCoupon) {
    return { ok: true, mode: 'SKIPPED_DEV' };
  }
  
  // ==================================================================
  // STEP 1: Tentar "claim" de registro RESTORED existente via updateMany
  // updateMany com WHERE condicional é atômico - não causa P2002
  // ==================================================================
  const claimedRestored = await tx.couponUsage.updateMany({
    where: {
      userId,
      couponCode: normalizedCode,
      context,
      status: CouponUsageStatus.RESTORED, // SÓ claim se status é RESTORED
    },
    data: {
      status: CouponUsageStatus.USED,
      bookingId: context === 'BOOKING' ? bookingId : null,
      creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
      restoredAt: null,
    },
  });
  
  if (claimedRestored.count > 0) {
    return { ok: true, mode: 'CLAIMED_RESTORED' };
  }
  
  // ==================================================================
  // STEP 2: Criar novo registro USED
  // Se falhar (P2002 por race condition), deixa propagar - transaction aborta
  // Isso é MELHOR que ter dados corrompidos ou 25P02
  // ==================================================================
  await tx.couponUsage.create({
    data: {
      userId,
      couponCode: normalizedCode,
      context,
      bookingId: context === 'BOOKING' ? bookingId : null,
      creditId: context === 'CREDIT_PURCHASE' ? creditId : null,
      status: CouponUsageStatus.USED,
    },
  });
  
  return { ok: true, mode: 'CREATED' };
}

/**
 * @deprecated Use recordCouponUsageIdempotent para garantir idempotência
 */
export async function recordCouponUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  couponCode: string,
  context: CouponUsageContext,
  bookingId?: string,
  creditId?: string
): Promise<void> {
  await recordCouponUsageIdempotent(tx, { userId, couponCode, context, bookingId, creditId });
}

/**
 * Gera o snapshot do cupom para auditoria (versão assíncrona)
 */
export async function createCouponSnapshot(couponCode: string): Promise<object | null> {
  const coupon = await getCouponInfo(couponCode);
  if (!coupon) return null;
  
  return {
    code: couponCode.toUpperCase().trim(),
    discountType: coupon.discountType,
    value: coupon.value,
    description: coupon.description,
    singleUsePerUser: coupon.singleUsePerUser || false,
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Restaura cupom após cancelamento/expiração de booking/crédito NÃO PAGO
 * 
 * REGRA DE NEGÓCIO:
 * - Se a pessoa NÃO PAGAR (cancelamento, expiração, erro): cupom VOLTA (status = RESTORED)
 * - Se a pessoa PAGAR: cupom CONSUMIDO PARA SEMPRE (NÃO restaurar)
 * 
 * @param tx Transação Prisma
 * @param bookingId ID do booking (para contexto BOOKING)
 * @param creditId ID do crédito (para contexto CREDIT_PURCHASE)
 * @param wasPaid Se true, NÃO restaura (cupom consumido para sempre)
 */
export async function restoreCouponUsage(
  tx: Prisma.TransactionClient,
  bookingId?: string,
  creditId?: string,
  wasPaid: boolean = false
): Promise<{ restored: boolean; couponCode?: string }> {
  // Se foi pago, NUNCA restaurar cupom
  if (wasPaid) {
    return { restored: false };
  }
  
  // Buscar o uso do cupom - usa AND para garantir que é o cupom certo
  // IMPORTANTE: Só restaura se o cupom está USED E apontando para ESTE booking/credit específico
  const usage = await tx.couponUsage.findFirst({
    where: {
      // Condição específica: o cupom deve estar apontando para este booking/credit
      ...(bookingId ? { bookingId } : {}),
      ...(creditId ? { creditId } : {}),
      status: CouponUsageStatus.USED,
    },
  });
  
  if (!usage) {
    return { restored: false };
  }
  
  // Marcar como restaurado (disponível para uso novamente)
  await tx.couponUsage.update({
    where: { id: usage.id },
    data: {
      status: CouponUsageStatus.RESTORED,
      restoredAt: new Date(),
      // Limpar referências ao booking/credit cancelado
      bookingId: null,
      creditId: null,
    },
  });
  
  return { restored: true, couponCode: usage.couponCode };
}
