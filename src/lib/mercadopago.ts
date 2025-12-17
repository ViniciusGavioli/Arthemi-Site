// ===========================================================
// Cliente MercadoPago
// ===========================================================
// Integração com MercadoPago ou modo mock se não houver token

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const mockMode = process.env.MOCK_PAYMENTS === 'true' || !accessToken;

/**
 * Verifica se está em modo mock
 */
export function isMockMode(): boolean {
  return mockMode;
}

// Configuração do cliente (só inicializa se tiver token)
let client: MercadoPagoConfig | null = null;
if (accessToken && !mockMode) {
  client = new MercadoPagoConfig({ accessToken });
}

// ---- Tipos ----

interface PreferenceItem {
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  bookingId: string;
}

export interface CreatePreferenceInput {
  bookingId: string;
  title: string;
  description: string;
  unitPrice: number; // Em centavos
  quantity: number;
  buyerEmail: string;
  buyerName: string;
}

export interface PreferenceResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface PaymentNotification {
  id: string;
  status: string;
  externalReference: string;
  transactionAmount: number;
  paymentMethodId: string;
}

// ---- Funções ----

/**
 * Cria preferência de pagamento no MercadoPago
 * Em modo mock, retorna dados simulados
 */
export async function createPaymentPreference(
  input: CreatePreferenceInput
): Promise<PreferenceResponse> {
  if (mockMode) {
    console.log('🎭 [MOCK] Criando preferência de pagamento:', input);
    
    // Simula resposta do MercadoPago
    const mockId = `MOCK_PREF_${Date.now()}`;
    return {
      id: mockId,
      initPoint: `${process.env.NEXT_PUBLIC_APP_URL}/mock-payment?pref=${mockId}&booking=${input.bookingId}`,
      sandboxInitPoint: `${process.env.NEXT_PUBLIC_APP_URL}/mock-payment?pref=${mockId}&booking=${input.bookingId}`,
    };
  }

  if (!client) {
    throw new Error('MercadoPago não configurado');
  }

  const preference = new Preference(client);
  
  const response = await preference.create({
    body: {
      items: [
        {
          id: input.bookingId,
          title: input.title,
          description: input.description,
          unit_price: input.unitPrice / 100, // MP espera em reais
          quantity: input.quantity,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: input.buyerEmail,
        name: input.buyerName,
      },
      external_reference: input.bookingId,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/booking/success?booking=${input.bookingId}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/booking/failure?booking=${input.bookingId}`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/booking/pending?booking=${input.bookingId}`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
    },
  });

  return {
    id: response.id!,
    initPoint: response.init_point!,
    sandboxInitPoint: response.sandbox_init_point!,
  };
}

/**
 * Busca detalhes de um pagamento no MercadoPago
 */
export async function getPaymentDetails(paymentId: string): Promise<PaymentNotification | null> {
  if (mockMode) {
    console.log('🎭 [MOCK] Buscando pagamento:', paymentId);
    
    // Simula pagamento aprovado
    return {
      id: paymentId,
      status: 'approved',
      externalReference: paymentId.replace('MOCK_PAY_', ''),
      transactionAmount: 7000, // R$ 70,00
      paymentMethodId: 'pix_mock',
    };
  }

  if (!client) {
    throw new Error('MercadoPago não configurado');
  }

  const payment = new Payment(client);
  const response = await payment.get({ id: paymentId });

  if (!response) return null;

  return {
    id: String(response.id),
    status: response.status || 'unknown',
    externalReference: response.external_reference || '',
    transactionAmount: (response.transaction_amount || 0) * 100, // Converte para centavos
    paymentMethodId: response.payment_method_id || '',
  };
}

/**
 * Processa notificação de webhook do MercadoPago
 */
export async function processWebhookNotification(
  type: string,
  dataId: string
): Promise<PaymentNotification | null> {
  if (type !== 'payment') {
    console.log(`[MP Webhook] Ignorando notificação do tipo: ${type}`);
    return null;
  }

  return getPaymentDetails(dataId);
}

/**
 * Verifica se está em modo mock
 */
export function isInMockMode(): boolean {
  return mockMode;
}

/**
 * Cria preferência simplificada (usado pelo endpoint create.ts)
 */
export async function createPreference(item: PreferenceItem): Promise<{
  id: string;
  init_point: string;
  sandbox_init_point: string;
}> {
  if (mockMode) {
    const mockId = `mock_pref_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    return {
      id: mockId,
      init_point: `${baseUrl}/mock-payment?pref=${mockId}&booking=${item.bookingId}`,
      sandbox_init_point: `${baseUrl}/mock-payment?pref=${mockId}&booking=${item.bookingId}`,
    };
  }

  if (!client) {
    throw new Error('MercadoPago não configurado');
  }

  const preference = new Preference(client);
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  const response = await preference.create({
    body: {
      items: [
        {
          id: item.bookingId,
          title: item.title,
          description: item.description,
          unit_price: item.unit_price,
          quantity: item.quantity,
          currency_id: 'BRL',
        },
      ],
      external_reference: item.bookingId,
      back_urls: {
        success: `${baseUrl}/booking/success?booking=${item.bookingId}`,
        failure: `${baseUrl}/booking/failure?booking=${item.bookingId}`,
        pending: `${baseUrl}/booking/pending?booking=${item.bookingId}`,
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/payments/webhook`,
    },
  });

  return {
    id: response.id!,
    init_point: response.init_point!,
    sandbox_init_point: response.sandbox_init_point!,
  };
}

/**
 * Busca informações de pagamento pelo ID (usado pelo webhook)
 */
export async function getPaymentInfo(paymentId: string): Promise<{
  status: string;
  external_reference: string;
  payment_method_id: string;
} | null> {
  if (mockMode) {
    return {
      status: 'approved',
      external_reference: '',
      payment_method_id: 'mock',
    };
  }

  if (!client) {
    throw new Error('MercadoPago não configurado');
  }

  const payment = new Payment(client);
  const response = await payment.get({ id: paymentId });

  if (!response) return null;

  return {
    status: response.status || 'unknown',
    external_reference: response.external_reference || '',
    payment_method_id: response.payment_method_id || '',
  };
}
