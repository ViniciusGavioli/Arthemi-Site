// ===========================================================
// API: POST /api/meta/context
// ===========================================================
// Recebe contexto do cliente para eventos Meta (fbp, fbc, IP, UA)
// Usado para correlacionar eventos Pixel (client) com CAPI (server)
//
// CHAMADO PELO CLIENT quando:
// - InitiateCheckout é disparado
// - Lead é capturado
// - Booking é iniciado
//
// O contexto é salvo e usado posteriormente pelo webhook para
// enviar Purchase/Schedule com os mesmos dados de deduplicação

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { generateServerEventId } from '@/lib/meta/capi';

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const contextSchema = z.object({
  eventId: z.string().uuid().optional(),  // Se não fornecido, geramos
  eventName: z.enum(['Purchase', 'Schedule', 'Lead', 'InitiateCheckout']),
  entityType: z.enum(['Booking', 'Credit']),
  entityId: z.string().min(1),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = generateRequestId();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  try {
    // Validar payload
    const validation = contextSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;

    // Capturar IP e User-Agent do request
    const clientIp = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      undefined;

    const userAgent = req.headers['user-agent'] || undefined;

    // Gerar eventId se não fornecido
    const eventId = data.eventId || generateServerEventId();

    // Upsert: criar ou atualizar contexto
    // Usa unique constraint (eventName, entityType, entityId)
    const context = await prisma.metaEventContext.upsert({
      where: {
        eventName_entityType_entityId: {
          eventName: data.eventName,
          entityType: data.entityType,
          entityId: data.entityId,
        },
      },
      create: {
        eventId,
        eventName: data.eventName,
        entityType: data.entityType,
        entityId: data.entityId,
        fbp: data.fbp,
        fbc: data.fbc,
        clientIp,
        userAgent,
        sourceUrl: data.sourceUrl,
      },
      update: {
        // Atualiza apenas se novos valores foram fornecidos
        ...(data.fbp && { fbp: data.fbp }),
        ...(data.fbc && { fbc: data.fbc }),
        ...(clientIp && { clientIp }),
        ...(userAgent && { userAgent }),
        ...(data.sourceUrl && { sourceUrl: data.sourceUrl }),
        // Não atualiza eventId se já existir (mantém o original)
      },
    });

    console.log(`📊 [META] Context saved`, {
      requestId,
      eventName: data.eventName,
      entityType: data.entityType,
      entityId: data.entityId,
      eventId: context.eventId,
      hasFbp: !!context.fbp,
      hasFbc: !!context.fbc,
    });

    return res.status(200).json({
      success: true,
      eventId: context.eventId,
    });

  } catch (error) {
    console.error(`❌ [META] Context error`, {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Não falhar o fluxo principal por erro de tracking
    // Retorna sucesso parcial
    return res.status(200).json({
      success: true,
      partial: true,
      error: 'Context save failed (non-blocking)',
    });
  }
}
