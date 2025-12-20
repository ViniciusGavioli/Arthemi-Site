// ===========================================================
// Dashboard - Página inicial do Admin
// ===========================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, StatCard, Button, Badge, Spinner } from '@/components/admin/ui';
import { formatDate, formatTime, formatCurrency, getWhatsAppLink, statusLabels, statusColors } from '@/components/admin/helpers';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  isManual?: boolean;
  room: { id: string; name: string };
  user: { id: string; name: string; phone: string | null; email: string };
}

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  revenue: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, pending: 0, cancelled: 0, revenue: 0 });
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Buscar reservas de hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const params = new URLSearchParams({
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        });

        const res = await fetch(`/api/admin/bookings?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTodayBookings(data.bookings || []);
          setStats(s => data.stats || s);
        }

        // Buscar pendentes
        const pendingRes = await fetch('/api/admin/bookings?status=PENDING');
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingBookings(pendingData.bookings || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  // Próxima reserva do dia
  const now = new Date();
  const nextBooking = todayBookings
    .filter(b => new Date(b.startTime) > now && b.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  // Reservas ativas de hoje (não canceladas)
  const activeToday = todayBookings.filter(b => b.status !== 'CANCELLED');

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="📅"
          label="Reservas Hoje"
          value={activeToday.length}
          color="primary"
          onClick={() => router.push('/admin/reservas?filter=today')}
        />
        <StatCard
          icon="⏳"
          label="Pendentes"
          value={pendingBookings.length}
          color={pendingBookings.length > 0 ? 'yellow' : 'gray'}
          onClick={() => router.push('/admin/reservas?status=PENDING')}
        />
        <StatCard
          icon="✓"
          label="Confirmadas"
          value={stats.confirmed}
          color="green"
        />
        <StatCard
          icon="💰"
          label="Receita"
          value={formatCurrency(stats.revenue)}
          color="blue"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próxima Reserva */}
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">⏰ Próxima Reserva</h2>
            {nextBooking ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary-600">
                    {formatTime(nextBooking.startTime)}
                  </span>
                  <Badge variant={statusColors[nextBooking.status]}>
                    {statusLabels[nextBooking.status]}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cliente</span>
                    <span className="font-medium">{nextBooking.user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sala</span>
                    <span className="font-medium">{nextBooking.room.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horário</span>
                    <span className="font-medium">
                      {formatTime(nextBooking.startTime)} - {formatTime(nextBooking.endTime)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/admin/reservas?id=${nextBooking.id}`)}
                  >
                    Ver detalhes
                  </Button>
                  {nextBooking.user.phone && (
                    <a
                      href={getWhatsAppLink(nextBooking.user.phone, `Olá ${nextBooking.user.name}! Sobre sua reserva no Espaço Arthemi...`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="success" size="sm" icon="💬">
                        WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <span className="text-4xl mb-3 block">☕</span>
                <p className="text-gray-600 font-medium mb-2">Dia tranquilo!</p>
                <p className="text-gray-500 text-sm">Nenhuma reserva agendada para hoje</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">⚡ Ações Rápidas</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/nova-reserva">
                <Button variant="primary" className="w-full" icon="➕">
                  Nova Reserva
                </Button>
              </Link>
              <Link href="/admin/clientes">
                <Button variant="secondary" className="w-full" icon="👥">
                  Buscar Cliente
                </Button>
              </Link>
              <Link href="/admin/reservas">
                <Button variant="secondary" className="w-full" icon="📅">
                  Ver Calendário
                </Button>
              </Link>
              <Link href="/admin/auditoria">
                <Button variant="ghost" className="w-full" icon="📋">
                  Ver Logs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reservas Pendentes */}
      {pendingBookings.length > 0 && (
        <Card className="mt-6">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                ⚠️ Reservas Pendentes ({pendingBookings.length})
              </h2>
              <Link href="/admin/reservas?status=PENDING">
                <Button variant="ghost" size="sm">Ver todas →</Button>
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingBookings.slice(0, 5).map((booking) => (
                <div
                  key={booking.id}
                  className="py-3 flex items-center justify-between hover:bg-gray-50 -mx-5 px-5 cursor-pointer"
                  onClick={() => router.push(`/admin/reservas?id=${booking.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-800">
                        {formatDate(booking.startTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(booking.startTime)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{booking.user.name}</p>
                      <p className="text-sm text-gray-500">{booking.room.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                      {formatCurrency(booking.amountPaid)}
                    </span>
                    <Badge variant="yellow">Pendente</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservas de Hoje */}
      <Card className="mt-6">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              📅 Reservas de Hoje ({activeToday.length})
            </h2>
            <Link href="/admin/reservas?filter=today">
              <Button variant="ghost" size="sm">Ver todas →</Button>
            </Link>
          </div>
          {activeToday.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {activeToday.map((booking) => (
                <div
                  key={booking.id}
                  className="py-3 flex items-center justify-between hover:bg-gray-50 -mx-5 px-5 cursor-pointer"
                  onClick={() => router.push(`/admin/reservas?id=${booking.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 text-center">
                      <p className="text-lg font-bold text-primary-600">
                        {formatTime(booking.startTime)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{booking.user.name}</p>
                      <p className="text-sm text-gray-500">
                        {booking.room.name} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {booking.isManual && (
                      <Badge variant="purple" icon="✋">Manual</Badge>
                    )}
                    <Badge variant={statusColors[booking.status]}>
                      {statusLabels[booking.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl mb-3 block">📅</span>
              <p className="text-gray-600 font-medium mb-2">Nenhuma reserva para hoje</p>
              <p className="text-gray-500 text-sm mb-4">Que tal criar uma nova reserva?</p>
              <Link href="/admin/nova-reserva">
                <Button variant="primary" icon="➕" size="lg">
                  Nova Reserva Manual
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
