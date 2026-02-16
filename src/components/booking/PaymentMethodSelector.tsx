// ===========================================================
// Componente: PaymentMethodSelector - Seleção de método de pagamento
// PIX (default) ou Cartão de Crédito
// ===========================================================
// Inclui seletor de parcelas quando cartão é selecionado
// ===========================================================

import { CreditCard, QrCode, Shield, Info } from 'lucide-react';
import { InstallmentSelector } from './InstallmentSelector';

export type PaymentMethod = 'PIX' | 'CARD';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  totalAmount?: number; // Valor total em centavos (para calcular parcelas)
  selectedInstallments?: number; // Número de parcelas selecionadas
  onInstallmentChange?: (installments: number) => void; // Callback quando parcelas mudam
  discountCents?: number; // Valor do desconto em centavos
}

export function PaymentMethodSelector({
  selected,
  onSelect,
  disabled = false,
  totalAmount = 0,
  selectedInstallments = 1,
  onInstallmentChange,
  discountCents = 0,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Forma de Pagamento
      </label>

      <div className="grid grid-cols-2 gap-3">
        {/* PIX */}
        <button
          type="button"
          onClick={() => {
            onSelect('PIX');
            // Reset parcelas ao selecionar PIX
            if (onInstallmentChange) onInstallmentChange(1);
          }}
          disabled={disabled}
          className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selected === 'PIX'
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
          className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selected === 'CARD'
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
      {selected === 'CARD' && totalAmount > 0 && onInstallmentChange && (
        <InstallmentSelector
          totalAmount={totalAmount}
          selectedInstallments={selectedInstallments}
          onSelect={onInstallmentChange}
          disabled={disabled}
          discountCents={discountCents}
        />
      )}

      {/* Aviso de redirecionamento para checkout seguro */}
      {/* Aviso de redirecionamento para checkout seguro */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-start gap-3 border border-blue-100">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          {selected === 'CARD'
            ? 'O valor das parcelas e os juros aplicados serão exibidos e processados diretamente no checkout seguro do Asaas antes da sua confirmação final.'
            : 'Você será direcionado para um ambiente seguro para finalizar o pagamento.'}
        </p>
      </div>
    </div>
  );
}
