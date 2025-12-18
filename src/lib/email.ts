// ===========================================================
// lib/email.ts - Serviço de envio de emails
// ===========================================================
// Usa Resend para envio transacional
// FASE 1.3: Email de confirmação de reserva

import { Resend } from 'resend';
import { generateBookingWhatsAppLink, WHATSAPP_NUMBER } from './whatsapp';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Espaço Arthemi <noreply@arthemi.com.br>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'contato@arthemi.com.br';

// Cliente Resend (lazy init)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn('⚠️ [EMAIL] RESEND_API_KEY não configurada - emails desabilitados');
    return null;
  }
  
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  
  return resendClient;
}

// ============================================================
// TIPOS
// ============================================================

export interface BookingEmailData {
  userName: string;
  userEmail: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  amountPaid: number;
  bookingId: string;
  paymentMethod?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// TEMPLATE HTML - EMAIL DE CONFIRMAÇÃO
// ============================================================

function getConfirmationEmailHtml(data: BookingEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amountPaid / 100);

  // Gera link de confirmação via WhatsApp
  const whatsappData = {
    bookingId: data.bookingId,
    userName: data.userName,
    roomName: data.roomName,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    amountPaid: data.amountPaid,
  };
  const whatsappLink = generateBookingWhatsAppLink(whatsappData).fullLink;
  const whatsappNumber = WHATSAPP_NUMBER;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Reserva</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8B7355 0%, #A08060 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 600;">
        ✅ Reserva Confirmada!
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi - Coworking de Saúde
      </p>
    </div>
    
    <!-- Conteúdo Principal -->
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <!-- Saudação -->
      <p style="font-size: 18px; margin: 0 0 24px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>! 👋
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Sua reserva foi confirmada com sucesso. Confira os detalhes abaixo:
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #8B7355;">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Sala</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Data</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">📅 ${data.date}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Horário</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">🕐 ${data.startTime} às ${data.endTime} (${data.duration})</p>
        </div>
        
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Valor Pago</span>
          <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #22c55e;">${formattedAmount}</p>
        </div>
        
      </div>
      
      <!-- Código da Reserva -->
      <div style="background: #f0f0f0; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 24px 0;">
        <span style="color: #888; font-size: 12px; text-transform: uppercase;">Código da Reserva</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace; color: #333;">
          ${data.bookingId.toUpperCase()}
        </p>
      </div>
      
      <!-- Informações Importantes -->
      <div style="background: #fff8e6; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #f5d67a;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          <strong>📍 Endereço:</strong> Rua Exemplo, 123 - Belo Horizonte/MG<br>
          <strong>⏰ Chegada:</strong> Recomendamos chegar 10 minutos antes
        </p>
      </div>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${whatsappLink}" 
           style="display: inline-block; background: #25D366; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 12px;">
          ✅ Confirmar via WhatsApp
        </a>
        <br>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br'}/booking/${data.bookingId}" 
           style="display: inline-block; background: #8B7355; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 12px;">
          Ver Minha Reserva
        </a>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid #eee; padding-top: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888;">
          Dúvidas? Entre em contato:
        </p>
        <p style="margin: 0; font-size: 14px;">
          📱 <a href="https://wa.me/${whatsappNumber}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
          &nbsp;•&nbsp;
          📧 <a href="mailto:contato@arthemi.com.br" style="color: #8B7355; text-decoration: none;">contato@arthemi.com.br</a>
        </p>
      </div>
      
    </div>
    
    <!-- Rodapé -->
    <div style="text-align: center; padding: 24px; color: #999; font-size: 12px;">
      <p style="margin: 0;">
        © ${new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
      </p>
      <p style="margin: 8px 0 0 0;">
        Você recebeu este email porque fez uma reserva em nosso espaço.
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

// ============================================================
// FUNÇÕES DE ENVIO
// ============================================================

/**
 * Envia email de confirmação de reserva
 */
export async function sendBookingConfirmationEmail(
  data: BookingEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] Simulando envio (Resend não configurado)');
    console.log('📧 [EMAIL] Para:', data.userEmail);
    console.log('📧 [EMAIL] Reserva:', data.bookingId);
    return { success: true, messageId: 'mock-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: `✅ Reserva Confirmada - ${data.roomName} em ${data.date}`,
      html: getConfirmationEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Enviado para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Verifica se o serviço de email está configurado
 */
export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
