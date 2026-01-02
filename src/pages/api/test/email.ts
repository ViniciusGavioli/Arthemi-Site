// ===========================================================
// API: POST /api/test/email - Teste de envio Resend
// ===========================================================
// Endpoint protegido para validar configuração do Resend
// Uso: curl -X POST /api/test/email -H "x-test-key: CHAVE" -d '{"to":"email@test.com"}'

import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Espaço Arthemi <noreply@arthemi.com.br>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'diretoria@arthemi.com.br';
const TEST_KEY = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;

interface ApiResponse {
  ok: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
  detail?: string;
  timestamp?: string;
  environment?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Validar chave de teste
  const testKey = req.headers['x-test-key'];
  
  if (!TEST_KEY) {
    console.error('❌ [TEST/EMAIL] ADMIN_SESSION_SECRET ou JWT_SECRET não configurado');
    return res.status(500).json({ 
      ok: false, 
      error: 'Configuração inválida',
      detail: 'Chave de autenticação não configurada no servidor',
    });
  }

  if (!testKey || testKey !== TEST_KEY) {
    return res.status(401).json({ 
      ok: false, 
      error: 'Não autorizado',
      detail: 'Header x-test-key ausente ou inválido',
    });
  }

  // Validar RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Resend não configurado',
      detail: 'RESEND_API_KEY não está definida nas variáveis de ambiente',
    });
  }

  // Extrair destinatário
  const { to } = req.body || {};
  const recipientEmail = to?.trim() || ADMIN_EMAIL;

  // Validar formato básico de email
  if (!recipientEmail.includes('@')) {
    return res.status(400).json({
      ok: false,
      error: 'Email inválido',
      detail: 'Forneça um email válido no campo "to"',
    });
  }

  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';

  // Template do email de teste
  const subject = '✅ Teste Resend — Espaço Arthemi';
  const textContent = `
Se você recebeu isso, o Resend está funcionando corretamente.

---
Timestamp: ${timestamp}
Ambiente: ${environment}
From: ${FROM_EMAIL}
To: ${recipientEmail}
---

Este é um email de teste automático.
Não é necessário responder.
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teste Resend</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f0; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 600;">
        ✅ Teste Resend
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        Espaço Arthemi
      </p>
    </div>
    
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      
      <p style="font-size: 18px; margin: 0 0 24px 0; color: #333; text-align: center;">
        <strong>Se você recebeu isso, o Resend está funcionando corretamente.</strong>
      </p>
      
      <div style="background: #f9f7f4; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border-left: 4px solid #22c55e;">
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">Timestamp</span>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-family: monospace; color: #333;">${timestamp}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">Ambiente</span>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: ${environment === 'production' ? '#dc2626' : '#22c55e'};">${environment.toUpperCase()}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">From</span>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #333;">${FROM_EMAIL}</p>
        </div>
        
        <div>
          <span style="color: #888; font-size: 13px; text-transform: uppercase;">To</span>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #333;">${recipientEmail}</p>
        </div>
        
      </div>
      
      <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
        Este é um email de teste automático. Não é necessário responder.
      </p>
      
    </div>
    
  </div>
</body>
</html>
`.trim();

  // Enviar email
  try {
    const resend = new Resend(RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ [TEST/EMAIL] Erro Resend:', error);
      return res.status(500).json({
        ok: false,
        error: 'Falha no envio',
        detail: error.message || 'Erro desconhecido do Resend',
        timestamp,
        environment,
      });
    }

    console.log(`✅ [TEST/EMAIL] Email de teste enviado para ${recipientEmail} - ID: ${data?.id}`);
    
    return res.status(200).json({
      ok: true,
      provider: 'resend',
      messageId: data?.id,
      timestamp,
      environment,
    });

  } catch (error) {
    console.error('❌ [TEST/EMAIL] Exceção:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp,
      environment,
    });
  }
}
