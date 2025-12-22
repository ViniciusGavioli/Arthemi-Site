// ===========================================================
// Cliente Asaas
// ===========================================================
// Integração profissional com Asaas para PIX, Boleto e Cartão

import { env } from './env';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

function getAsaasApiUrl(): string {
  return process.env.ASAAS_SANDBOX === 'true'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';
}

function getApiKey(): string {
  return process.env.ASAAS_API_KEY || '';
}

/**
 * Verifica se está em modo mock (avaliado em runtime)
 */
export function isMockMode(): boolean {
  const apiKey = process.env.ASAAS_API_KEY || '';
  const mockModeEnv = process.env.ASAAS_MOCK_MODE;
  
  // Mock mode se: não tem API key OU ASAAS_MOCK_MODE está explicitamente 'true'
  return !apiKey || mockModeEnv === 'true';
}

// ============================================================
// TIPOS - CLIENTE
// ============================================================

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

// ============================================================
// TIPOS - COBRANÇA
// ============================================================

export type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

export interface CreatePaymentInput {
  customerId: string;
  value: number; // Em reais (ex: 70.00)
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference: string; // bookingId
  billingType: BillingType;
}

export interface AsaasPayment {
  id: string;
  dateCreated: string;
  customer: string;
  value: number;
  netValue: number;
  description: string;
  billingType: BillingType;
  status: AsaasPaymentStatus;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  externalReference: string;
  confirmedDate?: string;
  paymentDate?: string;
}

export type AsaasPaymentStatus =
  | 'PENDING'           // Aguardando pagamento
  | 'RECEIVED'          // Recebida (saldo já creditado)
  | 'CONFIRMED'         // Confirmada (aguardando crédito)
  | 'OVERDUE'           // Vencida
  | 'REFUNDED'          // Estornada
  | 'RECEIVED_IN_CASH'  // Recebida em dinheiro
  | 'REFUND_REQUESTED'  // Estorno solicitado
  | 'REFUND_IN_PROGRESS'// Estorno em processamento
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED' // Negativação solicitada
  | 'DUNNING_RECEIVED'  // Negativação recebida
  | 'AWAITING_RISK_ANALYSIS';

// ============================================================
// TIPOS - PIX
// ============================================================

export interface PixQrCode {
  encodedImage: string; // Base64 da imagem
  payload: string;      // Código copia e cola
  expirationDate: string;
}

// ============================================================
// TIPOS - WEBHOOK
// ============================================================

export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_UPDATED';

export interface AsaasWebhookPayload {
  id: string;
  event: AsaasWebhookEvent;
  dateCreated: string;
  payment: AsaasPayment;
}

// ============================================================
// HELPERS
// ============================================================

async function asaasRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (isMockMode()) {
    throw new Error('Asaas está em modo mock - configure ASAAS_API_KEY');
  }

  const apiKey = getApiKey();
  const apiUrl = getAsaasApiUrl();

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('❌ Asaas API Error:', {
      status: response.status,
      error,
    });
    throw new Error(
      error.errors?.[0]?.description ||
      `Erro Asaas: ${response.status}`
    );
  }

  return response.json();
}

// ============================================================
// CLIENTES
// ============================================================

/**
 * Cria ou busca cliente no Asaas
 */
export async function findOrCreateCustomer(
  input: CreateCustomerInput
): Promise<AsaasCustomer> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Criando cliente:', input);
    return {
      id: `cus_mock_${Date.now()}`,
      name: input.name,
      email: input.email,
      phone: input.phone,
    };
  }

  // Buscar por email primeiro
  const searchResult = await asaasRequest<{ data: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(input.email)}`
  );

  if (searchResult.data.length > 0) {
    console.log('✅ Cliente encontrado:', searchResult.data[0].id);
    return searchResult.data[0];
  }

  // Criar novo cliente
  const customer = await asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpfCnpj: input.cpfCnpj,
      notificationDisabled: false,
    }),
  });

  console.log('✅ Cliente criado:', customer.id);
  return customer;
}

// ============================================================
// COBRANÇAS
// ============================================================

/**
 * Cria uma cobrança no Asaas
 */
export async function createPayment(
  input: CreatePaymentInput
): Promise<AsaasPayment> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Criando cobrança:', input);
    const mockId = `pay_mock_${Date.now()}`;
    // Valor em reais para exibição (input.value já está em reais aqui)
    const amountInCents = Math.round(input.value * 100);
    return {
      id: mockId,
      dateCreated: new Date().toISOString(),
      customer: input.customerId,
      value: input.value,
      netValue: input.value * 0.97, // ~3% taxa
      description: input.description,
      billingType: input.billingType,
      status: 'PENDING',
      dueDate: input.dueDate,
      // CORREÇÃO: Incluir amount na URL do mock para exibição correta
      invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/mock-payment?id=${mockId}&booking=${input.externalReference}&amount=${amountInCents}`,
      externalReference: input.externalReference,
    };
  }

  const payment = await asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });

  console.log('✅ Cobrança criada:', payment.id);
  return payment;
}

/**
 * Busca detalhes de uma cobrança
 */
