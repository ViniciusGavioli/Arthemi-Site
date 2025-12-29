// ===========================================================
// Reservas - Lista e Calendário de reservas
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, Button, Badge, Input, Select, Table, Spinner, Toast } from '@/components/admin/ui';
import { 
  useToast, formatDate, formatTime, formatCurrency, getWhatsAppLink, 
  statusLabels, statusColors 
} from '@/components/admin/helpers';
import BookingDetailModal from '@/components/admin/BookingDetailModal';

// FullCalendar precisa de import dinâmico
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// Resources (consultórios) para o calendário
const calendarResources = [
  { id: 'sala-a', title: 'Consultório 1' },
  { id: 'sala-b', title: 'Consultório 2' },
  { id: 'sala-c', title: 'Consultório 3' },
];

// Tipos
interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  creditsUsed?: number;
  isManual?: boolean;
  notes?: string;
  room: { id: string; name: string };
  user: { id: string; name: string; phone: string | null; email: string };
  product?: { id: string; name: string; price: number } | null;
}

// Cores
const roomColorsCalendar: Record<string, string> = {
  'Consultório 1': '#22c55e',
  'Consultório 2': '#3b82f6',
  'Consultório 3': '#f59e0b',
};

const statusColorsCalendar: Record<string, string> = {
  CONFIRMED: '#22c55e',
  PENDING: '#f59e0b',
  CANCELLED: '#ef4444',
  COMPLETED: '#3b82f6',
  NO_SHOW: '#ef4444',
};

