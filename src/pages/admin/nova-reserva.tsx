// ===========================================================
// Nova Reserva Manual - Formulário completo
// ===========================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  Card, CardContent, Button, Input, Select, Textarea, Badge, Spinner, Toast 
} from '@/components/admin/ui';
import { 
  useToast, formatCurrency, fetchApi 
} from '@/components/admin/helpers';
import { getHourOptionsForDate, getBusinessHoursForDate, isClosedDay } from '@/lib/business-hours';

interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Credit {
  id: string;
  amount: number;
  remainingAmount: number;
  roomId: string | null;
  roomName: string | null;
}

interface AvailabilitySlot {
  hour: number;
  available: boolean;
}

export default function NovaReservaPage() {
  const router = useRouter();
  const { userId: queryUserId } = router.query;
  const { toast, showToast, hideToast } = useToast();

  // Estado do formulário
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Busca de cliente
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCredits, setUserCredits] = useState<Credit[]>([]);

  // Criar novo cliente
  const [createNewUser, setCreateNewUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  // Dados da reserva
  const [formData, setFormData] = useState({
    roomId: 'sala-a',
    date: new Date().toISOString().split('T')[0],
    bookingType: 'HOURLY',
    shiftType: 'MORNING',
    startHour: '9',
    endHour: '10',
    amount: '',
    useCredits: false,
    notes: '',
  });

  // Disponibilidade
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');

  // Buscar usuário por ID
  const loadUserById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data.user);
        // Carregar créditos
        loadUserCredits(id);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar usuário da query
  useEffect(() => {
    if (queryUserId && typeof queryUserId === 'string') {
      loadUserById(queryUserId);
    }
  }, [queryUserId, loadUserById]);

  // Buscar usuários
  async function searchUsers(query: string) {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }

  // Carregar créditos do usuário
  async function loadUserCredits(userId: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar créditos ativos
        const activeCredits = (data.credits || []).filter((c: Credit & { status: string; expiresAt: string | null }) => 
          c.status === 'CONFIRMED' && 
          c.remainingAmount > 0 &&
          (!c.expiresAt || new Date(c.expiresAt) > new Date())
        ).map((c: Credit & { room?: { name: string } }) => ({
          ...c,
          roomName: c.room?.name || 'Genérico',
        }));
        setUserCredits(activeCredits);
      }
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  }

  // Selecionar usuário
  function handleSelectUser(user: User) {
    setSelectedUser(user);
    setUserSearch('');
    setSearchResults([]);
    setCreateNewUser(false);
    loadUserCredits(user.id);
  }

  // Verificar disponibilidade
  const checkAvailability = useCallback(async () => {
    setCheckingAvailability(true);
    setAvailabilityError('');

    try {
      const params = new URLSearchParams({
        roomId: formData.roomId,
        date: formData.date,
      });

      const res = await fetch(`/api/availability?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Simular slots de disponibilidade (a API real deveria retornar isso)
        const slots: AvailabilitySlot[] = [];
        for (let h = 7; h <= 21; h++) {
          // Verificar se há conflito com reservas existentes
          const hasConflict = (data.bookings || []).some((b: { startTime: string; endTime: string }) => {
            const start = new Date(b.startTime).getHours();
            const end = new Date(b.endTime).getHours();
            return h >= start && h < end;
          });
          slots.push({ hour: h, available: !hasConflict });
        }
        setAvailability(slots);

        // Verificar se horário selecionado está disponível
        const startH = Number(formData.startHour);
        const endH = Number(formData.endHour);
        const isAvailable = slots.every(s => 
          s.hour < startH || s.hour >= endH || s.available
        );

        if (!isAvailable) {
          setAvailabilityError('Horário selecionado não está disponível');
        }
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      showToast('Erro ao verificar disponibilidade', 'error');
    } finally {
      setCheckingAvailability(false);
    }
  }, [formData.roomId, formData.date, formData.startHour, formData.endHour, showToast]);

  // Verificar ao mudar data/sala/horário
  useEffect(() => {
    if (formData.date && formData.roomId) {
      const timer = setTimeout(checkAvailability, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.date, formData.roomId, formData.startHour, formData.endHour, checkAvailability]);

  // Calcular créditos aplicáveis
  const applicableCredits = userCredits.filter(c => {
    // Créditos genéricos ou da sala selecionada
    if (!c.roomId) return true;
    return c.roomId === formData.roomId;
  });

  const totalAvailableCredits = applicableCredits.reduce((sum, c) => sum + c.remainingAmount, 0);

  // Criar reserva
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Guard: Não permitir reserva em dia fechado
    if (isClosed) {
      showToast('Não é possível reservar em dia fechado (domingo)', 'warning');
      return;
    }

    if (!selectedUser && !createNewUser) {
      showToast('Selecione ou crie um cliente', 'warning');
      return;
    }

    if (createNewUser && (!newUserData.name || !newUserData.phone)) {
      showToast('Preencha nome e telefone do novo cliente', 'warning');
      return;
    }

    if (availabilityError) {
      showToast('Horário não disponível', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        roomId: formData.roomId,
        date: new Date(formData.date).toISOString(),
        bookingType: formData.bookingType,
        amount: formData.amount ? Math.round(Number(formData.amount) * 100) : 0,
        notes: formData.notes || undefined,
      };

      // Usuário
      if (selectedUser) {
        payload.userId = selectedUser.id;
      } else if (createNewUser) {
        payload.userPhone = newUserData.phone;
        payload.userName = newUserData.name;
        payload.userEmail = newUserData.email || undefined;
      }

      // Tipo de reserva
      if (formData.bookingType === 'SHIFT') {
        payload.shiftType = formData.shiftType;
      } else if (formData.bookingType === 'HOURLY') {
        payload.startHour = Number(formData.startHour);
        payload.endHour = Number(formData.endHour);
      }

      const { data, error } = await fetchApi<{ bookingId: string }>('/api/admin/bookings/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      showToast('Reserva criada com sucesso!', 'success');
      router.push(`/admin/reservas?id=${data?.bookingId}`);
    } catch {
      showToast('Erro ao criar reserva', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Opções de hora DINÂMICAS baseadas na data selecionada
  const hourOptions = useMemo(() => {
    const date = formData.date ? new Date(formData.date + 'T12:00:00') : null;
    const hours = getHourOptionsForDate(date);
    // Admin: incluir hora 7 se necessário (antes da abertura oficial)
    return hours.map(h => ({
      value: String(h),
      label: `${String(h).padStart(2, '0')}:00`,
    }));
  }, [formData.date]);

  // Verificar se é dia fechado
  const isClosed = useMemo(() => {
    if (!formData.date) return false;
    const date = new Date(formData.date + 'T12:00:00');
    return isClosedDay(date);
  }, [formData.date]);

  if (loading) {
    return (
      <AdminLayout title="Nova Reserva">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Nova Reserva Manual">
      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Coluna 1: Cliente */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 Cliente</h2>

              {selectedUser ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-green-800">{selectedUser.name}</p>
                      <p className="text-sm text-green-600">{selectedUser.phone}</p>
                      <p className="text-sm text-green-600">{selectedUser.email}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(null);
                        setUserCredits([]);
                      }}
                    >
                      ✕ Trocar
                    </Button>
                  </div>
                  {totalAvailableCredits > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <Badge variant="green">
                        💳 {formatCurrency(totalAvailableCredits)} em créditos disponíveis
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Busca */}
                  {!createNewUser && (
                    <div className="relative">
                      <Input
                        label="Buscar cliente existente"
                        placeholder="Nome, telefone ou email..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          searchUsers(e.target.value);
                        }}
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {searchResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              <p className="font-medium text-gray-800">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.phone}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Criar novo */}
                  {createNewUser ? (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-700">Novo Cliente</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCreateNewUser(false)}
                        >
                          ✕ Cancelar
                        </Button>
                      </div>
                      <Input
                        label="Nome *"
                        value={newUserData.name}
                        onChange={(e) => setNewUserData(d => ({ ...d, name: e.target.value }))}
                        required
                      />
                      <Input
                        label="Telefone *"
                        value={newUserData.phone}
                        onChange={(e) => setNewUserData(d => ({ ...d, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        required
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData(d => ({ ...d, email: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <div className="text-center pt-2">
                      <span className="text-gray-400">ou</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="block mx-auto mt-2"
                        onClick={() => setCreateNewUser(true)}
                      >
                        ➕ Criar Novo Cliente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coluna 2: Reserva */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">📅 Detalhes da Reserva</h2>

              <div className="space-y-4">
                {/* Consultório */}
                <Select
                  label="Consultório"
                  value={formData.roomId}
                  onChange={(e) => setFormData(d => ({ ...d, roomId: e.target.value }))}
                  options={[
                    { value: 'sala-a', label: 'Consultório 1 | Prime' },
                    { value: 'sala-b', label: 'Consultório 2 | Executive' },
                    { value: 'sala-c', label: 'Consultório 3 | Essential' },
                  ]}
                />

                {/* Data */}
                <Input
                  label="Data"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(d => ({ ...d, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />

                {/* Tipo */}
                <Select
                  label="Tipo de Reserva"
                  value={formData.bookingType}
                  onChange={(e) => setFormData(d => ({ ...d, bookingType: e.target.value }))}
                  options={[
                    { value: 'HOURLY', label: 'Hora Avulsa' },
                    { value: 'SHIFT', label: 'Turno (4h)' },
                  ]}
                />

                {/* Aviso de dia fechado */}
                {isClosed && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                    🚫 Fechado neste dia (domingo). Selecione outra data.
                  </div>
                )}

                {/* Horários para HOURLY */}
                {formData.bookingType === 'HOURLY' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Início"
                      value={formData.startHour}
                      onChange={(e) => setFormData(d => ({ ...d, startHour: e.target.value }))}
                      options={hourOptions}
                      disabled={isClosed}
                    />
                    <Select
                      label="Fim"
                      value={formData.endHour}
                      onChange={(e) => setFormData(d => ({ ...d, endHour: e.target.value }))}
                      options={hourOptions.filter(o => Number(o.value) > Number(formData.startHour))}
                      disabled={isClosed}
                    />
                  </div>
                )}

                {/* Turno para SHIFT */}
                {formData.bookingType === 'SHIFT' && (
                  <Select
                    label="Turno"
                    value={formData.shiftType}
                    onChange={(e) => setFormData(d => ({ ...d, shiftType: e.target.value }))}
                    options={[
                      { value: 'MORNING', label: 'Manhã (8h-12h)' },
                      { value: 'AFTERNOON', label: 'Tarde (14h-18h)' },
                    ]}
                  />
                )}

                {/* Disponibilidade */}
                {checkingAvailability && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Spinner size="sm" />
                    <span>Verificando disponibilidade...</span>
                  </div>
                )}
                {availabilityError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    ⚠️ {availabilityError}
                  </div>
                )}
                {!checkingAvailability && !availabilityError && availability.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    ✓ Horário disponível
                  </div>
                )}

                {/* Valor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor (R$) <span className="text-gray-400">- deixe vazio para cortesia</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData(d => ({ ...d, amount: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Usar créditos */}
                {selectedUser && totalAvailableCredits > 0 && (
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.useCredits}
                      onChange={(e) => setFormData(d => ({ ...d, useCredits: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600"
                    />
                    <div>
                      <p className="font-medium">Usar créditos do cliente</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(totalAvailableCredits)} disponíveis para este consultório
                      </p>
                    </div>
                  </label>
                )}

                {/* Observações */}
                <Textarea
                  label="Observações"
                  value={formData.notes}
                  onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  placeholder="Anotações internas..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.push('/admin/reservas')}
            disabled={submitting}
            icon="←"
          >
            Voltar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={
              submitting ||
              isClosed ||
              !!availabilityError ||
              (!selectedUser && !createNewUser) ||
              (createNewUser && (!newUserData.name || !newUserData.phone))
            }
            icon="✅"
          >
            Confirmar Reserva
          </Button>
        </div>
      </form>

      {/* Toast */}
      {toast.visible && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </AdminLayout>
  );
}