export async function getPayment(paymentId: string): Promise<AsaasPayment | null> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Buscando cobrança:', paymentId);
    return {
      id: paymentId,
      dateCreated: new Date().toISOString(),
      customer: 'cus_mock',
      value: 70,
      netValue: 67.9,
      description: 'Mock Payment',
      billingType: 'PIX',
      status: 'PENDING',
      dueDate: new Date().toISOString().split('T')[0],
      invoiceUrl: '#',
      externalReference: paymentId.replace('pay_mock_', ''),
    };
  }

  try {
    return await asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
  } catch {
    return null;
  }
}

/**
 * Busca cobrança por referência externa (bookingId)
 */
export async function getPaymentByExternalReference(
  externalReference: string
): Promise<AsaasPayment | null> {
  if (isMockMode()) {
    return null;
  }

  const result = await asaasRequest<{ data: AsaasPayment[] }>(
    `/payments?externalReference=${encodeURIComponent(externalReference)}`
  );

  return result.data[0] || null;
}

// ============================================================
// PIX
// ============================================================

/**
 * Obtém QR Code PIX de uma cobrança
 */
export async function getPixQrCode(paymentId: string): Promise<PixQrCode | null> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Gerando QR Code PIX:', paymentId);
    // Retorna um QR code mock (placeholder)
    return {
      encodedImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      payload: `00020126580014br.gov.bcb.pix0136${paymentId}520400005303986540570.005802BR5925ESPACO ARTHEMI SAUDE6009SAO PAULO62070503***6304MOCK`,
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  try {
    return await asaasRequest<PixQrCode>(`/payments/${paymentId}/pixQrCode`);
  } catch (error) {
    console.error('Erro ao obter QR Code PIX:', error);
    return null;
  }
}

// ============================================================
// ESTORNO
// ============================================================

/**
 * Estorna uma cobrança
 */
export async function refundPayment(
  paymentId: string,
  value?: number,
  description?: string
): Promise<boolean> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Estornando cobrança:', paymentId);
    return true;
  }

  try {
    await asaasRequest(`/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({
        value,
        description,
      }),
    });
    console.log('✅ Estorno solicitado:', paymentId);
    return true;
  } catch (error) {
    console.error('Erro ao estornar:', error);
    return false;
  }
}

// ============================================================
// CANCELAMENTO
// ============================================================

/**
 * Cancela/remove uma cobrança pendente
 */
export async function deletePayment(paymentId: string): Promise<boolean> {
  if (isMockMode()) {
    console.log('🎭 [MOCK] Cancelando cobrança:', paymentId);
    return true;
  }

  try {
    await asaasRequest(`/payments/${paymentId}`, {
      method: 'DELETE',
    });
    console.log('✅ Cobrança cancelada:', paymentId);
    return true;
  } catch (error) {
    console.error('Erro ao cancelar:', error);
    return false;
  }
}

// ============================================================
// WEBHOOK HELPERS
// ============================================================

/**
 * Valida token do webhook
 */
export function validateWebhookToken(token: string | null): boolean {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  
  // Se não configurou token, aceita qualquer um (não recomendado em produção)
  if (!expectedToken) {
    console.warn('⚠️ ASAAS_WEBHOOK_TOKEN não configurado - webhook não autenticado');
    return true;
  }
  
  return token === expectedToken;
}

/**
 * Verifica se o evento indica pagamento confirmado
 */
export function isPaymentConfirmed(event: AsaasWebhookEvent): boolean {
  return event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
}

/**
 * Verifica se o status indica pagamento confirmado
 */
export function isPaymentStatusConfirmed(status: AsaasPaymentStatus): boolean {
  return status === 'RECEIVED' || status === 'CONFIRMED';
}

// ============================================================
// TIPOS PARA INTEGRAÇÃO
// ============================================================

export interface CreateBookingPaymentInput {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  value: number; // Em centavos
  description: string;
  dueDate?: string;
}

export interface BookingPaymentResult {
  paymentId: string;
  invoiceUrl: string;
  pixQrCode?: PixQrCode;
  status: AsaasPaymentStatus;
}

/**
 * Cria cobrança PIX para uma reserva
 * Função de alto nível que abstrai cliente + cobrança + QR Code
 */
export async function createBookingPayment(
  input: CreateBookingPaymentInput
): Promise<BookingPaymentResult> {
  // 1. Criar/buscar cliente
  const customer = await findOrCreateCustomer({
    name: input.customerName,
    email: input.customerEmail,
    phone: input.customerPhone,
  });

  // 2. Calcular data de vencimento (hoje + 1 dia se não especificado)
  const dueDate = input.dueDate || 
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 3. Criar cobrança PIX
  const payment = await createPayment({
    customerId: customer.id,
    value: input.value / 100, // Converter centavos para reais
    dueDate,
    description: input.description,
    externalReference: input.bookingId,
    billingType: 'PIX',
  });

  // 4. Obter QR Code PIX
  const pixQrCode = await getPixQrCode(payment.id);

  return {
    paymentId: payment.id,
    invoiceUrl: payment.invoiceUrl,
    pixQrCode: pixQrCode || undefined,
    status: payment.status,
  };
}
