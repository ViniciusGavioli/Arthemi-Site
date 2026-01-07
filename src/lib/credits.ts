// ===========================================================
// Módulo puro: Lógica de créditos (sem dependências de API/handlers)
// ===========================================================

import { getBookingTotalByDate } from '@/lib/pricing';

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
