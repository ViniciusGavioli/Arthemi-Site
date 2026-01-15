// ===========================================================
// lib/meta/capi-integration.ts - Integração CAPI com DB
// ===========================================================
// Helpers para buscar contexto persistido e enviar eventos CAPI
// Usado pelo webhook Asaas e pelo create-with-credit

import { prisma } from '@/lib/prisma';
import { 
  sendPurchaseEvent, 
  sendScheduleEvent, 
  generateServerEventId,
  type CapiUserData,
  type CapiResponse,
} from './capi';

// ============================================================
// TIPOS
// ============================================================

export interface MetaEventContextData {
  eventId: string;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
}

export interface SendCapiPurchaseParams {
  entityType: 'Booking' | 'Credit';
  entityId: string;
  value: number;              // Em reais (não centavos)
  orderId: string;            // ID para referência (paymentId, creditId, etc)
  contentIds?: string[];      // IDs dos produtos
  contentName?: string;       // Nome do produto/pacote
  userEmail?: string;         // Email do usuário (será hasheado)
  userPhone?: string;         // Phone do usuário (será hasheado)
  userId?: string;            // ID interno do usuário (será hasheado)
  requestId?: string;
}

export interface SendCapiScheduleParams {
  entityType: 'Booking';
  entityId: string;
  roomName: string;
  roomId: string;
  value?: number;             // Valor em reais (opcional)
  userEmail?: string;
  userPhone?: string;
  userId?: string;
  requestId?: string;
}

// ============================================================
// BUSCAR CONTEXTO PERSISTIDO
// ============================================================

/**
 * Busca contexto Meta persistido para uma entidade
 * Prioriza evento Purchase, depois Schedule, depois InitiateCheckout
 */
export async function getMetaContext(
  entityType: string,
  entityId: string
): Promise<MetaEventContextData | null> {
  // Buscar contextos existentes para esta entidade
  const contexts = await prisma.metaEventContext.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  if (contexts.length === 0) {
    return null;
  }

  const context = contexts[0];
  return {
    eventId: context.eventId,
    fbp: context.fbp,
    fbc: context.fbc,
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    sourceUrl: context.sourceUrl,
  };
}

/**
 * Cria ou atualiza contexto Meta para uma entidade
 * Gera eventId se não existir
 */
export async function ensureMetaContext(
  eventName: string,
  entityType: string,
  entityId: string,
  additionalData?: Partial<MetaEventContextData>
): Promise<MetaEventContextData> {
  const existing = await getMetaContext(entityType, entityId);
  
  if (existing) {
    return existing;
  }

  // Criar novo contexto
  const eventId = generateServerEventId();
  
  const context = await prisma.metaEventContext.create({
    data: {
      eventId,
      eventName,
      entityType,
      entityId,
      fbp: additionalData?.fbp,
      fbc: additionalData?.fbc,
      clientIp: additionalData?.clientIp,
      userAgent: additionalData?.userAgent,
      sourceUrl: additionalData?.sourceUrl,
    },
  });

  return {
    eventId: context.eventId,
    fbp: context.fbp,
    fbc: context.fbc,
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    sourceUrl: context.sourceUrl,
  };
}

/**
 * Marca contexto como enviado ao CAPI
 */
async function markContextAsSent(
  eventName: string,
  entityType: string,
  entityId: string,
  status: 'SENT' | 'FAILED' | 'SKIPPED'
): Promise<void> {
  try {
    await prisma.metaEventContext.updateMany({
      where: {
        eventName,
        entityType,
        entityId,
      },
      data: {
        capiSentAt: status === 'SENT' ? new Date() : null,
        capiStatus: status,
      },
    });
  } catch (error) {
    // Non-blocking - apenas log
    console.warn(`⚠️ [CAPI] Failed to mark context as sent`, {
      eventName,
      entityType,
      entityId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ============================================================
// ENVIO DE PURCHASE (Webhook)
// ============================================================

/**
 * Envia evento Purchase para CAPI
 * Chamado pelo webhook quando pagamento é confirmado
 * 
 * Busca contexto persistido (IP, UA, fbp, fbc) e complementa
 * com dados do usuário para melhor match rate
 */
export async function sendCapiPurchase(
  params: SendCapiPurchaseParams
): Promise<CapiResponse> {
  const { entityType, entityId, value, orderId, contentIds, contentName, requestId } = params;

  // Buscar ou criar contexto
  const context = await ensureMetaContext('Purchase', entityType, entityId);

  // Montar userData
  const userData: CapiUserData = {
    clientIpAddress: context.clientIp || undefined,
    clientUserAgent: context.userAgent || undefined,
    fbp: context.fbp || undefined,
    fbc: context.fbc || undefined,
    em: params.userEmail,
    ph: params.userPhone,
    externalId: params.userId,
  };

  // Se não temos IP/UA do cliente, usar marcador
  // Isso é necessário para o Meta aceitar o evento, mas diminui match rate
  if (!userData.clientIpAddress) {
    userData.clientIpAddress = '0.0.0.0'; // Marcador de "desconhecido"
  }
  if (!userData.clientUserAgent) {
    userData.clientUserAgent = 'Arthemi-Server/1.0';
  }

  // Enviar evento
  const result = await sendPurchaseEvent({
    eventId: context.eventId,
    value,
    orderId,
    contentIds,
    contentName,
    userData,
    eventSourceUrl: context.sourceUrl || undefined,
    requestId,
  });

  // Marcar como enviado
  await markContextAsSent(
    'Purchase',
    entityType,
    entityId,
    result.ok ? 'SENT' : 'FAILED'
  );

  return result;
}

// ============================================================
// ENVIO DE SCHEDULE (Booking)
// ============================================================

/**
 * Envia evento Schedule para CAPI
 * Chamado quando booking é criado/confirmado
 */
export async function sendCapiSchedule(
  params: SendCapiScheduleParams
): Promise<CapiResponse> {
  const { entityType, entityId, roomName, roomId, value, requestId } = params;

  // Buscar ou criar contexto
  const context = await ensureMetaContext('Schedule', entityType, entityId);

  // Montar userData
  const userData: CapiUserData = {
    clientIpAddress: context.clientIp || undefined,
    clientUserAgent: context.userAgent || undefined,
    fbp: context.fbp || undefined,
    fbc: context.fbc || undefined,
    em: params.userEmail,
    ph: params.userPhone,
    externalId: params.userId,
  };

  // Marcadores se não temos dados reais
  if (!userData.clientIpAddress) {
    userData.clientIpAddress = '0.0.0.0';
  }
  if (!userData.clientUserAgent) {
    userData.clientUserAgent = 'Arthemi-Server/1.0';
  }

  // Enviar evento
  const result = await sendScheduleEvent({
    eventId: context.eventId,
    contentName: roomName,
    contentIds: [roomId],
    value,
    userData,
    eventSourceUrl: context.sourceUrl || undefined,
    requestId,
  });

  // Marcar como enviado
  await markContextAsSent(
    'Schedule',
    entityType,
    entityId,
    result.ok ? 'SENT' : 'FAILED'
  );

  return result;
}

// ============================================================
// VERIFICAÇÃO DE DUPLICIDADE
// ============================================================

/**
 * Verifica se evento CAPI já foi enviado para esta entidade
 */
export async function isCapiEventSent(
  eventName: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const context = await prisma.metaEventContext.findFirst({
    where: {
      eventName,
      entityType,
      entityId,
      capiStatus: 'SENT',
    },
  });

  return !!context;
}
