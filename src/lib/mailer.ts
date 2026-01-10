// ===========================================================
// lib/mailer.ts - Envio de Emails para Autenticação
// ===========================================================
// Usa o Resend existente (lib/email.ts) ou fallback para console
// 
// Em DEV sem RESEND_API_KEY: apenas console.log
// Em PROD: usa Resend

import { Resend } from 'resend';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Espaço Arthemi <noreply@arthemi.com.br>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Cliente Resend (lazy init)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    if (IS_PRODUCTION) {
      console.error('❌ [MAILER] ERRO: RESEND_API_KEY não configurada em PRODUÇÃO');
    }
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

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// TEMPLATE: RESET DE SENHA
// ============================================================

function getResetPasswordEmailHtml(data: { 
  userName: string; 
  resetLink: string;
  expiresInHours: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha - Espaço Arthemi</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px; font-weight: 600;">Espaço Arthemi</h1>
      <p style="color: #fff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Redefinição de Senha</p>
    </div>
    
    <!-- Conteúdo -->
    <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 16px; margin: 0 0 20px;">Olá, <strong>${data.userName}</strong>!</p>
      
      <p style="font-size: 16px; margin: 0 0 20px;">
        Recebemos uma solicitação para redefinir a senha da sua conta no Espaço Arthemi.
      </p>
      
      <p style="font-size: 16px; margin: 0 0 20px;">
        Clique no botão abaixo para criar uma nova senha:
      </p>
      
      <!-- Botão -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.resetLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); 
                  color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; 
                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);">
          Redefinir Minha Senha
        </a>
      </div>
      
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        ⏰ Este link expira em <strong>${data.expiresInHours} hora${data.expiresInHours > 1 ? 's' : ''}</strong>.
      </p>
      
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        Se você não solicitou a redefinição de senha, ignore este email. Sua senha permanecerá inalterada.
      </p>
      
      <!-- Separador -->
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #999; margin: 0;">
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:
      </p>
      <p style="font-size: 12px; color: #666; word-break: break-all; margin: 10px 0 0;">
        ${data.resetLink}
      </p>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Espaço Arthemi</p>
      <p style="margin: 5px 0 0;">Este é um email automático, não responda.</p>
    </div>
    
  </div>
</body>
</html>
`;
}

// ============================================================
// TEMPLATE: BEM-VINDO (REGISTRO)
// ============================================================

function getWelcomeEmailHtml(data: { userName: string; loginLink: string; whatsappLink: string }): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Espaço Arthemi</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px; font-weight: 600;">🌿 Espaço Arthemi</h1>
      <p style="color: #fff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Bem-vindo(a)!</p>
    </div>
    
    <!-- Conteúdo -->
    <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 16px; margin: 0 0 20px;">Olá, <strong>${data.userName}</strong>!</p>
      
      <p style="font-size: 16px; margin: 0 0 20px; line-height: 1.6;">
        Seja muito bem-vindo(a) ao <strong>Espaço Arthemi</strong>.
      </p>
      
      <p style="font-size: 16px; margin: 0 0 20px;">
        Seu cadastro foi realizado com sucesso e agora você já pode:
      </p>
      
      <ul style="font-size: 15px; margin: 0 0 20px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 8px;">• Agendar horários</li>
        <li style="margin-bottom: 8px;">• Acompanhar suas reservas</li>
        <li style="margin-bottom: 8px;">• Gerenciar créditos</li>
        <li style="margin-bottom: 8px;">• Solicitar cancelamentos ou estornos (quando aplicável)</li>
      </ul>
      
      <p style="font-size: 16px; margin: 0 0 20px;">
        Para acessar sua conta, utilize o link abaixo:
      </p>
      
      <!-- Botão -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.loginLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); 
                  color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; 
                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);">
          👉 Acessar Minha Conta
        </a>
      </div>
      
      <p style="font-size: 15px; margin: 20px 0; color: #555; line-height: 1.6;">
        Caso tenha qualquer dúvida ou precise de ajuda, nossa equipe está à disposição.
      </p>
      
      <p style="font-size: 16px; margin: 20px 0 0; color: #333;">
        Seja bem-vindo(a).<br>
        Estamos felizes em ter você com a gente 🤍
      </p>
      
    </div>
    
    <!-- Footer / Assinatura -->
    <div style="text-align: center; padding: 24px; color: #666; font-size: 13px; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="margin: 0; font-weight: 600; color: #333;">Espaço Arthemi</p>
      <p style="margin: 4px 0 0;">Atendimento & Administração</p>
      <p style="margin: 8px 0 0;">
        🌐 <a href="${APP_URL}" style="color: #8B7355; text-decoration: none;">${APP_URL.replace('https://', '')}</a>
      </p>
      <p style="margin: 4px 0 0;">
        📲 <a href="${data.whatsappLink}" style="color: #8B7355; text-decoration: none;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
`;
}

