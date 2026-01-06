// ===========================================================
// Componente: BookingWizardModal - Modal de agendamento
// Props: isOpen, onClose, userId
// Fecha com ESC, scroll interno, responsivo
// ===========================================================

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { CreditBookingWizard } from './CreditBookingWizard';

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  emailVerified?: boolean;
  onSuccess?: (bookingId: string) => void;
  onPurchaseCredits?: () => void;
  onResendVerification?: () => void;
}

export function BookingWizardModal({ 
  isOpen, 
  onClose, 
  userId, 
  emailVerified = true,
  onSuccess, 
  onPurchaseCredits,
  onResendVerification,
}: BookingWizardModalProps) {
  // Fecha com ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Previne scroll do body
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Não renderiza se fechado
  if (!isOpen) return null;

  function handleSuccess(bookingId: string) {
    if (onSuccess) {
      onSuccess(bookingId);
    }
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <CreditBookingWizard
            userId={userId}
            emailVerified={emailVerified}
            onSuccess={handleSuccess}
            onCancel={onClose}
            onPurchaseCredits={onPurchaseCredits}
            onResendVerification={onResendVerification}
          />
        </div>
      </div>
    </div>
  );
}
