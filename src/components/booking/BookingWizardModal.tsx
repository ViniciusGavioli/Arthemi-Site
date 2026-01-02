// ===========================================================
// Componente: BookingWizardModal - Modal de reserva com créditos
// ===========================================================
// Wizard de 3 passos: Sala → Data/Horários → Confirmação
// Reutiliza lógica de /minha-conta/nova-reserva

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { format, addDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Check, AlertTriangle, Loader2 } from 'lucide-react';

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

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
  /** Pré-selecionar sala (se vem de crédito específico) */
  preselectedRoomId?: string;
}

type Step = 1 | 2 | 3;

// ===========================================================
// COMPONENTE PRINCIPAL
// ===========================================================

export function BookingWizardModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  preselectedRoomId 
}: BookingWizardModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Estado geral
  const [step, setStep] = useState<Step>(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creditsByRoom, setCreditsByRoom] = useState<CreditBalance[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  // Seleções
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Janela de reserva
  const [maxBookingDate, setMaxBookingDate] = useState<Date | null>(null);
  const [hasBookingLimit, setHasBookingLimit] = useState(false);

  // ===========================================================
  // EFEITOS
  // ===========================================================

  // Fecha com ESC
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Foco no modal
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Carrega dados iniciais
  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedRoom(null);
      setSelectedDate(null);
      setSelectedHours([]);
      setError('');
      setSuccessBookingId(null);
    }
  }, [isOpen]);

  // Busca disponibilidade quando muda sala/data
  useEffect(() => {
    if (selectedRoom && selectedDate) {
      fetchAvailability();
    }
  }, [selectedRoom, selectedDate]);

  // Preseleciona sala
  useEffect(() => {
    if (preselectedRoomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === preselectedRoomId);
      if (room) setSelectedRoom(room);
    }
  }, [preselectedRoomId, rooms]);

  // ===========================================================
  // FUNÇÕES
  // ===========================================================

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Busca autenticação e dados
      const [authRes, creditsRes, roomsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/user/credits'),
        fetch('/api/rooms'),
      ]);

      const authData = await authRes.json();
      if (!authData.authenticated) {
        setError('Sessão expirada. Faça login novamente.');
        return;
      }

      // Créditos
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.summary) {
          setTotalCredits(creditsData.summary.total);
          setCreditsByRoom(creditsData.summary.byRoom || []);
        }
      }

      // Janela de reserva
      const windowRes = await fetch(`/api/user/booking-window?userId=${authData.user.id}`);
      if (windowRes.ok) {
        const windowData = await windowRes.json();
        setHasBookingLimit(windowData.hasLimit);
        if (windowData.maxDate) {
          setMaxBookingDate(new Date(windowData.maxDate));
        }
      }

      // Salas
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.rooms || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Tente novamente.');
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

      // Sucesso
      setSuccessBookingId(data.bookingId);
      if (onSuccess) onSuccess(data.bookingId);
    } catch (err) {
      setError('Erro ao processar reserva');
    } finally {
      setSubmitting(false);
    }
  }

  // Navegação entre passos
  function canGoToStep2(): boolean {
    return !!selectedRoom;
  }

  function canGoToStep3(): boolean {
    return !!selectedRoom && !!selectedDate && selectedHours.length > 0;
  }

  function goNext() {
    if (step === 1 && canGoToStep2()) setStep(2);
    else if (step === 2 && canGoToStep3()) setStep(3);
  }

  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  // Gera datas disponíveis
  const maxDays = hasBookingLimit ? 30 : 365;
  const dateOptions = Array.from({ length: maxDays }, (_, i) => addDays(startOfDay(new Date()), i + 1))
    .filter(date => {
      if (maxBookingDate) return !isAfter(date, maxBookingDate);
      return true;
    });

  // ===========================================================
  // RENDER
  // ===========================================================

  if (!isOpen) return null;

  const total = calculateTotal();
  const availableForSelected = selectedRoom ? getAvailableCreditsForRoom(selectedRoom) : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-wizard-title"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 id="booking-wizard-title" className="text-lg font-semibold text-gray-900">
              Nova Reserva
            </h2>
            <p className="text-sm text-gray-500">
              Saldo: <span className="font-medium text-primary-600">{formatCurrency(totalCredits)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        {!successBookingId && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    s < step ? 'bg-primary-600 text-white' :
                    s === step ? 'bg-primary-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {s < step ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-1 rounded ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Consultório</span>
              <span>Data e Horário</span>
              <span>Confirmação</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : successBookingId ? (
            // Sucesso
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Reserva Confirmada!</h3>
              <p className="text-gray-600 mb-6">
                Sua reserva foi criada com sucesso. Você receberá um email de confirmação.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : totalCredits === 0 ? (
            // Sem créditos
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sem créditos disponíveis</h3>
              <p className="text-gray-600 mb-6">
                Você não possui créditos para fazer reservas. Adquira um pacote de horas primeiro.
              </p>
              <Link
                href="/salas"
                className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Ver Pacotes
              </Link>
            </div>
          ) : (
            <>
              {/* Step 1: Consultório */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Escolha o consultório</h3>
                  </div>
                  
                  {rooms.map((room) => {
                    const availableCredit = getAvailableCreditsForRoom(room);
                    const hasCredit = availableCredit > 0;
                    
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        disabled={!hasCredit}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                          !hasCredit
                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                            : selectedRoom?.id === room.id
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
                          <p className="text-xs text-gray-500">Crédito disponível</p>
                          <p className={`font-medium ${hasCredit ? 'text-primary-600' : 'text-gray-400'}`}>
                            {formatCurrency(availableCredit)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Data e Horários */}
              {step === 2 && selectedRoom && (
                <div className="space-y-6">
                  {/* Data */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-primary-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Escolha a data</h3>
                    </div>
                    
                    {hasBookingLimit && maxBookingDate && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          ℹ️ Reservas até <strong>{format(maxBookingDate, 'dd/MM/yyyy', { locale: ptBR })}</strong>
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

                  {/* Horários */}
                  {selectedDate && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-primary-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Escolha os horários</h3>
                      </div>

                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
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
                                  : 'bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                              }`}
                            >
                              {String(slot.hour).padStart(2, '0')}:00
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedHours.length > 0 && (
                        <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                          <p className="text-sm text-primary-800">
                            <strong>{selectedHours.length}h</strong> selecionada{selectedHours.length > 1 ? 's' : ''}: {' '}
                            {String(Math.min(...selectedHours)).padStart(2, '0')}:00 - {String(Math.max(...selectedHours) + 1).padStart(2, '0')}:00
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirmação */}
              {step === 3 && selectedRoom && selectedDate && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Confirme sua reserva</h3>

                  <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultório</span>
                      <span className="font-medium text-gray-900">{selectedRoom.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data</span>
                      <span className="font-medium text-gray-900">
                        {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horário</span>
                      <span className="font-medium text-gray-900">
                        {String(Math.min(...selectedHours)).padStart(2, '0')}:00 - {String(Math.max(...selectedHours) + 1).padStart(2, '0')}:00 ({selectedHours.length}h)
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 flex justify-between">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-xl text-primary-600">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {total > availableForSelected ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-red-700 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Saldo insuficiente. Disponível: {formatCurrency(availableForSelected)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-green-700 text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Será descontado do seu saldo. Sem cobrança adicional.
                      </p>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-amber-800 text-sm">
                      <strong>Política de cancelamento:</strong> Cancelamentos gratuitos até 48h antes do horário reservado.
                    </p>
                  </div>
                </div>
              )}

              {/* Erro */}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com navegação */}
        {!loading && !successBookingId && totalCredits > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={goNext}
                disabled={step === 1 ? !canGoToStep2() : !canGoToStep3()}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || total > availableForSelected}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar Reserva
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
