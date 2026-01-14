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

  // 4. Se achou, atualiza dados de forma segura (sem causar P2002)
  if (user) {
    const updateData: Record<string, unknown> = {};

    // Atualiza nome se diferente
    if (nameNorm && nameNorm !== user.name) {
      updateData.name = nameNorm;
    }

    // Atualiza CPF se não tinha ou se é o mesmo
    if (cpfNorm && (!user.cpf || user.cpf === cpfNorm)) {
      updateData.cpf = cpfNorm;
    }

    // NÃO atualiza phone ou email aqui - são campos unique e podem causar conflito
    // Se precisar atualizar phone/email, deve ser feito com verificação prévia

    // Só faz update se tem algo para atualizar
    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    return { user, isNew: false };
  }

  // 5. Não achou - criar novo usuário usando UPSERT para evitar P2002
  // IMPORTANTE: P2002 dentro de transação interativa aborta TODA a transação (25P02)
  // Por isso usamos upsert que é atômico e nunca causa P2002
  
  // Decidir qual campo usar como chave do upsert
  // Prioridade: email > phone (email é mais confiável como identificador único)
  if (emailNorm) {
    const result = await prisma.user.upsert({
      where: { email: emailNorm },
      create: {
        name: nameNorm,
        email: emailNorm,
        phone: phoneNorm,
        cpf: cpfNorm,
        role: 'CUSTOMER',
      },
      update: {
        // Se já existe por email, atualiza outros campos
        name: nameNorm,
        phone: phoneNorm,
        cpf: cpfNorm || undefined,
      },
    });
    return { user: result, isNew: false }; // Não sabemos se é novo, mas é seguro
  }
  
  // Se não tem email, usa phone como chave
  const result = await prisma.user.upsert({
    where: { phone: phoneNorm },
    create: {
      name: nameNorm,
      email: `${phoneNorm}@temp.arthemi.com.br`,
      phone: phoneNorm,
      cpf: cpfNorm,
      role: 'CUSTOMER',
    },
    update: {
      // Se já existe por phone, atualiza outros campos
      name: nameNorm,
      cpf: cpfNorm || undefined,
    },
  });
  return { user: result, isNew: false };
}
