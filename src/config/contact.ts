/**
 * Configuração centralizada de contato - Single Source of Truth
 * NÃO depende de variáveis de ambiente
 */

/** Número do WhatsApp no formato internacional (sem +) */
export const WHATSAPP_NUMBER = '5531999923910';

/** Nome para exibição */
export const WHATSAPP_DISPLAY = '(31) 9992-3910';

/**
 * Constrói URL do WhatsApp com mensagem pré-preenchida
 * @param message - Mensagem a ser enviada (será URL-encoded)
 * @returns URL completa do wa.me
 */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Constrói URL do WhatsApp sem mensagem
 * @returns URL do wa.me apenas com número
 */
export function getWhatsAppUrl(): string {
  return `https://wa.me/${WHATSAPP_NUMBER}`;
}
