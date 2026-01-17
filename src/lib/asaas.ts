// ===========================================================
// Cliente Asaas
// ===========================================================
// Integração profissional com Asaas para PIX, Boleto e Cartão

import { env } from './env';

import { timingSafeEqual } from 'crypto';
import rateLimiter from './asaas-limiter';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

function getAsaasApiUrl(): string {
  return process.env.ASAAS_SANDBOX === 'true'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';
}

function getApiKey(): string {
  return process.env.ASAAS_API_KEY || '';
}

/**
 * Verifica se está em modo mock (avaliado em runtime)
 * 
 * REGRA FINAL:
 * - PRODUÇÃO + API KEY VÁLIDA = SEMPRE ASAAS REAL (ignora todas as flags)
 * - DEV = mock por padrão
 */
export function isMockMode(): boolean {
  const apiKey = process.env.ASAAS_API_KEY || '';
  const isProduction = process.env.NODE_ENV === 'production';
  const hasValidKey = apiKey.startsWith('$aact_');
  
  // PRODUÇÃO: Se tem API key válida, NUNCA é mock
  // Ignora ASAAS_MOCK_MODE, MOCK_PAYMENTS, qualquer flag
  if (isProduction && hasValidKey) {
    console.log('🟢 [Asaas] Modo PRODUÇÃO - API real ativa');
    return false;
  }
  
  // Sem API key válida = sempre mock
  if (!hasValidKey) {
    console.log('🟡 [Asaas] Modo MOCK - API key inválida ou ausente');
    return true;
  }
  
  // DEV com API key: mock por padrão (para não cobrar durante desenvolvimento)
  const mockModeEnv = process.env.ASAAS_MOCK_MODE;
  return mockModeEnv !== 'false';
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
  // Parcelamento (apenas para CREDIT_CARD)
  installmentCount?: number; // 2-12 parcelas
  installmentValue?: number; // Valor de cada parcela em reais
  maxInstallmentCount?: number; // Máximo de parcelas permitidas
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
  // Campos de refund (preenchidos em eventos de estorno)
  refundedValue?: number;        // Valor efetivamente estornado (pode ser parcial)
  chargebackValue?: number;      // Valor do chargeback (quando aplicável)
  maxInstallmentCount?: number; // Máximo de parcelas permitidas
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
  | 'PAYMENT_UPDATED'
  // Eventos de cartão - captura recusada
  | 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
  // Eventos de chargeback (cartão)
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL';

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
  await rateLimiter.acquireToken();

  if (isMockMode()) {
    throw new Error('Asaas está em modo mock - configure ASAAS_API_KEY');
  }

  const apiKey = getApiKey();
  const apiUrl = getAsaasApiUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 segundos

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      signal: controller.signal, 
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey,
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // CRÍTICO: Ler o body do erro para diagnóstico
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => 'Unable to read response body');
      }
      
      console.error('❌ Asaas API Error:', {
        status: response?.status,
        endpoint,
        timestamp: new Date().toISOString(),
        errorBody, // ← AGORA TEMOS O ERRO REAL DO ASAAS
      });
      
      // Se for erro de validação, propagar mensagem específica
      const asaasError = errorBody as { errors?: Array<{ description?: string; code?: string }> };
      const errorMessage = asaasError?.errors?.[0]?.description || 'Erro na integração com gateway de pagamento';
      const errorCode = asaasError?.errors?.[0]?.code;
      
      // Criar erro com metadados para normalização
      const err = new Error(errorMessage) as Error & { asaasErrorBody?: unknown; asaasErrorCode?: string };
      err.asaasErrorBody = errorBody;
      err.asaasErrorCode = errorCode;
      throw err;
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout); // Limpar timeout mesmo em erro
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout na comunicação com Asaas (15s)');
    }
    
    throw error;
  }
}

// ============================================================
// NORMALIZAÇÃO DE ERROS ASAAS
// ============================================================

export interface NormalizedAsaasError {
  code: string;
  message: string;
  details?: {
    minAmountCents?: number;
    paymentMethod?: string;
    originalError?: string;
  };
}

/**
 * Normaliza erros do Asaas para códigos padronizados
 * Detecta erros de valor mínimo e outros erros comuns
 */
