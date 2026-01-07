// ===========================================================
// Helper: Detecção de Overbooking
// ===========================================================
// Detecta violação de EXCLUDE constraint do PostgreSQL
// SQLSTATE 23P01 = exclusion_violation
// ===========================================================

/**
 * Verifica se o erro é uma violação de exclusion constraint (overbooking)
 * @param error Erro capturado do Prisma
 * @returns true se for violação de constraint de sobreposição de horário
 */
export function isOverbookingError(error: unknown): boolean {
  // Guard: null/undefined
  if (!error) return false;
  
  // Verificar se é um erro do Prisma (duck-typing para evitar import em testes)
  const prismaError = error as { code?: string; meta?: { target?: string[] }; message?: string };
  
  if (prismaError.code === 'P2002') {
    // P2002 = Unique/Exclusion constraint violation
    const target = prismaError.meta?.target;
    if (Array.isArray(target) && target.includes('bookings_no_overlap')) {
      return true;
    }
  }
  
  // Fallback: verificar mensagem de erro para SQLSTATE 23P01
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('23p01') ||
      message.includes('exclusion_violation') ||
      message.includes('bookings_no_overlap') ||
      message.includes('conflicting key value violates exclusion constraint')
    ) {
      return true;
    }
  }
  
  // Fallback adicional: verificar propriedade message em objetos
  if (typeof prismaError.message === 'string') {
    const message = prismaError.message.toLowerCase();
    if (
      message.includes('23p01') ||
      message.includes('exclusion_violation') ||
      message.includes('bookings_no_overlap') ||
      message.includes('conflicting key value violates exclusion constraint')
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Mensagem de erro padronizada para overbooking
 */
export const OVERBOOKING_ERROR_MESSAGE = 
  'Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário.';
