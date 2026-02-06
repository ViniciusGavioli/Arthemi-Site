-- ===========================================================
-- Migration: Adicionar tabela Coupon para gerenciamento dinâmico de cupons
-- ===========================================================
-- Cria tabela para gerenciar cupons de desconto dinamicamente
-- Suporta cupons de percentual, valor fixo e override de preço

-- ============================================================
-- 1. Criar tabela Coupon
-- ============================================================
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "singleUsePerUser" BOOLEAN NOT NULL DEFAULT false,
  "isDevCoupon" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "minAmountCents" INTEGER,
  "maxUses" INTEGER,
  "currentUses" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. Criar índices
-- ============================================================
-- UNIQUE INDEX em code (já cria índice, não precisa de índice adicional)
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_isActive_idx" ON "coupons"("isActive");
CREATE INDEX IF NOT EXISTS "coupons_validUntil_idx" ON "coupons"("validUntil");

-- ============================================================
-- 3. Adicionar coluna couponId em CouponUsage (opcional)
-- ============================================================
ALTER TABLE "coupon_usages"
ADD COLUMN IF NOT EXISTS "couponId" TEXT;

-- ============================================================
-- 4. Criar foreign key (se não existir)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'coupon_usages_couponId_fkey'
  ) THEN
    ALTER TABLE "coupon_usages"
    ADD CONSTRAINT "coupon_usages_couponId_fkey" 
    FOREIGN KEY ("couponId") 
    REFERENCES "coupons"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. Criar índice em couponId
-- ============================================================
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");

-- ============================================================
-- 6. Inserir cupons existentes (hardcoded) na tabela
-- ============================================================
-- Cupons de produção (desativados por padrão - COUPONS_ENABLED=false)
-- NOTA: IDs são gerados manualmente (não usam cuid()) para manter consistência
INSERT INTO "coupons" ("id", "code", "discountType", "value", "description", "singleUsePerUser", "isDevCoupon", "isActive", "createdAt", "updatedAt")
VALUES 
  ('coupon_arthemi10', 'ARTHEMI10', 'percent', 10, '10% de desconto', false, false, false, NOW(), NOW()),
  ('coupon_primeiracompra', 'PRIMEIRACOMPRA', 'percent', 15, '15% primeira compra', true, false, false, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Cupons de desenvolvimento (ativos)
INSERT INTO "coupons" ("id", "code", "discountType", "value", "description", "singleUsePerUser", "isDevCoupon", "isActive", "createdAt", "updatedAt")
VALUES 
  ('coupon_teste50', 'TESTE50', 'fixed', 500, 'DEV: R$5 desconto', false, true, true, NOW(), NOW()),
  ('coupon_devtest', 'DEVTEST', 'percent', 50, 'DEV: 50% desconto', false, true, true, NOW(), NOW()),
  ('coupon_teste5', 'TESTE5', 'priceOverride', 500, 'TESTE: Força R$5,00', false, true, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Comentários
COMMENT ON TABLE "coupons" IS 'Cupons de desconto gerenciados dinamicamente';
COMMENT ON COLUMN "coupons"."code" IS 'Código único do cupom (ex: ARTHEMI10)';
COMMENT ON COLUMN "coupons"."discountType" IS 'Tipo: fixed (valor fixo), percent (percentual), priceOverride (força valor)';
COMMENT ON COLUMN "coupons"."value" IS 'Valor em centavos para fixed/priceOverride, em % para percent';
COMMENT ON COLUMN "coupons"."singleUsePerUser" IS 'true = cupom só pode ser usado 1x por usuário';
COMMENT ON COLUMN "coupons"."isDevCoupon" IS 'true = cupom de desenvolvimento (uso infinito)';
COMMENT ON COLUMN "coupons"."isActive" IS 'false = cupom desativado';
COMMENT ON COLUMN "coupons"."validFrom" IS 'Data de início da validade (null = sem limite)';
COMMENT ON COLUMN "coupons"."validUntil" IS 'Data de fim da validade (null = sem limite)';
COMMENT ON COLUMN "coupons"."minAmountCents" IS 'Valor mínimo em centavos para aplicar o cupom';
COMMENT ON COLUMN "coupons"."maxUses" IS 'Número máximo de usos totais (null = ilimitado)';
COMMENT ON COLUMN "coupons"."currentUses" IS 'Número atual de usos';
