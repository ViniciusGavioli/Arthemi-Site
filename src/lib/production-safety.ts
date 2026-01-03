// ===========================================================
// Blindagem de Produção - Helpers
// ===========================================================
// Funções auxiliares para operações seguras e idempotentes

import { prisma } from './prisma';

// ============================================================
// TIMEOUT HELPER
// ============================================================

/**
 * Executa uma promise com timeout
 * @param promise Promise a executar
 * @param timeoutMs Tempo máximo em ms
 * @param operation Nome da operação para log
 * @throws Error com mensagem de timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout: ${operation} excedeu ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// ============================================================
// VERIFICAÇÃO DE PAGAMENTO DUPLICADO
// ============================================================

/**
 * Verifica se já existe um pagamento com o mesmo externalId
 * Previne cobranças duplicadas
 * 
 * @param externalId ID externo do pagamento (paymentId do Asaas)
 * @returns true se já existe
 */
export async function paymentExists(externalId: string): Promise<boolean> {
  const existing = await prisma.payment.findFirst({
    where: { externalId },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Verifica se já existe um booking com paymentId específico
 * 
 * @param paymentId ID do pagamento
 * @returns true se já existe
 */
export async function bookingWithPaymentExists(paymentId: string): Promise<boolean> {
  const existing = await prisma.booking.findFirst({
    where: { paymentId },
    select: { id: true },
  });
  return !!existing;
}

// ============================================================
// LOCK TRANSACIONAL PARA SLOT DE BOOKING
// ============================================================

/**
 * Interface para resultado de verificação de conflito
 */
export interface SlotConflictResult {
  hasConflict: boolean;
  conflictingBookingId?: string;
}

/**
 * Verifica conflito de slot dentro de transação
 * Usa findFirst com índice para lock implícito
 * 
 * @param tx Transação Prisma
 * @param roomId ID da sala
 * @param startTime Início do slot
 * @param endTime Fim do slot
 * @returns Resultado com indicação de conflito
 */
export async function checkSlotConflict(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  roomId: string,
  startTime: Date,
  endTime: Date
): Promise<SlotConflictResult> {
  const conflicting = await tx.booking.findFirst({
    where: {
      roomId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      OR: [
        // Novo começa durante existente
        { startTime: { lt: endTime, gte: startTime } },
        // Novo termina durante existente
        { endTime: { gt: startTime, lte: endTime } },
        // Existente engloba o novo
        { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
      ],
    },
    select: { id: true },
  });

  return {
    hasConflict: !!conflicting,
    conflictingBookingId: conflicting?.id,
  };
}

// ============================================================
// VALIDAÇÃO DE CPF ÚNICO POR USUÁRIO
// ============================================================

/**
 * Verifica se CPF já está em uso por outro usuário
 * 
 * @param cpf CPF normalizado (apenas números)
 * @param excludeUserId ID do usuário a excluir da verificação (para updates)
 * @returns true se CPF já está em uso por outro usuário
 */
export async function cpfInUseByOther(
  cpf: string,
  excludeUserId?: string
): Promise<boolean> {
  if (!cpf) return false;
  
  const existing = await prisma.user.findFirst({
    where: {
      cpf,
      ...(excludeUserId && { id: { not: excludeUserId } }),
    },
    select: { id: true },
  });
  
  return !!existing;
}

// ============================================================
// SANITIZAÇÃO DE ERROS
// ============================================================

/**
 * Lista de mensagens de erro seguras para retornar ao cliente
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'CONFLICT': 'Horário não disponível. Já existe uma reserva neste período.',
  'TEMPO_INSUFICIENTE': 'Reservas precisam ser feitas com pelo menos 30 minutos de antecedência.',
  'CPF_INVALIDO': 'CPF inválido. Verifique os dados e tente novamente.',
  'CPF_EM_USO': 'CPF já está cadastrado em outra conta.',
  'SALA_INATIVA': 'Sala não encontrada ou inativa.',
  'HORARIO_INVALIDO': 'Horário fora do expediente.',
  'PAGAMENTO_DUPLICADO': 'Este pagamento já foi processado.',
  'TIMEOUT': 'Operação demorou muito. Tente novamente.',
  'RATE_LIMIT': 'Muitas tentativas. Aguarde alguns minutos.',
};

/**
 * Converte erro interno em mensagem segura para o cliente
 * Logs detalhados ficam apenas no servidor
 * 
 * @param error Erro original
 * @param context Contexto para log (ex: 'booking', 'payment')
 * @returns Mensagem segura para o cliente
 */
export function getSafeErrorMessage(error: unknown, context: string): string {
  const message = error instanceof Error ? error.message : 'Erro desconhecido';
  
  // Log completo no servidor
  console.error(`❌ [${context}] ERRO:`, {
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  // Verificar se é erro conhecido
  for (const [key, safeMessage] of Object.entries(SAFE_ERROR_MESSAGES)) {
    if (message.includes(key) || message.toUpperCase().includes(key)) {
      return safeMessage;
    }
  }
  
  // Verificar timeout
  if (message.toLowerCase().includes('timeout')) {
    return SAFE_ERROR_MESSAGES['TIMEOUT'];
  }
  
  // Mensagem genérica para erros desconhecidos
  return 'Erro ao processar solicitação. Tente novamente.';
}

// ============================================================
// CONSTANTES DE TIMEOUT
// ============================================================

export const TIMEOUTS = {
  /** Timeout para criação de booking (15s) */
  BOOKING_CREATE: 15000,
  /** Timeout para criação de pagamento Asaas (20s) */
  PAYMENT_CREATE: 20000,
  /** Timeout para operações de banco simples (5s) */
  DB_SIMPLE: 5000,
  /** Timeout para transações complexas (30s) */
  DB_TRANSACTION: 30000,
} as const;
