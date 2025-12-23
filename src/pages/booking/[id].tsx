// ===========================================================
// Página: /booking/[id] - Visualização pública da reserva
// ===========================================================
// FASE 1.4: Cliente visualiza e cancela sua reserva

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { analytics } from '@/lib/analytics';

// ============================================================
// TIPOS
// ============================================================

interface Booking {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  startTime: string;
  endTime: string;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  room: {
    id: string;
    name: string;
    description: string | null;
  };
  user: {
    name: string;
    email: string;
    phone: string;
  };
  product: {
    name: string;
    price: number;
    type: string;
  } | null;
}

// ============================================================
// HELPERS
// ============================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return {
        label: 'Confirmada',
        color: 'bg-green-100 text-green-700',
        icon: '✅',
      };
    case 'PENDING':
      return {
        label: 'Pendente',
        color: 'bg-yellow-100 text-yellow-700',
        icon: '⏳',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelada',
        color: 'bg-red-100 text-red-700',
        icon: '❌',
      };
    default:
      return {
        label: status,
        color: 'bg-gray-100 text-gray-700',
        icon: '📋',
      };
  }
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function BookingDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Buscar reserva
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`/api/bookings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Reserva não encontrada');
        return res.json();
      })
      .then((data) => {
        setBooking(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setBooking(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Verificar se pode cancelar
  const canCancel = (): { allowed: boolean; reason?: string } => {
    if (!booking) return { allowed: false, reason: 'Reserva não encontrada' };
    
    if (booking.status === 'CANCELLED') {
      return { allowed: false, reason: 'Reserva já cancelada' };
    }

    const now = new Date();
    const startTime = new Date(booking.startTime);
    
    if (startTime <= now) {
      return { allowed: false, reason: 'A reserva já iniciou ou passou' };
    }

    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilStart < 2) {
      return { 
        allowed: false, 
        reason: 'Cancelamento permitido apenas com 2h de antecedência' 
      };
    }

    return { allowed: true };
  };

  // Handler de cancelamento
  const handleCancel = async () => {
    if (!booking) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cancelar');
      }

      // Rastrear cancelamento
      analytics.bookingCancelled(booking.room.name);

      // Atualizar estado local
      setBooking({ ...booking, status: 'CANCELLED' });
      setShowCancelConfirm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar reserva');
    } finally {
      setCancelling(false);
    }
  };

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando reserva...</p>
        </div>
      </div>
    );
  }

  // Erro
  if (error || !booking) {
    return (
      <>
        <Head>
          <title>Reserva não encontrada | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">😕</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Reserva não encontrada
            </h1>
            <p className="text-gray-600 mb-6">
              O link pode estar incorreto ou a reserva não existe mais.
            </p>
            <Link
              href="/"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </>
    );
  }

  const statusConfig = getStatusConfig(booking.status);
  const cancelCheck = canCancel();
  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const durationHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

  return (
    <>
      <Head>
        <title>Minha Reserva | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-warm-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          
          {/* Header */}
          <div className="text-center mb-6">
            <Link href="/" className="text-primary-600 hover:text-primary-700 text-sm">
              ← Voltar ao site
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-2">
              Minha Reserva
            </h1>
          </div>

          {/* Card Principal */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            
            {/* Status Banner */}
            <div className={`px-6 py-4 ${
              booking.status === 'CONFIRMED' ? 'bg-green-500' :
              booking.status === 'CANCELLED' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <span className="text-2xl">{statusConfig.icon}</span>
                  <span className="font-semibold text-lg">{statusConfig.label}</span>
                </div>
                <span className="text-white/80 text-sm font-mono">
                  #{booking.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6">
              
              {/* Sala */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🏥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sala</p>
                  <p className="text-lg font-semibold text-gray-800">{booking.room.name}</p>
                </div>
              </div>

              {/* Data e Hora */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Data e Horário</p>
                  <p className="text-lg font-semibold text-gray-800 capitalize">
                    {formatDate(booking.startTime)}
                  </p>
                  <p className="text-gray-600">
                    {formatTime(booking.startTime)} às {formatTime(booking.endTime)}
                    <span className="text-gray-400"> ({durationHours}h)</span>
                  </p>
                </div>
              </div>

              {/* Valor */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Pago</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(booking.amountPaid)}
                  </p>
                  {booking.paymentMethod && (
                    <p className="text-sm text-gray-400">via {booking.paymentMethod}</p>
                  )}
                </div>
              </div>

              {/* Produto/Pacote (se houver) */}
              {booking.product && (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📦</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pacote</p>
                    <p className="text-lg font-semibold text-gray-800">{booking.product.name}</p>
                  </div>
                </div>
              )}

              {/* Observações (se houver) */}
              {booking.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Observações</p>
                  <p className="text-gray-700">{booking.notes}</p>
                </div>
              )}

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Dados do Cliente */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Dados do Cliente</p>
                <div className="space-y-1">
                  <p className="text-gray-800 font-medium">{booking.user.name}</p>
                  <p className="text-gray-600 text-sm">{booking.user.phone}</p>
                  <p className="text-gray-600 text-sm">{booking.user.email}</p>
                </div>
              </div>

            </div>

            {/* Ações */}
            <div className="px-6 pb-6 space-y-3">
              
              {/* Botão Cancelar */}
              {cancelCheck.allowed ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition"
                >
                  Cancelar Reserva
                </button>
              ) : booking.status !== 'CANCELLED' && (
                <div className="text-center text-sm text-gray-500 py-2">
                  {cancelCheck.reason}
                </div>
              )}

              {/* Link WhatsApp */}
              <a
                href={`https://wa.me/5531984916090?text=Olá! Tenho uma dúvida sobre minha reserva ${booking.id.slice(0, 8).toUpperCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-green-500 text-white rounded-lg font-semibold text-center hover:bg-green-600 transition"
              >
                💬 Falar no WhatsApp
              </a>

            </div>
          </div>

          {/* Info */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Guarde este link para consultar sua reserva a qualquer momento.
          </p>

        </div>
      </div>

      {/* Modal de Confirmação de Cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Cancelar Reserva?
            </h2>
            <p className="text-gray-600 mb-6">
              Esta ação não pode ser desfeita. O reembolso será processado conforme nossa política.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {cancelling ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
