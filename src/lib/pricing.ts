// ===========================================================
// Helper Unificado de Preços por Data (Weekday vs Saturday)
// ===========================================================
// Fonte única de verdade: PRICES_V3 (src/constants/prices.ts)
// Garante consistência UI x Backend x Créditos

import { getDayOfWeek } from '@/lib/business-hours';
import { PRICES_V3, ROOM_SLUG_MAP } from '@/constants/prices';

/**
 * Determina se uma data é sábado (no timezone Brasil)
 * @param date - Data a verificar
 * @returns true se sábado, false senão
 */
export function isSaturday(date: Date): boolean {
  return getDayOfWeek(date) === 6;
}

/**
 * Converte roomId (DB UUID) para RoomKey (V3)
 * Compatível com room.slug ou fallback por ID
 * @param roomId - ID da sala (UUID) ou slug
 * @param roomSlug - slug da sala (opcional, para otimização)
 * @returns RoomKey ('SALA_A' | 'SALA_B' | 'SALA_C') ou null
 */
export function getRoomKeyFromId(roomId: string, roomSlug?: string): 'SALA_A' | 'SALA_B' | 'SALA_C' | null {
  // Se temos slug, mapear direto
  if (roomSlug) {
    const key = ROOM_SLUG_MAP[roomSlug];
    if (key) return key;
  }

  // Fallback: tentar roomId como slug (para casos onde ID é estático)
  const keyFromId = ROOM_SLUG_MAP[roomId];
  if (keyFromId) return keyFromId;

  // Não conseguiu mapear
  return null;
}

/**
 * Obtém o preço por hora de uma sala para uma data específica
 * Usa PRICES_V3 como fonte de verdade
 * @param roomId - ID da sala (UUID) ou slug
 * @param date - Data da reserva
 * @param roomSlug - slug da sala (opcional, para otimização)
 * @returns Preço em reais (ex: 59.99)
 * @throws Error se sala não encontrada ou preço indefinido
 */
export function getRoomHourlyPriceByDate(
  roomId: string,
  date: Date,
  roomSlug?: string
): number {
  const roomKey = getRoomKeyFromId(roomId, roomSlug);
  
  if (!roomKey) {
    throw new Error(`Sala não mapeada para PRICES_V3: ${roomId}`);
  }

  const room = PRICES_V3[roomKey];
  if (!room) {
    throw new Error(`Sala não encontrada em PRICES_V3: ${roomKey}`);
  }

  // Determinar preço: sábado ou dia útil
  if (isSaturday(date)) {
    const saturdayPrice = room.prices.SATURDAY_HOUR;
    if (!saturdayPrice) {
      throw new Error(`Preço de sábado indefinido para ${roomKey}`);
    }
    return saturdayPrice;
  }

  // Dia útil: usar HOURLY_RATE
  const weekdayPrice = room.prices.HOURLY_RATE;
  if (!weekdayPrice) {
    throw new Error(`Preço de dia útil indefinido para ${roomKey}`);
  }

  return weekdayPrice;
}

/**
 * Calcula valor total de uma reserva por hora para uma data específica
 * Usa PRICES_V3 como fonte de verdade
 * @param roomId - ID da sala (UUID) ou slug
 * @param date - Data da reserva
 * @param hours - Quantidade de horas
 * @param roomSlug - slug da sala (opcional, para otimização)
 * @returns Total em reais (ex: 119.98)
 * @throws Error se sala não encontrada ou preço indefinido
 */
export function getBookingTotalByDate(
  roomId: string,
  date: Date,
  hours: number,
  roomSlug?: string
): number {
  const hourlyPrice = getRoomHourlyPriceByDate(roomId, date, roomSlug);
  return hourlyPrice * hours;
}

/**
 * Calcula valor total em centavos (para cálculos de crédito/pagamento)
 * Garante precisão decimal
 * @param roomId - ID da sala (UUID) ou slug
 * @param date - Data da reserva
 * @param hours - Quantidade de horas
 * @param roomSlug - slug da sala (opcional, para otimização)
 * @returns Total em centavos (ex: 11998)
 * @throws Error se sala não encontrada ou preço indefinido
 */
export function getBookingTotalCentsByDate(
  roomId: string,
  date: Date,
  hours: number,
  roomSlug?: string
): number {
  const totalReais = getBookingTotalByDate(roomId, date, hours, roomSlug);
  return Math.round(totalReais * 100);
}

/**
 * Obtém informações de preço para exibição no UI
 * Retorna preço, indicador se é sábado, e labels
 * @param roomId - ID da sala
 * @param date - Data selecionada
 * @param roomSlug - slug da sala (opcional)
 * @returns { hourlyPrice, isSat, label }
 */
export function getPricingInfoForUI(
  roomId: string,
  date: Date | null,
  roomSlug?: string
): {
  hourlyPrice: number;
  isSaturday: boolean;
  label: string; // Ex: "Sábado - Preço diferente"
} {
  if (!date) {
    // Sem data: retornar preço de dia útil padrão
    const roomKey = getRoomKeyFromId(roomId, roomSlug);
    const weekdayPrice = roomKey ? PRICES_V3[roomKey]?.prices.HOURLY_RATE : 0;
    return {
      hourlyPrice: weekdayPrice || 0,
      isSaturday: false,
      label: 'Preço por hora',
    };
  }

  const isSat = isSaturday(date);
  try {
    const price = getRoomHourlyPriceByDate(roomId, date, roomSlug);
    return {
      hourlyPrice: price,
      isSaturday: isSat,
      label: isSat ? '💙 Sábado - Preço especial' : 'Preço por hora',
    };
  } catch (err) {
    // Fallback silencioso (UI pode exibir preço padrão)
    console.error('[PRICING] Erro ao calcular preço:', err);
    const roomKey = getRoomKeyFromId(roomId, roomSlug);
    const weekdayPrice = roomKey ? PRICES_V3[roomKey]?.prices.HOURLY_RATE : 0;
    return {
      hourlyPrice: weekdayPrice || 0,
      isSaturday: false,
      label: 'Preço por hora',
    };
  }
}
