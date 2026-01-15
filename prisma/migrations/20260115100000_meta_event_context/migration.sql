-- ===========================================================
-- Migration: Meta Event Context
-- ===========================================================
-- Tabela para persistir contexto de eventos Meta Pixel/CAPI
-- Permite deduplicação event_id entre Pixel (client) e CAPI (server)

-- CreateTable
CREATE TABLE "meta_event_contexts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fbp" TEXT,
    "fbc" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "sourceUrl" TEXT,
    "capiSentAt" TIMESTAMP(3),
    "capiStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_event_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique por evento + entidade para evitar duplicação)
CREATE UNIQUE INDEX "meta_event_contexts_eventName_entityType_entityId_key" ON "meta_event_contexts"("eventName", "entityType", "entityId");

-- CreateIndex (busca por entidade)
CREATE INDEX "meta_event_contexts_entityType_entityId_idx" ON "meta_event_contexts"("entityType", "entityId");

-- CreateIndex (busca por eventId para dedup)
CREATE INDEX "meta_event_contexts_eventId_idx" ON "meta_event_contexts"("eventId");
