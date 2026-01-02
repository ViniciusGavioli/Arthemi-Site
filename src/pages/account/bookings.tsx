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

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

interface CancelModalState {
  isOpen: boolean;
  bookingId: string | null;
  roomName: string;
  totalAmount: number;
}

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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal de cancelamento
  const [cancelModal, setCancelModal] = useState<CancelModalState>({
    isOpen: false,
    bookingId: null,
    roomName: '',
    totalAmount: 0,
  });
  const [requestRefund, setRequestRefund] = useState(false);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const [pixKey, setPixKey] = useState('');
  const [refundReason, setRefundReason] = useState('');

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

  // Abrir modal de cancelamento
  function openCancelModal(booking: Booking) {
    setCancelModal({
      isOpen: true,
      bookingId: booking.id,
      roomName: booking.roomName,
      totalAmount: booking.totalAmount,
    });
    setRequestRefund(false);
    setPixKeyType('CPF');
    setPixKey('');
    setRefundReason('');
    setError('');
  }

  // Fechar modal
  function closeCancelModal() {
    setCancelModal({
      isOpen: false,
      bookingId: null,
      roomName: '',
      totalAmount: 0,
    });
  }

  // Processar cancelamento
  async function handleCancelSubmit() {
    if (!cancelModal.bookingId) return;

    // Validar campos se pediu estorno
    if (requestRefund) {
      if (!pixKey.trim()) {
        setError('Informe a chave PIX para receber o estorno');
        return;
      }
    }

    setCancellingId(cancelModal.bookingId);
    setError('');
    setSuccessMessage('');

    try {
      const body: {
        requestRefund?: boolean;
        pixKeyType?: PixKeyType;
        pixKey?: string;
        reason?: string;
      } = {};

      if (requestRefund) {
        body.requestRefund = true;
        body.pixKeyType = pixKeyType;
        body.pixKey = pixKey.trim();
        if (refundReason.trim()) {
          body.reason = refundReason.trim();
        }
      }

      const res = await fetch(`/api/me/bookings/${cancelModal.bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        const msg = data.refundRequestId
          ? 'Reserva cancelada! Seu pedido de estorno foi registrado e você receberá um email com a atualização.'
          : 'Reserva cancelada com sucesso!';
        setSuccessMessage(msg);
        closeCancelModal();
        await fetchBookings();
      } else {
        setError(data.error || 'Erro ao cancelar reserva');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setCancellingId(null);
    }
  }

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

  // Card de reserva
  function BookingCard({ booking, showCancel }: { booking: Booking; showCancel: boolean }) {
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

        {showCancel && booking.canCancel && booking.status !== 'CANCELLED' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => openCancelModal(booking)}
              disabled={cancellingId === booking.id}
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {cancellingId === booking.id ? 'Cancelando...' : 'Cancelar reserva'}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {Math.floor(booking.hoursUntilStart)}h restantes para cancelamento
            </p>
          </div>
        )}

        {showCancel && !booking.canCancel && booking.status !== 'CANCELLED' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Cancelamento não disponível (menos de 48h para início)
            </p>
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

          {/* Mensagens */}
          {successMessage && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-6">
              {successMessage}
            </div>
          )}

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

      {/* Modal de cancelamento */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Cancelar Reserva
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {cancelModal.roomName} - {formatCurrency(cancelModal.totalAmount)}
              </p>

              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              {/* Checkbox de estorno (só aparece se houve pagamento) */}
              {cancelModal.totalAmount > 0 ? (
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestRefund}
                    onChange={(e) => setRequestRefund(e.target.checked)}
                    className="mt-1 h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Quero solicitar estorno</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Você pagou {formatCurrency(cancelModal.totalAmount)}. Pode solicitar a devolução via PIX.
                    </p>
                  </div>
                </label>
              ) : (
                <div className="bg-gray-50 text-gray-600 px-3 py-2 rounded text-sm mb-4">
                  Esta reserva não possui pagamento registrado. O cancelamento não gera estorno.
                </div>
              )}

              {/* Campos de PIX (aparecem se marcou estorno) */}
              {requestRefund && (
                <div className="space-y-4 border-t border-gray-100 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de chave PIX
                    </label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="PHONE">Telefone</option>
                      <option value="RANDOM">Chave aleatória</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chave PIX
                    </label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder={
                        pixKeyType === 'CPF' ? '000.000.000-00' :
                        pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                        pixKeyType === 'EMAIL' ? 'seu@email.com' :
                        pixKeyType === 'PHONE' ? '(00) 00000-0000' :
                        'Chave aleatória'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo (opcional)
                    </label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Informe o motivo do cancelamento..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>

                  <div className="bg-yellow-50 text-yellow-800 px-3 py-2 rounded text-xs">
                    ⚠️ O estorno será analisado pela administração e você receberá um email com o resultado.
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeCancelModal}
                  disabled={cancellingId !== null}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCancelSubmit}
                  disabled={cancellingId !== null}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {cancellingId ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
