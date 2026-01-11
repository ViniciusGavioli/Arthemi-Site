-- ===========================================================
-- Migration: Cupom + Auditoria + Refund
-- ===========================================================
-- 1. Adiciona campos gross/discount/net/coupon em Booking
-- 2. Adiciona campos gross/discount/net/coupon em Credit
-- 3. Cria CouponUsage para rastreamento de uso
-- 4. Cria Refund como fonte de verdade contábil
-- ===========================================================

-- ============================================================
-- 1. BOOKING: Adicionar campos de auditoria de desconto
-- ============================================================
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "grossAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "netAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
ADD COLUMN IF NOT EXISTS "couponSnapshot" JSONB;

COMMENT ON COLUMN "bookings"."grossAmount" IS 'Valor bruto antes de desconto (centavos)';
COMMENT ON COLUMN "bookings"."discountAmount" IS 'Valor do desconto aplicado (centavos)';
COMMENT ON COLUMN "bookings"."netAmount" IS 'Valor líquido após desconto (centavos)';
COMMENT ON COLUMN "bookings"."couponCode" IS 'Código do cupom aplicado';
COMMENT ON COLUMN "bookings"."couponSnapshot" IS 'Snapshot do cupom no momento da aplicação {discountType, value, description}';

-- ============================================================
-- 2. CREDIT: Adicionar campos de auditoria de desconto
-- ============================================================
ALTER TABLE "credits"
ADD COLUMN IF NOT EXISTS "grossAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "netAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
ADD COLUMN IF NOT EXISTS "couponSnapshot" JSONB;

COMMENT ON COLUMN "credits"."grossAmount" IS 'Valor bruto antes de desconto (centavos)';
COMMENT ON COLUMN "credits"."discountAmount" IS 'Valor do desconto aplicado (centavos)';
COMMENT ON COLUMN "credits"."netAmount" IS 'Valor líquido após desconto (centavos)';
COMMENT ON COLUMN "credits"."couponCode" IS 'Código do cupom aplicado na compra';
COMMENT ON COLUMN "credits"."couponSnapshot" IS 'Snapshot do cupom no momento da aplicação';

-- ============================================================
-- 3. ENUM: CouponUsageContext
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponUsageContext') THEN
    CREATE TYPE "CouponUsageContext" AS ENUM ('BOOKING', 'CREDIT_PURCHASE');
  END IF;
END $$;

-- ============================================================
-- 4. ENUM: CouponUsageStatus
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponUsageStatus') THEN
    CREATE TYPE "CouponUsageStatus" AS ENUM ('USED', 'RESTORED');
  END IF;
END $$;

-- ============================================================
-- 5. MODEL: CouponUsage - Rastreamento de uso de cupons
-- ============================================================
CREATE TABLE IF NOT EXISTS "coupon_usages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "couponCode" TEXT NOT NULL,
  "context" "CouponUsageContext" NOT NULL,
  "bookingId" TEXT,
  "creditId" TEXT,
  "status" "CouponUsageStatus" NOT NULL DEFAULT 'USED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" TIMESTAMP(3),
  
  CONSTRAINT "coupon_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Índice único para impedir cupom duplicado por usuário+contexto
CREATE UNIQUE INDEX IF NOT EXISTS "coupon_usages_userId_couponCode_context_key" ON "coupon_usages"("userId", "couponCode", "context");
CREATE INDEX IF NOT EXISTS "coupon_usages_couponCode_idx" ON "coupon_usages"("couponCode");
CREATE INDEX IF NOT EXISTS "coupon_usages_userId_idx" ON "coupon_usages"("userId");

-- ============================================================
-- 6. ENUM: RefundGateway
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundGateway') THEN
    CREATE TYPE "RefundGateway" AS ENUM ('MANUAL', 'ASAAS');
  END IF;
END $$;

-- ============================================================
-- 7. ENUM: RefundRecordStatus (distinto de RefundStatus existente)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundRecordStatus') THEN
    CREATE TYPE "RefundRecordStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
  END IF;
END $$;

-- ============================================================
-- 8. MODEL: Refund - Fonte de verdade contábil para estornos
-- ============================================================
CREATE TABLE IF NOT EXISTS "refunds" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "creditsReturned" INTEGER NOT NULL DEFAULT 0,
  "moneyReturned" INTEGER NOT NULL DEFAULT 0,
  "totalRefunded" INTEGER NOT NULL DEFAULT 0,
  -- Campos para refund parcial
  "expectedAmount" INTEGER,
  "refundedAmount" INTEGER,
  "isPartial" BOOLEAN NOT NULL DEFAULT false,
  "gateway" "RefundGateway" NOT NULL DEFAULT 'MANUAL',
  "externalRefundId" TEXT,
  "status" "RefundRecordStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "processedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Índices para Refund
CREATE INDEX IF NOT EXISTS "refunds_userId_idx" ON "refunds"("userId");
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds"("status");
CREATE INDEX IF NOT EXISTS "refunds_isPartial_idx" ON "refunds"("isPartial") WHERE "isPartial" = true;

COMMENT ON TABLE "refunds" IS 'Fonte de verdade contábil para estornos - garante idempotência e auditoria';
COMMENT ON COLUMN "refunds"."bookingId" IS 'UNIQUE - apenas um Refund por booking (idempotência)';
COMMENT ON COLUMN "refunds"."creditsReturned" IS 'Valor em centavos devolvido como crédito';
COMMENT ON COLUMN "refunds"."moneyReturned" IS 'Valor em centavos devolvido como dinheiro';
COMMENT ON COLUMN "refunds"."totalRefunded" IS 'creditsReturned + moneyReturned (sempre NET, nunca GROSS)';
COMMENT ON COLUMN "refunds"."expectedAmount" IS 'Valor total esperado (NET + créditos)';
COMMENT ON COLUMN "refunds"."refundedAmount" IS 'Valor efetivamente estornado pelo gateway';
COMMENT ON COLUMN "refunds"."isPartial" IS 'true = refund parcial, requer revisão manual';

-- ============================================================
-- 9. ENUM: Adicionar PARTIAL_REFUND ao FinancialStatus
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PARTIAL_REFUND' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialStatus')) THEN
    ALTER TYPE "FinancialStatus" ADD VALUE 'PARTIAL_REFUND';
  END IF;
END $$;

