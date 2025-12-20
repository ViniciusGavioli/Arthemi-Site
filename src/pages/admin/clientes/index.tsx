// ===========================================================
// Clientes - Lista de clientes
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, Button, Badge, Input, Table, Spinner, Toast } from '@/components/admin/ui';
import { 
  useToast, formatDate, formatCurrency, getWhatsAppLink,
} from '@/components/admin/helpers';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  totalCredits: number;
  totalBookings: number;
  lastBooking: {
    id: string;
    startTime: string;
    status: string;
  } | null;
}

export default function ClientesPage() {
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCredits, setFilterCredits] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterCredits) params.append('hasCredits', 'true');

      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        showToast('Erro ao carregar clientes', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Erro ao carregar clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterCredits, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Colunas da tabela
  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (u: User) => (
        <span className="font-medium text-gray-800">{u.name}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (u: User) => (
        <a 
          href={getWhatsAppLink(u.phone)} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-green-600 hover:text-green-700 flex items-center gap-1"
        >
          💬 {u.phone}
        </a>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (u: User) => (
        <span className="text-gray-600">{u.email}</span>
      ),
    },
    {
      key: 'credits',
      header: 'Créditos',
      render: (u: User) => (
        u.totalCredits > 0 ? (
          <Badge variant="green">{formatCurrency(u.totalCredits)}</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'lastBooking',
      header: 'Última Reserva',
      render: (u: User) => (
        u.lastBooking ? (
          <span className="text-sm text-gray-600">{formatDate(u.lastBooking.startTime)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'totalBookings',
      header: 'Total',
      render: (u: User) => (
        <span className="text-gray-600">{u.totalBookings} reservas</span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (u: User) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/admin/clientes/${u.id}`)}
            icon="👤"
          >
            Ver
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(`/admin/nova-reserva?userId=${u.id}`)}
            icon="➕"
          >
            Reservar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Clientes">
      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[300px]">
              <Input
                label="Buscar cliente"
                placeholder="Nome, telefone ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterCredits}
                onChange={(e) => setFilterCredits(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Apenas com crédito</span>
            </label>
            <Button variant="secondary" size="sm" onClick={fetchUsers} icon="🔄">
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table
              columns={columns}
              data={users}
              keyExtractor={(u) => u.id}
              onRowClick={(u) => router.push(`/admin/clientes/${u.id}`)}
              emptyMessage="Nenhum cliente encontrado"
              emptyDescription={search ? 'Tente buscar com outros termos' : 'Clientes aparecem aqui quando fazem reservas'}
              emptyActionLabel={!search ? '➕ Criar Reserva Manual' : undefined}
              onEmptyAction={!search ? () => router.push('/admin/nova-reserva') : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Toast */}
      {toast.visible && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
}
