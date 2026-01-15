// ===========================================================
// lib/meta/capi.ts - Meta Conversions API (Server-Side)
// ===========================================================
// Implementação server-only para envio de eventos ao Meta CAPI
// NUNCA expor token no client
//
// EVENTOS SUPORTADOS:
// - Purchase: Pagamento confirmado
// - Schedule: Booking criado/confirmado
// - Lead: Captação de lead (opcional)
//
// DEDUPLICAÇÃO:
// - event_id DEVE ser o mesmo enviado no Pixel (client)
// - Meta desduplicará automaticamente eventos com mesmo event_id
//
// REFERÊNCIA:
// https://developers.facebook.com/docs/marketing-api/conversions-api

import { createHash } from 'crypto';

// ============================================================
// CONFIGURAÇÃO (Server-only)
// ============================================================

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_CONVERSIONS_TOKEN = process.env.META_CONVERSIONS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;
const META_CAPI_ENABLED = process.env.META_CAPI_ENABLED !== 'false';

// Timeout e retry config
const CAPI_TIMEOUT_MS = 3000;
const CAPI_MAX_RETRIES = 1;

// ============================================================
// TIPOS
// ============================================================

export type MetaEventName = 
  | 'Purchase' 
  | 'Schedule' 
  | 'Lead' 
  | 'InitiateCheckout'
  | 'ViewContent'
  | 'Contact'
  | 'CompleteRegistration';

export type ActionSource = 'website' | 'app' | 'phone_call' | 'chat' | 'email' | 'other';

export interface CapiUserData {
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;           // _fbp cookie
  fbc?: string;           // _fbc cookie (click tracking)
  em?: string;            // Email (será hasheado se não estiver)
  ph?: string;            // Phone (será hasheado se não estiver)
  fn?: string;            // First name (será hasheado)
  ln?: string;            // Last name (será hasheado)
  externalId?: string;    // User ID interno (será hasheado)
}

export interface CapiCustomData {
  currency?: string;
  value?: number;
  contentIds?: string[];
  contentName?: string;
  contentType?: string;
  orderId?: string;
  numItems?: number;
}

export interface CapiEventInput {
  eventName: MetaEventName;
  eventId: string;              // OBRIGATÓRIO para dedup
  eventTime?: number;           // Unix timestamp (seconds). Default: agora
  eventSourceUrl?: string;      // URL onde o evento ocorreu
  actionSource?: ActionSource;  // Default: 'website'
  userData: CapiUserData;
  customData?: CapiCustomData;
}

export interface CapiResponse {
  ok: boolean;
  status: number;
  metaTraceId?: string;
  eventsReceived?: number;
  messages?: string[];
  error?: string;
}

// ============================================================
// HASHING SHA-256 (Server-only)
// ============================================================

/**
 * Hash SHA-256 normalizado para Meta CAPI
 * - Lowercase
 * - Trim
 * - Remove caracteres especiais para phone
 * 
 * @param value Valor a ser hasheado
 * @param type Tipo do campo (para normalização específica)
 */
export function hashForMeta(value: string | undefined | null, type?: 'email' | 'phone' | 'name'): string | undefined {
  if (!value) return undefined;
  
  let normalized = value.trim().toLowerCase();
  
  // Normalização específica por tipo
  if (type === 'phone') {
    // Remove tudo que não é dígito
    normalized = normalized.replace(/\D/g, '');
    // Brasil: adicionar código do país se não tiver
    if (normalized.length === 11 || normalized.length === 10) {
      normalized = '55' + normalized;
    }
  } else if (type === 'email') {
    // Email já está normalizado (lowercase + trim)
  } else if (type === 'name') {
    // Remove acentos e caracteres especiais
    normalized = normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }
  
  if (!normalized) return undefined;
  
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verifica se um valor já está hasheado (SHA-256 = 64 chars hex)
 */
function isAlreadyHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

// ============================================================
// GERAÇÃO DE EVENT_ID (Server-side)
// ============================================================

/**
 * Gera UUID v4 para event_id quando não fornecido pelo client
 */
export function generateServerEventId(): string {
  // Node.js crypto.randomUUID disponível desde v14.17
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback manual
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// PAYLOAD BUILDER
// ============================================================

interface MetaCapiPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    event_source_url?: string;
    action_source: string;
    user_data: Record<string, string | undefined>;
    custom_data?: Record<string, unknown>;
  }>;
  test_event_code?: string;
}

/**
 * Constrói payload formatado para Meta CAPI
 */
