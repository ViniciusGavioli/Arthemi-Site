// ===========================================================
// API: POST /api/webhooks/mercadopago
// ===========================================================
// Redireciona para o handler principal de webhook
// MercadoPago espera essa URL específica

import handler from '../payments/webhook';

export default handler;
