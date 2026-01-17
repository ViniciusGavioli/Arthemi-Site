// ===========================================================
// lib/meta-pixel.ts - Meta Pixel + Analytics
// ===========================================================
// Implementação isolada e segura do Meta Pixel
// Falhas no pixel NÃO afetam o funcionamento do site
//
// EVENTOS IMPLEMENTADOS:
// - PageView: Automático em todas as páginas (SPA-safe)
// - ViewContent: Quando usuário vê detalhes de uma sala
// - Lead: Quando usuário inicia processo de reserva
// - Contact: Quando usuário clica em WhatsApp/telefone
// - CompleteRegistration: Quando usuário cria conta com sucesso
// - InitiateCheckout: Quando usuário inicia checkout
// - Purchase: Quando pagamento é confirmado
//
// DEDUPLICAÇÃO (CAPI-ready):
// - Todos os eventos incluem event_id único
// - event_id pode ser usado para correlacionar com CAPI no futuro

// ============================================================
// CONFIGURAÇÃO
// ============================================================

// Meta Pixel ID - configurar via variável de ambiente
// Validação: deve ser apenas números (ID do Meta Pixel é numérico)
const rawPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_PIXEL_ID = rawPixelId && /^\d+$/.test(rawPixelId.trim()) 
  ? rawPixelId.trim() 
  : undefined;

// Modo de debug (log no console)
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================
// TIPOS
// ============================================================

interface MetaPixelEventParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  [key: string]: unknown;
}

interface MetaPixelEventOptions {
  eventID?: string;
}

// Declaração global do fbq (com suporte a eventID)
declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: MetaPixelEventParams,
      options?: MetaPixelEventOptions
    ) => void;
    _fbq?: unknown;
  }
}

// ============================================================
// GERAÇÃO DE EVENT_ID (DEDUPLICAÇÃO)
// ============================================================

/**
 * Gera um UUID único para event_id
 * Usa crypto.randomUUID quando disponível, com fallback seguro
 */
export function generateEventId(): string {
  // Preferir crypto.randomUUID (mais seguro e padrão)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback: gerar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// VERIFICAÇÃO DE DISPONIBILIDADE
// ============================================================

/**
 * Verifica se o Meta Pixel está disponível e configurado
 */
function isPixelAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!META_PIXEL_ID) return false;
  if (!window.fbq) return false;
  return true;
}

/**
 * Log de debug (apenas em desenvolvimento)
 */
function debugLog(event: string, params?: MetaPixelEventParams, eventId?: string): void {
  if (DEBUG_MODE) {
    console.log(`[META PIXEL] ${event}`, { params: params || {}, eventId: eventId || 'N/A' });
  }
}

// ============================================================
// EVENTOS DO META PIXEL (COM event_id)
// ============================================================

/**
 * Dispara evento PageView
 * Chamado automaticamente via useEffect no _app.tsx
 */
