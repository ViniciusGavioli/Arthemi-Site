// ===========================================================
// Página: /minha-conta/reservas - Lista de Reservas do Cliente
// ===========================================================

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format, isPast, isFuture, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// FIX D: Número do WhatsApp para fallback
const WHATSAPP_NUMBER = '5531984916090';

interface Booking {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  creditsUsed: number;
}

// FIX D: Estados de cancelamento por booking
interface CancelState {
  loading: boolean;
  error: string | null;
  showWhatsApp: boolean;
}

export default function ReservasPage() {
  const router = useRouter();
  const { created } = router.query;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  
  // FIX D: Estado de cancelamento por booking
  const [cancelStates, setCancelStates] = useState<Record<string, CancelState>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // FIX D: Função para buscar reservas (reutilizável para refetch)
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

  // FIX D: Função de cancelamento
  const handleCancelBooking = async (bookingId: string) => {
    // Atualizar estado para "cancelando"
    setCancelStates(prev => ({
      ...prev,
      [bookingId]: { loading: true, error: null, showWhatsApp: false }
    }));

    try {
      const res = await fetch(`/api/me/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.ok) {
        // Sucesso: atualizar UI imediatamente e refetch
        setSuccessMessage('Reserva cancelada com sucesso!');
        setCancelStates(prev => ({
          ...prev,
          [bookingId]: { loading: false, error: null, showWhatsApp: false }
        }));
        
        // Atualizar booking localmente para feedback imediato
        setBookings(prev => prev.map(b => 
          b.id === bookingId ? { ...b, status: 'CANCELLED' } : b
        ));
        
        // Refetch para garantir dados atualizados
        await fetchBookings();
        
        // Limpar mensagem após 5s
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        // Erro: mostrar mensagem e fallback WhatsApp
        setCancelStates(prev => ({
          ...prev,
          [bookingId]: { 
            loading: false, 
            error: data.error || 'Erro ao cancelar reserva', 
            showWhatsApp: true 
          }
        }));
      }
    } catch (err) {
      // Erro de conexão: mostrar fallback WhatsApp
      setCancelStates(prev => ({
        ...prev,
        [bookingId]: { 
          loading: false, 
          error: 'Erro de conexão. Tente novamente ou fale conosco.', 
          showWhatsApp: true 
        }
      }));
    }
  };

  // FIX D: Gerar link do WhatsApp com mensagem
  const getWhatsAppLink = (bookingId: string) => {
    const message = `Olá! Tive problema ao cancelar minha reserva. Código: ${bookingId.slice(0, 8).toUpperCase()}. Podem ajudar?`;
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

          {/* Mensagem de sucesso */}
          {created && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-700">✅ Reserva criada com sucesso!</p>
            </div>
          )}
          
          {/* FIX D: Mensagem de sucesso de cancelamento */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-700">✅ {successMessage}</p>
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
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
                    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${
                      !isUpcoming ? 'opacity-60' : ''
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

                    {/* Ações - FIX D: Cancelamento funcional */}
                    {isUpcoming && booking.status === 'CONFIRMED' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {/* Estado de cancelamento */}
                        {cancelStates[booking.id]?.error && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                            <p className="text-red-700 text-sm">{cancelStates[booking.id].error}</p>
                          </div>
                        )}
                        
                        <div className="flex gap-3 items-center">
                          <button
                            className={`text-sm font-medium transition-colors ${
                              cancelStates[booking.id]?.loading
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-red-600 hover:text-red-700'
                            }`}
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancelStates[booking.id]?.loading}
                          >
                            {cancelStates[booking.id]?.loading ? 'Cancelando...' : 'Cancelar reserva'}
                          </button>
                          
                          {/* FIX D: Botão WhatsApp fallback quando erro */}
                          {cancelStates[booking.id]?.showWhatsApp && (
                            <a
                              href={getWhatsAppLink(booking.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1"
                            >
                              📱 Falar no WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
