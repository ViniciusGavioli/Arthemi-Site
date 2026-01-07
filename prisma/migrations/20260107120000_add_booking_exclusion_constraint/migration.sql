-- ===========================================================
-- Migration: P-001 - Prevenir Overbooking (Concorrência de Reservas)
-- ===========================================================
-- Esta migration adiciona um EXCLUDE constraint para garantir que
-- NUNCA haja duas reservas para a mesma sala no mesmo período.
--
-- Funciona mesmo com requisições concorrentes (race condition).
-- ===========================================================

-- 1. Habilitar extensão btree_gist (necessária para EXCLUDE com tsrange)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Criar EXCLUDE constraint na tabela bookings
-- Previne sobreposição de horários para a mesma sala
-- Considera apenas reservas ativas (status NOT IN ('CANCELLED', 'NO_SHOW'))
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING GIST (
  "roomId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- 3. Comentário de documentação
COMMENT ON CONSTRAINT bookings_no_overlap ON bookings IS 
'P-001: Previne overbooking - não permite duas reservas ativas para a mesma sala com horários sobrepostos';