export function trackPageView(): void {
  if (!isPixelAvailable()) {
    debugLog('PageView (skipped - pixel not available)');
    return;
  }

  const eventId = generateEventId();
  
  try {
    window.fbq!('track', 'PageView', {}, { eventID: eventId });
    debugLog('PageView', {}, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar PageView:', error);
  }
}

/**
 * Dispara evento ViewContent
 * Usar quando usuário visualiza detalhes de uma sala
 */
export function trackViewContent(params: {
  contentId: string;
  contentName: string;
  contentCategory?: string;
  value?: number;
}): void {
  if (!isPixelAvailable()) {
    debugLog('ViewContent (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_category: params.contentCategory || 'Consultório',
    content_type: 'product',
    value: params.value ? params.value / 100 : undefined,
    currency: 'BRL',
  };

  try {
    window.fbq!('track', 'ViewContent', eventParams, { eventID: eventId });
    debugLog('ViewContent', eventParams, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar ViewContent:', error);
  }
}

/**
 * Dispara evento Lead
 * Usar quando usuário inicia processo de reserva (abre modal)
 */
export function trackLead(params?: {
  contentName?: string;
  contentCategory?: string;
  value?: number;
}): void {
  if (!isPixelAvailable()) {
    debugLog('Lead (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_name: params?.contentName,
    content_category: params?.contentCategory || 'Reserva',
    value: params?.value ? params.value / 100 : undefined,
    currency: 'BRL',
  };

  try {
    window.fbq!('track', 'Lead', eventParams, { eventID: eventId });
    debugLog('Lead', eventParams, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar Lead:', error);
  }
}

/**
 * Dispara evento Contact
 * Usar quando usuário clica em WhatsApp, telefone ou email
 */
export function trackContact(params: {
  channel: 'whatsapp' | 'phone' | 'email';
  location?: string;
}): void {
  if (!isPixelAvailable()) {
    debugLog('Contact (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_category: 'Contact',
    content_name: params.channel,
  };

  try {
    // Contact é um evento padrão do Meta
    window.fbq!('track', 'Contact', eventParams, { eventID: eventId });
    debugLog('Contact', eventParams, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar Contact:', error);
  }
}

/**
 * Dispara evento CompleteRegistration
 * Usar quando usuário cria conta com sucesso
 */
export function trackCompleteRegistration(params?: {
  value?: number;
  currency?: string;
}): void {
  if (!isPixelAvailable()) {
    debugLog('CompleteRegistration (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_name: 'Registro',
    status: 'completed',
    value: params?.value,
    currency: params?.currency || 'BRL',
  };

  try {
    window.fbq!('track', 'CompleteRegistration', eventParams, { eventID: eventId });
    debugLog('CompleteRegistration', eventParams, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar CompleteRegistration:', error);
  }
}

/**
 * Dispara evento InitiateCheckout
 * Usar quando usuário envia formulário de reserva
 */
export function trackInitiateCheckout(params: {
  contentIds: string[];
  contentName: string;
  value: number;
  numItems?: number;
}): void {
  if (!isPixelAvailable()) {
    debugLog('InitiateCheckout (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_ids: params.contentIds,
    content_name: params.contentName,
    content_type: 'product',
    value: params.value / 100,
    currency: 'BRL',
    num_items: params.numItems || 1,
  };

  try {
    window.fbq!('track', 'InitiateCheckout', eventParams, { eventID: eventId });
    debugLog('InitiateCheckout', eventParams, eventId);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar InitiateCheckout:', error);
  }
}

/**
 * @deprecated NÃO USE - Purchase é enviado APENAS via CAPI (Server-Side)
 * para garantir deduplicação correta e atribuição de conversão precisa.
 * O evento Purchase é disparado pelo webhook de pagamento Asaas.
 * 
 * Mantido apenas para compatibilidade - NÃO chamar diretamente.
 */
export function trackPurchase(params: {
  contentIds: string[];
  contentName: string;
  value: number;
  numItems?: number;
}): string | null {
  if (!isPixelAvailable()) {
    debugLog('Purchase (skipped)', params as unknown as MetaPixelEventParams);
    return null;
  }

  const eventId = generateEventId();
  const eventParams: MetaPixelEventParams = {
    content_ids: params.contentIds,
    content_name: params.contentName,
    content_type: 'product',
    value: params.value / 100,
    currency: 'BRL',
    num_items: params.numItems || 1,
  };

  try {
    window.fbq!('track', 'Purchase', eventParams, { eventID: eventId });
    debugLog('Purchase', eventParams, eventId);
    return eventId;
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar Purchase:', error);
    return null;
  }
}

/**
 * Dispara evento customizado
 * Para eventos específicos do negócio
 */
export function trackCustomEvent(
  eventName: string,
  params?: MetaPixelEventParams
): void {
  if (!isPixelAvailable()) {
    debugLog(`Custom: ${eventName} (skipped)`, params);
    return;
  }

  const eventId = generateEventId();

  try {
    window.fbq!('trackCustom', eventName, params, { eventID: eventId });
    debugLog(`Custom: ${eventName}`, params, eventId);
  } catch (error) {
    console.warn(`[META PIXEL] Erro ao disparar ${eventName}:`, error);
  }
}

// ============================================================
// SCRIPT DE INICIALIZAÇÃO (para uso no _app.tsx)
// ============================================================

/**
 * Retorna o script de inicialização do Meta Pixel
 * Usar com next/script strategy="afterInteractive"
 */
export function getMetaPixelScript(): string {
  if (!META_PIXEL_ID) return '';

  return `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${META_PIXEL_ID}');
    fbq('track', 'PageView');
  `;
}

/**
 * Retorna o ID do Meta Pixel (para uso no noscript)
 */
export function getMetaPixelId(): string | undefined {
  return META_PIXEL_ID;
}

// ============================================================
// CAPTURA DE CONTEXTO PARA CAPI (Client → Server)
// ============================================================

/**
 * Obtém o cookie _fbp (Facebook Browser ID)
 */
export function getFbp(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/_fbp=([^;]+)/);
  return match ? match[1] : undefined;
}

/**
 * Obtém o cookie _fbc (Facebook Click ID)
 */
export function getFbc(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/_fbc=([^;]+)/);
  return match ? match[1] : undefined;
}

/**
 * Envia contexto do evento para o servidor (para correlação CAPI)
 * Chamado automaticamente por trackInitiateCheckout quando entityId é fornecido
 * 
 * @param eventName Nome do evento (Purchase, Schedule, etc)
 * @param entityType Tipo da entidade (Booking, Credit)
 * @param entityId ID da entidade
 * @param eventId ID do evento (se já gerado)
 * @returns Promise com o eventId salvo
 */
export async function sendMetaContext(params: {
  eventName: 'Purchase' | 'Schedule' | 'Lead' | 'InitiateCheckout';
  entityType: 'Booking' | 'Credit';
  entityId: string;
  eventId?: string;
}): Promise<{ success: boolean; eventId?: string }> {
  try {
    const response = await fetch('/api/meta/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: params.eventId,
        eventName: params.eventName,
        entityType: params.entityType,
        entityId: params.entityId,
        fbp: getFbp(),
        fbc: getFbc(),
        sourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    });

    const data = await response.json();
    
    if (DEBUG_MODE) {
      console.log('[META PIXEL] Context sent:', {
        eventName: params.eventName,
        entityId: params.entityId,
        eventId: data.eventId,
        success: data.success,
      });
    }

    return {
      success: data.success,
      eventId: data.eventId,
    };
  } catch (error) {
    console.warn('[META PIXEL] Failed to send context:', error);
    return { success: false };
  }
}

/**
 * Versão melhorada de InitiateCheckout que também envia contexto para CAPI
 * Usar quando temos o entityId do booking/credit
 */
export function trackInitiateCheckoutWithContext(params: {
  contentIds: string[];
  contentName: string;
  value: number;
  numItems?: number;
  entityType: 'Booking' | 'Credit';
  entityId: string;
}): void {
  // Dispara o evento Pixel normal
  trackInitiateCheckout({
    contentIds: params.contentIds,
    contentName: params.contentName,
    value: params.value,
    numItems: params.numItems,
  });

  // Envia contexto para o servidor (non-blocking)
  sendMetaContext({
    eventName: 'InitiateCheckout',
    entityType: params.entityType,
    entityId: params.entityId,
  }).catch(() => {
    // Silenciosa - não afeta UX
  });
}
