import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const adminPasswordHash = await hashPassword('arthemi2025');
    const viniPasswordHash = await hashPassword('vinicius2025');

    const admin = await prisma.user.upsert({
      where: { email: 'admin@arthemi.com.br' },
      update: {
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email: 'admin@arthemi.com.br',
        name: 'Administrador',
        phone: '11999990000',
        role: 'ADMIN',
        passwordHash: adminPasswordHash,
        isActive: true,
        failedAttempts: 0,
      },
    });

    const vini = await prisma.user.upsert({
      where: { email: 'viniciusgavioli528@gmail.com' },
      update: {
        passwordHash: viniPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email: 'viniciusgavioli528@gmail.com',
        name: 'Vinicius Gavioli',
        phone: '11999999999',
        role: 'ADMIN',
        passwordHash: viniPasswordHash,
        isActive: true,
        failedAttempts: 0,
      },
    });

    res.status(200).json({ 
      success: true, 
      message: 'Contas admin configuradas com sucesso!', 
      emails: [admin.email, vini.email] 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erro ao configurar contas' });
  }
}