// ============================================================
// FUNÇÕES DE ENVIO
// ============================================================

/**
 * Envia email de reset de senha
 */
export async function sendResetPasswordEmail(
  to: string,
  userName: string,
  token: string
): Promise<MailResult> {
  // IMPORTANTE: A página de reset está em /reset-password (não /auth/reset-password)
  const resetLink = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;
  
  console.log(`📧 [MAILER] Preparando email de reset para: ${to}`);
  console.log(`📧 [MAILER] APP_URL configurado: ${APP_URL}`);
  console.log(`📧 [MAILER] RESEND_API_KEY presente: ${!!RESEND_API_KEY}`);
  
  const client = getResendClient();
  
  // Em produção sem API key = falha explícita
  if (!client) {
    if (IS_PRODUCTION) {
      console.error('❌ [MAILER] FALHA: Impossível enviar email em PRODUÇÃO sem RESEND_API_KEY');
      return { success: false, error: 'RESEND_API_KEY não configurada em produção' };
    }
    // Fallback em desenvolvimento: apenas log
    console.log('\n' + '='.repeat(60));
    console.log('📧 [MAILER DEV] EMAIL DE RESET DE SENHA');
    console.log('='.repeat(60));
    console.log(`Para: ${to}`);
    console.log(`Nome: ${userName}`);
    console.log(`Link: ${resetLink}`);
    console.log('='.repeat(60) + '\n');
    
    return { success: true, messageId: 'dev-console-log' };
  }
  
  try {
    const html = getResetPasswordEmailHtml({
      userName,
      resetLink,
      expiresInHours: 1,
    });
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Redefinir sua senha - Espaço Arthemi',
      html,
    });
    
    console.log(`📧 [MAILER] Resposta do Resend:`, JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('❌ [MAILER] Erro retornado pelo Resend:', result.error);
      return { success: false, error: result.error.message };
    }
    
    console.log(`✅ [MAILER] Email de reset enviado com sucesso para ${to}, ID: ${result.data?.id}`);
    return { success: true, messageId: result.data?.id };
    
  } catch (error) {
    console.error('❌ [MAILER] Exceção ao enviar email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Envia email de boas-vindas (após registro)
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<MailResult> {
  const loginLink = `${APP_URL}/login`;
  const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER || '5531999999999'}`;
  
  const client = getResendClient();
  
  // Em produção sem API key = falha explícita
  if (!client) {
    if (IS_PRODUCTION) {
      console.error('❌ [MAILER] FALHA: Impossível enviar email em PRODUÇÃO sem RESEND_API_KEY');
      return { success: false, error: 'RESEND_API_KEY não configurada em produção' };
    }
    // Fallback em desenvolvimento: apenas log
    console.log('\n' + '='.repeat(60));
    console.log('📧 [MAILER DEV] EMAIL DE BEM-VINDO');
    console.log('='.repeat(60));
    console.log(`Para: ${to}`);
    console.log(`Nome: ${userName}`);
    console.log(`Link Login: ${loginLink}`);
    console.log('='.repeat(60) + '\n');
    
    return { success: true, messageId: 'dev-console-log' };
  }
  
  try {
    const html = getWelcomeEmailHtml({ userName, loginLink, whatsappLink });
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Bem-vindo(a) ao Espaço Arthemi 🌿',
      html,
    });
    
    if (result.error) {
      console.error('❌ [MAILER] Erro ao enviar email:', result.error);
      return { success: false, error: result.error.message };
    }
    
    console.log(`✅ [MAILER] Email de boas-vindas enviado para ${to}`);
    return { success: true, messageId: result.data?.id };
    
  } catch (error) {
    console.error('❌ [MAILER] Exceção ao enviar email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// ============================================================
// TEMPLATE: ATIVAÇÃO DE CONTA (checkout anônimo)
// ============================================================

function getAccountActivationEmailHtml(data: { 
  userName: string; 
  activationLink: string;
  expiresInHours: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ative sua Conta - Espaço Arthemi</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px; font-weight: 600;">🌿 Espaço Arthemi</h1>
      <p style="color: #fff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Ative sua Conta</p>
    </div>
    
    <!-- Conteúdo -->
    <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 16px; margin: 0 0 20px;">Olá, <strong>${data.userName}</strong>!</p>
      
      <p style="font-size: 16px; margin: 0 0 20px; line-height: 1.6;">
        Sua compra foi realizada com sucesso! 🎉
      </p>
      
      <p style="font-size: 16px; margin: 0 0 20px;">
        Para acessar sua conta e acompanhar suas reservas, clique no botão abaixo para ativar seu acesso e criar sua senha:
      </p>
      
      <!-- Botão -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.activationLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); 
                  color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; 
                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);">
          Ativar Minha Conta
        </a>
      </div>
      
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        ⏰ Este link expira em <strong>${data.expiresInHours} horas</strong>.
      </p>
      
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        Após ativar, você poderá:
      </p>
      
      <ul style="font-size: 14px; margin: 0 0 20px; padding-left: 20px; color: #555;">
        <li style="margin-bottom: 8px;">• Visualizar suas reservas</li>
        <li style="margin-bottom: 8px;">• Acompanhar seus créditos</li>
        <li style="margin-bottom: 8px;">• Fazer novas reservas</li>
      </ul>
      
      <!-- Separador -->
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #999; margin: 0;">
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:
      </p>
      <p style="font-size: 12px; color: #666; word-break: break-all; margin: 10px 0 0;">
        ${data.activationLink}
      </p>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Espaço Arthemi</p>
      <p style="margin: 5px 0 0;">Este é um email automático, não responda.</p>
    </div>
    
  </div>
</body>
</html>
`;
}

/**
 * Envia email de ativação de conta (após checkout anônimo)
 */
export async function sendAccountActivationEmail(
  to: string,
  userName: string,
  activationLink: string
): Promise<MailResult> {
  const client = getResendClient();
  
  // Em produção sem API key = falha explícita
  if (!client) {
    if (IS_PRODUCTION) {
      console.error('❌ [MAILER] FALHA: Impossível enviar email em PRODUÇÃO sem RESEND_API_KEY');
      return { success: false, error: 'RESEND_API_KEY não configurada em produção' };
    }
    // Fallback em desenvolvimento: apenas log
    console.log('\n' + '='.repeat(60));
    console.log('📧 [MAILER DEV] EMAIL DE ATIVAÇÃO DE CONTA');
    console.log('='.repeat(60));
    console.log(`Para: ${to}`);
    console.log(`Nome: ${userName}`);
    console.log(`Link: ${activationLink}`);
    console.log('='.repeat(60) + '\n');
    
    return { success: true, messageId: 'dev-console-log' };
  }
  
  try {
    const html = getAccountActivationEmailHtml({
      userName,
      activationLink,
      expiresInHours: 12,
    });
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Ative sua conta - Espaço Arthemi 🌿',
      html,
    });
    
    if (result.error) {
      console.error('❌ [MAILER] Erro ao enviar email de ativação:', result.error);
      return { success: false, error: result.error.message };
    }
    
    console.log(`✅ [MAILER] Email de ativação enviado para ${to}`);
    return { success: true, messageId: result.data?.id };
    
  } catch (error) {
    console.error('❌ [MAILER] Exceção ao enviar email de ativação:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
