// ===========================================================
// Utilitários de Formatação
// ===========================================================

/**
 * Formata valor em centavos para moeda BRL
 * @param cents Valor em centavos
 * @returns String formatada (ex: "R$ 70,00")
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Formata data para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "17/12/2025")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

/**
 * Formata data e hora para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "17/12/2025 às 14:00")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Formata hora para exibição
 * @param date Data a formatar
 * @returns String formatada (ex: "14:00")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Calcula diferença em horas entre duas datas
 */
export function getHoursDiff(start: Date, end: Date): number {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Gera slug a partir de string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
