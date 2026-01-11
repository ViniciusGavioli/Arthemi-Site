// ===========================================================
// Componente: CreditBookingWizard - Wizard de reserva com crédito
// Reutilizável: pode ser usado em modal ou página standalone
// ===========================================================

import { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  isTurnoDay, 
  isWithinTurnoProtectionWindow,
  TURNO_PROTECTION_ERROR_CODE,
  TURNO_PROTECTION_ERROR_MESSAGE,
} from '@/lib/turno-protection';
import { 
  SHIFT_BLOCKS, 
  isSaturdayDay, 
  type ShiftBlock 
} from '@/lib/business-hours';
import { getPricingInfoForUI } from '@/lib/pricing';
import { MICROCOPY } from '@/lib/policies';
import { isValidCoupon } from '@/lib/coupons';

// ===========================================================
// TIPOS
// ===========================================================

// Tipos de uso de crédito
type CreditUsageType = 'HOURLY' | 'SHIFT' | 'SATURDAY_HOURLY' | 'SATURDAY_SHIFT' | null;

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

// Crédito individual (lista completa da API)
interface Credit {
  id: string;
  roomId: string | null;
  roomName: string | null;
  roomTier: number | null;
  amount: number;
  remainingAmount: number;
  type: string;
  usageType: CreditUsageType;
  expiresAt: string | null;
  createdAt: string;
}

interface TimeSlot {
  hour: number;
  available: boolean;
}

interface CreditBookingWizardProps {
  userId: string;
  emailVerified?: boolean; // Se false, bloqueia o botão de confirmar
  onSuccess: (bookingId: string) => void;
  onCancel: () => void;
  onPurchaseCredits?: () => void;
  onResendVerification?: () => Promise<void>; // Callback para reenviar email de verificação (async)
}

// ===========================================================
// COMPONENTE
// ===========================================================

