// ===========================================================
// lib/email-templates.ts - Templates de Email Transacionais
// ===========================================================
// Templates HTML para emails do sistema Arthemi
// Usa textos centralizados de lib/policies.ts
// ===========================================================

import { 
  EMAIL_TEMPLATES, 
  POLICY_CONSTANTS, 
  formatCurrency, 
  formatDate 
} from './policies';

// ============================================================
// ESTILOS BASE
// ============================================================

const baseStyles = `
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  .header { background-color: #d97706; padding: 24px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
  .content { padding: 32px 24px; }
  .content h2 { color: #1f2937; margin-top: 0; }
  .info-box { background-color: #fef3c7; border-left: 4px solid #d97706; padding: 16px; margin: 20px 0; }
  .info-box.green { background-color: #d1fae5; border-left-color: #059669; }
  .info-box.gray { background-color: #f3f4f6; border-left-color: #6b7280; }
  .details { background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .details p { margin: 8px 0; }
  .details strong { color: #1f2937; }
  .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 14px; color: #6b7280; }
  .button { display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
  .warning { color: #92400e; font-size: 14px; margin-top: 16px; }
  .divider { border-top: 1px solid #e5e7eb; margin: 24px 0; }
`;

// ============================================================
// HEADER PADRÃO
// ============================================================

function getHeader(): string {
  return `
    <div class="header">
      <h1>Espaço Arthemi</h1>
    </div>
  `;
}

// ============================================================
// FOOTER PADRÃO
// ============================================================

function getFooter(): string {
  return `
    <div class="footer">
      <p>Espaço Arthemi</p>
      <p>
        WhatsApp: <a href="https://wa.me/55${POLICY_CONSTANTS.WHATSAPP_SUPPORT.replace(/\D/g, '')}">${POLICY_CONSTANTS.WHATSAPP_SUPPORT}</a>
      </p>
      <p>
        <a href="mailto:${POLICY_CONSTANTS.EMAIL_SUPPORT}">${POLICY_CONSTANTS.EMAIL_SUPPORT}</a>
      </p>
    </div>
  `;
}

// ============================================================
// 1. CONFIRMAÇÃO DE RESERVA
// ============================================================

export interface BookingConfirmationData {
  userName: string;
  roomName: string;
  startTime: Date;
  endTime: Date;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  couponCode?: string | null;
  bookingId: string;
}

