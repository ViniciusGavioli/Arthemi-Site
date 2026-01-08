// ===========================================================
// API: GET /api/admin/users/[id] - Detalhes de um usuário
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // P-005: Verificar autenticação admin via JWT
  if (!requireAdminAuth(req, res)) return;

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do usuário é obrigatório' });
  }

  try {
    // Buscar usuário com todos os dados
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            room: { select: { id: true, name: true } },
            product: { select: { id: true, name: true, price: true } },
          },
          orderBy: { startTime: 'desc' },
        },
        credits: {
          include: {
            room: { select: { id: true, name: true, tier: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        packages: {
          include: {
            room: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Calcular resumo de créditos
    const now = new Date();
    const activeCredits = user.credits.filter(c => 
      c.status === 'CONFIRMED' && 
      (!c.expiresAt || new Date(c.expiresAt) > now)
    );

    const totalCredits = activeCredits.reduce((sum, c) => {
      return sum + (c.remainingAmount || c.amount);
    }, 0);

    // Créditos por sala
    const creditsByRoom: Record<string, { roomId: string | null; roomName: string; total: number; tier: number | null }> = {};
    
    for (const credit of activeCredits) {
      const key = credit.roomId || 'generic';
      const roomName = credit.room?.name || 'Genérico';
      const tier = credit.room?.tier || null;
      
      if (!creditsByRoom[key]) {
        creditsByRoom[key] = { roomId: credit.roomId, roomName, total: 0, tier };
      }
      creditsByRoom[key].total += (credit.remainingAmount || credit.amount);
    }

    // Reservas futuras
    const futureBookings = user.bookings.filter(b => 
      new Date(b.startTime) > now && 
      b.status !== 'CANCELLED'
    ).length;

    // Pacotes ativos
    const activePackages = user.packages.filter(p => 
      p.isActive && 
      p.remainingHours > 0 && 
      new Date(p.expiresAt) > now
    );

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      summary: {
        totalCredits,
        creditsByRoom: Object.values(creditsByRoom),
        futureBookings,
        totalBookings: user.bookings.length,
        activePackages: activePackages.length,
        totalPackageHours: activePackages.reduce((sum, p) => sum + p.remainingHours, 0),
      },
      bookings: user.bookings,
      credits: user.credits,
      packages: user.packages,
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}
