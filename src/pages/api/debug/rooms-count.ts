// ===========================================================
// API: /api/debug/rooms-count (TEMPORÁRIO)
// ===========================================================
// Endpoint protegido para debug de rooms em produção
// REMOVER após resolver o problema

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticação admin
  if (!requireAdminAuth(req, res)) {
    return; // requireAdminAuth já enviou a resposta de erro
  }

  const requestId = `debug-${Date.now()}`;
  
  console.log(`[${requestId}] DEBUG rooms-count iniciado`);
  console.log(`[${requestId}] DATABASE_URL length: ${process.env.DATABASE_URL?.length || 0}`);
  console.log(`[${requestId}] DATABASE_URL ends with: "${process.env.DATABASE_URL?.slice(-20) || 'N/A'}"`);

  try {
    // Teste de conexão básico
    const connectionTest = await prisma.$queryRaw`SELECT 1 as ok`;
    console.log(`[${requestId}] Connection test: OK`);

    // Contagem total de rooms
    const roomsTotalCount = await prisma.room.count();
    console.log(`[${requestId}] roomsTotalCount: ${roomsTotalCount}`);

    // Contagem de rooms ativas
    const roomsActiveCount = await prisma.room.count({
      where: { isActive: true },
    });
    console.log(`[${requestId}] roomsActiveCount: ${roomsActiveCount}`);

    // Lista de rooms (sem PII, só id, slug, isActive)
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        tier: true,
      },
    });
    console.log(`[${requestId}] rooms:`, JSON.stringify(rooms));

    return res.status(200).json({
      requestId,
      timestamp: new Date().toISOString(),
      databaseConnected: true,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      roomsTotalCount,
      roomsActiveCount,
      rooms,
    });
  } catch (error) {
    console.error(`[${requestId}] ERROR:`, error);
    
    return res.status(500).json({
      requestId,
      timestamp: new Date().toISOString(),
      databaseConnected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });
  }
}
