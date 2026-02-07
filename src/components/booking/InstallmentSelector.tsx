// ===========================================================
// Componente: InstallmentSelector - Seletor de parcelas
// ===========================================================
// Permite escolher número de parcelas (2x a 12x) para pagamento com cartão
// Calcula e exibe o valor da parcela

import { CreditCard } from 'lucide-react';

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
    12,
    Math.floor(totalAmount / minInstallmentValue)
  );

  // Opções de parcelamento (1x = à vista, 2x a maxInstallments)
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  // Calcular valor da parcela
  const installmentValue = selectedInstallments > 1
    ? Math.round(totalAmount / selectedInstallments)
    : totalAmount;

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
        {installmentOptions.map((installments) => {
          const value = installments > 1
            ? Math.round(totalAmount / installments)
            : totalAmount;
          const isSelected = selectedInstallments === installments;
          const isValid = value >= minInstallmentValue || installments === 1;

          return (
            <button
              key={installments}
              type="button"
              onClick={() => onSelect(installments)}
              disabled={disabled || !isValid}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : isValid
                    ? 'border-gray-200 hover:border-gray-300 text-gray-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center">
                <span>{installments}x</span>
                {installments > 1 && (
                  <span className="text-xs mt-0.5">
                    {formatCurrency(value)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedInstallments > 1 && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{selectedInstallments}x de {formatCurrency(installmentValue)}</strong>
            <span className="text-blue-600 ml-2">
              Total: {formatCurrency(totalAmount)}
            </span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Taxas e juros serão calculados pelo gateway de pagamento
          </p>
        </div>
      )}

      {maxInstallments < 12 && totalAmount > 0 && (
        <p className="text-xs text-amber-600">
          Valor mínimo por parcela: {formatCurrency(minInstallmentValue)}
        </p>
      )}
    </div>
  );
}
