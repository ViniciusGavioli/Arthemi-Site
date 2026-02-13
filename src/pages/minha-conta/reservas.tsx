// ===========================================================
// Página: /minha-conta/reservas - Lista de Reservas do Cliente
// ===========================================================
// P0-3: Cancelamento de reservas PENDING restaurado

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format, isPast, isFuture, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WHATSAPP_NUMBER } from '@/config/contact';

interface Booking {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  creditsUsed: number;
}

export default function ReservasPage() {
  const router = useRouter();
  const { created } = router.query;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Função para buscar reservas
  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/user/bookings?limit=100');
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Erro ao buscar reservas:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        if (!authData.authenticated) {
          router.push('/login');
          return;
        }
        await fetchBookings();
      } catch (err) {
        console.error('Erro ao inicializar:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchBookings]);

  // Cancelar reserva PENDING
  async function handleCancelPending(bookingId: string) {
    setCancellingId(bookingId);
    setShowCancelModal(null);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || 'Reserva cancelada com sucesso!');
        await fetchBookings();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Erro ao cancelar reserva');
      }
    } catch {
      setError('Erro de conexão ao cancelar');
    } finally {
      setCancellingId(null);
    }
  }

  // P0-3: Gerar link do WhatsApp com mensagem para solicitar cancelamento
  const getWhatsAppCancelLink = (bookingId: string) => {
    const message = `Olá! Gostaria de solicitar o cancelamento da minha reserva. Código: ${bookingId.slice(0, 8).toUpperCase()}. Podem me ajudar?`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      CANCELLED: 'bg-red-100 text-red-700',
      COMPLETED: 'bg-gray-100 text-gray-700',
      NO_SHOW: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirmada',
      PENDING: 'Pendente',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Concluída',
      NO_SHOW: 'Não compareceu',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  }

  const filteredBookings = bookings.filter((b) => {
    const start = new Date(b.startTime);
    if (filter === 'upcoming') return isFuture(start) && b.status !== 'CANCELLED';
    if (filter === 'past') return isPast(start) || b.status === 'CANCELLED';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Minhas Reservas | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/minha-conta">
              <span className="text-primary-600 hover:text-primary-700">← Voltar</span>
            </Link>
            <Link
              href="/minha-conta/nova-reserva"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              + Nova Reserva
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Minhas Reservas</h1>

          {created && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-700">✅ Reserva criada com sucesso!</p>
            </div>
          )}

          {/* Mensagem de sucesso */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
              <span>✅ {successMessage}</span>
              <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800">✕</button>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 mb-6">
            {[
              { key: 'upcoming', label: 'Próximas' },
              { key: 'past', label: 'Passadas' },
              { key: 'all', label: 'Todas' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <span className="text-5xl mb-4 block">📅</span>
              <p className="text-gray-600 mb-6">
                {filter === 'upcoming'
                  ? 'Você não tem reservas agendadas'
                  : 'Nenhuma reserva encontrada'}
              </p>
              <Link
                href="/minha-conta/nova-reserva"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Fazer nova reserva
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const start = new Date(booking.startTime);
                const end = new Date(booking.endTime);
                const hours = differenceInHours(end, start);
                const isUpcoming = isFuture(start);

                return (
                  <div
                    key={booking.id}
                    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${!isUpcoming ? 'opacity-60' : ''
                      }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{booking.roomName}</p>
                        <p className="text-sm text-gray-500">
                          {format(start, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>
                        🕐 {format(start, 'HH:mm')} - {format(end, 'HH:mm')} ({hours}h)
                      </span>
                      {booking.creditsUsed > 0 && (
                        <span>💰 {formatCurrency(booking.creditsUsed)}</span>
                      )}
                      {booking.amountPaid > 0 && (
                        <span>💳 {formatCurrency(booking.amountPaid)}</span>
                      )}
                    </div>

                    {/* Botão cancelar para reservas PENDING */}
                    {isUpcoming && booking.status === 'PENDING' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => setShowCancelModal(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          {cancellingId === booking.id ? (
                            <>
                              <span className="animate-spin">⏳</span> Cancelando...
                            </>
                          ) : (
                            <>
                              ❌ Cancelar reserva pendente
                            </>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                          O horário será liberado imediatamente
                        </p>
                      </div>
                    )}

                    {/* Link WhatsApp para reservas CONFIRMED */}
                    {isUpcoming && booking.status === 'CONFIRMED' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex gap-3 items-center">
                          <a
                            href={getWhatsAppCancelLink(booking.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-600 hover:text-gray-800 flex items-center gap-2"
                          >
                            📱 Precisa cancelar? Fale conosco
                          </a>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Cancelamentos são processados via WhatsApp com até 48h de antecedência
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal de confirmação de cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmar Cancelamento
            </h3>
            <p className="text-gray-600 mb-4">
              Tem certeza que deseja cancelar esta reserva pendente?
            </p>
            <ul className="text-sm text-gray-500 mb-6 space-y-1">
              <li>✓ O horário será liberado imediatamente</li>
              <li>✓ Créditos utilizados serão restaurados</li>
              <li>✓ Cobrança pendente será cancelada</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(null)}
                disabled={!!cancellingId}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={() => handleCancelPending(showCancelModal)}
                disabled={!!cancellingId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancellingId ? (
                  <>
                    <span className="animate-spin">⏳</span> Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
