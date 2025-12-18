/**
 * Analytics - Integração com Plausible
 * 
 * Plausible é privacy-first:
 * - Não usa cookies
 * - Não coleta dados pessoais
 * - Não precisa de banner de consentimento (LGPD)
 * - Script leve (~1KB)
 * 
 * @see https://plausible.io/docs
 */

// Tipos para eventos customizados
export type AnalyticsEvent = 
  | 'booking_started'      // Usuário abriu modal de reserva
  | 'booking_form_filled'  // Usuário preencheu formulário
  | 'booking_submitted'    // Usuário clicou em reservar
  | 'booking_completed'    // Pagamento confirmado
  | 'booking_cancelled'    // Usuário cancelou reserva
  | 'room_viewed'          // Usuário viu detalhes da sala
  | 'faq_opened'           // Usuário abriu uma pergunta FAQ
  | 'contact_clicked';     // Usuário clicou em contato (telefone/email)

// Props opcionais para eventos
export interface EventProps {
  room?: string;
  value?: number;
  method?: string;
  [key: string]: string | number | boolean | undefined;
}

// Verifica se estamos no browser e se Plausible está carregado
function isPlausibleAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).plausible === 'function';
}

/**
 * Rastreia um evento customizado no Plausible
 * 
 * @example
 * trackEvent('booking_started', { room: 'Sala Premium' });
 * trackEvent('booking_completed', { room: 'Sala B', value: 55 });
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProps): void {
  // Só executa no browser
  if (typeof window === 'undefined') return;
  
  // Verifica se Plausible está disponível
  if (!isPlausibleAvailable()) {
    // Em desenvolvimento, loga no console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, props || '');
    }
    return;
  }
  
  // Envia evento para Plausible
  try {
    (window as any).plausible(event, { props });
  } catch (error) {
    console.error('[Analytics] Erro ao enviar evento:', error);
  }
}

/**
 * Rastreia pageview manualmente (útil para SPAs)
 * Plausible já faz isso automaticamente, mas pode ser útil em alguns casos
 */
export function trackPageview(url?: string): void {
  if (typeof window === 'undefined') return;
  
  if (!isPlausibleAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] pageview:`, url || window.location.pathname);
    }
    return;
  }
  
  try {
    (window as any).plausible('pageview', { u: url });
  } catch (error) {
    console.error('[Analytics] Erro ao enviar pageview:', error);
  }
}

/**
 * Helpers para eventos específicos do funil
 */
export const analytics = {
  // Quando usuário abre o modal de reserva
  bookingStarted: (roomName: string) => {
    trackEvent('booking_started', { room: roomName });
  },
  
  // Quando usuário preenche o formulário
  bookingFormFilled: (roomName: string) => {
    trackEvent('booking_form_filled', { room: roomName });
  },
  
  // Quando usuário clica em "Reservar" (antes do pagamento)
  bookingSubmitted: (roomName: string, value: number) => {
    trackEvent('booking_submitted', { room: roomName, value });
  },
  
  // Quando pagamento é confirmado (chamado na página de sucesso)
  bookingCompleted: (roomName: string, value: number) => {
    trackEvent('booking_completed', { room: roomName, value });
  },
  
  // Quando usuário cancela reserva
  bookingCancelled: (roomName: string) => {
    trackEvent('booking_cancelled', { room: roomName });
  },
  
  // Quando usuário visualiza detalhes de uma sala
  roomViewed: (roomName: string) => {
    trackEvent('room_viewed', { room: roomName });
  },
  
  // Quando usuário abre uma pergunta do FAQ
  faqOpened: (question: string) => {
    trackEvent('faq_opened', { question: question.substring(0, 50) });
  },
  
  // Quando usuário clica em contato
  contactClicked: (method: 'phone' | 'email' | 'whatsapp') => {
    trackEvent('contact_clicked', { method });
  },
};
