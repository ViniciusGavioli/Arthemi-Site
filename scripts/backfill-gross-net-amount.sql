-- ===========================================================
-- Backfill: Preencher grossAmount/discountAmount/netAmount
-- ===========================================================
-- Para registros antigos que foram criados antes da migration
-- Executar no Supabase SQL Editor
-- ===========================================================

-- 1. CREDITS: Preencher campos de auditoria onde estão NULL ou 0
-- Regra: grossAmount = amount, discountAmount = 0, netAmount = amount

UPDATE credits
SET 
  "grossAmount" = amount,
  "discountAmount" = 0,
  "netAmount" = amount
WHERE 
  "grossAmount" IS NULL 
  OR "grossAmount" = 0;

-- Verificar resultado
SELECT 
  'credits' as tabela,
  COUNT(*) FILTER (WHERE "grossAmount" IS NULL OR "grossAmount" = 0) as sem_gross,
  COUNT(*) FILTER (WHERE "grossAmount" > 0) as com_gross,
  COUNT(*) as total
FROM credits;

-- 2. BOOKINGS: Preencher campos de auditoria onde estão NULL ou 0
-- Regra: grossAmount = amountPaid, discountAmount = 0, netAmount = amountPaid

UPDATE bookings
SET 
  "grossAmount" = "amountPaid",
  "discountAmount" = 0,
  "netAmount" = "amountPaid"
WHERE 
  ("grossAmount" IS NULL OR "grossAmount" = 0)
  AND "amountPaid" > 0;

-- Para bookings com amountPaid = 0 (cortesias ou pendentes), deixar como está
-- Não faz sentido definir grossAmount sem valor pago

-- Verificar resultado
SELECT 
  'bookings' as tabela,
  COUNT(*) FILTER (WHERE "grossAmount" IS NULL OR "grossAmount" = 0) as sem_gross,
  COUNT(*) FILTER (WHERE "grossAmount" > 0) as com_gross,
  COUNT(*) as total
FROM bookings;

-- ===========================================================
-- RESUMO ESPERADO:
-- credits: todos devem ter grossAmount > 0 (se amount > 0)
-- bookings: apenas os com amountPaid > 0 terão grossAmount
-- ===========================================================
