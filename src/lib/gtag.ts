// ===========================================================
// lib/gtag.ts - Google Analytics 4 + Google Ads Conversions
// ===========================================================
// Implementação isolada e segura do gtag.js
// Para rastreamento de tráfego pago (Google Ads) e analytics (GA4)
//
// EVENTOS IMPLEMENTADOS:
// - page_view: Automático via Next.js router
// - view_item: Quando usuário vê detalhes de uma sala
// - begin_checkout: Quando usuário inicia checkout
// - purchase: Quando pagamento é confirmado
// - generate_lead: Quando usuário demonstra interesse
// - sign_up: Quando usuário cria conta
//
// GOOGLE ADS CONVERSIONS:
// - Todos os eventos de purchase incluem transaction_id para atribuição
// - Compatível com Enhanced Conversions

// ============================================================
// CONFIGURAÇÃO
// ============================================================

// Google Analytics 4 - Measurement ID
export const GA4_MEASUREMENT_ID = 'G-379R20W0J1';

// Google Ads Conversion ID (se houver - configurar depois)
// Formato: AW-XXXXXXXXX
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// Modo de debug (log no console)
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================
// TIPOS
// ============================================================

interface GtagEventParams {
  // E-commerce padrão
  currency?: string;
  value?: number;
  transaction_id?: string;
  items?: Array<{
    item_id?: string;
    item_name?: string;
    item_category?: string;
    price?: number;
    quantity?: number;
  }>;

  // Customizados
  event_category?: string;
  event_label?: string;
  method?: string;
  content_type?: string;
  content_id?: string;

  // Qualquer outro parâmetro
  [key: string]: unknown;
}

// Declaração global do gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ============================================================
// VERIFICAÇÃO DE DISPONIBILIDADE
// ============================================================

/**
 * Verifica se o gtag está disponível
 */
function isGtagAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.gtag) return false;
  return true;
}

/**
 * Log para debug em desenvolvimento
 */
function debugLog(eventName: string, params?: GtagEventParams): void {
  if (DEBUG_MODE) {
    console.log(`[gtag] ${eventName}`, params || '');
  }
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Rastreia um evento no GA4
 */
export function gtagEvent(eventName: string, params?: GtagEventParams): void {
  debugLog(eventName, params);

  if (!isGtagAvailable()) {
    return;
  }

  try {
    window.gtag!('event', eventName, params);
  } catch (error) {
    console.error('[gtag] Erro ao enviar evento:', error);
  }
}

/**
 * Rastreia page view (chamado automaticamente pelo Next.js)
 */
export function pageview(url: string): void {
  if (!isGtagAvailable()) {
    debugLog('page_view', { page_path: url });
    return;
  }

  try {
    window.gtag!('config', GA4_MEASUREMENT_ID, {
      page_path: url,
    });
  } catch (error) {
    console.error('[gtag] Erro ao enviar pageview:', error);
  }
}

// ============================================================
// EVENTOS E-COMMERCE (GA4 + GOOGLE ADS)
// ============================================================

/**
 * view_item - Usuário visualizou um item (sala)
 */
export function trackViewItem(params: {
  itemId: string;
  itemName: string;
  itemCategory?: string;
  price?: number;
}): void {
  gtagEvent('view_item', {
    currency: 'BRL',
    value: params.price || 0,
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      item_category: params.itemCategory || 'Consultório',
      price: params.price || 0,
      quantity: 1,
    }],
  });
}

/**
 * add_to_cart - Usuário selecionou sala/horário
 */
export function trackAddToCart(params: {
  itemId: string;
  itemName: string;
  price: number;
  hours?: number;
}): void {
  gtagEvent('add_to_cart', {
    currency: 'BRL',
    value: params.price,
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      item_category: 'Consultório',
      price: params.price,
      quantity: params.hours || 1,
    }],
  });
}

/**
 * begin_checkout - Usuário iniciou checkout
 */
export function trackBeginCheckout(params: {
  itemId: string;
  itemName: string;
  value: number;
  coupon?: string;
}): void {
  gtagEvent('begin_checkout', {
    currency: 'BRL',
    value: params.value,
    coupon: params.coupon,
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      item_category: 'Consultório',
      price: params.value,
      quantity: 1,
    }],
  });
}