export function CreditBookingWizard({ 
  userId, 
  emailVerified = true, 
  onSuccess, 
  onCancel, 
  onPurchaseCredits,
  onResendVerification,
}: CreditBookingWizardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creditsByRoom, setCreditsByRoom] = useState<CreditBalance[]>([]);
  const [allCredits, setAllCredits] = useState<Credit[]>([]); // Lista completa de créditos para filtrar por usageType
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Seleções
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null); // Crédito selecionado (para restricionar datas/horários)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [selectedShiftBlock, setSelectedShiftBlock] = useState<ShiftBlock | null>(null); // Para créditos SHIFT
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Cupom de desconto (opcional)
  const [couponCode, setCouponCode] = useState('');
  const [couponWarning, setCouponWarning] = useState(''); // Aviso discreto (não bloqueia)

  // Janela de reserva (30 dias para horas/pacotes)
  const [maxBookingDate, setMaxBookingDate] = useState<Date | null>(null);
  const [hasBookingLimit, setHasBookingLimit] = useState(false);

  // Erro
  const [error, setError] = useState('');

  // Estado do reenvio de verificação de e-mail
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

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
        // Armazena lista completa de créditos com usageType
        if (creditsData.credits) {
          setAllCredits(creditsData.credits);
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
    if (!selectedRoom || !selectedDate) return 0;
    
    // Usar helper PRICES_V3 para respeitar preço de sábado
    const pricingInfo = getPricingInfoForUI(selectedRoom.id, selectedDate, selectedRoom.slug);
    const hourlyPrice = pricingInfo.hourlyPrice;
    
    // Para SHIFT, o total é 4h (bloco fixo)
    if (isShiftCredit(selectedCredit) && selectedShiftBlock) {
      return 4 * hourlyPrice;
    }
    if (selectedHours.length === 0) return 0;
    return selectedHours.length * hourlyPrice;
  }

  function toggleHour(hour: number) {
    // Se crédito é HOURLY ou SATURDAY_HOURLY, só permite 1 hora
    if (isSingleHourCredit(selectedCredit)) {
      if (selectedHours.includes(hour)) {
        setSelectedHours([]);
      } else {
        setSelectedHours([hour]); // Substitui ao invés de adicionar
      }
      return;
    }
    
    // Comportamento legado: múltiplas horas
    if (selectedHours.includes(hour)) {
      setSelectedHours(selectedHours.filter(h => h !== hour));
    } else {
      setSelectedHours([...selectedHours, hour].sort((a, b) => a - b));
    }
  }

  async function handleSubmit() {
    // Validação para créditos de SHIFT
    if (isShiftCredit(selectedCredit)) {
      if (!selectedRoom || !selectedDate || !selectedShiftBlock) {
        setError('Selecione consultório, data e bloco de turno');
        return;
      }
    } else {
      if (!selectedRoom || !selectedDate || selectedHours.length === 0) {
        setError('Selecione consultório, data e horários');
        return;
      }
    }

    const total = calculateTotal();
    const availableCredit = getAvailableCreditsForRoom(selectedRoom!);

    if (total > availableCredit) {
      setError('Saldo insuficiente para esta reserva');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let startHour: number;
      let endHour: number;

      // Para SHIFT, usa o bloco selecionado
      if (isShiftCredit(selectedCredit) && selectedShiftBlock) {
        startHour = selectedShiftBlock.start;
        endHour = selectedShiftBlock.end;
      } else {
        startHour = Math.min(...selectedHours);
        endHour = Math.max(...selectedHours) + 1;
      }

      const startTime = new Date(selectedDate!);
      startTime.setHours(startHour, 0, 0, 0);

      const endTime = new Date(selectedDate!);
      endTime.setHours(endHour, 0, 0, 0);

      const res = await fetch('/api/bookings/create-with-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          couponCode: couponCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Renderizar mensagem por code (fallback para error)
        const errorMessages: Record<string, string> = {
          [TURNO_PROTECTION_ERROR_CODE]: TURNO_PROTECTION_ERROR_MESSAGE,
          'COUPON_REQUIRES_CASH_PAYMENT': MICROCOPY.creditBooking.couponRequiresCashPayment,
          'COUPON_ALREADY_USED': MICROCOPY.creditBooking.couponAlreadyUsed,
        };
        
        const message = data.code && errorMessages[data.code] 
          ? errorMessages[data.code] 
          : data.error || 'Erro ao criar reserva';
        
        setError(message);
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

  // Handler para reenviar e-mail de verificação com feedback
  async function handleResendVerification() {
    if (!onResendVerification || resendStatus === 'sending') return;
    
    setResendStatus('sending');
    setResendMessage('');
    
    try {
      await onResendVerification();
      setResendStatus('sent');
      setResendMessage('E-mail enviado! Verifique sua caixa de entrada e spam.');
    } catch (err) {
      setResendStatus('error');
      setResendMessage('Erro ao reenviar. Tente novamente em alguns minutos.');
    }
  }

  // Verifica se uma data está bloqueada pela proteção de turno
  // Horas avulsas não podem ser agendadas > 30 dias em dias de TURNO (seg-sex)
  function isDateBlockedByTurnoProtection(date: Date): boolean {
    // Se é dia de TURNO (seg-sex) e está além de 30 dias, bloqueia
    return isTurnoDay(date) && !isWithinTurnoProtectionWindow(date);
  }

  // ===== LÓGICA DE FILTRO DE DATAS POR USAGETYPE =====
  // Retorna true se a data é válida para o crédito selecionado
  function isDateValidForCredit(date: Date, credit: Credit | null): boolean {
    // Crédito legado (null) ou sem crédito selecionado: qualquer dia
    if (!credit || credit.usageType === null) {
      return true;
    }

    const isSaturday = isSaturdayDay(date);

    switch (credit.usageType) {
      case 'SATURDAY_HOURLY':
      case 'SATURDAY_SHIFT':
        // Apenas sábados
        return isSaturday;
      case 'HOURLY':
      case 'SHIFT':
        // Apenas dias úteis (seg-sex)
        return !isSaturday;
      default:
        return true;
    }
  }

  // Retorna os créditos disponíveis para a sala selecionada
  function getCreditsForSelectedRoom(room: Room): Credit[] {
    return allCredits.filter(c => {
      // Verifica se o crédito é aplicável à sala (tier compatível)
      if (c.roomTier !== null && c.roomTier > room.tier) {
        return false;
      }
      // Verifica se tem saldo
      return c.remainingAmount > 0;
    });
  }

  // Verifica se um crédito é do tipo SHIFT
  function isShiftCredit(credit: Credit | null): boolean {
    return credit?.usageType === 'SHIFT' || credit?.usageType === 'SATURDAY_SHIFT';
  }

  // Verifica se crédito só permite 1 hora
  function isSingleHourCredit(credit: Credit | null): boolean {
    return credit?.usageType === 'HOURLY' || credit?.usageType === 'SATURDAY_HOURLY';
  }

  // Gera próximos dias disponíveis
  // REGRA ANTI-CANIBALIZAÇÃO: Dias de TURNO só podem ser reservados até 30 dias
  const maxDays = 365; // Mostra até 365 dias, mas filtra os bloqueados
  const dateOptions = Array.from({ length: maxDays }, (_, i) => addDays(startOfDay(new Date()), i + 1))
    .filter(date => {
      // Regra existente de maxBookingDate
      if (maxBookingDate && isAfter(date, maxBookingDate)) {
        return false;
      }
      // NOVA REGRA: Bloqueia dias de TURNO além de 30 dias
      if (isDateBlockedByTurnoProtection(date)) {
        return false;
      }
      // NOVA REGRA: Filtra por usageType do crédito selecionado
      if (!isDateValidForCredit(date, selectedCredit)) {
        return false;
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
  
  // Diferentes condições de submit para SHIFT vs horas
  // emailVerified=false também bloqueia
  const canSubmit = (() => {
    // BLOQUEIO: Email não verificado
    if (!emailVerified) return false;
    
    if (!selectedRoom || !selectedDate || total > availableForSelected) return false;
    
    // Para SHIFT, precisa ter bloco selecionado
    if (isShiftCredit(selectedCredit)) {
      return selectedShiftBlock !== null;
    }
    
    // Para outros, precisa ter horas selecionadas
    return selectedHours.length > 0;
  })();

  return (
    <div className="space-y-6">
      {/* Banner de email não verificado (pequeno, referencia ação no final) */}
      {!emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-lg">📧</span>
          <p className="text-sm text-amber-800">
            <strong>E-mail não verificado.</strong> Veja instruções abaixo para concluir sua reserva.
          </p>
        </div>
      )}

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
                onClick={() => { 
                  setSelectedRoom(room); 
                  setSelectedCredit(null); // Reset crédito ao mudar sala
                  setSelectedHours([]); 
                  setSelectedShiftBlock(null);
                  setSelectedDate(null);
                }}
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

      {/* Step 1.5: Escolha do Crédito (só aparece se há créditos com usageType diferente) */}
      {selectedRoom && (() => {
        const roomCredits = getCreditsForSelectedRoom(selectedRoom);
        // Se só há créditos legados (null), não mostra seleção
        const hasTypedCredits = roomCredits.some(c => c.usageType !== null);
        if (!hasTypedCredits && roomCredits.length > 0) {
          // Auto-seleciona crédito legado (comportamento padrão)
          if (!selectedCredit && roomCredits.length > 0) {
            // Não precisa selecionar, usa comportamento legado
          }
          return null;
        }
        
        return (
          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">2. Escolha o tipo de crédito</h3>
            <div className="grid gap-3">
              {roomCredits.map((credit) => {
                const label = credit.usageType === 'SHIFT' ? 'Turno Fixo (4h)' :
                              credit.usageType === 'SATURDAY_SHIFT' ? 'Turno Sábado (4h)' :
                              credit.usageType === 'HOURLY' ? 'Hora Avulsa (dias úteis)' :
                              credit.usageType === 'SATURDAY_HOURLY' ? 'Hora Avulsa (sábado)' :
                              'Crédito Flex';
                              
                return (
                  <button
                    key={credit.id}
                    onClick={() => { 
                      setSelectedCredit(credit); 
                      setSelectedHours([]); 
                      setSelectedShiftBlock(null);
                      setSelectedDate(null);
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left bg-white ${
                      selectedCredit?.id === credit.id
                        ? 'border-primary-500 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{label}</p>
                      <p className="text-sm text-gray-500">
                        {credit.usageType === 'SHIFT' || credit.usageType === 'SATURDAY_SHIFT' 
                          ? 'Bloco de 4 horas' 
                          : credit.usageType === null 
                            ? 'Múltiplas horas'
                            : '1 hora por reserva'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Disponível</p>
                      <p className="font-medium text-primary-600">{formatCurrency(credit.remainingAmount)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Step 2/3: Data */}
      {selectedRoom && (selectedCredit || !getCreditsForSelectedRoom(selectedRoom).some(c => c.usageType !== null)) && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {getCreditsForSelectedRoom(selectedRoom).some(c => c.usageType !== null) ? '3' : '2'}. Escolha a data
          </h3>
          
          {/* Aviso contextual baseado no tipo de crédito */}
          {isShiftCredit(selectedCredit) ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                ℹ️ Crédito de turno: você reservará um bloco fixo de 4 horas.
                {selectedCredit?.usageType === 'SATURDAY_SHIFT' ? ' Disponível apenas aos sábados.' : ' Disponível de seg-sex.'}
              </p>
            </div>
          ) : isSingleHourCredit(selectedCredit) ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                ℹ️ Crédito de hora avulsa: você pode reservar 1 hora por vez.
                {selectedCredit?.usageType === 'SATURDAY_HOURLY' ? ' Disponível apenas aos sábados.' : ' Disponível de seg-sex.'}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                ℹ️ Para dias úteis (seg-sex), reservas de horas avulsas podem ser feitas com até 30 dias de antecedência.
                Sábados seguem disponibilidade normal.
              </p>
            </div>
          )}

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
                onClick={() => { setSelectedDate(date); setSelectedHours([]); setSelectedShiftBlock(null); }}
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

      {/* Step 3/4: Horários ou Turnos */}
      {selectedRoom && selectedDate && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {getCreditsForSelectedRoom(selectedRoom).some(c => c.usageType !== null) ? '4' : '3'}. 
            {isShiftCredit(selectedCredit) ? ' Escolha o turno' : ' Escolha os horários'}
          </h3>
          
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : isShiftCredit(selectedCredit) ? (
            /* UI de blocos de turno para créditos SHIFT */
            <div className="grid gap-3">
              {(isSaturdayDay(selectedDate) ? SHIFT_BLOCKS.SATURDAY : SHIFT_BLOCKS.WEEKDAY).map((block) => {
                // Verifica se todos os horários do bloco estão disponíveis
                const blockHours = Array.from({ length: block.end - block.start }, (_, i) => block.start + i);
                const isBlockAvailable = blockHours.every(h => 
                  availableSlots.find(s => s.hour === h)?.available
                );
                
                return (
                  <button
                    key={block.id}
                    onClick={() => isBlockAvailable && setSelectedShiftBlock(block)}
                    disabled={!isBlockAvailable}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      selectedShiftBlock?.id === block.id
                        ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50'
                        : isBlockAvailable
                        ? 'bg-white border-gray-200 hover:border-gray-300'
                        : 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${selectedShiftBlock?.id === block.id ? 'text-primary-700' : isBlockAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
                        {block.label}
                      </p>
                      <p className={`text-sm ${selectedShiftBlock?.id === block.id ? 'text-primary-600' : 'text-gray-500'}`}>
                        {String(block.start).padStart(2, '0')}:00 - {String(block.end).padStart(2, '0')}:00 (4h)
                      </p>
                    </div>
                    {!isBlockAvailable && (
                      <span className="text-xs text-red-500">Indisponível</span>
                    )}
                    {selectedShiftBlock?.id === block.id && (
                      <span className="text-primary-600 text-lg">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {isSingleHourCredit(selectedCredit) && (
                <p className="text-sm text-gray-500 mb-3">
                  Selecione apenas 1 hora por reserva
                </p>
              )}
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
            </>
          )}
        </div>
      )}

      {/* Cupom de Desconto (opcional) - só aparece se houver horários selecionados */}
      {selectedRoom && (selectedHours.length > 0 || selectedShiftBlock) && (
        <div className="bg-gray-50 rounded-xl p-5">
          <label className="block text-base font-semibold text-gray-900 mb-2">
            {MICROCOPY.creditBooking.couponLabel}
          </label>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              setCouponCode(value);
              // Validação discreta: mostrar aviso se cupom digitado não é reconhecido
              if (value.trim() && !isValidCoupon(value)) {
                setCouponWarning(MICROCOPY.creditBooking.couponNotRecognized);
              } else {
                setCouponWarning('');
              }
            }}
            disabled={submitting}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
              submitting
                ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                : couponWarning
                  ? 'border-amber-300 bg-white'
                  : 'border-gray-300 bg-white'
            }`}
            placeholder={MICROCOPY.creditBooking.couponPlaceholder}
          />
          {couponWarning && (
            <p className="mt-1 text-xs text-amber-600">
              {couponWarning}
            </p>
          )}
          {couponCode.trim() && !couponWarning && (
            <p className="mt-1 text-xs text-gray-500">
              {MICROCOPY.creditBooking.couponHint}
            </p>
          )}
        </div>
      )}

      {/* Resumo */}
      {selectedRoom && (selectedHours.length > 0 || selectedShiftBlock) && (
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
                {isShiftCredit(selectedCredit) && selectedShiftBlock ? (
                  <>
                    {String(selectedShiftBlock.start).padStart(2, '0')}:00 - 
                    {String(selectedShiftBlock.end).padStart(2, '0')}:00
                    (4h - Turno)
                  </>
                ) : (
                  <>
                    {String(Math.min(...selectedHours)).padStart(2, '0')}:00 - 
                    {String(Math.max(...selectedHours) + 1).padStart(2, '0')}:00
                    ({selectedHours.length}h)
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <span className="text-gray-900 font-semibold">Total (créditos)</span>
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

      {/* Aviso inline de verificação de e-mail (próximo ao botão) */}
      {!emailVerified && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">📧</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800">Verifique seu e-mail para reservar</p>
              <p className="text-sm text-amber-700 mt-1">
                Enviamos um link de verificação para seu e-mail. Confira também a pasta de spam.
              </p>
              
              {/* Feedback do reenvio */}
              {resendStatus === 'sent' && (
                <p className="text-sm text-green-700 mt-2 font-medium">
                  ✓ {resendMessage}
                </p>
              )}
              {resendStatus === 'error' && (
                <p className="text-sm text-red-700 mt-2">
                  ✗ {resendMessage}
                </p>
              )}
              
              {/* Botão de reenvio */}
              {onResendVerification && resendStatus !== 'sent' && (
                <button
                  onClick={handleResendVerification}
                  disabled={resendStatus === 'sending'}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {resendStatus === 'sending' ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      Reenviar e-mail de verificação
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
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
          {submitting 
            ? 'Processando...' 
            : !emailVerified 
              ? '⚠️ Verificação Pendente' 
              : 'Confirmar Reserva'
          }
        </button>
      </div>
    </div>
  );
}
