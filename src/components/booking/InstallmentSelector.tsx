// ===========================================================
// Componente: InstallmentSelector - Seletor de parcelas
// ===========================================================
// Permite escolher número de parcelas (2x a 12x) para pagamento com cartão
// Calcula e exibe o valor da parcela usando utility centralizada

import { CreditCard } from 'lucide-react';
import { calculatePaymentTotals } from '@/utils/financial';


export interface InstallmentSelectorProps {
  totalAmount: number; // Valor total em centavos
  selectedInstallments: number; // Número de parcelas selecionadas (1 = à vista)
  onSelect: (installments: number) => void;
  disabled?: boolean;
  minInstallmentValue?: number; // Valor mínimo por parcela em centavos (default: 500 = R$ 5,00)
}

export function InstallmentSelector({
  totalAmount,
  selectedInstallments,
  onSelect,
  disabled = false,
  minInstallmentValue = 500, // R$ 5,00 mínimo por parcela
}: InstallmentSelectorProps) {
  // Calcular número máximo de parcelas baseado no valor mínimo
  const maxInstallments = Math.min(
    10, // Teto fixo de 10x
    Math.floor(totalAmount / minInstallmentValue)
  );

  // Opções de parcelamento (1x = à vista, 2x a maxInstallments)
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  // Calcular valores sincronizados usando utility centralizada


  // Formatar valor em BRL
  const formatCurrency = (cents: number): string => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        Parcelamento
      </label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {installmentOptions
          .filter(installments => {
            // Filtro de Parcela Mínima R$ 30,00 (usando regra centralizada)
            return calculatePaymentTotals(totalAmount, installments).isValid;
          })
          .map((installments) => {
            const isSelected = selectedInstallments === installments;
            const isValid = installments <= maxInstallments;

            return (
              <button
                key={installments}
                type="button"
                onClick={() => onSelect(installments)}
                disabled={disabled || !isValid}
                className={`h-12 w-full rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center ${isSelected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : isValid
                    ? 'border-gray-200 hover:border-gray-300 text-gray-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {installments}x
              </button>
            );
          })}
      </div>



      {maxInstallments < 12 && totalAmount > 0 && (
        <p className="text-xs text-amber-600">
          Valor mínimo por parcela: {formatCurrency(minInstallmentValue)}
        </p>
      )}
    </div>
  );
}
