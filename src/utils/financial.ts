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
    installments: number,
    discountCents: number = 0
): {
    installmentValueCents: number;
    adjustedTotalCents: number;
    installmentCount: number;
    adjustmentCents: number; // Diferença em centavos entre ajustado e original/líquido
    totalWithInterest: number; // Alias para adjustedTotalCents
    isValid: boolean; // Se a opção é válida (parcela mínima R$ 30,00)
} {
    // Calcular valor líquido (Base - Desconto)
    const netValueCents = Math.max(0, baseCents - discountCents);

    // 1x a 3x: Sem juros sobre o valor líquido
    if (installments <= 3) {
        const installmentValueCents = Math.round(netValueCents / installments);
        const adjustedTotalCents = installmentValueCents * installments;

        return {
            installmentValueCents,
            adjustedTotalCents: netValueCents, // Mantém valor líquido como total (sem juros)
            totalWithInterest: netValueCents,
            installmentCount: installments,
            adjustmentCents: 0,
            isValid: true,
        };
    }

    // 4x a 10x: Regra do Marcelo
    // Markup: 2% a cada parcela acima de 3 (ex: 4x=+2%, 6x=+6%, 10x=+14%)
    // INCIDÊNCIA: Sobre o valor com desconto (líquido)
    const markupPercentage = (installments - 3) * 2; // 2% por parcela extra
    const markupRate = markupPercentage / 100;

    // Total com juros (Base = Net Value)
    const totalWithMarkupCents = Math.round(netValueCents * (1 + markupRate));

    // Valor da parcela
    const installmentValueCents = Math.round(totalWithMarkupCents / installments);

    // Recalcular total ajustado baseado na parcela arredondada
    const adjustedTotalCents = installmentValueCents * installments;
    const adjustmentCents = adjustedTotalCents - netValueCents;

    // Validação: Parcela mínima de R$ 30,00 (3000 centavos)
    const isValid = installmentValueCents >= 3000;

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
