// ===========================================================
// ERROR CODES - Códigos tipados para erros de negócio
// ===========================================================

/**
 * Códigos de erro de negócio - NUNCA devem virar 500
 * Estes códigos são usados pelo frontend para tomar decisões
 */
export const BusinessErrorCode = {
  // ========== CUPOM (400) ==========
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_ALREADY_USED: 'COUPON_ALREADY_USED',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  
  // ========== CRÉDITOS (400/409) ==========
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  CREDIT_CONSUMED_BY_ANOTHER: 'CREDIT_CONSUMED_BY_ANOTHER',
  CREDIT_EXPIRED: 'CREDIT_EXPIRED',
  
  // ========== RESERVA (400/409) ==========
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  BOOKING_OUTSIDE_HOURS: 'BOOKING_OUTSIDE_HOURS',
  BOOKING_WINDOW_EXCEEDED: 'BOOKING_WINDOW_EXCEEDED',
  INSUFFICIENT_TIME: 'INSUFFICIENT_TIME',
  
  // ========== PAGAMENTO (400) ==========
  PAYMENT_MIN_AMOUNT: 'PAYMENT_MIN_AMOUNT',
  PAYMENT_CREATION_FAILED: 'PAYMENT_CREATION_FAILED',
  PRICING_ERROR: 'PRICING_ERROR',
  
  // ========== AUTENTICAÇÃO/AUTORIZAÇÃO (401/403) ==========
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // ========== VALIDAÇÃO (400) ==========
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CPF: 'INVALID_CPF',
  INVALID_PHONE: 'INVALID_PHONE',
  
  // ========== RECURSOS (404/409) ==========
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // ========== RATE LIMIT (429) ==========
  RATE_LIMITED: 'RATE_LIMITED',
  
  // ========== INTERNO (500) - Apenas para erros reais ==========
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type BusinessErrorCode = typeof BusinessErrorCode[keyof typeof BusinessErrorCode];

/**
 * Mapeamento de código para status HTTP
 */
export const ErrorCodeToStatus: Record<BusinessErrorCode, number> = {
  // 400 - Bad Request
  [BusinessErrorCode.COUPON_INVALID]: 400,
  [BusinessErrorCode.COUPON_ALREADY_USED]: 400,
  [BusinessErrorCode.COUPON_EXPIRED]: 400,
  [BusinessErrorCode.INSUFFICIENT_CREDITS]: 400,
  [BusinessErrorCode.CREDIT_EXPIRED]: 400,
  [BusinessErrorCode.BOOKING_OUTSIDE_HOURS]: 400,
  [BusinessErrorCode.BOOKING_WINDOW_EXCEEDED]: 400,
  [BusinessErrorCode.INSUFFICIENT_TIME]: 400,
  [BusinessErrorCode.PAYMENT_MIN_AMOUNT]: 400,
  [BusinessErrorCode.PRICING_ERROR]: 400,
  [BusinessErrorCode.VALIDATION_ERROR]: 400,
  [BusinessErrorCode.INVALID_CPF]: 400,
  [BusinessErrorCode.INVALID_PHONE]: 400,
  
  // 401 - Unauthorized
  [BusinessErrorCode.UNAUTHORIZED]: 401,
  
  // 403 - Forbidden
  [BusinessErrorCode.EMAIL_NOT_VERIFIED]: 403,
  [BusinessErrorCode.FORBIDDEN]: 403,
  
  // 404 - Not Found
  [BusinessErrorCode.NOT_FOUND]: 404,
  
  // 409 - Conflict
  [BusinessErrorCode.BOOKING_CONFLICT]: 409,
  [BusinessErrorCode.CREDIT_CONSUMED_BY_ANOTHER]: 409,
  [BusinessErrorCode.CONFLICT]: 409,
  [BusinessErrorCode.DUPLICATE_ENTRY]: 409,
  [BusinessErrorCode.PAYMENT_CREATION_FAILED]: 409,
  
  // 429 - Too Many Requests
  [BusinessErrorCode.RATE_LIMITED]: 429,
  
  // 500 - Internal Server Error
  [BusinessErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Mensagens padrão por código (pode ser sobrescrita)
 */
export const DefaultErrorMessages: Record<BusinessErrorCode, string> = {
  [BusinessErrorCode.COUPON_INVALID]: 'Cupom inválido ou não encontrado.',
  [BusinessErrorCode.COUPON_ALREADY_USED]: 'Este cupom já foi utilizado.',
  [BusinessErrorCode.COUPON_EXPIRED]: 'Este cupom expirou.',
  [BusinessErrorCode.INSUFFICIENT_CREDITS]: 'Saldo de créditos insuficiente.',
  [BusinessErrorCode.CREDIT_CONSUMED_BY_ANOTHER]: 'Créditos foram consumidos por outra operação.',
  [BusinessErrorCode.CREDIT_EXPIRED]: 'Créditos expirados.',
  [BusinessErrorCode.BOOKING_CONFLICT]: 'Horário não disponível. Já existe uma reserva neste período.',
  [BusinessErrorCode.BOOKING_OUTSIDE_HOURS]: 'Horário fora do expediente.',
  [BusinessErrorCode.BOOKING_WINDOW_EXCEEDED]: 'Data fora da janela de reserva permitida.',
  [BusinessErrorCode.INSUFFICIENT_TIME]: 'Reservas precisam ser feitas com antecedência mínima.',
  [BusinessErrorCode.PAYMENT_MIN_AMOUNT]: 'Valor abaixo do mínimo permitido para pagamento.',
  [BusinessErrorCode.PAYMENT_CREATION_FAILED]: 'Erro ao processar pagamento.',
  [BusinessErrorCode.PRICING_ERROR]: 'Erro ao calcular preço.',
  [BusinessErrorCode.EMAIL_NOT_VERIFIED]: 'Você precisa verificar seu e-mail.',
  [BusinessErrorCode.UNAUTHORIZED]: 'Autenticação necessária.',
  [BusinessErrorCode.FORBIDDEN]: 'Acesso negado.',
  [BusinessErrorCode.VALIDATION_ERROR]: 'Dados inválidos.',
  [BusinessErrorCode.INVALID_CPF]: 'CPF inválido.',
  [BusinessErrorCode.INVALID_PHONE]: 'Telefone inválido.',
  [BusinessErrorCode.NOT_FOUND]: 'Recurso não encontrado.',
  [BusinessErrorCode.CONFLICT]: 'Conflito com operação existente.',
  [BusinessErrorCode.DUPLICATE_ENTRY]: 'Registro duplicado.',
  [BusinessErrorCode.RATE_LIMITED]: 'Muitas tentativas. Aguarde e tente novamente.',
  [BusinessErrorCode.INTERNAL_ERROR]: 'Erro interno. Tente novamente.',
};