/**
 * purchase - Pagamento confirmado (CONVERSÃO PRINCIPAL)
 * Este é o evento mais importante para Google Ads!
 */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  itemId: string;
  itemName: string;
  coupon?: string;
  paymentMethod?: 'pix' | 'credit_card' | 'credit';
}): void {
  // Evento GA4 purchase
  gtagEvent('purchase', {
    transaction_id: params.transactionId,
    currency: 'BRL',
    value: params.value,
    coupon: params.coupon,
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      item_category: 'Consultório',
      price: params.value,
      quantity: 1,
    }],
  });

  // Se tiver Google Ads configurado, enviar conversão
  if (GOOGLE_ADS_ID && isGtagAvailable()) {
    try {
      // Conversão de compra no Google Ads
      // O label precisa ser configurado no Google Ads
      window.gtag!('event', 'conversion', {
        send_to: `${GOOGLE_ADS_ID}/purchase`,
        transaction_id: params.transactionId,
        value: params.value,
        currency: 'BRL',
      });
    } catch (error) {
      console.error('[gtag] Erro ao enviar conversão Google Ads:', error);
    }
  }
}

/**
 * generate_lead - Usuário demonstrou interesse (abriu modal de reserva)
 */
export function trackGenerateLead(params: {
  itemName?: string;
  value?: number;
}): void {
  gtagEvent('generate_lead', {
    currency: 'BRL',
    value: params.value || 0,
    event_label: params.itemName,
  });
}

/**
 * sign_up - Usuário criou conta
 */
export function trackSignUp(method: string = 'email'): void {
  gtagEvent('sign_up', {
    method,
  });
}

// Google Ads Conversion Label for 'Contato' (WhatsApp)
const GOOGLE_ADS_CONTACT_LABEL = 'w5GcCK2pyfobEMjusvRC';

/**
 * Clique em contato (WhatsApp, telefone, email)
 */
export function trackContact(params: {
  method: 'whatsapp' | 'phone' | 'email';
  location?: string;
}): void {
  gtagEvent('contact', {
    method: params.method,
    event_label: params.location,
  });

  // Também como evento personalizado para facilitar
  gtagEvent('click_contact', {
    contact_method: params.method,
    page_location: params.location,
  });

  // Se for WhatsApp e tiver ID do Google Ads, envia conversão
  if (params.method === 'whatsapp' && GOOGLE_ADS_ID && isGtagAvailable()) {
    try {
      window.gtag!('event', 'conversion', {
        send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONTACT_LABEL}`,
        value: 1.0,
        currency: 'BRL',
      });
      debugLog('conversion (Google Ads)', { label: GOOGLE_ADS_CONTACT_LABEL });
    } catch (error) {
      console.error('[gtag] Erro ao enviar conversão Google Ads:', error);
    }
  }
}

// ============================================================
// UTILITÁRIOS PARA UTM
// ============================================================

/**
 * Extrai parâmetros UTM da URL atual
 */
export function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utmParams: Record<string, string> = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];

  utmKeys.forEach(key => {
    const value = params.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
}

/**
 * Salva UTMs no sessionStorage para atribuição
 */
export function saveUtmParams(): void {
  if (typeof window === 'undefined') return;

  const utmParams = getUtmParams();

  if (Object.keys(utmParams).length > 0) {
    try {
      sessionStorage.setItem('utm_params', JSON.stringify(utmParams));
    } catch {
      // sessionStorage pode não estar disponível
    }
  }
}

/**
 * Recupera UTMs salvos
 */
export function getSavedUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const saved = sessionStorage.getItem('utm_params');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// ============================================================
// EXPORTAÇÃO AGRUPADA
// ============================================================

export const gtag = {
  event: gtagEvent,
  pageview,
  viewItem: trackViewItem,
  addToCart: trackAddToCart,
  beginCheckout: trackBeginCheckout,
  purchase: trackPurchase,
  generateLead: trackGenerateLead,
  signUp: trackSignUp,
  contact: trackContact,
  getUtmParams,
  saveUtmParams,
  getSavedUtmParams,
};

export default gtag;
