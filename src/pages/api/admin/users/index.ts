// ===========================================================
// API: GET /api/admin/users - Lista usuários para o admin
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticação admin
  const adminToken = req.cookies.admin_token;
  if (!adminToken) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const { search, hasCredits, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const where: Record<string, unknown> = {
      role: 'CUSTOMER', // Apenas clientes, não admins
    };

    // Busca por nome, email ou telefone
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    // Buscar usuários
    const users = await prisma.user.findMany({
      where,
      include: {
        bookings: {
          select: {
            id: true,
            startTime: true,
            status: true,
          },
          orderBy: { startTime: 'desc' },
          take: 1,
        },
        credits: {
          where: {
            status: 'CONFIRMED',
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          select: {
            id: true,
            amount: true,
            remainingAmount: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    // Contar total
    const total = await prisma.user.count({ where });

    // Formatar resposta
    const formattedUsers = users.map(user => {
      // Calcular saldo de créditos
      const totalCredits = user.credits.reduce((sum, c) => {
        // Usar remainingAmount se disponível, senão amount
        return sum + (c.remainingAmount || c.amount);
      }, 0);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        totalCredits,
        totalBookings: user._count.bookings,
        lastBooking: user.bookings[0] || null,
      };
    });

    // Filtrar por créditos se solicitado
    let result = formattedUsers;
    if (hasCredits === 'true') {
      result = formattedUsers.filter(u => u.totalCredits > 0);
    }

    return res.status(200).json({
      users: result,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}
