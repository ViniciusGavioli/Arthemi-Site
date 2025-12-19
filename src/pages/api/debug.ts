// API de debug para verificar conexão com banco de dados
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verifica se DATABASE_URL está definida (sem mostrar o valor)
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlPrefix = process.env.DATABASE_URL?.substring(0, 30) + '...';
    
    // Tenta uma query simples
    const roomCount = await prisma.room.count();
    
    res.status(200).json({
      status: 'ok',
      hasDbUrl,
      dbUrlPrefix,
      roomCount,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      status: 'error',
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
    });
  }
}
