// ===========================================================
// Ficha do Cliente - Detalhes completos
// ===========================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  Card, CardContent, Button, Badge, Tabs, Table, Spinner, Toast, StatCard 
} from '@/components/admin/ui';
import { 
  useToast, formatDate, formatTime, formatCurrency, getWhatsAppLink, getPhoneLink, getEmailLink,
  statusLabels, statusColors, creditTypeLabels, creditStatusLabels
} from '@/components/admin/helpers';
import CreditModal from '@/components/admin/CreditModal';

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

interface Summary {
  totalCredits: number;
  creditsByRoom: { roomId: string | null; roomName: string; total: number; tier: number | null }[];
  futureBookings: number;
  totalBookings: number;
  activePackages: number;
  totalPackageHours: number;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  room: { id: string; name: string };
  product?: { id: string; name: string; price: number } | null;
}

interface Credit {
  id: string;
  amount: number;
  remainingAmount: number;
  type: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  room?: { id: string; name: string; tier: number } | null;
}

interface Package {
  id: string;
  type: string;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  expiresAt: string;
  isActive: boolean;
  room?: { id: string; name: string } | null;
}

export default function ClienteDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [activeTab, setActiveTab] = useState('resumo');
  const [showCreditModal, setShowCreditModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    async function fetchUserDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setSummary(data.summary);
          setBookings(data.bookings);
          setCredits(data.credits);
          setPackages(data.packages);
        } else {
          showToast('Erro ao carregar cliente', 'error');
          router.push('/admin/clientes');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        showToast('Erro ao carregar cliente', 'error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const tabs = [
    { id: 'resumo', label: 'Resumo', icon: '📊' },
    { id: 'reservas', label: 'Reservas', icon: '📅' },
    { id: 'creditos', label: 'Créditos', icon: '💳' },
    { id: 'pacotes', label: 'Pacotes', icon: '📦' },
  ];

  // Colunas das tabelas
  const bookingColumns = [
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
      render: (b: Booking) => <span>{formatCurrency(b.amountPaid)}</span>,
    },
  ];

  const creditColumns = [
    {
      key: 'date',
      header: 'Data',
      render: (c: Credit) => <span>{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (c: Credit) => <Badge variant="blue">{creditTypeLabels[c.type] || c.type}</Badge>,
    },
    {
      key: 'room',
      header: 'Sala',
      render: (c: Credit) => <span>{c.room?.name || 'Genérico'}</span>,
    },
    {
      key: 'amount',
      header: 'Valor Original',
      render: (c: Credit) => <span>{formatCurrency(c.amount)}</span>,
    },
    {
      key: 'remaining',
      header: 'Saldo',
      render: (c: Credit) => (
        <span className={c.remainingAmount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
          {formatCurrency(c.remainingAmount)}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Validade',
      render: (c: Credit) => (
        <span className={c.expiresAt && new Date(c.expiresAt) < new Date() ? 'text-red-500' : ''}>
          {c.expiresAt ? formatDate(c.expiresAt) : 'Sem validade'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Credit) => {
        const variant = c.status === 'CONFIRMED' ? 'green' : c.status === 'USED' ? 'gray' : 'red';
        return <Badge variant={variant}>{creditStatusLabels[c.status] || c.status}</Badge>;
      },
    },
  ];

  const packageColumns = [
    {
      key: 'type',
      header: 'Tipo',
      render: (p: Package) => <span className="font-medium">{p.type}</span>,
    },
    {
      key: 'room',
      header: 'Sala',
      render: (p: Package) => <span>{p.room?.name || 'Qualquer'}</span>,
    },
    {
      key: 'hours',
      header: 'Horas',
      render: (p: Package) => (
        <span>
          {p.usedHours}/{p.totalHours}h ({p.remainingHours}h restantes)
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Validade',
      render: (p: Package) => (
        <span className={new Date(p.expiresAt) < new Date() ? 'text-red-500' : ''}>
          {formatDate(p.expiresAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: Package) => (
        <Badge variant={p.isActive && p.remainingHours > 0 ? 'green' : 'gray'}>
          {p.isActive && p.remainingHours > 0 ? 'Ativo' : 'Esgotado'}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <AdminLayout title="Carregando...">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout title="Cliente não encontrado">
        <div className="text-center py-12">
          <p className="text-gray-500">Cliente não encontrado</p>
          <Button variant="primary" onClick={() => router.push('/admin/clientes')} className="mt-4">
            Voltar para Clientes
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={user.name}>
      {/* Header do Cliente */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600">
                <span className="flex items-center gap-1">📱 {user.phone}</span>
                <span className="flex items-center gap-1">✉️ {user.email}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Cliente desde {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`/admin/nova-reserva?userId=${user.id}`)}
                icon="➕"
              >
                Nova Reserva
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowCreditModal(true)}
                icon="🎁"
              >
                Dar Crédito
              </Button>
              <a href={getWhatsAppLink(user.phone, `Olá ${user.name}!`)} target="_blank" rel="noopener noreferrer">
                <Button variant="success" size="lg" icon="💬">WhatsApp</Button>
              </a>
              <a href={getPhoneLink(user.phone)}>
                <Button variant="secondary" icon="📞">Ligar</Button>
              </a>
              <a href={getEmailLink(user.email)}>
                <Button variant="ghost" icon="✉️">Email</Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
        <CardContent>
          {/* Aba Resumo */}
          {activeTab === 'resumo' && summary && (
            <div className="space-y-6">
              {/* Cards de estatísticas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon="💳"
                  label="Crédito Total"
                  value={formatCurrency(summary.totalCredits)}
                  color={summary.totalCredits > 0 ? 'green' : 'gray'}
                />
                <StatCard
                  icon="📅"
                  label="Reservas Futuras"
                  value={summary.futureBookings}
                  color="blue"
                />
                <StatCard
                  icon="📊"
                  label="Total de Reservas"
                  value={summary.totalBookings}
                  color="gray"
                />
                <StatCard
                  icon="⏱️"
                  label="Horas em Pacotes"
                  value={`${summary.totalPackageHours}h`}
                  color={summary.totalPackageHours > 0 ? 'primary' : 'gray'}
                />
              </div>

              {/* Créditos por sala */}
              {summary.creditsByRoom.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Créditos por Sala</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {summary.creditsByRoom.map((cr) => (
                      <div
                        key={cr.roomId || 'generic'}
                        className="bg-gray-50 rounded-lg p-4"
                      >
                        <p className="text-sm text-gray-500">{cr.roomName}</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(cr.total)}
                        </p>
                        {cr.tier && (
                          <p className="text-xs text-gray-400">Tier {cr.tier}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Últimas reservas */}
              {bookings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">Últimas Reservas</h3>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('reservas')}>
                      Ver todas →
                    </Button>
                  </div>
                  <Table
                    columns={bookingColumns}
                    data={bookings.slice(0, 5)}
                    keyExtractor={(b) => b.id}
                    onRowClick={(b) => router.push(`/admin/reservas?id=${b.id}`)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Aba Reservas */}
          {activeTab === 'reservas' && (
            <Table
              columns={bookingColumns}
              data={bookings}
              keyExtractor={(b) => b.id}
              onRowClick={(b) => router.push(`/admin/reservas?id=${b.id}`)}
              emptyMessage="Nenhuma reserva encontrada"
              emptyDescription="Este cliente ainda não tem reservas"
              emptyActionLabel="➕ Criar Nova Reserva"
              onEmptyAction={() => router.push(`/admin/nova-reserva?userId=${user.id}`)}
            />
          )}

          {/* Aba Créditos */}
          {activeTab === 'creditos' && (
            <Table
              columns={creditColumns}
              data={credits}
              keyExtractor={(c) => c.id}
              emptyMessage="Nenhum crédito encontrado"
              emptyDescription="Este cliente não possui créditos ativos"
              emptyActionLabel="🎁 Adicionar Crédito"
              onEmptyAction={() => setShowCreditModal(true)}
            />
          )}

          {/* Aba Pacotes */}
          {activeTab === 'pacotes' && (
            <Table
              columns={packageColumns}
              data={packages}
              keyExtractor={(p) => p.id}
              emptyMessage="Nenhum pacote encontrado"
              emptyDescription="Este cliente não possui pacotes de horas ativos"
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de Crédito */}
      {showCreditModal && (
        <CreditModal
          userId={user.id}
          userName={user.name}
          onClose={() => setShowCreditModal(false)}
          onSuccess={() => {
            setShowCreditModal(false);
            showToast('Crédito criado com sucesso', 'success');
            // Reload page to fetch updated data
            router.replace(router.asPath);
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
