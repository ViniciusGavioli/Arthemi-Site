// ===========================================================
// Helper: resolveOrCreateUser
// ===========================================================
// Resolve usuário por email (prioridade) ou phone
// Evita P2002 em unique constraints
// Usado em: /api/bookings, /api/credits/purchase, /api/admin/bookings/create

import { PrismaClient, User } from '@prisma/client';

interface ResolveUserInput {
  name: string;
  email?: string | null;
  phone: string;
  cpf?: string | null;
}

interface ResolveUserResult {
  user: User;
  isNew: boolean;
}

/**
 * Resolve ou cria usuário de forma segura
 * 
 * Ordem de resolução:
 * 1. Busca por email (se fornecido)
 * 2. Busca por phone
 * 3. Cria novo se não encontrou
 * 
 * Em caso de P2002 (duplicate), busca o usuário existente
 */
export async function resolveOrCreateUser(
  prisma: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: ResolveUserInput
): Promise<ResolveUserResult> {
  // 1. Normalizar inputs
  const emailNorm = input.email?.trim().toLowerCase() || null;
  const phoneNorm = input.phone.replace(/\D/g, '');
  const nameNorm = input.name.trim();
  const cpfNorm = input.cpf?.replace(/\D/g, '') || null;

  // 2. Tentar resolver por email primeiro (se fornecido)
  let user: User | null = null;
  
  if (emailNorm) {
    user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });
  }

  // 3. Se não achou por email, tenta por phone
  if (!user && phoneNorm) {
    user = await prisma.user.findUnique({
      where: { phone: phoneNorm },
    });
  }

  // 4. Se achou, atualiza dados (com cuidado no email)
  if (user) {
    try {
      const updateData: Record<string, unknown> = {
        name: nameNorm,
      };

      // Atualiza phone se mudou
      if (phoneNorm && user.phone !== phoneNorm) {
        updateData.phone = phoneNorm;
      }

      // Atualiza CPF se não tinha ou se é o mesmo
      if (cpfNorm && (!user.cpf || user.cpf === cpfNorm)) {
        updateData.cpf = cpfNorm;
      }

      // Atualiza email SOMENTE se:
      // - user.email é null/vazio
      // - OU user.email === emailNorm
      // NUNCA tentar setar email diferente (evitar P2002)
      if (emailNorm && (!user.email || user.email === emailNorm)) {
        updateData.email = emailNorm;
      }

      // Só faz update se tem algo para atualizar
      if (Object.keys(updateData).length > 1 || updateData.name !== user.name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      return { user, isNew: false };
    } catch (error: unknown) {
      // Se P2002 no update (phone/email duplicado com outro user)
      // Ignora o update e continua com o user que já tem
      if (isPrismaP2002Error(error)) {
        console.warn(`⚠️ [resolveOrCreateUser] P2002 no update, usando user existente: ${user.id}`);
        return { user, isNew: false };
      }
      throw error;
    }
  }

  // 5. Não achou - criar novo usuário
  try {
    const newUser = await prisma.user.create({
      data: {
        name: nameNorm,
        email: emailNorm || `${phoneNorm}@temp.arthemi.com.br`,
        phone: phoneNorm,
        cpf: cpfNorm,
        role: 'CUSTOMER',
      },
    });

    return { user: newUser, isNew: true };
  } catch (error: unknown) {
    // P2002 = unique constraint violation
    // Significa que entre o findUnique e o create, outro request criou o user
    if (isPrismaP2002Error(error)) {
      console.warn('⚠️ [resolveOrCreateUser] P2002 no create, buscando user existente');
      
      // Tentar buscar por email ou phone
      const existingUser = emailNorm
        ? await prisma.user.findUnique({ where: { email: emailNorm } })
        : await prisma.user.findUnique({ where: { phone: phoneNorm } });

      if (existingUser) {
        return { user: existingUser, isNew: false };
      }

      // Se ainda não achou, tenta pelo outro campo
      const fallbackUser = await prisma.user.findUnique({ where: { phone: phoneNorm } });
      if (fallbackUser) {
        return { user: fallbackUser, isNew: false };
      }

      // Isso não deveria acontecer, mas por segurança
      throw new Error('Não foi possível resolver usuário após P2002');
    }

    throw error;
  }
}

/**
 * Verifica se é erro Prisma P2002 (unique constraint)
 */
function isPrismaP2002Error(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}
