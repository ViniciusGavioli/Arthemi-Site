// ===========================================================
// Componente: PaymentMethodSelector - Seleção de método de pagamento
// PIX (default) ou Cartão de Crédito
// ===========================================================
// NOTA: Parcelamento/taxas são exibidos SOMENTE no checkout hospedado.
// NÃO simular parcelas localmente - checkout externo é fonte da verdade.
// ===========================================================

import { CreditCard, QrCode, Shield } from 'lucide-react';

export type PaymentMethod = 'PIX' | 'CARD';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selected,
  onSelect,
  disabled = false,
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

      {/* Aviso de redirecionamento para checkout seguro */}
      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-700 flex items-start gap-2">
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Você será direcionado para um ambiente seguro para finalizar o pagamento.
            {selected === 'CARD' && ' As opções de parcelamento e eventuais taxas são exibidas nesse momento.'}
          </span>
        </p>
      </div>
    </div>
  );
}
