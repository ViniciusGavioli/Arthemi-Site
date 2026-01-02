// ===========================================================
// Componente: BookingListItem - Item de reserva na lista
// ===========================================================

import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';

export type BookingStatus = 'CONFIRMED' | 'PENDING_PAYMENT' | 'CANCELLED' | 'COMPLETED';

interface BookingListItemProps {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: BookingStatus | string;
  onCancel?: (id: string) => void;
  showActions?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-700' },
  PENDING_PAYMENT: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  COMPLETED: { label: 'Concluída', className: 'bg-gray-100 text-gray-600' },
};

export function BookingListItem({
  id,
  roomName,
  startTime,
  endTime,
  status,
  onCancel,
  showActions = true,
}: BookingListItemProps) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const statusInfo = statusConfig[status] || statusConfig.PENDING_PAYMENT;

  return (
    <div className="group flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all">
      {/* Ícone da data */}
      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 flex flex-col items-center justify-center">
        <span className="text-xs font-medium text-primary-600 uppercase">
          {format(start, 'MMM', { locale: ptBR })}
        </span>
        <span className="text-xl font-bold text-primary-700">
          {format(start, 'd')}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{roomName}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {format(start, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
          </span>
        </div>
      </div>

      {/* Ações */}
      {showActions && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {status === 'CONFIRMED' && onCancel && (
            <button
              onClick={() => onCancel(id)}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
          <Link
            href={`/minha-conta/reservas?id=${id}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Skeleton para loading
export function BookingListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl animate-pulse">
      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-200" />
      <div className="flex-1">
        <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