export function buildCapiPayload(input: CapiEventInput): MetaCapiPayload {
  const eventTime = input.eventTime || Math.floor(Date.now() / 1000);
  
  // User data com hashing automático
  const userData: Record<string, string | undefined> = {};
  
  // Campos obrigatórios para match
  if (input.userData.clientIpAddress) {
    userData.client_ip_address = input.userData.clientIpAddress;
  }
  if (input.userData.clientUserAgent) {
    userData.client_user_agent = input.userData.clientUserAgent;
  }
  
  // Cookies de tracking (não hasheados)
  if (input.userData.fbp) {
    userData.fbp = input.userData.fbp;
  }
  if (input.userData.fbc) {
    userData.fbc = input.userData.fbc;
  }
  
  // PII - SEMPRE hashear se não estiver
  if (input.userData.em) {
    userData.em = isAlreadyHashed(input.userData.em) 
      ? input.userData.em 
      : hashForMeta(input.userData.em, 'email');
  }
  if (input.userData.ph) {
    userData.ph = isAlreadyHashed(input.userData.ph)
      ? input.userData.ph
      : hashForMeta(input.userData.ph, 'phone');
  }
  if (input.userData.fn) {
    userData.fn = isAlreadyHashed(input.userData.fn)
      ? input.userData.fn
      : hashForMeta(input.userData.fn, 'name');
  }
  if (input.userData.ln) {
    userData.ln = isAlreadyHashed(input.userData.ln)
      ? input.userData.ln
      : hashForMeta(input.userData.ln, 'name');
  }
  if (input.userData.externalId) {
    userData.external_id = isAlreadyHashed(input.userData.externalId)
      ? input.userData.externalId
      : hashForMeta(input.userData.externalId);
  }
  
  // Custom data
  const customData: Record<string, unknown> = {};
  if (input.customData) {
    if (input.customData.currency) {
      customData.currency = input.customData.currency;
    }
    if (typeof input.customData.value === 'number') {
      customData.value = input.customData.value;
    }
    if (input.customData.contentIds?.length) {
      customData.content_ids = input.customData.contentIds;
    }
    if (input.customData.contentName) {
      customData.content_name = input.customData.contentName;
    }
    if (input.customData.contentType) {
      customData.content_type = input.customData.contentType;
    }
    if (input.customData.orderId) {
      customData.order_id = input.customData.orderId;
    }
    if (typeof input.customData.numItems === 'number') {
      customData.num_items = input.customData.numItems;
    }
  }
  
  const payload: MetaCapiPayload = {
    data: [{
      event_name: input.eventName,
      event_time: eventTime,
      event_id: input.eventId,
      action_source: input.actionSource || 'website',
      user_data: userData,
      ...(Object.keys(customData).length > 0 && { custom_data: customData }),
      ...(input.eventSourceUrl && { event_source_url: input.eventSourceUrl }),
    }],
  };
  
  // Test event code (apenas em dev/staging)
  if (META_TEST_EVENT_CODE) {
    payload.test_event_code = META_TEST_EVENT_CODE;
  }
  
  return payload;
}

// ============================================================
// FETCH COM TIMEOUT E RETRY
// ============================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// ENVIO PRINCIPAL
// ============================================================

/**
 * Envia evento para Meta Conversions API
 * 
 * @param input Dados do evento
 * @param requestId ID da requisição para logging (opcional)
 * @returns Resultado do envio
 * 
 * @example
 * ```ts
 * const result = await sendCapiEvent({
 *   eventName: 'Purchase',
 *   eventId: 'uuid-from-client',
 *   userData: {
 *     clientIpAddress: '1.2.3.4',
 *     clientUserAgent: 'Mozilla/5.0...',
 *     em: 'user@example.com',
 *   },
 *   customData: {
 *     currency: 'BRL',
 *     value: 150.00,
 *     orderId: 'credit-123',
 *   },
 * });
 * ```
 */
