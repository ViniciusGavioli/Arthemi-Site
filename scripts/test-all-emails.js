// ============================================================
// Script: Testar TODOS os tipos de email do sistema
// ============================================================
// Uso: node scripts/test-all-emails.js [email]
// Exemplo: node scripts/test-all-emails.js viniciusgavioli528@gmail.com

// Carregar variáveis de ambiente
require('dotenv').config();

const { Resend } = require('resend');

// Configuração
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Usar o domínio verificado em produção (arthemisaude.com)
const FROM_EMAIL = process.env.EMAIL_FROM || 'administrativo@arthemisaude.com';
const TARGET_EMAIL = process.argv[2] || 'viniciusgavioli528@gmail.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.arthemisaude.com';

// Validar configuração
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY não configurada!');
  console.log('   Configure: $env:RESEND_API_KEY = "sua_chave_aqui"');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// ============================================================
// TEMPLATES DE EMAIL
// ============================================================

// 1. Email de Confirmação de Reserva
function getBookingConfirmationHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">✅ Reserva Confirmada</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Sua reserva foi confirmada com sucesso.</p>
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">📍 SALA</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">Consultório 1</p>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">📅 DATA</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">09/01/2026 (Sexta-feira)</p>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">⏰ HORÁRIO</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">14:00 às 16:00</p>
        </div>
        <div style="padding-top: 16px; border-top: 1px dashed #ddd;">
          <span style="color: #888; font-size: 13px;">💳 FORMA DE PAGAMENTO</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">PIX</p>
        </div>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Confirmação de Reserva]</p>
    </div>
  </div>
</body>
</html>`;
}

// 2. Email de PIX Pendente
function getPixPendingHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">⏳ Pagamento Pendente</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Sua reserva está aguardando pagamento via PIX.</p>
      <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 16px; color: #92400e;"><strong>⚠️ Atenção:</strong> Você tem 30 minutos para realizar o pagamento.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Pagar Agora
        </a>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - PIX Pendente]</p>
    </div>
  </div>
</body>
</html>`;
}

// 3. Email de Cancelamento
function getCancellationHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">❌ Reserva Cancelada</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Confirmamos o cancelamento da sua reserva.</p>
      <div style="background: #fee2e2; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">📍 SALA</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">Consultório 1</p>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">📅 DATA</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">09/01/2026</p>
        </div>
        <div>
          <span style="color: #888; font-size: 13px;">💰 MOTIVO</span>
          <p style="margin: 4px 0 0; font-size: 16px; color: #dc2626;">Cancelado a pedido do cliente</p>
        </div>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Cancelamento]</p>
    </div>
  </div>
</body>
</html>`;
}

// 4. Email de Ativação de Conta
function getActivationHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">🌿 Espaço Arthemi</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Ative sua conta</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Bem-vindo ao Espaço Arthemi! Clique no botão abaixo para ativar sua conta:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/verificar-email?token=test_token_123" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ativar Minha Conta
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Este link expira em 24 horas.</p>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Ativação de Conta]</p>
    </div>
  </div>
</body>
</html>`;
}

// 5. Email de Reset de Senha
function getResetPasswordHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">Espaço Arthemi</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Redefinição de Senha</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Recebemos uma solicitação para redefinir sua senha.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/auth/reset-password?token=test_token_123" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Redefinir Minha Senha
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">⏰ Este link expira em 1 hora.</p>
      <p style="font-size: 14px; color: #888;">Se você não solicitou, ignore este email.</p>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Reset de Senha]</p>
    </div>
  </div>
</body>
</html>`;
}

// 6. Email de Boas-Vindas
function getWelcomeHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">🌿 Espaço Arthemi</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Bem-vindo(a)!</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Sua conta foi criada com sucesso! Agora você pode:</p>
      <ul style="font-size: 16px; color: #555; line-height: 1.8;">
        <li>Reservar salas e consultórios</li>
        <li>Gerenciar suas reservas</li>
        <li>Acompanhar seu histórico</li>
        <li>Acessar pacotes de horas</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/login" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Acessar Minha Conta
        </a>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Boas-Vindas]</p>
    </div>
  </div>
</body>
</html>`;
}

// 7. Email de Magic Link
function getMagicLinkHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2C3E2D 0%, #4A5D4B 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">🔐 Acesso Rápido</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Clique no botão abaixo para acessar sua conta sem precisar de senha:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/api/auth/verify?token=test_magic_link" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #2C3E2D; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Acessar Minha Conta
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">⏰ Este link expira em 15 minutos.</p>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Magic Link]</p>
    </div>
  </div>