export function generateBookingConfirmationEmail(data: BookingConfirmationData): {
  subject: string;
  html: string;
} {
  const {
    userName,
    roomName,
    startTime,
    endTime,
    grossAmount,
    discountAmount,
    netAmount,
    couponCode,
    bookingId,
  } = data;

  const dateStr = formatDate(startTime);
  const startTimeStr = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTimeStr = endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Resumo de pagamento
  let paymentSummary = '';
  if (discountAmount > 0 && couponCode) {
    paymentSummary = `
      <div class="details">
        <p><strong>Resumo do Pagamento</strong></p>
        <p>Valor original: ${formatCurrency(grossAmount)}</p>
        <p style="color: #059669;">Desconto (${couponCode}): -${formatCurrency(discountAmount)}</p>
        <p><strong>Valor pago: ${formatCurrency(netAmount)}</strong></p>
      </div>
    `;
  } else {
    paymentSummary = `
      <div class="details">
        <p><strong>Valor pago: ${formatCurrency(netAmount)}</strong></p>
      </div>
    `;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${getHeader()}
    
    <div class="content">
      <h2>${EMAIL_TEMPLATES.bookingConfirmation.greeting(userName)}</h2>
      
      <p>${EMAIL_TEMPLATES.bookingConfirmation.intro}</p>
      
      <div class="info-box green">
        <p><strong>✅ Reserva Confirmada</strong></p>
        <p>Código: <strong>${bookingId.slice(0, 8).toUpperCase()}</strong></p>
      </div>
      
      <div class="details">
        <p><strong>Detalhes da Reserva</strong></p>
        <p>📍 Consultório: <strong>${roomName}</strong></p>
        <p>📅 Data: <strong>${dateStr}</strong></p>
        <p>🕐 Horário: <strong>${startTimeStr} às ${endTimeStr}</strong></p>
      </div>
      
      ${paymentSummary}
      
      <div class="divider"></div>
      
      <div class="info-box gray">
        <p style="margin: 0; font-size: 14px;">
          <strong>ℹ️ Política de Cancelamento</strong><br>
          Cancelamentos com no mínimo 48 horas de antecedência são elegíveis 
          para reembolso do valor efetivamente pago.<br><br>
          <em>Cupons promocionais não são restaurados em caso de cancelamento.</em>
        </p>
      </div>
      
      <p style="white-space: pre-line; margin-top: 24px;">
${EMAIL_TEMPLATES.bookingConfirmation.footer}
      </p>
    </div>
    
    ${getFooter()}
  </div>
</body>
</html>
  `;

  return {
    subject: EMAIL_TEMPLATES.bookingConfirmation.subject,
    html,
  };
}

// ============================================================
// 2. CANCELAMENTO COM CRÉDITO
// ============================================================

export interface CancellationCreditData {
  userName: string;
  roomName: string;
  bookingDate: Date;
  creditAmount: number;
  creditExpiresAt: Date;
  bookingId: string;
  hadCoupon: boolean;
}

export function generateCancellationCreditEmail(data: CancellationCreditData): {
  subject: string;
  html: string;
} {
  const {
    userName,
    roomName,
    bookingDate,
    creditAmount,
    creditExpiresAt,
    bookingId,
    hadCoupon,
  } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${getHeader()}
    
    <div class="content">
      <h2>${EMAIL_TEMPLATES.cancellationCredit.greeting(userName)}</h2>
      
      <p>${EMAIL_TEMPLATES.cancellationCredit.intro}</p>
      
      <div class="info-box">
        <p><strong>Reserva Cancelada</strong></p>
        <p>Código: ${bookingId.slice(0, 8).toUpperCase()}</p>
        <p>Consultório: ${roomName}</p>
        <p>Data original: ${formatDate(bookingDate)}</p>
      </div>
      
      <div class="info-box green">
        <p><strong>💳 Crédito Disponível</strong></p>
        <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 8px 0;">
          ${formatCurrency(creditAmount)}
        </p>
        <p>Validade: ${formatDate(creditExpiresAt)}</p>
      </div>
      
      <p>Você pode utilizar este crédito em novas reservas pelo nosso site.</p>
      
      ${hadCoupon ? `
      <div class="info-box gray">
        <p style="margin: 0; font-size: 14px;">
          <strong>ℹ️ Importante</strong><br>
          ${EMAIL_TEMPLATES.cancellationCredit.couponNotice}
        </p>
      </div>
      ` : ''}
      
      <a href="https://arthemi.com.br/reservar" class="button">
        Fazer Nova Reserva
      </a>
      
      <p style="white-space: pre-line; margin-top: 24px;">
${EMAIL_TEMPLATES.cancellationCredit.footer}
      </p>
    </div>
    
    ${getFooter()}
  </div>
</body>
</html>
  `;

  return {
    subject: EMAIL_TEMPLATES.cancellationCredit.subject,
    html,
  };
}

// ============================================================
// 3. CANCELAMENTO COM ESTORNO FINANCEIRO
// ============================================================

export interface CancellationRefundData {
  userName: string;
  roomName: string;
  bookingDate: Date;
  refundAmount: number;
  bookingId: string;
  hadCoupon: boolean;
}

export function generateCancellationRefundEmail(data: CancellationRefundData): {
  subject: string;
  html: string;
} {
  const {
    userName,
    roomName,
    bookingDate,
    refundAmount,
    bookingId,
    hadCoupon,
  } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${getHeader()}
    
    <div class="content">
      <h2>${EMAIL_TEMPLATES.cancellationRefund.greeting(userName)}</h2>
      
      <p>${EMAIL_TEMPLATES.cancellationRefund.intro}</p>
      
      <div class="info-box">
        <p><strong>Reserva Cancelada</strong></p>
        <p>Código: ${bookingId.slice(0, 8).toUpperCase()}</p>
        <p>Consultório: ${roomName}</p>
        <p>Data original: ${formatDate(bookingDate)}</p>
      </div>
      
      <div class="info-box green">
        <p><strong>💰 Estorno em Processamento</strong></p>
        <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 8px 0;">
          ${formatCurrency(refundAmount)}
        </p>
        <p>Forma: PIX</p>
        <p>Prazo: até 5 dias úteis</p>
      </div>
      
      ${hadCoupon ? `
      <div class="info-box gray">
        <p style="margin: 0; font-size: 14px;">
          <strong>ℹ️ Importante</strong><br>
          ${EMAIL_TEMPLATES.cancellationRefund.couponNotice}
        </p>
      </div>
      ` : ''}
      
      <p style="white-space: pre-line; margin-top: 24px;">
${EMAIL_TEMPLATES.cancellationRefund.footer}
      </p>
    </div>
    
    ${getFooter()}
  </div>
</body>
</html>
  `;

  return {
    subject: EMAIL_TEMPLATES.cancellationRefund.subject,
    html,
  };
}

// ============================================================
// 4. ESTORNO PARCIAL (REVISÃO)
// ============================================================

export interface PartialRefundReviewData {
  userName: string;
  roomName: string;
  bookingDate: Date;
  expectedAmount: number;
  refundedAmount: number;
  bookingId: string;
}

export function generatePartialRefundReviewEmail(data: PartialRefundReviewData): {
  subject: string;
  html: string;
} {
  const {
    userName,
    roomName,
    bookingDate,
    expectedAmount,
    refundedAmount,
    bookingId,
  } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${getHeader()}
    
    <div class="content">
      <h2>${EMAIL_TEMPLATES.partialRefundReview.greeting(userName)}</h2>
      
      <p>${EMAIL_TEMPLATES.partialRefundReview.intro}</p>
      
      <div class="info-box">
        <p><strong>Reserva em Análise</strong></p>
        <p>Código: ${bookingId.slice(0, 8).toUpperCase()}</p>
        <p>Consultório: ${roomName}</p>
        <p>Data original: ${formatDate(bookingDate)}</p>
      </div>
      
      <div class="details">
        <p><strong>Detalhes do Reembolso</strong></p>
        <p>Valor esperado: <strong>${formatCurrency(expectedAmount)}</strong></p>
        <p>Valor processado: <strong style="color: #d97706;">${formatCurrency(refundedAmount)}</strong></p>
        <p>Diferença: <strong>${formatCurrency(expectedAmount - refundedAmount)}</strong></p>
      </div>
      
      <div class="info-box gray">
        <p style="margin: 0; font-size: 14px;">
          Nossa equipe está analisando a situação e entrará em contato 
          em até 2 dias úteis para regularização.
        </p>
      </div>
      
      <p style="white-space: pre-line; margin-top: 24px;">
${EMAIL_TEMPLATES.partialRefundReview.footer}
      </p>
    </div>
    
    ${getFooter()}
  </div>
</body>
</html>
  `;

  return {
    subject: EMAIL_TEMPLATES.partialRefundReview.subject,
    html,
  };
}
