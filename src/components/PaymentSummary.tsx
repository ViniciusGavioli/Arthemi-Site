// ===========================================================
// Componente: PaymentSummary - Resumo de Pagamento Institucional
// ===========================================================
// Exibe o resumo de pagamento com breakdown de valores
// Usa textos centralizados de lib/policies.ts
// ===========================================================

import React from 'react';
import { MICROCOPY, formatCurrency } from '@/lib/policies';

interface PaymentSummaryProps {
  /** Valor bruto antes de desconto (centavos) */
  grossAmount: number;
  /** Valor do desconto (centavos) */
  discountAmount: number;
  /** Valor líquido após desconto (centavos) */
  netAmount: number;
  /** Código do cupom aplicado */
  couponCode?: string | null;
  /** Exibir como "Valor pago" ou "Total a pagar" */
  variant?: 'paid' | 'toPay';
  /** Tamanho da fonte */
  size?: 'sm' | 'md' | 'lg';
  /** Mostrar tooltip sobre desconto */
  showDiscountTooltip?: boolean;
}

export function PaymentSummary({
  grossAmount,
  discountAmount,
  netAmount,
  couponCode,
  variant = 'paid',
  size = 'md',
  showDiscountTooltip = false,
}: PaymentSummaryProps) {
  const hasDiscount = discountAmount > 0;
  const { paymentSummary } = MICROCOPY;

  // Classes baseadas no tamanho
  const sizeClasses = {
    sm: {
      text: 'text-sm',
      value: 'text-base font-semibold',
      label: 'text-xs',
    },
    md: {
      text: 'text-base',
      value: 'text-lg font-semibold',
      label: 'text-sm',
    },
    lg: {
      text: 'text-lg',
      value: 'text-xl font-bold',
      label: 'text-base',
    },
  };

  const classes = sizeClasses[size];
  const totalLabel = variant === 'paid' ? paymentSummary.paidLabel : paymentSummary.totalLabel;

  // Sem desconto: mostrar apenas valor final
  if (!hasDiscount) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className={`${classes.label} text-gray-600`}>{totalLabel}</span>
          <span className={`${classes.value} text-green-600`}>
            {formatCurrency(netAmount)}
          </span>
        </div>
      </div>
    );
  }

  // Com desconto: mostrar breakdown completo
  return (
    <div className="space-y-2">
      {/* Subtotal */}
      <div className="flex justify-between items-center">
        <span className={`${classes.label} text-gray-500`}>
          {paymentSummary.subtotalLabel}
        </span>
        <span className={`${classes.text} text-gray-700`}>
          {formatCurrency(grossAmount)}
        </span>
      </div>

      {/* Desconto */}
      <div className="flex justify-between items-center group relative">
        <span className={`${classes.label} text-green-600`}>
          {couponCode 
            ? paymentSummary.couponAppliedLabel(couponCode) 
            : paymentSummary.discountLabel}
        </span>
        <span className={`${classes.text} text-green-600`}>
          -{formatCurrency(discountAmount)}
        </span>
        
        {/* Tooltip */}
        {showDiscountTooltip && (
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
            <div className="bg-gray-800 text-white text-xs rounded-lg p-2 max-w-xs shadow-lg">
              {paymentSummary.discountTooltip}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 pt-2">
        <div className="flex justify-between items-center">
          <span className={`${classes.label} font-medium text-gray-800`}>
            {totalLabel}
          </span>
          <span className={`${classes.value} text-green-600`}>
            {formatCurrency(netAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componente: RefundPolicyNotice - Aviso de Política
// ============================================================

interface RefundPolicyNoticeProps {
  /** Variante visual */
  variant?: 'info' | 'warning';
  /** Tamanho */
  size?: 'sm' | 'md';
  /** Mostrar apenas se houver cupom */
  showOnlyWithCoupon?: boolean;
  /** Tinha cupom na reserva */
  hadCoupon?: boolean;
}

export function RefundPolicyNotice({
  variant = 'info',
  size = 'md',
  showOnlyWithCoupon = false,
  hadCoupon = false,
}: RefundPolicyNoticeProps) {
  // Se configurado para mostrar só com cupom e não tinha cupom, não renderizar
  if (showOnlyWithCoupon && !hadCoupon) {
    return null;
  }

  const { bookingDetails } = MICROCOPY;

  const variantClasses = {
    info: 'bg-amber-50 border-amber-200 text-amber-800',
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
  };

  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
  };

  return (
    <div className={`border rounded-lg ${variantClasses[variant]} ${sizeClasses[size]}`}>
      <p className="font-medium">ℹ️ {bookingDetails.refundPolicyTitle}</p>
      <p className="mt-1 opacity-90">
        {bookingDetails.refundPolicyText}
      </p>
    </div>
  );
}

// ============================================================
// Componente: CancellationEligibilityBadge - Badge de Elegibilidade
// ============================================================

interface CancellationEligibilityBadgeProps {
  /** Se está dentro do prazo de 48h */
  isEligible: boolean;
  /** Horas restantes até a reserva */
  hoursRemaining?: number;
}

export function CancellationEligibilityBadge({
  isEligible,
  hoursRemaining,
}: CancellationEligibilityBadgeProps) {
  if (isEligible) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
        <span>✓</span>
        <span>Elegível para reembolso</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
      <span>✗</span>
      <span>
        {hoursRemaining !== undefined 
          ? `Menos de 48h (${Math.floor(hoursRemaining)}h restantes)`
          : 'Fora do prazo para reembolso'}
      </span>
    </div>
  );
}

// ============================================================
// Componente: CouponWarning - Aviso sobre Cupom
// ============================================================

interface CouponWarningProps {
  /** Código do cupom */
  couponCode: string;
}

export function CouponWarning({ couponCode }: CouponWarningProps) {
  const { cancellation } = MICROCOPY;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
      <p className="font-medium">⚠️ Atenção</p>
      <p className="mt-1">
        Esta reserva utilizou o cupom <strong>{couponCode}</strong>. 
        O desconto aplicado não será creditado em caso de cancelamento.
      </p>
    </div>
  );
}
