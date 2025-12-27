// ===========================================================
// lib/analytics.ts - Meta Pixel + Analytics
// ===========================================================
// Implementação isolada e segura do Meta Pixel
// Falhas no pixel NÃO afetam o funcionamento do site
//
// EVENTOS IMPLEMENTADOS:
// - PageView: Automático em todas as páginas
// - ViewContent: Quando usuário vê detalhes de uma sala
// - Lead: Quando usuário inicia processo de reserva
// - Purchase: Quando pagamento é confirmado (via webhook)

// ============================================================
// CONFIGURAÇÃO
// ============================================================

// Meta Pixel ID - configurar via variável de ambiente
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

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

// Declaração global do fbq
declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: MetaPixelEventParams
    ) => void;
    _fbq?: unknown;
  }
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
function debugLog(event: string, params?: MetaPixelEventParams): void {
  if (DEBUG_MODE) {
    console.log(`[META PIXEL] ${event}`, params || '');
  }
}

// ============================================================
// EVENTOS DO META PIXEL
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

  try {
    window.fbq!('track', 'PageView');
    debugLog('PageView');
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

  try {
    window.fbq!('track', 'ViewContent', {
      content_ids: [params.contentId],
      content_name: params.contentName,
      content_category: params.contentCategory || 'Sala',
      content_type: 'product',
      value: params.value ? params.value / 100 : undefined,
      currency: 'BRL',
    });
    debugLog('ViewContent', { contentId: params.contentId, contentName: params.contentName });
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

  try {
    window.fbq!('track', 'Lead', {
      content_name: params?.contentName,
      content_category: params?.contentCategory || 'Reserva',
      value: params?.value ? params.value / 100 : undefined,
      currency: 'BRL',
    });
    debugLog('Lead', params as unknown as MetaPixelEventParams);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar Lead:', error);
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

  try {
    window.fbq!('track', 'InitiateCheckout', {
      content_ids: params.contentIds,
      content_name: params.contentName,
      content_type: 'product',
      value: params.value / 100,
      currency: 'BRL',
      num_items: params.numItems || 1,
    });
    debugLog('InitiateCheckout', params as unknown as MetaPixelEventParams);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar InitiateCheckout:', error);
  }
}

/**
 * Dispara evento Purchase
 * Usar na página de sucesso após confirmação de pagamento
 */
export function trackPurchase(params: {
  contentIds: string[];
  contentName: string;
  value: number;
  numItems?: number;
}): void {
  if (!isPixelAvailable()) {
    debugLog('Purchase (skipped)', params as unknown as MetaPixelEventParams);
    return;
  }

  try {
    window.fbq!('track', 'Purchase', {
      content_ids: params.contentIds,
      content_name: params.contentName,
      content_type: 'product',
      value: params.value / 100,
      currency: 'BRL',
      num_items: params.numItems || 1,
    });
    debugLog('Purchase', params as unknown as MetaPixelEventParams);
  } catch (error) {
    console.warn('[META PIXEL] Erro ao disparar Purchase:', error);
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

  try {
    window.fbq!('trackCustom', eventName, params);
    debugLog(`Custom: ${eventName}`, params);
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
