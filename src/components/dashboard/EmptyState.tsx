// ===========================================================
// Componente: EmptyState - Estado vazio elegante
// ===========================================================

import Link from 'next/link';
import { Calendar, CreditCard, AlertCircle, RefreshCw } from 'lucide-react';

type EmptyStateVariant = 'bookings' | 'credits' | 'history' | 'error';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  iconBg: string;
}> = {
  bookings: {
    icon: <Calendar className="w-8 h-8" />,
    title: 'Nenhuma reserva agendada',
    description: 'Você ainda não tem reservas futuras. Que tal agendar um horário?',
    actionLabel: 'Agendar agora',
    actionHref: '/minha-conta/nova-reserva',
    iconBg: 'bg-primary-100 text-primary-600',
  },
  credits: {
    icon: <CreditCard className="w-8 h-8" />,
    title: 'Sem créditos disponíveis',
    description: 'Adquira um pacote de horas e aproveite condições especiais.',
    actionLabel: 'Ver pacotes',
    actionHref: '/salas',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  history: {
    icon: <Calendar className="w-8 h-8" />,
    title: 'Sem histórico',
    description: 'Suas reservas anteriores aparecerão aqui.',
    actionLabel: 'Fazer primeira reserva',
    actionHref: '/minha-conta/nova-reserva',
    iconBg: 'bg-gray-100 text-gray-600',
  },
  error: {
    icon: <AlertCircle className="w-8 h-8" />,
    title: 'Erro ao carregar',
    description: 'Não foi possível carregar os dados. Tente novamente.',
    actionLabel: 'Tentar novamente',
    actionHref: '#',
    iconBg: 'bg-red-100 text-red-600',
  },
};

export function EmptyState({
  variant,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  
  const finalTitle = title || config.title;
  const finalDescription = description || config.description;
  const finalActionLabel = actionLabel || config.actionLabel;
  const finalActionHref = actionHref || config.actionHref;

  const ActionButton = () => {
    if (variant === 'error' && onAction) {
      return (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {finalActionLabel}
        </button>
      );
    }

    return (
      <Link
        href={finalActionHref}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
      >
        {finalActionLabel}
      </Link>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${config.iconBg}`}>
        {config.icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{finalTitle}</h3>
      <p className="text-gray-500 max-w-sm mb-6">{finalDescription}</p>
      <ActionButton />
    </div>
  );
}
