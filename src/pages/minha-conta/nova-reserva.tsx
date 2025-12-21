// ===========================================================
// Página: /minha-conta/nova-reserva - Agendar usando crédito
// ===========================================================

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { format, addDays, startOfDay, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  email: string;
  name: string;
}

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

export default function NovaReservaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
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

  // Erro
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedRoom && selectedDate) {
      fetchAvailability();
    }
  }, [selectedRoom, selectedDate]);

  async function fetchInitialData() {
    try {
      // Verifica autenticação
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/auth/entrar');
        return;
      }
      setUser(authData.user);

      // Busca créditos
      const creditsRes = await fetch('/api/user/credits');
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.summary) {
          setTotalCredits(creditsData.summary.total);
          setCreditsByRoom(creditsData.summary.byRoom || []);
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
    // Créditos genéricos + créditos da mesma sala ou superior (tier menor = sala melhor)
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
      setError('Selecione sala, data e horários');
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

      // Sucesso - redireciona
      router.push(`/minha-conta/reservas?created=${data.bookingId}`);
    } catch (err) {
      setError('Erro ao processar reserva');
    } finally {
      setSubmitting(false);
    }
  }

  // Gera próximos 30 dias
  const dateOptions = Array.from({ length: 30 }, (_, i) => addDays(startOfDay(new Date()), i + 1));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Sem créditos
  if (totalCredits === 0) {
    return (
      <>
        <Head>
          <title>Nova Reserva | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
              <Link href="/minha-conta">
                <span className="text-primary-600 hover:text-primary-700">← Voltar</span>
              </Link>
            </div>
          </header>
          <main className="max-w-3xl mx-auto px-4 py-16 text-center">
            <span className="text-6xl mb-6 block">💰</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Você não tem créditos</h1>
            <p className="text-gray-600 mb-8">Compre um pacote de horas para fazer reservas.</p>
            <Link
              href="/salas"
              className="inline-block bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Ver pacotes disponíveis
            </Link>
          </main>
        </div>
      </>
    );
  }

  const total = calculateTotal();
  const availableForSelected = selectedRoom ? getAvailableCreditsForRoom(selectedRoom) : 0;
  const canSubmit = selectedRoom && selectedDate && selectedHours.length > 0 && total <= availableForSelected;

  return (
    <>
      <Head>
        <title>Nova Reserva | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/minha-conta">
              <span className="text-primary-600 hover:text-primary-700">← Voltar</span>
            </Link>
            <div className="text-sm text-gray-600">
              Saldo: <strong className="text-primary-600">{formatCurrency(totalCredits)}</strong>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Nova Reserva</h1>

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Step 1: Sala */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Escolha a sala</h2>
            <div className="grid gap-3">
              {rooms.map((room) => {
                const availableCredit = getAvailableCreditsForRoom(room);
                return (
                  <button
                    key={room.id}
                    onClick={() => { setSelectedRoom(room); setSelectedHours([]); }}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      selectedRoom?.id === room.id
                        ? 'border-primary-500 bg-primary-50'
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
                      <p className="text-sm text-gray-500">Crédito disponível</p>
                      <p className="font-medium text-primary-600">{formatCurrency(availableCredit)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Data */}
          {selectedRoom && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Escolha a data</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dateOptions.slice(0, 14).map((date) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => { setSelectedDate(date); setSelectedHours([]); }}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      selectedDate?.toDateString() === date.toDateString()
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-xs uppercase">{format(date, 'EEE', { locale: ptBR })}</p>
                    <p className="text-lg font-bold">{format(date, 'd')}</p>
                    <p className="text-xs">{format(date, 'MMM', { locale: ptBR })}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Horários */}
          {selectedRoom && selectedDate && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Escolha os horários</h2>
              
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
                          ? 'bg-primary-500 text-white'
                          : slot.available
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sala</span>
                  <span className="font-medium">{selectedRoom.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data</span>
                  <span className="font-medium">
                    {selectedDate && format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Horário</span>
                  <span className="font-medium">
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
                    Saldo insuficiente. Você tem {formatCurrency(availableForSelected)} disponível para esta sala.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-green-700 text-sm">
                    ✓ Será descontado do seu saldo. Sem cobrança adicional.
                  </p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-full bg-primary-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processando...' : 'Confirmar Reserva'}
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
