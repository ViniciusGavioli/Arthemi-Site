// Script para enviar email de ativação manualmente
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { Resend } = require('resend');

const prisma = new PrismaClient();
const PEPPER = process.env.EMAIL_TOKEN_PEPPER || 'dev-pepper-arthemi-2025';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const EMAIL = process.argv[2] || 'viniciusgavioli528@gmail.com';

async function main() {
  console.log(`📧 Enviando email de ativação para: ${EMAIL}`);
  
  const user = await prisma.user.findFirst({
    where: { email: EMAIL }
  });
  
  if (!user) {
    console.log('❌ Usuário não encontrado');
    return;
  }
  
  console.log(`✅ Usuário encontrado: ${user.name}`);
  
  // Gerar token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken + PEPPER).digest('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h
  
  // Invalidar tokens antigos
  await prisma.emailActivationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });
  
  // Criar novo token
  await prisma.emailActivationToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });
  
  const activationUrl = `${APP_URL}/verificar-email?token=${rawToken}`;
  console.log(`🔗 URL de ativação: ${activationUrl}`);
  
  // Enviar email
  if (!RESEND_API_KEY) {
    console.log('⚠️  RESEND_API_KEY não configurada - email não enviado');
    console.log('👆 Use o link acima para ativar manualmente');
    return;
  }
  
  const resend = new Resend(RESEND_API_KEY);
  
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
    <h1 style="color: #8B7355; margin: 0 0 20px;">Ative sua conta</h1>
    <p>Olá <strong>${user.name}</strong>,</p>
    <p>Clique no botão abaixo para ativar sua conta e criar sua senha:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${activationUrl}" 
         style="background: #8B7355; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Ativar minha conta
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">Este link expira em 12 horas.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Espaço Arthemi</p>
  </div>
</body>
</html>`;

  try {
    const result = await resend.emails.send({
      from: 'Espaço Arthemi <noreply@arthemi.com.br>',
      to: user.email,
      subject: 'Ative sua conta - Espaço Arthemi 🌿',
      html
    });
    
    if (result.error) {
      console.log('❌ Erro ao enviar:', result.error);
    } else {
      console.log(`✅ Email enviado! ID: ${result.data?.id}`);
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