export default function ReservasPage() {
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  
  // Estado
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  // Filtros
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Carregar reservas
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRoom !== 'all') params.append('roomId', filterRoom);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const res = await fetch(`/api/admin/bookings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showToast('Erro ao carregar reservas', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterRoom, filterStatus, dateRange, showToast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Abrir modal se ID na query
  useEffect(() => {
    if (router.query.id && bookings.length > 0) {
      const booking = bookings.find(b => b.id === router.query.id);
      if (booking) {
        setSelectedBooking(booking);
      }
    }
  }, [router.query.id, bookings]);

  // Filtrar por busca e tipo
  const filteredBookings = bookings.filter(b => {
    // Busca por nome ou telefone
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = b.user.name.toLowerCase().includes(searchLower);
      const phoneMatch = b.user.phone?.includes(search);
      if (!nameMatch && !phoneMatch) return false;
    }
    // Filtro por tipo
    if (filterType === 'manual' && !b.isManual) return false;
    if (filterType === 'online' && b.isManual) return false;
    if (filterType === 'credit' && !b.creditsUsed) return false;
    return true;
  });

  // Mapear nome do consultório para resourceId
  const roomToResourceId: Record<string, string> = {
    'Consultório 1': 'sala-a',
    'Consultório 2': 'sala-b',
    'Consultório 3': 'sala-c',
  };

  // Eventos do calendário com resourceId
  const calendarEvents = filteredBookings.map(booking => ({
    id: booking.id,
    title: booking.user.name,
    start: booking.startTime,
    end: booking.endTime,
    resourceId: roomToResourceId[booking.room.name] || 'sala-a',
    backgroundColor: statusColorsCalendar[booking.status] || '#6b7280',
    borderColor: roomColorsCalendar[booking.room.name] || '#6b7280',
    textColor: '#ffffff',
    extendedProps: { booking },
  }));

  // Colunas da tabela
  const columns = [
    {
      key: 'datetime',
      header: 'Data/Hora',
      render: (b: Booking) => (
        <div>
          <p className="font-medium">{formatDate(b.startTime)}</p>
          <p className="text-xs text-gray-500">{formatTime(b.startTime)} - {formatTime(b.endTime)}</p>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Cliente',
      render: (b: Booking) => (
        <div>
          <p className="font-medium text-primary-600 hover:underline cursor-pointer"
             onClick={(e) => { e.stopPropagation(); router.push(`/admin/clientes/${b.user.id}`); }}>
            {b.user.name}
          </p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (b: Booking) => b.user.phone ? (
        <a 
          href={getWhatsAppLink(b.user.phone)} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-green-600 hover:text-green-700 flex items-center gap-1"
        >
          💬 {b.user.phone}
        </a>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'room',
      header: 'Sala',
      render: (b: Booking) => <span>{b.room.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b: Booking) => (
        <Badge variant={statusColors[b.status]}>{statusLabels[b.status]}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (b: Booking) => (
        <div>
          <p className="font-medium">{formatCurrency(b.amountPaid)}</p>
          {b.creditsUsed ? (
            <p className="text-xs text-blue-600">+ {formatCurrency(b.creditsUsed)} crédito</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (b: Booking) => (
        <div className="flex gap-1">
          {b.isManual && <Badge variant="blue">Manual</Badge>}
          {b.creditsUsed ? <Badge variant="green">Crédito</Badge> : null}
          {!b.isManual && !b.creditsUsed && <Badge variant="gray">Online</Badge>}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Reservas">
      {/* Header com ações */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'calendar' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('calendar')}
            icon="📅"
          >
            Calendário
          </Button>
          <Button
            variant={view === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setView('list')}
            icon="📋"
          >
            Lista
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchBookings} icon="🔄">
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => router.push('/admin/nova-reserva')} icon="➕">
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Select
                label="Consultório"
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'sala-a', label: 'Consultório 1' },
                  { value: 'sala-b', label: 'Consultório 2' },
                  { value: 'sala-c', label: 'Consultório 3' },
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'PENDING', label: 'Pendente' },
                  { value: 'CONFIRMED', label: 'Confirmado' },
                  { value: 'CANCELLED', label: 'Cancelado' },
                  { value: 'COMPLETED', label: 'Concluído' },
                  { value: 'NO_SHOW', label: 'Não compareceu' },
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                label="Tipo"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'online', label: 'Online' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'credit', label: 'Com crédito' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Buscar"
                placeholder="Nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legenda (calendário) */}
      {view === 'calendar' && (
        <Card className="mb-6">
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium text-gray-700">Cores:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Confirmado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <span>Pendente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span>Cancelado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <span>Concluído</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-green-500"></div>
                <span>Consultório 1</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-blue-500"></div>
                <span>Consultório 2</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-amber-500"></div>
                <span>Consultório 3</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : view === 'calendar' ? (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, resourceTimeGridPlugin, interactionPlugin]}
              initialView="resourceTimeGridDay"
              resources={calendarResources}
              locale={ptBrLocale}
              timeZone="America/Sao_Paulo"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimeGridDay,resourceTimeGridWeek,dayGridMonth',
              }}
              views={{
                resourceTimeGridWeek: {
                  type: 'resourceTimeGrid',
                  duration: { weeks: 1 },
                  buttonText: 'Semana',
                },
                resourceTimeGridDay: {
                  type: 'resourceTimeGrid',
                  duration: { days: 1 },
                  buttonText: 'Dia',
                },
              }}
              events={calendarEvents}
              eventClick={(info) => {
                const booking = info.event.extendedProps.booking as Booking;
                if (booking) setSelectedBooking(booking);
              }}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              slotDuration="01:00:00"
              slotEventOverlap={false}
              eventDisplay="block"
              allDaySlot={false}
              height={650}
              nowIndicator
              resourceAreaWidth="100px"
              resourceAreaHeaderContent="Salas"
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5, 6],
                startTime: '08:00',
                endTime: '20:00',
              }}
            />
          ) : (
            <Table
              columns={columns}
              data={filteredBookings}
              keyExtractor={(b) => b.id}
              onRowClick={(b) => setSelectedBooking(b)}
              emptyMessage="Nenhuma reserva encontrada"
              emptyDescription="Tente ajustar os filtros ou criar uma nova reserva"
              emptyActionLabel="➕ Nova Reserva Manual"
              onEmptyAction={() => router.push('/admin/nova-reserva')}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => {
            setSelectedBooking(null);
            // Limpar query param
            if (router.query.id) {
              router.replace('/admin/reservas', undefined, { shallow: true });
            }
          }}
          onUpdate={() => {
            fetchBookings();
            showToast('Reserva atualizada com sucesso', 'success');
          }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast.visible && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
}
