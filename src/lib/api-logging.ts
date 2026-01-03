/**
 * API Logging - Wrapper para logging padronizado de API routes
 * 
 * Funcionalidades:
 * - Log de início/fim de request
 * - Duração em ms
 * - statusCode, method, path
 * - requestId (correlation)
 * - userId quando disponível
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateRequestId, REQUEST_ID_HEADER } from './request-id';
import { getAuthFromRequest } from './auth';

export interface ApiLoggingOptions {
  /** Nome do endpoint para logs */
  name?: string;
  /** Se deve logar request body (cuidado com dados sensíveis) */
  logBody?: boolean;
}

export interface ApiContext {
  requestId: string;
  startTime: number;
}

/**
 * Wrapper que adiciona logging padronizado a um API handler.
 * 
 * @example
 * export default withApiLogging(handler, { name: 'bookings' });
 */
export function withApiLogging<T = unknown>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>, ctx: ApiContext) => Promise<void> | void,
  options: ApiLoggingOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const method = req.method || 'UNKNOWN';
    const path = req.url || '/';
    const name = options.name || path;

    // Setar header de resposta com requestId
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Tentar obter userId da sessão
    let userId: string | undefined;
    try {
      const auth = getAuthFromRequest(req);
      userId = auth?.userId;
    } catch {
      // Silenciar - auth opcional
    }

    // Log de início
    console.log(`[API] ${method} ${name} START`, JSON.stringify({
      requestId,
      userId: userId || null,
      ip: getClientIp(req),
    }));

    // Interceptar res.end para capturar statusCode
    const originalEnd = res.end.bind(res);
    let statusCode = 200;

    res.end = function(...args: Parameters<typeof originalEnd>) {
      statusCode = res.statusCode;
      return originalEnd(...args);
    } as typeof res.end;

    try {
      // Executar handler com contexto
      await handler(req, res, { requestId, startTime });
    } catch (error) {
      // Log de erro
      const duration = Date.now() - startTime;
      console.error(`[API] ${method} ${name} ERROR`, JSON.stringify({
        requestId,
        userId: userId || null,
        duration,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    } finally {
      // Log de fim
      const duration = Date.now() - startTime;
      console.log(`[API] ${method} ${name} END`, JSON.stringify({
        requestId,
        userId: userId || null,
        statusCode: res.statusCode,
        duration,
      }));
    }
  };
}

/**
 * Extrai IP do cliente
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  return req.socket?.remoteAddress || 'unknown';
}
