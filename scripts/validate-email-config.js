#!/usr/bin/env node
// ===========================================================
// Script: validate-email-config.js
// ===========================================================
// Valida configuração de email (Resend) para produção
// Uso: node scripts/validate-email-config.js

require('dotenv').config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

console.log('\n📧 Validação de Configuração de Email\n');
console.log('='.repeat(50));

let hasErrors = false;

// 1. RESEND_API_KEY
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY: NÃO CONFIGURADA');
  hasErrors = true;
} else if (!RESEND_API_KEY.startsWith('re_')) {
  console.error('❌ RESEND_API_KEY: Formato inválido (deve começar com "re_")');
  hasErrors = true;
} else {
  console.log(`✅ RESEND_API_KEY: Configurada (${RESEND_API_KEY.substring(0, 10)}...)`);
}

// 2. EMAIL_FROM
if (!EMAIL_FROM) {
  console.warn('⚠️  EMAIL_FROM: Usando default "Espaço Arthemi <noreply@arthemi.com.br>"');
} else {
  console.log(`✅ EMAIL_FROM: ${EMAIL_FROM}`);
  
  // Extrair domínio do email
  const match = EMAIL_FROM.match(/<([^>]+)>/);
  const email = match ? match[1] : EMAIL_FROM;
  const domain = email.split('@')[1];
  
  if (domain) {
    console.log(`   📍 Domínio: ${domain}`);
    console.log('   ⚠️  Certifique-se de que este domínio está verificado no Resend');
  }
}

// 3. APP_URL
if (!APP_URL) {
  console.error('❌ NEXT_PUBLIC_APP_URL / NEXTAUTH_URL: NÃO CONFIGURADA');
  console.error('   Os links nos emails não funcionarão corretamente');
  hasErrors = true;
} else {
  console.log(`✅ APP_URL: ${APP_URL}`);
}

// 4. Ambiente
console.log(`\n📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);

if (IS_PRODUCTION && !RESEND_API_KEY) {
  console.error('\n🚨 ERRO CRÍTICO: Produção sem RESEND_API_KEY!');
  console.error('   Emails NÃO serão enviados em produção.');
  hasErrors = true;
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.error('\n❌ Configuração com ERROS. Corrija antes de deploy.\n');
  process.exit(1);
} else {
  console.log('\n✅ Configuração OK!\n');
  
  console.log('📋 Para testar envio manualmente:');
  console.log(`
curl -X POST "${APP_URL || 'http://localhost:3000'}/api/test/email" \\
  -H "Content-Type: application/json" \\
  -H "x-test-key: \$ADMIN_SESSION_SECRET" \\
  -d '{"to":"seu-email@test.com"}'
`);
  
  console.log('📋 Para testar resend-activation:');
  console.log(`
curl -X POST "${APP_URL || 'http://localhost:3000'}/api/auth/resend-activation" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"email-cadastrado@test.com"}'
`);

  process.exit(0);
}
