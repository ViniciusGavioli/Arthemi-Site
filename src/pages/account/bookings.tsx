// ===========================================================
// Página: /account/bookings - Minhas Reservas
// ===========================================================

import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSSR } from '@/lib/auth';

interface Booking {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  canCancel: boolean;
  hoursUntilStart: number;
}

interface BookingsData {
  upcoming: Booking[];
  past: Booking[];
}

interface PageProps {
  user: { userId: string; role: string };
}

// P0-3: Types PixKeyType e CancelModalState removidos - sem modal de cancelamento

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx: GetServerSidePropsContext) => {
  const result = requireAuthSSR(ctx);
  
  if ('redirect' in result) {
    return result;
  }
  
  return {
    props: {
      user: result.auth,
    },
  };
};

export default function BookingsPage({ user: _user }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingsData | null>(null);
  const [error, setError] = useState('');
  // P0-3: Removido states de cancelamento - usuário não pode cancelar diretamente

  async function fetchBookings() {
    try {
      const res = await fetch('/api/me/bookings');
      const data = await res.json();
      if (data.ok) {
        setBookings(data.bookings);
      } else {
        setError(data.error || 'Erro ao carregar reservas');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  // P0-3: Funções de cancelamento removidas - apenas ADMIN pode cancelar

  // Formatar data
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // Formatar hora
  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Formatar valor
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  // Badge de status
  function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirmada',
      PENDING: 'Pendente',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Concluída',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  }

  // Card de reserva - P0-3: Sem botão de cancelar, apenas link WhatsApp
  function BookingCard({ booking, showCancel: _showCancel }: { booking: Booking; showCancel: boolean }) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{booking.roomName}</h3>
            <p className="text-sm text-gray-500">
              {formatDate(booking.startTime)}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-medium">{formatTime(booking.startTime)}</span>
            <span className="mx-1">→</span>
            <span className="font-medium">{formatTime(booking.endTime)}</span>
          </div>
          <div className="font-medium text-gray-900">
            {formatCurrency(booking.totalAmount)}
          </div>
        </div>

        {/* P0-3: Link WhatsApp ao invés de botão de cancelar */}
        {booking.status !== 'CANCELLED' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a
              href={`https://wa.me/5531984916090?text=Olá! Preciso de ajuda com minha reserva ${booking.id.slice(0, 8).toUpperCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              📱 Precisa cancelar? Fale conosco
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Minhas Reservas | Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-amber-600">
              Arthemi
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/account" className="text-gray-600 hover:text-gray-900">
                Minha Conta
              </Link>
              <span className="text-amber-600 font-medium">Reservas</span>
              <Link href="/account/credits" className="text-gray-600 hover:text-gray-900">
                Créditos
              </Link>
            </nav>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Minhas Reservas</h1>
          <p className="text-gray-600 mb-8">
            Gerencie suas reservas e acompanhe seu histórico
          </p>

          {/* Mensagens - P0-3: successMessage removido */}

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
          )}

          {!loading && !error && bookings && (
            <>
              {/* Próximas reservas */}
              <section className="mb-10">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Próximas Reservas
                </h2>

                {bookings.upcoming.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                    <p className="text-gray-500 mb-4">Nenhuma reserva agendada</p>
                    <Link
                      href="/salas"
                      className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-2 rounded-lg hover:bg-amber-700 transition text-sm"
                    >
                      Fazer uma Reserva
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.upcoming.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} showCancel={true} />
                    ))}
                  </div>
                )}
              </section>

              {/* Histórico */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Histórico
                </h2>

                {bookings.past.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                    <p className="text-gray-500">Nenhuma reserva anterior</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.past.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} showCancel={false} />
                    ))}
                  </div>
                )}
              </section>

              {/* Info de cancelamento */}
              <div className="mt-8 bg-blue-50 text-blue-800 rounded-lg p-4 text-sm">
                <p className="font-medium mb-1">📋 Política de cancelamento</p>
                <p>
                  Reservas podem ser canceladas com no mínimo 48 horas de antecedência.
                  Após esse prazo, o cancelamento não estará disponível.
                </p>
              </div>

              {/* Link para pedidos de estorno */}
              <div className="mt-4">
                <Link
                  href="/account/refunds"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Ver meus pedidos de estorno →
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
      {/* P0-3: Modal de cancelamento removido - usuário contata via WhatsApp */}
    </>
  );
}
