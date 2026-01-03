// ===========================================================
// Componente: PaymentMethodSelector - Seleção de método de pagamento
// PIX (default) ou Cartão de Crédito
// ===========================================================

import { CreditCard, QrCode } from 'lucide-react';

export type PaymentMethod = 'PIX' | 'CARD';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  showInstallments?: boolean;
  installmentCount?: number;
  onInstallmentChange?: (count: number) => void;
  totalAmount?: number; // Em centavos
}

// Valor mínimo por parcela: R$ 5,00 (Asaas)
const MIN_INSTALLMENT_VALUE = 500; // centavos
const MAX_INSTALLMENTS = 12;

export function PaymentMethodSelector({
  selected,
  onSelect,
  disabled = false,
  showInstallments = false,
  installmentCount = 1,
  onInstallmentChange,
  totalAmount = 0,
}: PaymentMethodSelectorProps) {
  // Calcula número máximo de parcelas baseado no valor
  const maxInstallments = Math.min(
    MAX_INSTALLMENTS,
    totalAmount > 0 ? Math.floor(totalAmount / MIN_INSTALLMENT_VALUE) : 1
  );

  // Gera opções de parcelamento
  const installmentOptions = Array.from(
    { length: Math.max(1, maxInstallments) },
    (_, i) => i + 1
  );

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Forma de Pagamento
      </label>

      <div className="grid grid-cols-2 gap-3">
        {/* PIX */}
        <button
          type="button"
          onClick={() => onSelect('PIX')}
          disabled={disabled}
          className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
            selected === 'PIX'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <QrCode className={`w-8 h-8 mb-2 ${selected === 'PIX' ? 'text-green-600' : 'text-gray-500'}`} />
          <span className={`font-medium ${selected === 'PIX' ? 'text-green-700' : 'text-gray-700'}`}>
            PIX
          </span>
          <span className="text-xs text-gray-500 mt-1">Aprovação imediata</span>
        </button>

        {/* Cartão */}
        <button
          type="button"
          onClick={() => onSelect('CARD')}
          disabled={disabled}
          className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
            selected === 'CARD'
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <CreditCard className={`w-8 h-8 mb-2 ${selected === 'CARD' ? 'text-primary-600' : 'text-gray-500'}`} />
          <span className={`font-medium ${selected === 'CARD' ? 'text-primary-700' : 'text-gray-700'}`}>
            Cartão
          </span>
          <span className="text-xs text-gray-500 mt-1">Crédito ou Débito</span>
        </button>
      </div>

      {/* Seletor de parcelas (apenas para cartão) */}
      {selected === 'CARD' && showInstallments && maxInstallments > 1 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <label htmlFor="installment-select" className="block text-sm font-medium text-gray-700 mb-2">
            Parcelamento
          </label>
          <select
            id="installment-select"
            aria-label="Selecione o número de parcelas"
            value={installmentCount}
            onChange={(e) => onInstallmentChange?.(Number(e.target.value))}
            disabled={disabled}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {installmentOptions.map((count) => {
              const installmentValue = totalAmount / count;
              return (
                <option key={count} value={count}>
                  {count}x de {formatCurrency(installmentValue)}
                  {count === 1 ? ' (à vista)' : ''}
                </option>
              );
            })}
          </select>
          {installmentCount > 1 && (
            <p className="text-xs text-gray-500 mt-2">
              Total: {formatCurrency(totalAmount)} em {installmentCount}x de{' '}
              {formatCurrency(totalAmount / installmentCount)}
            </p>
          )}
        </div>
      )}

      {/* Aviso de segurança */}
      {selected === 'CARD' && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full" />
          Pagamento seguro processado pelo Asaas. Seus dados de cartão não passam pelo nosso servidor.
        </p>
      )}
    </div>
  );
}
