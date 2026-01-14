// ===========================================================
// API: POST /api/coupons/validate
// ===========================================================
// Preview de cupom - NÃO registra uso, apenas calcula desconto
// Usado pela UI para mostrar desconto antes do pagamento

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { isValidCoupon, getCouponInfo, applyDiscount } from '@/lib/coupons';

// Rate limit simples in-memory (20 req/min por IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Limpar entradas antigas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000);

// Schema de validação
const validateSchema = z.object({
  code: z.string().min(1, 'Código do cupom é obrigatório'),
  grossAmount: z.number().int().positive('Valor deve ser positivo'),
  productId: z.string().optional(),
});

export type ValidateCouponResponse = {
  valid: boolean;
  code: string;
  grossAmount: number;
  discountAmount?: number;
  netAmount?: number;
  discountDescription?: string;
  reason?: 'INVALID' | 'EXPIRED' | 'MIN_AMOUNT' | 'LIMIT' | 'INACTIVE';
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidateCouponResponse | { error: string }>
) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
             req.socket.remoteAddress || 
             'unknown';
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
  }

  try {
    // Parse e validação
    const parsed = validateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        valid: false,
        code: req.body?.code || '',
        grossAmount: req.body?.grossAmount || 0,
        reason: 'INVALID',
        message: parsed.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    const { code, grossAmount } = parsed.data;
    const normalizedCode = code.toUpperCase().trim();

    // Verificar se cupom existe
    if (!isValidCoupon(normalizedCode)) {
      return res.status(400).json({
        valid: false,
        code: normalizedCode,
        grossAmount,
        reason: 'INVALID',
        message: 'Cupom inválido ou inexistente.',
      });
    }

    // Obter info do cupom
    const couponInfo = getCouponInfo(normalizedCode);
    if (!couponInfo) {
      return res.status(400).json({
        valid: false,
        code: normalizedCode,
        grossAmount,
        reason: 'INVALID',
        message: 'Cupom não encontrado.',
      });
    }

    // Calcular desconto
    const { finalAmount, discountAmount, couponApplied } = applyDiscount(grossAmount, normalizedCode);

    if (!couponApplied || discountAmount === 0) {
      return res.status(400).json({
        valid: false,
        code: normalizedCode,
        grossAmount,
        reason: 'INACTIVE',
        message: 'Cupom não aplicável para este valor.',
      });
    }

    // Sucesso - retornar preview
    return res.status(200).json({
      valid: true,
      code: normalizedCode,
      grossAmount,
      discountAmount,
      netAmount: finalAmount,
      discountDescription: couponInfo.description,
      message: `Cupom ${normalizedCode} aplicado! Desconto de ${formatCurrency(discountAmount)}.`,
    });

  } catch (error) {
    console.error('[API] /api/coupons/validate error:', error);
    return res.status(500).json({ error: 'Erro interno ao validar cupom.' });
  }
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
