// ===========================================================
// Módulo puro: Lógica de créditos (sem dependências de API/handlers)
// ===========================================================

import { getBookingTotalByDate } from '@/lib/pricing';
import { Prisma, PrismaClient } from '@prisma/client';

// Tipo para transação Prisma (baseado no que $transaction retorna)
type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Calcula creditAmount em centavos baseado no tipo de compra
 * Função pura, sem side effects, reutilizável em testes e handlers
 * @param amountCents - Preço em centavos (vem de Product.price ou helper)
 * @param isHoursPurchase - true se compra de horas avulsas (data.hours)
 * @param roomId - ID da sala (para helper)
 * @param creditHours - Horas compradas (só usado se isHoursPurchase)
 * @param roomSlug - Slug da sala (para helper)
 * @param now - Data de referência (para testes determinísticos). Default: new Date()
 * @returns creditAmount em centavos
 */
export function computeCreditAmountCents({
  amountCents,
  isHoursPurchase,
  roomId,
  creditHours,
  roomSlug,
  now,
}: {
  amountCents: number;
  isHoursPurchase: boolean;
  roomId: string;
  creditHours: number;
  roomSlug: string;
  now?: Date;
}): number {
  if (isHoursPurchase) {
    // Horas avulsas: usar preço HOURLY_RATE (dia útil padrão, sem data booking)
    const referenceDate = now || new Date();
    return Math.round(getBookingTotalByDate(roomId, referenceDate, creditHours, roomSlug) * 100);
  } else {
    // Produto com price definido: amount já é centavos
    return amountCents;
  }
}

// ===========================================================
// REVERSÃO DE CRÉDITOS
// ===========================================================

/**
 * Restaura créditos consumidos quando uma reserva é cancelada
 * Distribui o valor proporcionalmente entre os créditos usados
 * 
 * @param tx - Transação Prisma
 * @param creditIds - IDs dos créditos que foram consumidos
 * @param totalToRestore - Valor total em centavos a restaurar
 * @returns Valor efetivamente restaurado
 */
export async function restoreCreditsFromCancelledBooking(
  tx: PrismaTransaction,
  creditIds: string[],
  totalToRestore: number
): Promise<number> {
  if (!creditIds.length || totalToRestore <= 0) {
    return 0;
  }

  // Buscar os créditos que foram usados
  const credits = await tx.credit.findMany({
    where: {
      id: { in: creditIds },
    },
  });

  if (credits.length === 0) {
    console.warn('[RESTORE_CREDITS] Nenhum crédito encontrado para restaurar');
    return 0;
  }

  let remaining = totalToRestore;
  let totalRestored = 0;

  // Restaurar cada crédito
  for (const credit of credits) {
    if (remaining <= 0) break;

    // Calcular quanto pode restaurar neste crédito
    // Máximo = amount - remainingAmount (quanto foi consumido)
    const maxRestore = credit.amount - credit.remainingAmount;
    const toRestore = Math.min(maxRestore, remaining);

    if (toRestore <= 0) continue;

    // Restaurar o crédito
    const result = await tx.$executeRaw`
      UPDATE credits
      SET 
        "remainingAmount" = "remainingAmount" + ${toRestore},
        "status" = CASE 
          WHEN "remainingAmount" + ${toRestore} > 0 THEN 'CONFIRMED' 
          ELSE "status" 
        END,
        "usedAt" = NULL,
        "updatedAt" = NOW()
      WHERE id = ${credit.id}
        AND "remainingAmount" + ${toRestore} <= "amount"
    `;

    if (result === 1) {
      totalRestored += toRestore;
      remaining -= toRestore;
    }
  }

  return totalRestored;
}
