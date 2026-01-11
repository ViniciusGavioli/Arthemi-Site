// ===========================================================
// Página: /booking/[id] - Visualização pública da reserva
// ===========================================================
// FASE 1.4: Cliente visualiza e cancela sua reserva

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { analytics } from '@/lib/analytics';
import { MICROCOPY, POLICY_CONSTANTS } from '@/lib/policies';

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
  // Campos de auditoria de cupom/desconto
  grossAmount: number | null;
  discountAmount: number | null;
  netAmount: number | null;
  couponCode: string | null;
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
  // P0-3: Removido states de cancelamento - usuário não pode cancelar

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

  // P0-3: Funções de cancelamento removidas - apenas ADMIN pode cancelar

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
  // P0-3: cancelCheck removido - usuário não pode cancelar
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
              
              {/* Consultório */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🏥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Consultório</p>
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

              {/* Valor - Resumo com Cupom/Desconto */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Resumo do Pagamento</p>
                  
                  {/* Se houver desconto, mostrar detalhamento */}
                  {booking.discountAmount && booking.discountAmount > 0 ? (
                    <div className="space-y-1 mt-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-700">{formatCurrency(booking.grossAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">
                          Desconto {booking.couponCode ? `(${booking.couponCode})` : ''}
                        </span>
                        <span className="text-green-600">-{formatCurrency(booking.discountAmount)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-100">
                        <span className="font-semibold text-gray-800">Total Pago</span>
                        <span className="font-bold text-green-600">{formatCurrency(booking.netAmount || booking.amountPaid)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(booking.amountPaid)}
                    </p>
                  )}
                  
                  {booking.paymentMethod && (
                    <p className="text-sm text-gray-400 mt-1">via {booking.paymentMethod}</p>
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

            {/* Ações - P0-3: Apenas WhatsApp, sem cancelamento direto */}
            <div className="px-6 pb-6 space-y-3">
              
              {/* Aviso sobre reembolso - aparece apenas se não está cancelado */}
              {booking.status !== 'CANCELLED' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p className="font-medium">ℹ️ {MICROCOPY.bookingDetails.refundPolicyTitle}</p>
                  <p className="mt-1 text-amber-700">
                    {MICROCOPY.bookingDetails.refundPolicyText}
                  </p>
                </div>
              )}
              
              {/* Link WhatsApp para cancelamento */}
              {booking.status !== 'CANCELLED' && (
                <a
                  href={`https://wa.me/5531984916090?text=Olá! Preciso de ajuda para cancelar minha reserva ${booking.id.slice(0, 8).toUpperCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-center hover:bg-gray-50 transition"
                >
                  📱 Precisa cancelar? Fale conosco
                </a>
              )}

              {/* Link WhatsApp para dúvidas */}
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
    </>
  );
}
