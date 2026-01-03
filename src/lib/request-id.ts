/**
 * Request ID - Correlation ID para observabilidade
 * 
 * Gera um ID único por request para rastreamento em logs,
 * auditoria e debugging.
 */

/**
 * Gera um requestId único (formato: timestamp base36 + random)
 * Mais curto que UUID, mas ainda único o suficiente.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Header para retornar o requestId na resposta
 */
export const REQUEST_ID_HEADER = 'x-request-id';