export async function sendCapiEvent(
  input: CapiEventInput,
  requestId?: string
): Promise<CapiResponse> {
  // Verificar se CAPI está habilitado
  if (!META_CAPI_ENABLED) {
    console.log(`📊 [CAPI] Disabled - skipping ${input.eventName}`, {
      requestId,
      eventId: input.eventId,
    });
    return {
      ok: true,
      status: 200,
      messages: ['CAPI disabled via META_CAPI_ENABLED=false'],
    };
  }
  
  // Verificar configuração
  if (!META_PIXEL_ID || !META_CONVERSIONS_TOKEN) {
    console.warn(`⚠️ [CAPI] Missing configuration`, {
      requestId,
      hasPixelId: !!META_PIXEL_ID,
      hasToken: !!META_CONVERSIONS_TOKEN, // NUNCA logar o token
    });
    return {
      ok: false,
      status: 500,
      error: 'CAPI not configured',
    };
  }
  
  const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`;
  const payload = buildCapiPayload(input);
  
  // Log estruturado (sem token, sem PII raw)
  console.log(`📤 [CAPI] Sending ${input.eventName}`, {
    requestId,
    eventId: input.eventId,
    eventName: input.eventName,
    hasUserData: !!input.userData,
    hasCustomData: !!input.customData,
    testMode: !!META_TEST_EVENT_CODE,
  });
  
  let lastError: Error | null = null;
  
  // Tentativas com retry
  for (let attempt = 0; attempt <= CAPI_MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${url}?access_token=${META_CONVERSIONS_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        CAPI_TIMEOUT_MS
      );
      
      const body = await response.json();
      const metaTraceId = response.headers.get('x-fb-trace-id') || undefined;
      
      if (!response.ok) {
        console.error(`❌ [CAPI] Error response`, {
          requestId,
          eventId: input.eventId,
          status: response.status,
          metaTraceId,
          error: body.error?.message,
          attempt: attempt + 1,
        });
        
        // Se erro do cliente (4xx), não fazer retry
        if (response.status >= 400 && response.status < 500) {
          return {
            ok: false,
            status: response.status,
            metaTraceId,
            error: body.error?.message || 'Client error',
            messages: body.error?.error_user_msg ? [body.error.error_user_msg] : undefined,
          };
        }
        
        // Erro de servidor (5xx) - tentar retry
        lastError = new Error(body.error?.message || `HTTP ${response.status}`);
        continue;
      }
      
      // Sucesso
      console.log(`✅ [CAPI] Sent ${input.eventName}`, {
        requestId,
        eventId: input.eventId,
        metaTraceId,
        eventsReceived: body.events_received,
        attempt: attempt + 1,
      });
      
      return {
        ok: true,
        status: response.status,
        metaTraceId,
        eventsReceived: body.events_received,
        messages: body.messages,
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Se foi abort (timeout), logar especificamente
      if (lastError.name === 'AbortError') {
        console.warn(`⏱️ [CAPI] Timeout after ${CAPI_TIMEOUT_MS}ms`, {
          requestId,
          eventId: input.eventId,
          attempt: attempt + 1,
        });
      } else {
        console.error(`❌ [CAPI] Network error`, {
          requestId,
          eventId: input.eventId,
          error: lastError.message,
          attempt: attempt + 1,
        });
      }
      
      // Continuar para próxima tentativa se houver
      continue;
    }
  }
  
  // Todas as tentativas falharam
  return {
    ok: false,
    status: 500,
    error: lastError?.message || 'All retry attempts failed',
  };
}

// ============================================================
// HELPERS DE ALTO NÍVEL
// ============================================================

/**
 * Envia evento Purchase (pagamento confirmado)
 */
export async function sendPurchaseEvent(params: {
  eventId: string;
  value: number;            // Em reais (não centavos)
  currency?: string;
  orderId: string;
  contentIds?: string[];
  contentName?: string;
  userData: CapiUserData;
  eventSourceUrl?: string;
  requestId?: string;
}): Promise<CapiResponse> {
  return sendCapiEvent({
    eventName: 'Purchase',
    eventId: params.eventId,
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: {
      currency: params.currency || 'BRL',
      value: params.value,
      orderId: params.orderId,
      contentIds: params.contentIds,
      contentName: params.contentName,
      contentType: 'product',
    },
  }, params.requestId);
}

/**
 * Envia evento Schedule (booking criado)
 */
export async function sendScheduleEvent(params: {
  eventId: string;
  contentName: string;      // Nome da sala
  contentIds: string[];     // IDs da sala/produto
  value?: number;           // Valor em reais (opcional)
  userData: CapiUserData;
  eventSourceUrl?: string;
  requestId?: string;
}): Promise<CapiResponse> {
  return sendCapiEvent({
    eventName: 'Schedule',
    eventId: params.eventId,
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: {
      currency: 'BRL',
      value: params.value,
      contentIds: params.contentIds,
      contentName: params.contentName,
      contentType: 'product',
    },
  }, params.requestId);
}
