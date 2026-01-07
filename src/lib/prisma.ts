// ===========================================================
// Prisma Client Singleton
// ===========================================================
// Evita múltiplas instâncias do Prisma Client em desenvolvimento

import { PrismaClient } from '@prisma/client';

// Re-exportar helpers de overbooking
export { isOverbookingError, OVERBOOKING_ERROR_MESSAGE } from './overbooking';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