</body>
</html>`;
}

// 8. Email de Solicitação de Estorno
function getRefundRequestHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">💰 Estorno Solicitado</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Recebemos sua solicitação de estorno.</p>
      <div style="background: #dbeafe; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">💵 VALOR</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">R$ 150,00</p>
        </div>
        <div>
          <span style="color: #888; font-size: 13px;">📋 STATUS</span>
          <p style="margin: 4px 0 0; font-size: 16px; color: #2563eb;">Em análise</p>
        </div>
      </div>
      <p style="font-size: 14px; color: #666;">Você receberá uma atualização quando o estorno for processado.</p>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Estorno Solicitado]</p>
    </div>
  </div>
</body>
</html>`;
}

// 9. Email de Status do Estorno (Aprovado)
function getRefundApprovedHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">✅ Estorno Aprovado</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;">Olá, <strong>Usuário Teste</strong>!</p>
      <p style="font-size: 16px; color: #555;">Boa notícia! Seu estorno foi aprovado.</p>
      <div style="background: #dcfce7; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">💵 VALOR</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">R$ 150,00</p>
        </div>
        <div>
          <span style="color: #888; font-size: 13px;">📅 PREVISÃO</span>
          <p style="margin: 4px 0 0; font-size: 16px; color: #16a34a;">Até 5 dias úteis</p>
        </div>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Estorno Aprovado]</p>
    </div>
  </div>
</body>
</html>`;
}

// 10. Email Admin - Novo Pedido de Estorno
function getAdminRefundRequestHtml() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">🔔 Novo Pedido de Estorno</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">[ADMIN] Espaço Arthemi</p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px;">
      <p style="font-size: 18px;"><strong>Atenção Administrador!</strong></p>
      <p style="font-size: 16px; color: #555;">Um novo pedido de estorno foi recebido:</p>
      <div style="background: #fee2e2; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">👤 CLIENTE</span>
          <p style="margin: 4px 0 0; font-size: 16px;">Usuário Teste (${TARGET_EMAIL})</p>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: #888; font-size: 13px;">💵 VALOR</span>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600;">R$ 150,00</p>
        </div>
        <div>
          <span style="color: #888; font-size: 13px;">📝 MOTIVO</span>
          <p style="margin: 4px 0 0; font-size: 14px;">Cancelamento a pedido do cliente</p>
        </div>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/admin/estornos" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ver no Painel Admin
        </a>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">[EMAIL DE TESTE - Admin Estorno]</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// ENVIAR TODOS OS EMAILS
// ============================================================

async function sendEmail(subject, html, delay = 1000) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TARGET_EMAIL,
      subject: `[TESTE] ${subject}`,
      html,
    });

    if (error) {
      console.log(`   ❌ Falhou: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Enviado! ID: ${data?.id}`);
    
    // Aguardar entre envios para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  } catch (err) {
    console.log(`   ❌ Erro: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('📧 TESTE DE TODOS OS EMAILS DO SISTEMA');
  console.log('='.repeat(60));
  console.log(`📨 Destinatário: ${TARGET_EMAIL}`);
  console.log(`📤 Remetente: ${FROM_EMAIL}`);
  console.log(`🌐 App URL: ${APP_URL}`);
  console.log('='.repeat(60));
  console.log('');

  const emails = [
    { name: '1. Confirmação de Reserva', subject: 'Reserva Confirmada ✅', html: getBookingConfirmationHtml() },
    { name: '2. PIX Pendente', subject: 'Pagamento PIX Pendente ⏳', html: getPixPendingHtml() },
    { name: '3. Cancelamento', subject: 'Reserva Cancelada ❌', html: getCancellationHtml() },
    { name: '4. Ativação de Conta', subject: 'Ative sua Conta 🌿', html: getActivationHtml() },
    { name: '5. Reset de Senha', subject: 'Redefinição de Senha 🔑', html: getResetPasswordHtml() },
    { name: '6. Boas-Vindas', subject: 'Bem-vindo ao Espaço Arthemi 🌿', html: getWelcomeHtml() },
    { name: '7. Magic Link', subject: 'Acesse sua Conta 🔐', html: getMagicLinkHtml() },
    { name: '8. Estorno Solicitado', subject: 'Estorno Recebido 💰', html: getRefundRequestHtml() },
    { name: '9. Estorno Aprovado', subject: 'Estorno Aprovado ✅', html: getRefundApprovedHtml() },
    { name: '10. Admin - Novo Estorno', subject: '[ADMIN] Novo Pedido de Estorno 🔔', html: getAdminRefundRequestHtml() },
  ];

  let success = 0;
  let failed = 0;

  for (const email of emails) {
    console.log(`📧 ${email.name}`);
    const result = await sendEmail(email.subject, email.html, 1500);
    if (result) success++;
    else failed++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 RESUMO');
  console.log('='.repeat(60));
  console.log(`✅ Enviados: ${success}`);
  console.log(`❌ Falharam: ${failed}`);
  console.log(`📬 Total: ${emails.length}`);
  console.log('');
  console.log(`📥 Verifique sua caixa de entrada: ${TARGET_EMAIL}`);
  console.log('   (Pode demorar alguns segundos para chegar)');
  console.log('='.repeat(60));
}

main().catch(console.error);
