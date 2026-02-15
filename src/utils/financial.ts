// ===========================================================
// Utility: financial.ts - Cálculos financeiros de parcelamento
// ===========================================================
// FUNÇÃO: Garantir contrato matemático perfeito entre
// installmentValue * installmentCount === adjustedTotal
//
// Usado por: BookingModal (front), InstallmentSelector (front),
//            api/bookings (backend) → asaas.ts (gateway)

/**
 * Calcula valores de parcelamento com contrato matemático perfeito.
 *
 * PROBLEMA RESOLVIDO:
 * R$ 59,99 em 10x → Math.round(5999/10) = 600 centavos (R$ 6,00)
 * 600 * 10 = 6000 ≠ 5999 → discrepância de 1 centavo no Asaas.
 *
 * SOLUÇÃO:
 * Retorna adjustedTotalCents = installmentValueCents * installments
 * O Asaas recebe `value` e `installmentValue` matematicamente consistentes.
 *
 * @param baseCents - Valor original em centavos (inteiro)
 * @param installments - Número de parcelas (1-12)
 * @returns Contrato de parcelamento sincronizado
 */
export function calculatePaymentTotals(
    baseCents: number,
    installments: number
): {
    installmentValueCents: number;
    adjustedTotalCents: number;
    installmentCount: number;
    /** Diferença em centavos entre ajustado e original (pode ser +1, 0 ou -1) */
    adjustmentCents: number;
    /** Valor total com juros (alias para adjustedTotalCents) */
    totalWithInterest: number;
    /** Se a opção é válida (parcela mínima R$ 30,00) */
    isValid: boolean;
} {
    // À vista: sem ajuste
    if (installments <= 1) {
        return {
            installmentValueCents: baseCents,
            adjustedTotalCents: baseCents,
            totalWithInterest: baseCents,
            installmentCount: 1,
            adjustmentCents: 0,
            isValid: true,
        };
    }

    // Parcelado: calcular markup e parcela
    // Markup: 2% a cada parcela acima de 3x (4x=2%, 5x=4%... 10x=14%)
    const markupRate = installments > 3 ? (installments - 3) * 0.02 : 0;
    const totalWithMarkupCents = Math.round(baseCents * (1 + markupRate));

    const installmentValueCents = Math.round(totalWithMarkupCents / installments);
    const adjustedTotalCents = installmentValueCents * installments;
    const adjustmentCents = adjustedTotalCents - baseCents;

    const isValid = installmentValueCents >= 3000 || installments === 1;

    return {
        installmentValueCents,
        adjustedTotalCents,
        totalWithInterest: adjustedTotalCents,
        installmentCount: installments,
        adjustmentCents,
        isValid,
    };
}

export const calculateMarceloRules = calculatePaymentTotals;

/**
 * Converte centavos para reais com 2 casas decimais
 * @example centsToReais(5999) → 59.99
 */
export function centsToReais(cents: number): number {
    return Math.round(cents) / 100;
}

/**
 * Formata centavos para exibição em BRL
 * @example formatBRL(5999) → "R$ 59,99"
 */
export function formatBRL(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}