export function normalizeAsaasError(
  error: unknown,
  paymentMethod?: 'PIX' | 'CARD' | 'CREDIT_CARD' | 'BOLETO'
): NormalizedAsaasError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();
  
  // Detectar erro de valor mínimo
  // Asaas retorna mensagens específicas como:
  // - "O valor mínimo para cobrança via PIX é de R$ 1,00"
  // - "Minimum value for PIX is R$ 1.00"
  // Patterns ESPECÍFICOS para evitar falsos positivos
  const minAmountPatterns = [
    /valor\s*m[íi]nimo\s*(para|de|é)/i,           // "valor mínimo para/de/é"
    /minimum\s*value\s*(for|is)/i,                // "minimum value for/is"
    /value\s*must\s*be\s*at\s*least\s*\d/i,       // "value must be at least X" (com número)
    /valor.*abaixo\s*do\s*m[íi]nimo\s*permitido/i, // "valor abaixo do mínimo permitido"
  ];
  
  const isMinAmountError = minAmountPatterns.some(pattern => pattern.test(errorMessage));
  
  if (isMinAmountError) {
    // Extrair valor mínimo da mensagem se possível
    const valueMatch = errorMessage.match(/R\$\s*([\d,.]+)/);
    let minAmountCents = 100; // Default PIX
    
    if (valueMatch) {
      const valueStr = valueMatch[1].replace('.', '').replace(',', '.');
      minAmountCents = Math.round(parseFloat(valueStr) * 100);
    } else if (paymentMethod === 'CARD' || paymentMethod === 'CREDIT_CARD') {
      minAmountCents = 500; // R$ 5,00 para cartão
    } else if (paymentMethod === 'BOLETO') {
      minAmountCents = 500; // R$ 5,00 para boleto
    }
    
    return {
      code: 'PAYMENT_MIN_AMOUNT',
      message: 'Valor abaixo do mínimo permitido para este método de pagamento.',
      details: {
        minAmountCents,
        paymentMethod: paymentMethod || 'UNKNOWN',
        originalError: errorMessage,
      },
    };
  }
  
  // Detectar timeout
  if (errorLower.includes('timeout') || errorLower.includes('15s')) {
    return {
      code: 'PAYMENT_TIMEOUT',
      message: 'Tempo limite excedido ao processar pagamento. Tente novamente.',
      details: { originalError: errorMessage },
    };
  }
  
  // Detectar erro de cartão recusado
  if (errorLower.includes('recusad') || errorLower.includes('declined') || errorLower.includes('refused')) {
    return {
      code: 'PAYMENT_DECLINED',
      message: 'Pagamento recusado. Verifique os dados do cartão ou tente outro método.',
      details: { originalError: errorMessage },
    };
  }
  
  // Detectar erro de cliente inválido - patterns específicos
  // Evitar falsos positivos com "customer" ou "cliente" em contextos genéricos
  const customerErrorPatterns = [
    /customer\s*(not\s*found|invalid|inválido)/i,
    /cliente\s*(não\s*encontrado|inválido)/i,
    /cpf\s*(inválido|invalid)/i,
    /invalid\s*cpf/i,
  ];
  
  if (customerErrorPatterns.some(pattern => pattern.test(errorMessage))) {
    return {
      code: 'PAYMENT_CUSTOMER_ERROR',
      message: 'Erro nos dados do cliente. Verifique CPF e email.',
      details: { originalError: errorMessage },
    };
  }
  
  // Erro genérico
  return {
    code: 'PAYMENT_ERROR',
    message: 'Erro ao processar pagamento. Tente novamente.',
    details: { originalError: errorMessage },
  };
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
    const existingCustomer = searchResult.data[0];
    console.log('✅ Cliente encontrado:', existingCustomer.id);
    
    // FIX C: SEMPRE atualizar customer para desabilitar notificações do Asaas
    // Isso garante que nenhum cliente receba emails do Asaas, apenas nossos emails próprios
    // Atualização idempotente - segura para executar múltiplas vezes
    try {
      const updatePayload: Record<string, unknown> = {
        notificationDisabled: true,
      };
      
      // Se cliente existente não tem CPF mas input tem, atualizar também
      if (!existingCustomer.cpfCnpj && input.cpfCnpj) {
        updatePayload.cpfCnpj = input.cpfCnpj;
        console.log('🔄 Atualizando CPF do cliente:', existingCustomer.id);
      }
      
      const updatedCustomer = await asaasRequest<AsaasCustomer>(
        `/customers/${existingCustomer.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        }
      );
      console.log('✅ Cliente atualizado (notificationDisabled=true):', updatedCustomer.id);
      return updatedCustomer;
    } catch (updateError) {
      // Se falhar atualização, log mas retorna cliente existente (best-effort)
      console.warn('⚠️ Falha ao atualizar notificationDisabled do cliente:', updateError);
      return existingCustomer;
    }
  }

  // Criar novo cliente
  const customer = await asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpfCnpj: input.cpfCnpj,
      notificationDisabled: true,
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
      maxInstallmentCount: input.maxInstallmentCount || 1,
    };
  }

  const paymentPayload: Record<string, unknown> = {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
  };

  // Adicionar parcelamento se aplicável (apenas CREDIT_CARD com >= 2 parcelas)
  // NOTA: Não enviar installmentValue - deixar Asaas calcular para evitar problemas de arredondamento
  if (
    input.billingType === 'CREDIT_CARD' &&
    input.installmentCount &&
    input.installmentCount >= 2
  ) {
    paymentPayload.installmentCount = input.installmentCount;
    // installmentValue é calculado automaticamente pelo Asaas
  }

   if (input.billingType === 'CREDIT_CARD' && input.maxInstallmentCount) {
    paymentPayload.maxInstallmentCount = input.maxInstallmentCount;
    
    console.log('💳 Configurando parcelamento:', {
      maxInstallmentCount: input.maxInstallmentCount,
      value: input.value,
      minParcelaValue: input.value / input.maxInstallmentCount
    });
  }

  const payment = await asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(paymentPayload),
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
 * SEGURANÇA: Em produção, REJEITA se token não está configurado
 */
export function validateWebhookToken(token: string | null): boolean {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  const isMock = isMockMode();
  
  // Em produção SEM mock: token é OBRIGATÓRIO
  if (isProduction && !isMock && !expectedToken) {
    console.error('🚨 [SEGURANÇA] ASAAS_WEBHOOK_TOKEN não configurado em produção!');
    return false;
  }
  
  // Em desenvolvimento ou mock: aceita se não configurou (apenas warning)
  if (!expectedToken) {
    console.warn('⚠️ ASAAS_WEBHOOK_TOKEN não configurado - webhook não autenticado');
    return true;
  }
  
  // Token não fornecido
  if (!token) {
    return false;
  }
  
  // Validação real do token
  return safeCompare(token, expectedToken);
}


 /**
  * Comparação segura de strings para evitar timing attacks
  */
  export function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) return false;

    return timingSafeEqual(bufA, bufB);
  }

/**
 * Verifica se o evento indica pagamento confirmado
 */
export function isPaymentConfirmed(event: AsaasWebhookEvent): boolean {
  return event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
}

/**
 * Verifica se o evento indica estorno (refund)
 */
export function isRefundEvent(event: AsaasWebhookEvent): boolean {
  return event === 'PAYMENT_REFUNDED';
}

/**
 * Verifica se o evento indica chargeback
 */
export function isChargebackEvent(event: AsaasWebhookEvent): boolean {
  return (
    event === 'PAYMENT_CHARGEBACK_REQUESTED' ||
    event === 'PAYMENT_CHARGEBACK_DISPUTE' ||
    event === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  );
}

/**
 * Verifica se o evento indica captura de cartão recusada
 */
export function isCardCaptureRefused(event: AsaasWebhookEvent): boolean {
  return event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED';
}

/**
 * Verifica se o evento indica estorno ou chargeback (qualquer reversão)
 */
export function isPaymentRefundedOrChargeback(event: AsaasWebhookEvent): boolean {
  return isRefundEvent(event) || isChargebackEvent(event);
}

/**
 * Verifica se o status indica pagamento confirmado
 */
export function isPaymentStatusConfirmed(status: AsaasPaymentStatus): boolean {
  return status === 'RECEIVED' || status === 'CONFIRMED';
}

  // ============================================================
  // HELPERS DE CONVERSÃO DE MOEDA
  // ============================================================

  /**
   * Converte reais para centavos
   * @example realToCents(70.00) → 7000
   */
  export function realToCents(reais: number): number {
    return Math.round(reais * 100);
  }

  /**
   * Converte centavos para reais
   * @example centsToReal(7000) → 70.00
   */
  export function centsToReal(cents: number): number {
    return cents / 100;
  }

  /**
   * Formata valor para exibição
   * @example formatCurrency(7000) → "R$ 70,00"
   */
  export function formatCurrency(cents: number): string {
    const reais = centsToReal(cents);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(reais);
  }

// ============================================================
// TIPOS PARA INTEGRAÇÃO
// ============================================================

/**
 * Constrói externalReference sem duplicar prefixos
 * Se já tem prefixo (booking:, purchase:), usa como está
 * Caso contrário, adiciona 'booking:'
 */
function buildExternalReference(bookingId: string): string {
  if (bookingId.startsWith('booking:') || bookingId.startsWith('purchase:')) {
    return bookingId;
  }
  return `booking:${bookingId}`;
}

export interface CreateBookingPaymentInput {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string; // CPF obrigatório para Asaas
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
    cpfCnpj: input.customerCpf, // CPF obrigatório para Asaas
  });

  // 2. Calcular data de vencimento (hoje + 1 dia se não especificado)
  const dueDate = input.dueDate || 
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 3. Criar cobrança PIX
  const payment = await createPayment({
    customerId: customer.id,
    value: centsToReal(input.value), // Converter centavos para reais
    dueDate,
    description: input.description,
    externalReference: buildExternalReference(input.bookingId),
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

// ============================================================
// PAGAMENTO COM CARTÃO (Checkout Hospedado)
// ============================================================

export interface CreateBookingCardPaymentInput {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  value: number; // Em centavos
  description: string;
  dueDate?: string;
  installmentCount?: number; // 1 = à vista, 2-12 = parcelado
  maxInstallments?: number;
}

export interface CardPaymentResult {
  paymentId: string;
  invoiceUrl: string;
  status: AsaasPaymentStatus;
  installmentCount?: number;
  installmentValue?: number;
  maxInstallments: number;
}

/**
 * Cria cobrança por CARTÃO DE CRÉDITO para uma reserva
 * O pagamento é feito na página hospedada do Asaas (invoiceUrl)
 * NÃO captura dados do cartão no backend - checkout é 100% Asaas
 * 
 * Suporta parcelamento: installmentCount >= 2
 * Valor mínimo por parcela: R$ 5,00 (validado pelo Asaas)
 * 
 * @env ASAAS_CARD_BILLING_MODE - Se 'UNDEFINED', aceita débito e crédito (Asaas decide)
 */
export async function createBookingCardPayment(
  input: CreateBookingCardPaymentInput
): Promise<CardPaymentResult> {
  // 1. Criar/buscar cliente
  const customer = await findOrCreateCustomer({
    name: input.customerName,
    email: input.customerEmail,
    phone: input.customerPhone,
    cpfCnpj: input.customerCpf,
  });

  // 2. Calcular data de vencimento (hoje + 3 dias para cartão)
  const dueDate = input.dueDate || 
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 3. Converter valor
  const valueInReais = centsToReal(input.value);

  const maxInstallments = input.maxInstallments || 10;
  
  // 4. Billing type SEMPRE CREDIT_CARD para checkout hospedado
  // NOTA: UNDEFINED não funciona com /payments - causa erro 400
  // Para aceitar débito, use checkout transparente com tokenização
  const billingType: BillingType = 'CREDIT_CARD';
  
  // 5. Configurar parcelamento (>= 2 parcelas)
  const installmentCount = 
    input.installmentCount && input.installmentCount >= 2 
      ? input.installmentCount 
      : undefined;

  // 6. Validar valor mínimo por parcela (R$ 5,00)
  if (installmentCount) {
    const estimatedInstallmentValue = valueInReais / installmentCount;
    if (estimatedInstallmentValue < 5) {
      throw new Error(`Valor mínimo por parcela é R$ 5,00. Atual: R$ ${estimatedInstallmentValue.toFixed(2)}`);
    }
  }

  // 7. Criar cobrança (installmentValue calculado automaticamente pelo Asaas)
  const payment = await createPayment({
    customerId: customer.id,
    value: valueInReais,
    dueDate,
    description: input.description,
    externalReference: buildExternalReference(input.bookingId),
    billingType, // Sempre CREDIT_CARD
    maxInstallmentCount: maxInstallments,
    // NÃO enviar installmentValue - Asaas calcula automaticamente
  });

  console.log('💳 [Asaas] Cobrança CARTÃO criada:', payment.id, {
    billingType,
    installmentCount: installmentCount || 1,
    invoiceUrl: payment.invoiceUrl,
    maxInstallments,
  });

  return {
    paymentId: payment.id,
    invoiceUrl: payment.invoiceUrl,
    status: payment.status,
    installmentCount: installmentCount || 1,
    installmentValue: installmentCount ? valueInReais / installmentCount : valueInReais,
    maxInstallments,
  };
}
