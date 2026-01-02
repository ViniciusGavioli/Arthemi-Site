// ===========================================================
// API: POST /api/auth/register
// ===========================================================
// Cria nova conta de cliente com email + senha
// 
// Input: { name, email, phone, password }
// Output: { ok: true } ou { error: string }

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/mailer';
import { logAudit } from '@/lib/audit';

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const RegisterSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.toLowerCase().trim()),
  phone: z
    .string()
    .min(10, 'Telefone inválido')
    .max(20, 'Telefone inválido')
    .transform((v) => v.replace(/\D/g, '')), // Remove não-numéricos
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(100, 'Senha muito longa'),
});

// ============================================================
// HELPER: Obter IP do cliente
// ============================================================

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar input
    const parseResult = RegisterSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message);
      return res.status(400).json({ 
        error: errors[0], 
        errors 
      });
    }

    const { name, email, phone, password } = parseResult.data;

    // Verificar se email já existe
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return res.status(409).json({ 
        error: 'Este email já está em uso' 
      });
    }

    // Verificar se telefone já existe
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (existingPhone) {
      return res.status(409).json({ 
        error: 'Este telefone já está em uso' 
      });
    }

    // Hash da senha
    const passwordHash = await hashPassword(password);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: 'CUSTOMER',
        isActive: true,
        failedAttempts: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Log de auditoria (não pode derrubar a rota)
    try {
      await logAudit({
        action: 'USER_REGISTER',
        source: 'USER',
        actorId: user.id,
        actorIp: getClientIp(req),
        userAgent: req.headers['user-agent'] as string,
        metadata: { email: user.email },
      });
    } catch (auditError) {
      console.error('❌ [REGISTER] Erro ao gravar audit (não bloqueia):', auditError);
    }

    // Enviar email de boas-vindas (async, não bloqueia resposta)
    sendWelcomeEmail(email, name).catch((err) => {
      console.error('❌ [REGISTER] Erro ao enviar email de boas-vindas:', err);
    });

    console.log(`✅ [REGISTER] Novo usuário criado: ${email}`);

    return res.status(201).json({ ok: true });

  } catch (error) {
    console.error('❌ [REGISTER] Erro:', error);
    
    // Erro de constraint única (email ou phone duplicado)
    if (
      error instanceof Error && 
      error.message.includes('Unique constraint')
    ) {
      return res.status(409).json({ 
        error: 'Email ou telefone já cadastrado' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro interno. Tente novamente.' 
    });
  }
}
