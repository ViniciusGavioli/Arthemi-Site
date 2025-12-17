import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// FullCalendar precisa ser importado dinamicamente por causa do SSR
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  room: {
    id: string;
    name: string;
  };
  user: {
    name: string;
    phone: string | null;
  };
  product: {
    name: string;
  } | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    booking: Booking;
  };
}

// Cores por sala
const roomColors: Record<string, string> = {
  'Sala A': '#22c55e', // green-500
  'Sala B': '#3b82f6', // blue-500
  'Sala C': '#f59e0b', // amber-500
};

// Cores por status
const statusColors: Record<string, string> = {
  CONFIRMED: '#22c55e',
  PENDING: '#f59e0b',
  CANCELLED: '#ef4444',
};

export default function AdminPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    revenue: 0,
  });

  // Buscar reservas
  const fetchBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterRoom !== 'all') params.append('roomId', filterRoom);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const res = await fetch(`/api/admin/bookings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [filterRoom, filterStatus]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Converter bookings para eventos do calendário
  const events: CalendarEvent[] = bookings.map(booking => ({
    id: booking.id,
    title: `${booking.room.name} - ${booking.user.name}`,
    start: booking.startTime,
    end: booking.endTime,
    backgroundColor: statusColors[booking.status] || '#6b7280',
    borderColor: roomColors[booking.room.name] || '#6b7280',
    extendedProps: { booking },
  }));

  // Handler de clique em evento
  function handleEventClick(info: { event: { extendedProps: Record<string, unknown> } }) {
    const booking = info.event.extendedProps.booking as Booking;
    if (booking) {
      setSelectedBooking(booking);
    }
  }

  // Atualizar status da reserva
  async function updateBookingStatus(bookingId: string, status: string) {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchBookings();
        setSelectedBooking(null);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  }

  return (
    <>
      <Head>
        <title>Admin | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">
                🗓️ Painel Administrativo
              </h1>
              <span className="text-sm text-gray-500">Espaço Arthemi</span>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Voltar ao site
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Total Reservas"
              value={stats.total}
              color="bg-gray-500"
            />
            <StatCard
              label="Confirmadas"
              value={stats.confirmed}
              color="bg-green-500"
            />
            <StatCard
              label="Pendentes"
              value={stats.pending}
              color="bg-yellow-500"
            />
            <StatCard
              label="Canceladas"
              value={stats.cancelled}
              color="bg-red-500"
            />
            <StatCard
              label="Receita"
              value={`R$ ${stats.revenue.toFixed(2)}`}
              color="bg-primary"
            />
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
            <div>
              <label htmlFor="filter-room" className="block text-sm font-medium text-gray-700 mb-1">
                Sala
              </label>
              <select
                id="filter-room"
                aria-label="Filtrar por sala"
                value={filterRoom}
                onChange={e => setFilterRoom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">Todas</option>
                <option value="sala-a">Sala A</option>
                <option value="sala-b">Sala B</option>
                <option value="sala-c">Sala C</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="filter-status"
                aria-label="Filtrar por status"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">Todos</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="PENDING">Pendente</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchBookings}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>

          {/* Legenda */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Legenda de Cores</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-gray-600">Confirmado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm text-gray-600">Pendente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm text-gray-600">Cancelado</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-4 border-green-500"></div>
                <span className="text-sm text-gray-600">Sala A</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-4 border-blue-500"></div>
                <span className="text-sm text-gray-600">Sala B</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-4 border-amber-500"></div>
                <span className="text-sm text-gray-600">Sala C</span>
              </div>
            </div>
          </div>

          {/* Calendário */}
          <div className="bg-white rounded-lg shadow p-4">
            {loading ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                locale={ptBrLocale}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={events}
                eventClick={handleEventClick}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                height={600}
                nowIndicator
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5, 6],
                  startTime: '08:00',
                  endTime: '20:00',
                }}
              />
            )}
          </div>
        </main>

        {/* Modal de Detalhes */}
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onUpdateStatus={updateBookingStatus}
          />
        )}
      </div>
    </>
  );
}

// Componente de Card de Estatística
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className={`w-2 h-2 rounded-full ${color} mb-2`}></div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

// Modal de Detalhes da Reserva
function BookingDetailModal({
  booking,
  onClose,
  onUpdateStatus,
}: {
  booking: Booking;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Detalhes da Reserva
              </h2>
              <p className="text-sm text-gray-500 font-mono">
                #{booking.id.slice(0, 8)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Status Badge */}
          <div className="mb-4">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                booking.status === 'CONFIRMED'
                  ? 'bg-green-100 text-green-700'
                  : booking.status === 'PENDING'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {booking.status === 'CONFIRMED'
                ? '✓ Confirmado'
                : booking.status === 'PENDING'
                ? '⏱ Pendente'
                : '✗ Cancelado'}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente</span>
              <span className="font-medium text-gray-800">{booking.user.name}</span>
            </div>
            {booking.user.phone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Telefone</span>
                <a
                  href={`tel:${booking.user.phone}`}
                  className="font-medium text-primary hover:underline"
                >
                  {booking.user.phone}
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Sala</span>
              <span className="font-medium text-gray-800">{booking.room.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data</span>
              <span className="font-medium text-gray-800">
                {startDate.toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Horário</span>
              <span className="font-medium text-gray-800">
                {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {booking.product && (
              <div className="flex justify-between">
                <span className="text-gray-500">Produto</span>
                <span className="font-medium text-gray-800">{booking.product.name}</span>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Ações</p>
            {booking.status !== 'CONFIRMED' && (
              <button
                onClick={() => onUpdateStatus(booking.id, 'CONFIRMED')}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                ✓ Confirmar Reserva
              </button>
            )}
            {booking.status !== 'CANCELLED' && (
              <button
                onClick={() => onUpdateStatus(booking.id, 'CANCELLED')}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                ✗ Cancelar Reserva
              </button>
            )}
            {booking.user.phone && (
              <a
                href={`https://wa.me/55${booking.user.phone.replace(/\D/g, '')}?text=Olá ${booking.user.name}! Sobre sua reserva no Espaço Arthemi...`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                💬 WhatsApp
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full border border-gray-300 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
