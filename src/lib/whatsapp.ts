// ===========================================================
// lib/whatsapp.ts - Utilitários para WhatsApp
// ===========================================================
// Gera links para envio de mensagens via WhatsApp Web/App
// Sem API paga - usa links wa.me

// Importa número centralizado do config (single source of truth)
import { WHATSAPP_NUMBER } from '@/config/contact';

// Re-exporta para compatibilidade com imports existentes
export { WHATSAPP_NUMBER };

// ============================================================
// TIPOS
// ============================================================

export interface WhatsAppBookingData {
  bookingId: string;
  userName: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  amountPaid?: number;
}

export interface WhatsAppLinkResult {
  /** Link para abrir conversa com o Espaço Arthemi */
  businessLink: string;
  /** Mensagem pré-formatada para o cliente enviar */
  message: string;
  /** Link direto wa.me com mensagem (para cliente enviar para o negócio) */
  fullLink: string;
}

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================

/**
 * Remove caracteres especiais do número de telefone
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formata valor em centavos para moeda BRL
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Gera link wa.me com mensagem pré-formatada
 * @param phone Número do telefone (com código do país)
 * @param message Mensagem a ser enviada
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Gera link wa.me sem mensagem (só abre a conversa)
 */
export function getWhatsAppContactLink(phone?: string): string {
  const cleanPhone = cleanPhoneNumber(phone || WHATSAPP_NUMBER);
  return `https://wa.me/${cleanPhone}`;
}

// ============================================================
// MENSAGENS DE CONFIRMAÇÃO
// ============================================================

/**
 * Gera mensagem de confirmação de reserva para o cliente enviar
 * (Cliente → Espaço Arthemi)
 */
export function generateBookingConfirmationMessage(data: WhatsAppBookingData): string {
  const amountText = data.amountPaid 
    ? `\n💰 Valor: ${formatCurrency(data.amountPaid)}`
    : '';

  return `Olá! 👋

Acabei de fazer uma reserva no Espaço Arthemi.

📋 *Detalhes da Reserva:*
• Código: ${data.bookingId.slice(0, 8).toUpperCase()}
• Consultório: ${data.roomName}
• Data: ${data.date}
• Horário: ${data.startTime} às ${data.endTime}${amountText}

Confirmo minha presença! ✅

_Mensagem automática gerada pelo sistema._`;
}

/**
 * Gera link completo para confirmação de reserva via WhatsApp
 */
export function generateBookingWhatsAppLink(data: WhatsAppBookingData): WhatsAppLinkResult {
  const message = generateBookingConfirmationMessage(data);
  const fullLink = generateWhatsAppLink(WHATSAPP_NUMBER, message);
  const businessLink = getWhatsAppContactLink();

  return {
    businessLink,
    message,
    fullLink,
  };
}

// ============================================================
// MENSAGENS PARA DIFERENTES CONTEXTOS
// ============================================================

/**
 * Gera mensagem para tirar dúvidas gerais
 */
export function generateInquiryMessage(subject?: string): string {
  const intro = subject 
    ? `Olá! Gostaria de saber mais sobre *${subject}*.`
    : 'Olá! Tenho uma dúvida sobre o Espaço Arthemi.';
  
  return `${intro}

Podem me ajudar?`;
}

/**
 * Gera link para dúvidas gerais
 */
export function generateInquiryWhatsAppLink(subject?: string): string {
  const message = generateInquiryMessage(subject);
  return generateWhatsAppLink(WHATSAPP_NUMBER, message);
}

/**
 * Gera mensagem para suporte de reserva existente
 */
export function generateSupportMessage(bookingId: string): string {
  return `Olá! 👋

Preciso de ajuda com minha reserva.

📋 Código: ${bookingId.slice(0, 8).toUpperCase()}

Podem me ajudar?`;
}

/**
 * Gera link para suporte de reserva
 */
export function generateSupportWhatsAppLink(bookingId: string): string {
  const message = generateSupportMessage(bookingId);
  return generateWhatsAppLink(WHATSAPP_NUMBER, message);
}
