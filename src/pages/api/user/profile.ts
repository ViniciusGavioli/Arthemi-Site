// ===========================================================
// API: GET/PUT /api/user/profile - Perfil do usuário
// ===========================================================
// GET  - Retorna dados do perfil (autenticação via JWT)
// PUT  - Atualiza dados do perfil (nome, telefone, CPF)
//
// Autenticação: Cookie JWT (arthemi_session)

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { getUserCreditsSummary } from '@/lib/business-rules';
import { validateCPF, brazilianPhone } from '@/lib/validations';
import { logAudit } from '@/lib/audit';

// ===========================================================
// TIPOS
// ===========================================================

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  emailNotifications: boolean;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  user?: UserData;
  credits?: {
    total: number;
    byRoom: { roomId: string | null; roomName: string; amount: number; tier: number | null }[];
  };
  stats?: {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
  };
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ===========================================================
// SCHEMA DE VALIDAÇÃO (PUT)
// ===========================================================

const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .optional(),
  phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const digits = val.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) return false;
      const ddd = parseInt(digits.slice(0, 2));
      if (ddd < 11 || ddd > 99) return false;
      if (digits.length === 11 && digits[2] !== '9') return false;
      return true;
    }, {
      message: 'Telefone inválido. Use o formato (XX) 9XXXX-XXXX',
    }),
  cpf: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return validateCPF(val);
    }, {
      message: 'CPF inválido',
    }),
  emailNotifications: z.boolean().optional(),
});

// ===========================================================
// HANDLER PRINCIPAL
// ===========================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Apenas GET e PUT são permitidos
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  // Autenticação JWT obrigatória
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({
      success: false,
      error: 'Não autenticado',
    });
  }

  const userId = auth.userId;

  try {
    if (req.method === 'GET') {
      return await handleGet(userId, res);
    } else {
      return await handlePut(userId, req, res);
    }
  } catch (error) {
    console.error('❌ [PROFILE] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
}

// ===========================================================
// GET - Buscar perfil
// ===========================================================

async function handleGet(
  userId: string,
  res: NextApiResponse<ApiResponse>
) {
  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Usuário não encontrado',
    });
  }

  // Buscar créditos
  const credits = await getUserCreditsSummary(userId);

  // Estatísticas de reservas
  const now = new Date();
  const [totalBookings, upcomingBookings, completedBookings] = await Promise.all([
    prisma.booking.count({
      where: { userId },
    }),
    prisma.booking.count({
      where: {
        userId,
        startTime: { gt: now },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: 'COMPLETED',
      },
    }),
  ]);

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf,
      emailNotifications: true, // TODO: Adicionar campo no schema quando necessário
      createdAt: user.createdAt.toISOString(),
    },
    credits,
    stats: {
      totalBookings,
      upcomingBookings,
      completedBookings,
    },
  });
}

// ===========================================================
// PUT - Atualizar perfil
// ===========================================================

async function handlePut(
  userId: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Validar body
  const parsed = UpdateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.errors.forEach((err) => {
      const field = err.path[0];
      if (field && typeof field === 'string') {
        fieldErrors[field] = err.message;
      }
    });

    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      fieldErrors,
    });
  }

  const { name, phone, cpf, emailNotifications } = parsed.data;

  // Verificar se há algo para atualizar
  if (!name && !phone && !cpf && emailNotifications === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum dado para atualizar',
    });
  }

  // Buscar usuário atual
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    return res.status(404).json({
      success: false,
      error: 'Usuário não encontrado',
    });
  }

  // Verificar se telefone já está em uso por outro usuário
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '');
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: phoneDigits,
        id: { not: userId },
      },
    });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'Telefone já está em uso por outro usuário',
        fieldErrors: { phone: 'Telefone já cadastrado' },
      });
    }
  }

  // Verificar se CPF já está em uso por outro usuário
  if (cpf) {
    const cpfDigits = cpf.replace(/\D/g, '');
    const existingCpf = await prisma.user.findFirst({
      where: {
        cpf: cpfDigits,
        id: { not: userId },
      },
    });

    if (existingCpf) {
      return res.status(400).json({
        success: false,
        error: 'CPF já está em uso por outro usuário',
        fieldErrors: { cpf: 'CPF já cadastrado' },
      });
    }
  }

  // Montar dados para atualização
  const updateData: {
    name?: string;
    phone?: string;
    cpf?: string;
  } = {};

  if (name) updateData.name = name.trim();
  if (phone) updateData.phone = phone.replace(/\D/g, '');
  if (cpf) updateData.cpf = cpf.replace(/\D/g, '');

  // Atualizar usuário
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  // Log de auditoria
  try {
    await logAudit({
      action: 'USER_PROFILE_UPDATE',
      source: 'USER',
      actorId: userId,
      actorIp: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      targetType: 'User',
      targetId: userId,
      metadata: {
        updatedFields: Object.keys(updateData),
        previousValues: {
          name: currentUser.name,
          phone: currentUser.phone,
          cpf: currentUser.cpf,
        },
        newValues: updateData,
      },
    });
  } catch (auditError) {
    console.error('❌ [PROFILE] Erro ao gravar audit (não bloqueia):', auditError);
  }

  console.log(`✅ [PROFILE] Perfil atualizado para user ${userId}`);

  return res.status(200).json({
    success: true,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      cpf: updatedUser.cpf,
      emailNotifications: true,
      createdAt: updatedUser.createdAt.toISOString(),
    },
  });
}

// ===========================================================
// HELPER: Obter IP do cliente
// ===========================================================

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
