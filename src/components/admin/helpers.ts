// ===========================================================
// Hook para gerenciar Toast notifications
// ===========================================================

import { useState, useCallback } from 'react';
import { ToastType as UIToastType } from './ui';

// Re-export ToastType for convenience
export type ToastType = UIToastType;

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
}

// ===========================================================
// Helpers de formatação
// ===========================================================

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(dateString: string): string {
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function getWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const url = `https://wa.me/55${digits}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

export function getPhoneLink(phone: string): string {
  return `tel:+55${phone.replace(/\D/g, '')}`;
}

export function getEmailLink(email: string, subject?: string): string {
  const url = `mailto:${email}`;
  return subject ? `${url}?subject=${encodeURIComponent(subject)}` : url;
}

// ===========================================================
// Status helpers - Com ícones e textos amigáveis
// ===========================================================

export const statusLabels: Record<string, string> = {
  PENDING: 'Aguardando',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
  NO_SHOW: 'Não compareceu',
};

export const statusIcons: Record<string, string> = {
  PENDING: '⏳',
  CONFIRMED: '✅',
  CANCELLED: '❌',
  COMPLETED: '✓',
  NO_SHOW: '👤',
};

export const statusColors: Record<string, 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange'> = {
  PENDING: 'yellow',
  CONFIRMED: 'green',
  CANCELLED: 'red',
  COMPLETED: 'blue',
  NO_SHOW: 'orange',
};

// Labels completos com ícones para exibição
export const statusBadges: Record<string, { label: string; icon: string; color: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange' }> = {
  PENDING: { label: 'Aguardando', icon: '⏳', color: 'yellow' },
  CONFIRMED: { label: 'Confirmada', icon: '✅', color: 'green' },
  CANCELLED: { label: 'Cancelada', icon: '❌', color: 'red' },
  COMPLETED: { label: 'Concluída', icon: '✓', color: 'blue' },
  NO_SHOW: { label: 'Não compareceu', icon: '👤', color: 'orange' },
};

// Badges especiais
export const specialBadges = {
  MANUAL: { label: 'Manual', icon: '✋', color: 'purple' as const },
  CREDIT: { label: 'Com crédito', icon: '💳', color: 'green' as const },
  LOCKED: { label: 'Bloqueada', icon: '🔒', color: 'gray' as const },
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  APPROVED: 'Pago',
  REJECTED: 'Pagamento recusado',
  REFUNDED: 'Reembolsado',
};

export const creditTypeLabels: Record<string, string> = {
  SUBLET: 'Sublocação',
  PROMO: 'Promocional',
  CANCELLATION: 'Cancelamento',
  SATURDAY: 'Sábado',
  MANUAL: 'Cortesia',
};

export const creditTypeIcons: Record<string, string> = {
  SUBLET: '🔄',
  PROMO: '🎉',
  CANCELLATION: '↩️',
  SATURDAY: '📅',
  MANUAL: '🎁',
};

export const creditStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Disponível',
  USED: 'Utilizado',
  EXPIRED: 'Expirado',
};

export const creditStatusColors: Record<string, 'gray' | 'green' | 'yellow' | 'red' | 'blue'> = {
  PENDING: 'yellow',
  CONFIRMED: 'green',
  USED: 'gray',
  EXPIRED: 'red',
};

// ===========================================================
// API helpers
// ===========================================================

export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error || 'Erro desconhecido' };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Erro de conexão' };
  }
}
