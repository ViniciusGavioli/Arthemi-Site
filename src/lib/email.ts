// ===========================================================
// lib/email.ts - Serviço de envio de emails
// ===========================================================
// Usa Resend para envio transacional
// FASE 1.3: Email de confirmação de reserva

import { Resend } from 'resend';
import { generateBookingWhatsAppLink, WHATSAPP_NUMBER } from './whatsapp';
import { isContingencyActive } from './contingency';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Espaço Arthemi <noreply@arthemi.com.br>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'contato@arthemi.com.br';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Cliente Resend (lazy init)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    // Em produção, API key ausente é erro crítico
    if (IS_PRODUCTION) {
      console.error('❌ [EMAIL] ERRO CRÍTICO: RESEND_API_KEY não configurada em PRODUÇÃO');
      return null;
    }
    console.warn('⚠️ [EMAIL] RESEND_API_KEY não configurada - modo desenvolvimento');
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
  magicLinkToken?: string; // Token para acesso direto à conta
  creditBalance?: number;  // Saldo de créditos após a compra (em centavos)
  pixPaymentUrl?: string;  // URL do pagamento PIX (para email pendente)
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// TEMPLATE HTML - EMAIL DE CONFIRMAÇÃO DE RESERVA
// ============================================================

function getConfirmationEmailHtml(data: BookingEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amountPaid / 100);

  const whatsappNumber = WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Confirmada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 600;">
        ✅ Reserva Confirmada
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi
      </p>
    </div>
    
    <!-- Conteúdo Principal -->
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <!-- Saudação -->
      <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>!
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Sua reserva foi confirmada com sucesso.<br>
        Confira os detalhes abaixo:
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #22c55e;">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📍 Sala</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📅 Data</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.date}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">⏰ Horário</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.startTime} às ${data.endTime}</p>
        </div>
        
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">💳 Forma de pagamento</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.paymentMethod || 'PIX'}</p>
        </div>
        
      </div>
      
      <!-- Aviso de chegada -->
      <p style="font-size: 15px; margin: 0 0 16px 0; color: #555;">
        Pedimos, por gentileza, que chegue com alguns minutos de antecedência.
      </p>
      
      <!-- Importante -->
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #f59e0b;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
          <strong>📌 Importante:</strong><br>
          • Cancelamentos são permitidos apenas com no mínimo 48h de antecedência.<br>
          • Após esse prazo, a reserva não poderá ser cancelada ou reembolsada.
        </p>
      </div>
      
      <p style="font-size: 15px; margin: 0 0 24px 0; color: #555;">
        Você pode acompanhar ou gerenciar sua reserva acessando sua conta:
      </p>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${appUrl}/minha-conta/reservas" 
           style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          👉 Ver Minhas Reservas
        </a>
      </div>
      
      <p style="font-size: 15px; margin: 24px 0 0 0; color: #555;">
        Qualquer dúvida, estamos à disposição.
      </p>
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${appUrl}" style="color: #8B7355; text-decoration: none;">${appUrl.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
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
 * - Verifica flag DISABLE_EMAILS antes de enviar
 * - Em produção, falha explicitamente se RESEND_API_KEY ausente
 */
export async function sendBookingConfirmationEmail(
  data: BookingEmailData
): Promise<EmailResult> {
  // 1. Verificar flag de contingência DISABLE_EMAILS
  try {
    const emailsDisabled = await isContingencyActive('DISABLE_EMAILS');
    if (emailsDisabled) {
      console.log('📧 [EMAIL] Email desativado por contingência (DISABLE_EMAILS=true)');
      return { success: false, error: 'Emails desativados por contingência' };
    }
  } catch (contingencyError) {
    console.warn('⚠️ [EMAIL] Erro ao verificar contingência, continuando envio:', contingencyError);
  }

  // 2. Verificar cliente Resend
  const client = getResendClient();
  
  if (!client) {
    // Em produção sem API key = falha explícita (não mock)
    if (IS_PRODUCTION) {
      console.error('❌ [EMAIL] FALHA: Impossível enviar email em PRODUÇÃO sem RESEND_API_KEY');
      return { success: false, error: 'RESEND_API_KEY não configurada em produção' };
    }
    // Desenvolvimento = mock com log claro
    console.log('📧 [EMAIL] MOCK (dev): Simulando envio para', data.userEmail);
    console.log('📧 [EMAIL] MOCK (dev): Reserva:', data.bookingId);
    return { success: true, messageId: 'mock-dev-' + Date.now() };
  }

  // 3. Enviar email
  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: 'Reserva confirmada no Espaço Arthemi ✅',
      html: getConfirmationEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Enviado com sucesso para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar:', error);
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

// ============================================================
// MAGIC LINK EMAIL
// ============================================================

export interface MagicLinkEmailData {
  userEmail: string;
  userName: string;
  token: string;
}

/**
 * Gera URL do magic link
 * Redireciona sempre para /minha-conta (área central do cliente)
 */
function getMagicLinkUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';
  return `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}&redirect=/minha-conta`;
}

