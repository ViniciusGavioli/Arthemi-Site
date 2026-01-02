// ===========================================================
// ConfirmationModal - Modal de confirmação para ações críticas
// ===========================================================

import { ReactNode } from 'react';
import { Modal, Button, Badge } from './ui';
import { formatDate, formatTime, formatCurrency } from './helpers';

interface BookingInfo {
  client: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  amount?: number;
}

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title: string;
  description?: string;
  booking: BookingInfo;
  impact?: ReactNode;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  requireReason?: boolean;
  reason?: string;
  onReasonChange?: (reason: string) => void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

const variantStyles = {
  danger: {
    icon: '⚠️',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    button: 'danger' as const,
  },
  warning: {
    icon: '⚡',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
    button: 'primary' as const,
  },
  info: {
    icon: 'ℹ️',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    button: 'primary' as const,
  },
};

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  title,
  description,
  booking,
  impact,
  variant = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  requireReason = false,
  reason = '',
  onReasonChange,
  reasonLabel = 'Motivo',
  reasonPlaceholder = 'Descreva o motivo desta ação...',
}: ConfirmationModalProps) {
  const style = variantStyles[variant];
  const canConfirm = !requireReason || (reason && reason.trim().length >= 5);

  return (
    <Modal open={open} onClose={onClose} title="" size="md">
      <div className="text-center mb-6">
        {/* Ícone */}
        <div className={`w-16 h-16 rounded-full ${style.iconBg} flex items-center justify-center mx-auto mb-4`}>
          <span className={`text-3xl ${style.iconText}`}>{style.icon}</span>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>

        {/* Descrição */}
        {description && (
          <p className="text-gray-600">{description}</p>
        )}
      </div>

      {/* Detalhes da Reserva */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Reserva afetada</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Cliente:</span>
            <p className="font-semibold text-gray-800">{booking.client}</p>
          </div>
          <div>
            <span className="text-gray-500">Consultório:</span>
            <p className="font-semibold text-gray-800">{booking.room}</p>
          </div>
          <div>
            <span className="text-gray-500">Data:</span>
            <p className="font-semibold text-gray-800">{formatDate(booking.date)}</p>
          </div>
          <div>
            <span className="text-gray-500">Horário:</span>
            <p className="font-semibold text-gray-800">
              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
            </p>
          </div>
          {booking.amount !== undefined && (
            <div className="col-span-2">
              <span className="text-gray-500">Valor:</span>
              <p className="font-semibold text-gray-800">{formatCurrency(booking.amount)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Impacto da ação */}
      {impact && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-yellow-700 uppercase tracking-wide mb-1 font-medium">
            ⚡ Impacto da ação
          </p>
          <div className="text-sm text-yellow-800">{impact}</div>
        </div>
      )}

      {/* Campo de motivo */}
      {requireReason && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {reasonLabel} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange?.(e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              !canConfirm && reason.length > 0
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            placeholder={reasonPlaceholder}
          />
          {requireReason && reason.length > 0 && reason.trim().length < 5 && (
            <p className="text-xs text-red-500 mt-1">
              Motivo deve ter pelo menos 5 caracteres
            </p>
          )}
          {requireReason && !reason && (
            <p className="text-xs text-gray-500 mt-1">
              Campo obrigatório para prosseguir
            </p>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </Button>
        <Button
          variant={style.button}
          onClick={onConfirm}
          loading={loading}
          disabled={loading || !canConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
