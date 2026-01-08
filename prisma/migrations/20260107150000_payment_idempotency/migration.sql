-- ===========================================================
-- P-003, P-006, P-007, P-013: Idempotência e Estados Finais
-- ===========================================================
-- 1. Adiciona idempotencyKey ao Payment para evitar cobranças duplicadas
-- 2. Adiciona UNIQUE constraint em externalId (ID do Asaas)
-- 3. Adiciona UNIQUE constraint em bookingId (1 pagamento por booking)
-- 4. Adiciona coluna purchaseId para compras de crédito
-- 5. Adiciona REFUNDED ao FinancialStatus

-- 1. Adicionar idempotencyKey ao Payment (unique)
ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- 2. Adicionar purchaseId para compras de crédito
-- Permite vincular Payment a Credit (purchase) em vez de Booking
ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "purchaseId" TEXT;

-- 3. Criar índices únicos (com WHERE para não conflitar com NULL)
-- Importante: usar índices parciais para permitir NULL mas garantir unicidade quando preenchido

-- Index único em externalId (ID do Asaas) - evita registrar mesmo pagamento duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS "payments_externalId_key" 
ON "payments" ("externalId") 
WHERE "externalId" IS NOT NULL;

-- Index único em idempotencyKey - evita criar cobrança duplicada
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotencyKey_key" 
ON "payments" ("idempotencyKey") 
WHERE "idempotencyKey" IS NOT NULL;

-- Index único em bookingId - 1 pagamento ativo por booking
-- Nota: permite múltiplos se um for REFUNDED/REJECTED, mas bloqueia duplicatas PENDING/APPROVED
CREATE UNIQUE INDEX IF NOT EXISTS "payments_bookingId_active_key" 
ON "payments" ("bookingId") 
WHERE "bookingId" IS NOT NULL 
  AND "status" IN ('PENDING', 'APPROVED', 'IN_PROCESS');

-- Index único em purchaseId - 1 pagamento por compra de crédito
CREATE UNIQUE INDEX IF NOT EXISTS "payments_purchaseId_key" 
ON "payments" ("purchaseId") 
WHERE "purchaseId" IS NOT NULL;

-- 4. Adicionar REFUNDED ao FinancialStatus (precisa recriar o enum)
-- PostgreSQL não permite ALTER TYPE ... ADD VALUE em transação com outros comandos
-- Então usamos uma estratégia diferente: verificar se já existe

DO $$
BEGIN
  -- Tenta adicionar REFUNDED ao enum (ignora se já existir)
  ALTER TYPE "FinancialStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Index para buscar webhooks que precisam reprocessar
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" 
ON "webhook_events" ("status") 
WHERE "status" IN ('PROCESSING', 'FAILED');