/**
 * Template HTML do email de magic link
 */
function getMagicLinkEmailHtml(data: MagicLinkEmailData): string {
  const magicLinkUrl = getMagicLinkUrl(data.token);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesse sua conta</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8B7355 0%, #A08060 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 600;">
        🔐 Acesse sua Conta
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
        Você solicitou acesso à sua conta no Espaço Arthemi. Clique no botão abaixo para entrar:
      </p>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${magicLinkUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #8B7355 0%, #A08060 100%); color: #fff; padding: 16px 48px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 18px; box-shadow: 0 4px 12px rgba(139, 115, 85, 0.3);">
          Acessar Minha Conta
        </a>
      </div>
      
      <!-- Aviso de expiração -->
      <div style="background: #fff8e6; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #f5d67a;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          <strong>⏰ Este link expira em 12 horas.</strong><br>
          Se você não solicitou este acesso, ignore este email.
        </p>
      </div>
      
      <!-- Link alternativo -->
      <p style="font-size: 13px; color: #888; margin: 24px 0 0 0; word-break: break-all;">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${magicLinkUrl}" style="color: #8B7355;">${magicLinkUrl}</a>
      </p>
      
    </div>
    
    <!-- Rodapé -->
    <div style="text-align: center; padding: 24px; color: #999; font-size: 12px;">
      <p style="margin: 0;">
        © ${new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
      </p>
      <p style="margin: 8px 0 0 0;">
        Você recebeu este email porque solicitou acesso à sua conta.
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia email com magic link para acesso
 */
export async function sendMagicLinkEmail(
  data: MagicLinkEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] Simulando envio Magic Link (Resend não configurado)');
    console.log('📧 [EMAIL] Para:', data.userEmail);
    console.log('📧 [EMAIL] Link:', getMagicLinkUrl(data.token));
    return { success: true, messageId: 'mock-magic-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: '🔐 Acesse sua conta - Espaço Arthemi',
      html: getMagicLinkEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar magic link:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Magic link enviado para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar magic link:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// ============================================================
// REFUND NOTIFICATION EMAILS
// ============================================================

export interface RefundEmailData {
  refundId: string;
  bookingId: string;
  userName: string;
  userEmail: string;
  roomName: string;
  bookingDate: string;
  bookingTime: string;
  amount: number; // centavos
  pixKeyType: string;
  pixKey: string;
  status: string;
  reason?: string;
  rejectionReason?: string;
  proofUrl?: string;
}

// Email para o admin sobre o refund
const REFUND_ADMIN_EMAIL = process.env.REFUND_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'diretoria@arthemi.com.br';

/**
 * Template HTML para notificação de novo pedido de estorno (para admin)
 */
function getRefundRequestedAdminEmailHtml(data: RefundEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amount / 100);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Pedido de Estorno</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">
        🔔 Novo pedido de estorno recebido
      </h1>
    </div>
    
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555;">
        Olá,<br><br>
        Um novo pedido de estorno foi registrado no sistema.
      </p>
      
      <p style="font-size: 14px; margin: 0 0 16px 0; color: #333; font-weight: 600;">
        📋 Detalhes:
      </p>
      
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #dc2626;">
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px;">CLIENTE</span>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600;">${data.userName}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px;">EMAIL</span>
          <p style="margin: 4px 0 0 0; font-size: 16px;">${data.userEmail}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px;">SALA</span>
          <p style="margin: 4px 0 0 0; font-size: 16px;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px;">DATA DA RESERVA</span>
          <p style="margin: 4px 0 0 0; font-size: 16px;">${data.bookingDate}</p>
        </div>
        
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px;">VALOR SOLICITADO</span>
          <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700; color: #dc2626;">${formattedAmount}</p>
        </div>
        
      </div>
      
      <p style="font-size: 14px; margin: 0 0 16px 0; color: #333; font-weight: 600;">
        💳 Dados PIX informados:
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #333;">
          <strong>Tipo:</strong> ${data.pixKeyType}<br>
          <strong>Chave:</strong> ${data.pixKey}
        </p>
      </div>
      
      <p style="font-size: 14px; margin: 0 0 8px 0; color: #333; font-weight: 600;">
        Motivo informado:
      </p>
      <p style="font-size: 14px; margin: 0 0 24px 0; color: #555; font-style: italic;">
        "${data.reason || 'Não informado'}"
      </p>
      
      <div style="text-align: center;">
        <a href="${appUrl}/admin/estornos" 
           style="display: inline-block; background: #dc2626; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          👉 Acessar painel administrativo
        </a>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #999; font-size: 12px;">
      <p style="margin: 0;">Sistema Espaço Arthemi</p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Template HTML para notificação de status do estorno (para cliente)
 */
function getRefundStatusEmailHtml(data: RefundEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amount / 100);

  const whatsappNumber = WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  // Configuração de cada status
  const statusConfig: Record<string, { 
    color: string; 
    icon: string; 
    title: string; 
    subject: string;
    message: string; 
    showProof?: boolean;
    showReason?: boolean;
  }> = {
    REVIEWING: {
      color: '#3b82f6',
      icon: '🔍',
      title: 'Seu pedido de estorno está em análise',
      subject: 'Seu pedido de estorno está em análise',
      message: 'Seu pedido de estorno está em análise pela nossa equipe.',
    },
    APPROVED: {
      color: '#22c55e',
      icon: '✅',
      title: 'Estorno aprovado',
      subject: 'Estorno aprovado ✅',
      message: 'Seu pedido de estorno foi aprovado.',
    },
    REJECTED: {
      color: '#dc2626',
      icon: '❌',
      title: 'Sobre sua solicitação de estorno',
      subject: 'Sobre sua solicitação de estorno',
      message: 'Após análise, infelizmente não foi possível aprovar sua solicitação de estorno referente à reserva:',
      showReason: true,
    },
    PAID: {
      color: '#16a34a',
      icon: '💰',
      title: 'PIX enviado — Estorno concluído',
      subject: 'PIX enviado — Estorno concluído 💰',
      message: 'Seu estorno foi realizado com sucesso.',
      showProof: true,
    },
  };

  const config = statusConfig[data.status] || statusConfig.APPROVED;

  // Conteúdo específico por status
  let specificContent = '';
  
  if (data.status === 'REVIEWING') {
    specificContent = `
      <p style="font-size: 16px; margin: 24px 0 0 0; color: #555; line-height: 1.6;">
        Assim que a análise for concluída, você receberá um novo e-mail com a decisão.
      </p>
    `;
  } else if (data.status === 'APPROVED') {
    specificContent = `
      <div style="margin-bottom: 16px;">
        <span style="color: #888; font-size: 13px; text-transform: uppercase;">💳 Pagamento</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; color: #333;">O pagamento será realizado via PIX para a chave informada.</p>
      </div>
      
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0 0 0; border: 1px solid #22c55e;">
        <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">
          <strong>📌 Prazo estimado:</strong><br>
          Até alguns dias úteis, conforme processamento administrativo.
        </p>
      </div>
      
      <p style="font-size: 15px; margin: 16px 0 0 0; color: #555;">
        Você será avisado(a) assim que o pagamento for realizado.
      </p>
    `;
  } else if (data.status === 'PAID') {
    specificContent = `
      <div style="margin-bottom: 16px;">
        <span style="color: #888; font-size: 13px; text-transform: uppercase;">📅 Data do pagamento</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #333;">${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      
      ${data.proofUrl ? `
      <p style="font-size: 15px; margin: 16px 0 0 0; color: #555;">
        O comprovante do PIX pode ser acessado pelo link abaixo:
      </p>
      <div style="text-align: center; margin: 16px 0;">
        <a href="${data.proofUrl}" 
           style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          👉 Ver Comprovante
        </a>
      </div>
      ` : ''}
      
      <p style="font-size: 14px; margin: 16px 0 0 0; color: #555;">
        Caso não identifique o valor em sua conta, entre em contato conosco pelo WhatsApp.
      </p>
    `;
  } else if (data.status === 'REJECTED') {
    specificContent = `
      <div style="margin-top: 24px;">
        <p style="font-size: 14px; margin: 0 0 8px 0; color: #333; font-weight: 600;">Motivo:</p>
        <p style="font-size: 14px; margin: 0; color: #555; font-style: italic; background: #fef2f2; padding: 12px; border-radius: 8px;">
          "${data.rejectionReason || 'Não informado'}"
        </p>
      </div>
      
      <p style="font-size: 15px; margin: 24px 0 0 0; color: #555;">
        Se desejar mais esclarecimentos, nossa equipe está à disposição.
      </p>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">
        ${config.title}
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi
      </p>
    </div>
    
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>!
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        ${config.message}
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid ${config.color};">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📍 Reserva</span>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #333;">${data.roomName} — ${data.bookingDate}</p>
        </div>
        
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">💰 Valor</span>
          <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: ${config.color};">${formattedAmount}</p>
        </div>
        
      </div>
      
      ${specificContent}
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${appUrl}" style="color: #8B7355; text-decoration: none;">${appUrl.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia email para admin sobre novo pedido de estorno
 */
export async function sendRefundRequestedEmailToAdmin(
  data: RefundEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] MOCK: Notificação de estorno para admin');
    console.log('📧 [EMAIL] MOCK: RefundId:', data.refundId, 'Amount:', data.amount);
    return { success: true, messageId: 'mock-refund-admin-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: REFUND_ADMIN_EMAIL,
      replyTo: data.userEmail,
      subject: '🔔 Novo pedido de estorno recebido',
      html: getRefundRequestedAdminEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar notificação de estorno:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Notificação de estorno enviada para admin - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar notificação de estorno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Envia email para cliente sobre atualização do status do estorno
 */
export async function sendRefundStatusEmailToUser(
  data: RefundEmailData
): Promise<EmailResult> {
  // Envia para status que requerem notificação
  if (!['REVIEWING', 'APPROVED', 'REJECTED', 'PAID'].includes(data.status)) {
    return { success: false, error: 'Status não requer notificação' };
  }

  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] MOCK: Notificação de status de estorno para cliente');
    console.log('📧 [EMAIL] MOCK: Status:', data.status, 'User:', data.userEmail);
    return { success: true, messageId: 'mock-refund-user-' + Date.now() };
  }

  // Assuntos conforme especificação
  const subjectByStatus: Record<string, string> = {
    REVIEWING: 'Seu pedido de estorno está em análise',
    APPROVED: 'Estorno aprovado ✅',
    REJECTED: 'Sobre sua solicitação de estorno',
    PAID: 'PIX enviado — Estorno concluído 💰',
  };

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: subjectByStatus[data.status] || 'Atualização do seu pedido de estorno',
      html: getRefundStatusEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar status de estorno:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Status de estorno enviado para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar status de estorno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// ============================================================
// EMAIL PIX PENDENTE
// ============================================================

function getPixPendingEmailHtml(data: BookingEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amountPaid / 100);

  const whatsappNumber = WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Finalize sua reserva</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">
        Finalize sua reserva — Pagamento pendente via PIX
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi
      </p>
    </div>
    
    <!-- Conteúdo Principal -->
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>!
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Sua reserva foi iniciada, mas o pagamento ainda está pendente.
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #f59e0b;">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📍 Sala</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📅 Data</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.date}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">⏰ Horário</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.startTime} às ${data.endTime}</p>
        </div>
        
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">💰 Valor</span>
          <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #f59e0b;">${formattedAmount}</p>
        </div>
        
      </div>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555;">
        Para confirmar sua reserva, finalize o pagamento via PIX utilizando o link abaixo:
      </p>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${data.pixPaymentUrl || `${appUrl}/minha-conta/reservas`}" 
           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          👉 Pagar via PIX
        </a>
      </div>
      
      <!-- Aviso -->
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #f59e0b;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
          <strong>⚠️ Atenção:</strong><br>
          A reserva só será confirmada após a compensação do pagamento.<br>
          Caso o pagamento não seja realizado, o horário poderá ser liberado automaticamente.
        </p>
      </div>
      
      <p style="font-size: 15px; margin: 0; color: #555;">
        Qualquer dúvida, fale com a gente.
      </p>
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${appUrl}" style="color: #8B7355; text-decoration: none;">${appUrl.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia email de pagamento PIX pendente
 */
export async function sendPixPendingEmail(
  data: BookingEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] MOCK: Email PIX pendente para', data.userEmail);
    return { success: true, messageId: 'mock-pix-pending-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: 'Finalize sua reserva — Pagamento pendente via PIX',
      html: getPixPendingEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar email PIX pendente:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Email PIX pendente enviado para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar email PIX pendente:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// ============================================================
// EMAIL CANCELAMENTO SEM ESTORNO
// ============================================================

export interface CancellationEmailData {
  userName: string;
  userEmail: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
}

function getCancellationEmailHtml(data: CancellationEmailData): string {
  const whatsappNumber = WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva cancelada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">
        Reserva cancelada — Espaço Arthemi
      </h1>
    </div>
    
    <!-- Conteúdo Principal -->
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>!
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Confirmamos o cancelamento da sua reserva conforme solicitado.
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #6b7280;">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📍 Sala</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📅 Data</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.date}</p>
        </div>
        
        <div>
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">⏰ Horário</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.startTime} às ${data.endTime}</p>
        </div>
        
      </div>
      
      <p style="font-size: 15px; margin: 0 0 16px 0; color: #555;">
        Nenhum estorno foi solicitado para esta reserva.
      </p>
      
      <p style="font-size: 15px; margin: 0; color: #555;">
        Se precisar reagendar ou tiver qualquer dúvida, estamos à disposição.
      </p>
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${appUrl}" style="color: #8B7355; text-decoration: none;">${appUrl.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia email de cancelamento sem estorno
 */
export async function sendCancellationEmail(
  data: CancellationEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] MOCK: Email cancelamento para', data.userEmail);
    return { success: true, messageId: 'mock-cancel-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: 'Reserva cancelada — Espaço Arthemi',
      html: getCancellationEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar email cancelamento:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Email cancelamento enviado para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar email cancelamento:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// ============================================================
// EMAIL ESTORNO SOLICITADO (PARA CLIENTE)
// ============================================================

function getRefundRequestedUserEmailHtml(data: RefundEmailData): string {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(data.amount / 100);

  const whatsappNumber = WHATSAPP_NUMBER;
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arthemi.com.br';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitação de estorno recebida</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">
        Recebemos sua solicitação de estorno
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi
      </p>
    </div>
    
    <!-- Conteúdo Principal -->
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">
        Olá, <strong>${data.userName}</strong>!
      </p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Recebemos sua solicitação de estorno referente à reserva abaixo:
      </p>
      
      <!-- Card de Detalhes -->
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #3b82f6;">
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📍 Sala</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.roomName}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">📅 Data</span>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #333;">${data.bookingDate}</p>
        </div>
        
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">💰 Valor</span>
          <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #3b82f6;">${formattedAmount}</p>
        </div>
        
      </div>
      
      <p style="font-size: 16px; margin: 0 0 24px 0; color: #555; line-height: 1.6;">
        Sua solicitação foi registrada e será analisada pela nossa equipe administrativa.
      </p>
      
      <!-- Importante -->
      <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #3b82f6;">
        <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
          <strong>📌 Importante:</strong><br>
          • O estorno é realizado via PIX<br>
          • O prazo de análise pode levar até alguns dias úteis<br>
          • Você receberá atualizações por e-mail
        </p>
      </div>
      
      <p style="font-size: 15px; margin: 0; color: #555;">
        Assim que houver qualquer movimentação, entraremos em contato.
      </p>
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${appUrl}" style="color: #8B7355; text-decoration: none;">${appUrl.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia email de confirmação de pedido de estorno para o cliente
 */
export async function sendRefundRequestedEmailToUser(
  data: RefundEmailData
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.log('📧 [EMAIL] MOCK: Confirmação de pedido de estorno para', data.userEmail);
    return { success: true, messageId: 'mock-refund-requested-user-' + Date.now() };
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      replyTo: REPLY_TO,
      subject: 'Recebemos sua solicitação de estorno',
      html: getRefundRequestedUserEmailHtml(data),
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar confirmação de estorno:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EMAIL] Confirmação de estorno enviada para ${data.userEmail} - ID: ${result?.id}`);
    return { success: true, messageId: result?.id };
    
  } catch (error) {
    console.error('❌ [EMAIL] Exceção ao enviar confirmação de estorno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
