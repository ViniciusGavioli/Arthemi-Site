// ===========================================================
// Componente: CreditBookingWizard - Wizard de reserva com crédito
// Reutilizável: pode ser usado em modal ou página standalone
// ===========================================================

import { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ===========================================================
// TIPOS
// ===========================================================

interface Room {
  id: string;
  name: string;
  slug: string;
  pricePerHour: number;
  tier: number;
}

interface CreditBalance {
  roomId: string | null;
  roomName: string;
  amount: number;
  tier: number | null;
}

interface TimeSlot {
  hour: number;
  available: boolean;
}

interface CreditBookingWizardProps {
  userId: string;
  onSuccess: (bookingId: string) => void;
  onCancel: () => void;
  onPurchaseCredits?: () => void;
}

// ===========================================================
// COMPONENTE
// ===========================================================

export function CreditBookingWizard({ userId, onSuccess, onCancel, onPurchaseCredits }: CreditBookingWizardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creditsByRoom, setCreditsByRoom] = useState<CreditBalance[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Seleções
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Janela de reserva (30 dias para horas/pacotes)
  const [maxBookingDate, setMaxBookingDate] = useState<Date | null>(null);
  const [hasBookingLimit, setHasBookingLimit] = useState(false);

  // Erro
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [userId]);

  useEffect(() => {
    if (selectedRoom && selectedDate) {
      fetchAvailability();
    }
  }, [selectedRoom, selectedDate]);

  async function fetchInitialData() {
    try {
      // Busca créditos
      const creditsRes = await fetch('/api/user/credits');
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.summary) {
          setTotalCredits(creditsData.summary.total);
          setCreditsByRoom(creditsData.summary.byRoom || []);
        }
      }

      // Busca janela de reserva
      const windowRes = await fetch(`/api/user/booking-window?userId=${userId}`);
      if (windowRes.ok) {
        const windowData = await windowRes.json();
        setHasBookingLimit(windowData.hasLimit);
        if (windowData.maxDate) {
          setMaxBookingDate(new Date(windowData.maxDate));
        }
      }

      // Busca salas
      const roomsRes = await fetch('/api/rooms');
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.rooms || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailability() {
    if (!selectedRoom || !selectedDate) return;

    setLoadingSlots(true);
    setSelectedHours([]);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/availability?roomId=${selectedRoom.id}&date=${dateStr}`);
      
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots || []);
      }
    } catch (err) {
      console.error('Erro ao buscar disponibilidade:', err);
    } finally {
      setLoadingSlots(false);
    }
  }

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function getAvailableCreditsForRoom(room: Room): number {
    return creditsByRoom
      .filter(c => c.tier === null || (c.tier !== null && c.tier <= room.tier))
      .reduce((sum, c) => sum + c.amount, 0);
  }

  function calculateTotal(): number {
    if (!selectedRoom || selectedHours.length === 0) return 0;
    return selectedHours.length * selectedRoom.pricePerHour;
  }

  function toggleHour(hour: number) {
    if (selectedHours.includes(hour)) {
      setSelectedHours(selectedHours.filter(h => h !== hour));
    } else {
      setSelectedHours([...selectedHours, hour].sort((a, b) => a - b));
    }
  }

  async function handleSubmit() {
    if (!selectedRoom || !selectedDate || selectedHours.length === 0) {
      setError('Selecione consultório, data e horários');
      return;
    }

    const total = calculateTotal();
    const availableCredit = getAvailableCreditsForRoom(selectedRoom);

    if (total > availableCredit) {
      setError('Saldo insuficiente para esta reserva');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const startHour = Math.min(...selectedHours);
      const endHour = Math.max(...selectedHours) + 1;

      const startTime = new Date(selectedDate);
      startTime.setHours(startHour, 0, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(endHour, 0, 0, 0);

      const res = await fetch('/api/bookings/create-with-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar reserva');
        return;
      }

      // Sucesso - chama callback
      onSuccess(data.bookingId);
    } catch (err) {
      setError('Erro ao processar reserva');
    } finally {
      setSubmitting(false);
    }
  }

  // Gera próximos dias disponíveis
  const maxDays = hasBookingLimit ? 30 : 365;
  const dateOptions = Array.from({ length: maxDays }, (_, i) => addDays(startOfDay(new Date()), i + 1))
    .filter(date => {
      if (maxBookingDate) {
        return !isAfter(date, maxBookingDate);
      }
      return true;
    });

  // Loading inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Sem créditos - mostra EmptyState simples
  if (totalCredits === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <span className="text-3xl">💳</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem créditos disponíveis</h3>
        <p className="text-gray-500 text-center mb-6 max-w-xs">
          Para agendar um horário, você precisa comprar créditos primeiro.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              onCancel(); // Fecha este modal
              if (onPurchaseCredits) onPurchaseCredits(); // Abre modal de compra
            }}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            Comprar horas
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const total = calculateTotal();
  const availableForSelected = selectedRoom ? getAvailableCreditsForRoom(selectedRoom) : 0;
  const canSubmit = selectedRoom && selectedDate && selectedHours.length > 0 && total <= availableForSelected;

  return (
    <div className="space-y-6">
      {/* Header com saldo */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Nova Reserva</h2>
        <div className="text-sm text-gray-600">
          Saldo: <strong className="text-primary-600">{formatCurrency(totalCredits)}</strong>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Consultório */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">1. Escolha o consultório</h3>
        <div className="grid gap-3">
          {rooms.map((room) => {
            const availableCredit = getAvailableCreditsForRoom(room);
            return (
              <button
                key={room.id}
                onClick={() => { setSelectedRoom(room); setSelectedHours([]); }}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left bg-white ${
                  selectedRoom?.id === room.id
                    ? 'border-primary-500 ring-2 ring-primary-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900">{room.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(room.pricePerHour)}/hora
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Crédito disponível</p>
                  <p className="font-medium text-primary-600">{formatCurrency(availableCredit)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Data */}
      {selectedRoom && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">2. Escolha a data</h3>
          
          {hasBookingLimit && maxBookingDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                ℹ️ Reservas podem ser feitas com até 30 dias de antecedência.
                Data máxima: <strong>{format(maxBookingDate, 'dd/MM/yyyy', { locale: ptBR })}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {dateOptions.slice(0, 14).map((date) => (
              <button
                key={date.toISOString()}
                onClick={() => { setSelectedDate(date); setSelectedHours([]); }}
                className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                  selectedDate?.toDateString() === date.toDateString()
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-900'
                }`}
              >
                <p className="text-xs uppercase font-medium">{format(date, 'EEE', { locale: ptBR })}</p>
                <p className="text-lg font-bold">{format(date, 'd')}</p>
                <p className="text-xs">{format(date, 'MMM', { locale: ptBR })}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Horários */}
      {selectedRoom && selectedDate && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">3. Escolha os horários</h3>
          
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.hour}
                  onClick={() => slot.available && toggleHour(slot.hour)}
                  disabled={!slot.available}
                  className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
                    selectedHours.includes(slot.hour)
                      ? 'bg-primary-500 text-white shadow-lg'
                      : slot.available
                      ? 'bg-white border border-gray-200 hover:border-primary-300 text-gray-900'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {String(slot.hour).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumo */}
      {selectedRoom && selectedHours.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Resumo</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Consultório</span>
              <span className="font-medium text-gray-900">{selectedRoom.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Data</span>
              <span className="font-medium text-gray-900">
                {selectedDate && format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Horário</span>
              <span className="font-medium text-gray-900">
                {String(Math.min(...selectedHours)).padStart(2, '0')}:00 - 
                {String(Math.max(...selectedHours) + 1).padStart(2, '0')}:00
                ({selectedHours.length}h)
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className="text-primary-600 font-bold text-xl">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {total > availableForSelected ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 text-sm">
                Saldo insuficiente. Você tem {formatCurrency(availableForSelected)} disponível para este consultório.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-green-700 text-sm">
                ✓ Será descontado do seu saldo. Sem cobrança adicional.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processando...' : 'Confirmar Reserva'}
        </button>
      </div>
    </div>
  );
}
