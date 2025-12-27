// ===========================================================
// API: /api/admin/settings - Gerenciar configurações do sistema
// ===========================================================
// GET: Listar configurações por categoria
// PUT: Atualizar configurações

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// Configurações padrão (criadas automaticamente se não existirem)
const DEFAULT_SETTINGS = [
  {
    key: 'META_PIXEL_ID',
    value: '',
    type: 'string',
    category: 'marketing',
    description: 'ID do Meta Pixel (Facebook/Instagram)',
    isActive: false,
  },
  {
    key: 'GA_MEASUREMENT_ID',
    value: '',
    type: 'string',
    category: 'marketing',
    description: 'ID de medição do Google Analytics 4',
    isActive: false,
  },
  {
    key: 'GTM_ID',
    value: '',
    type: 'string',
    category: 'marketing',
    description: 'ID do Google Tag Manager',
    isActive: false,
  },
];

interface ApiResponse {
  success: boolean;
  settings?: Record<string, { value: string; isActive: boolean; description?: string }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Verificar autenticação admin (cookie já verificado pelo middleware)
  
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    } else if (req.method === 'PUT') {
      return await handlePut(req, res);
    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).json({ success: false, error: 'Método não permitido' });
    }
  } catch (error) {
    console.error('[SETTINGS] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

// GET: Listar configurações
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { category } = req.query;

  // Garantir que configurações padrão existam
  await ensureDefaultSettings();

  // Buscar configurações
  const whereClause = category ? { category: String(category) } : {};
  const settings = await prisma.setting.findMany({
    where: whereClause,
    orderBy: { key: 'asc' },
  });

  // Transformar em objeto key-value
  const settingsMap: Record<string, { value: string; isActive: boolean; description?: string }> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = {
      value: setting.value,
      isActive: setting.isActive,
      description: setting.description || undefined,
    };
  }

  return res.status(200).json({ success: true, settings: settingsMap });
}

// PUT: Atualizar configurações
async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const updates = req.body as Record<string, { value?: string; isActive?: boolean }>;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: 'Dados inválidos' });
  }

  // Validar e sanitizar inputs
  const validKeys = DEFAULT_SETTINGS.map(s => s.key);
  const sanitizedUpdates: { key: string; value?: string; isActive?: boolean }[] = [];

  for (const [key, data] of Object.entries(updates)) {
    if (!validKeys.includes(key)) continue;
    
    // Sanitizar valor (remover caracteres perigosos)
    const sanitizedValue = typeof data.value === 'string' 
      ? data.value.trim().replace(/[<>"'&]/g, '')
      : undefined;

    sanitizedUpdates.push({
      key,
      value: sanitizedValue,
      isActive: typeof data.isActive === 'boolean' ? data.isActive : undefined,
    });
  }

  // Atualizar no banco
  for (const update of sanitizedUpdates) {
    await prisma.setting.upsert({
      where: { key: update.key },
      create: {
        key: update.key,
        value: update.value || '',
        isActive: update.isActive ?? false,
        type: 'string',
        category: 'marketing',
      },
      update: {
        ...(update.value !== undefined && { value: update.value }),
        ...(update.isActive !== undefined && { isActive: update.isActive }),
        updatedAt: new Date(),
      },
    });
  }

  // Log de auditoria
  await logAudit({
    action: 'ADMIN_BOOKING_UPDATE', // Reutilizando action existente
    source: 'ADMIN',
    actorEmail: 'admin',
    actorIp: getClientIp(req),
    targetType: 'Setting',
    targetId: 'marketing',
    metadata: { 
      updates: sanitizedUpdates.map(u => u.key),
    },
  });

  return res.status(200).json({ success: true });
}

// Garantir que configurações padrão existam
async function ensureDefaultSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {}, // Não atualiza se já existe
    });
  }
}

// Extrair IP do cliente
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
