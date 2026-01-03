// ===========================================================
// Componente BookingModal - Modal de reserva com formulário
// ===========================================================

import { useState, useEffect, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { formatCurrency, maskPhone, getPhoneError } from '@/lib/utils';
import Link from 'next/link';
import { analytics } from '@/lib/analytics';
import { PaymentMethodSelector } from '@/components/booking';

// Registrar locale português
registerLocale('pt-BR', ptBR);

// Helper para mapear nome de consultório
const getRoomDisplayName = (roomName: string): string => {
  const mapping: Record<string, string> = {
    'Consultório 1': 'Consultório 01',
    'Consultório 2': 'Consultório 02',
    'Consultório 3': 'Consultório 03',
  };
  return mapping[roomName] || roomName;
};

// Interface para slots de disponibilidade
interface AvailabilitySlot {
  hour: number;
  available: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  hoursIncluded: number | null;
  type: string;
  roomId?: string | null;
}

interface Room {
  id: string;
  name: string;
  hourlyRate: number;
  products?: Product[];
}

interface BookingModalProps {
  room: Room;
  products: Product[];
  onClose: () => void;
}

interface BookingFormData {
  userName: string;
  userPhone: string;
  userEmail: string;
  userCpf: string;
  date: Date | null;
  startHour: number;
  duration: number;
  productType: 'hourly' | 'package';
  productId: string;
  couponCode: string;
  notes: string;
  paymentMethod: 'PIX' | 'CARD';
  installmentCount: number;
}

// Função para formatar CPF (XXX.XXX.XXX-XX)
function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Validar CPF (apenas quantidade de dígitos)
function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

export default function BookingModal({ room, products, onClose }: BookingModalProps) {
  const [formData, setFormData] = useState<BookingFormData>({
    userName: '',
    userPhone: '',
    userEmail: '',
    userCpf: '',
    date: null,
    startHour: 9,
    duration: 1,
    productType: 'hourly',
    productId: '',
    couponCode: '',
    notes: '',
    paymentMethod: 'PIX',
    installmentCount: 1,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Estados de disponibilidade
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Buscar disponibilidade quando data mudar
  const fetchAvailability = useCallback(async (date: Date) => {
    setLoadingAvailability(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(`/api/availability?roomId=${room.id}&date=${dateStr}`);
      const data = await response.json();
      
      if (data.success && data.slots) {
        setAvailabilitySlots(data.slots);
        
        // Se o horário atual não está disponível, selecionar o primeiro disponível
        const currentHourSlot = data.slots.find((s: AvailabilitySlot) => s.hour === formData.startHour);
        if (!currentHourSlot?.available) {
          const firstAvailable = data.slots.find((s: AvailabilitySlot) => s.available);
          if (firstAvailable) {
            setFormData(prev => ({ ...prev, startHour: firstAvailable.hour }));
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar disponibilidade:', err);
    } finally {
      setLoadingAvailability(false);
    }
  }, [room.id, formData.startHour]);

  // Effect para buscar disponibilidade quando data mudar
  useEffect(() => {
    if (formData.date) {
      fetchAvailability(formData.date);
    } else {
      setAvailabilitySlots([]);
    }
  }, [formData.date, fetchAvailability]);

  // Rastrear abertura do modal (booking_started)
  useEffect(() => {
    analytics.bookingStarted(room.name);
  }, [room.name]);

  // Pegar preço da hora avulsa desta sala
  const hourlyProduct = products.find(p => p.type === 'HOURLY_RATE');
  const hourlyPrice = hourlyProduct?.price || room.hourlyRate || 0;

  // Cupons válidos (deve estar sincronizado com o backend)
  const VALID_COUPONS: Record<string, { discountType: 'fixed' | 'percent'; value: number; description: string }> = {
    'TESTE50': { discountType: 'fixed', value: -1, description: 'Cupom de teste - R$ 5,00' },
  };

  // Calcular valor total (com cupom aplicado)
  const getTotalPrice = () => {
    let basePrice: number;
    if (formData.productType === 'package' && formData.productId) {
      const product = products.find((p) => p.id === formData.productId);
      basePrice = product?.price || 0;
    } else {
      basePrice = hourlyPrice * formData.duration;
    }

    // Aplicar cupom se válido
    const couponKey = formData.couponCode.toUpperCase().trim();
    const coupon = VALID_COUPONS[couponKey];
    if (coupon) {
      if (coupon.discountType === 'fixed' && coupon.value === -1) {
        return 500; // R$ 5,00 em centavos
      } else if (coupon.discountType === 'fixed') {
        return Math.max(0, basePrice - coupon.value);
      } else if (coupon.discountType === 'percent') {
        return Math.round(basePrice * (1 - coupon.value / 100));
      }
    }

    return basePrice;
  };

  // Verificar se cupom é válido (para exibir feedback)
  const isCouponValid = () => {
    const couponKey = formData.couponCode.toUpperCase().trim();
    return couponKey && VALID_COUPONS[couponKey];
  };

  // Opções de horário (8h às 19h)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 8);

  // E1: Ajustar duração automaticamente se horário selecionado não permitir a duração atual
  useEffect(() => {
    if (formData.startHour && formData.productType === 'hourly') {
      const maxDuration = 20 - formData.startHour;
      if (formData.duration > maxDuration) {
        setFormData(prev => ({ ...prev, duration: Math.max(1, maxDuration) }));
      }
    }
  }, [formData.startHour]);

  // Produtos filtrados para esta sala (excluindo hora avulsa que é calculado automaticamente)
  const filteredProducts = products.filter((p) => 
    ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'SHIFT_FIXED', 'DAY_PASS', 'SATURDAY_5H'].includes(p.type)
  );

  // Handler de submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações comuns (nome, telefone, termos)
    if (!formData.userName || !formData.userPhone) {
      setError('Por favor, preencha nome e telefone.');
      return;
    }

    // Validar aceite dos termos
    if (!acceptedTerms) {
      setError('Você precisa aceitar os Termos de Uso e Política de Privacidade.');
      return;
    }

    // Validar telefone
    const phoneValidationError = getPhoneError(formData.userPhone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      setError(phoneValidationError);
      return;
    }

    // Validar CPF antes de enviar
    if (!isValidCpf(formData.userCpf)) {
      setCpfError('CPF inválido (11 dígitos)');
      setError('CPF inválido.');
      return;
    }
    setCpfError(null);

    // E5: Validação defensiva por tipo
    if (formData.productType === 'hourly') {
      // Hora avulsa PRECISA de data e horário
      if (!formData.date) {
        setError('Por favor, selecione uma data.');
        return;
      }
      if (!formData.startHour) {
        setError('Por favor, selecione um horário.');
        return;
      }
      // E1: Validar que horário não ultrapassa fechamento (20h)
      if (formData.startHour + formData.duration > 20) {
        setError(`A reserva ultrapassa o horário de fechamento (20h). Duração máxima disponível: ${20 - formData.startHour}h.`);
        return;
      }
    } else {
      // Pacote PRECISA de productId selecionado
      if (!formData.productId) {
        setError('Por favor, selecione um pacote.');
        return;
      }
    }

    setSubmitting(true);

    // Rastrear tentativa de reserva
    analytics.bookingSubmitted(room.name, getTotalPrice());

    try {
      // Se é PACOTE/CRÉDITO → usa endpoint de crédito (sem criar booking)
      if (formData.productType === 'package') {
        // Determinar se é horas avulsas ou pacote
        const isHourlyCredit = formData.productId === 'hourly_credit';
        
        const response = await fetch('/api/credits/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName: formData.userName,
            userPhone: formData.userPhone,
            userEmail: formData.userEmail || undefined,
            userCpf: formData.userCpf.replace(/\D/g, ''),
            roomId: room.id,
            // Se é hora avulsa, envia hours; se é pacote, envia productId
            productId: isHourlyCredit ? undefined : formData.productId,
            hours: isHourlyCredit ? formData.duration : undefined,
            couponCode: formData.couponCode || undefined,
            paymentMethod: formData.paymentMethod,
            installmentCount: formData.paymentMethod === 'CARD' ? formData.installmentCount : undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao processar compra de créditos');
        }

        // Redirecionar para pagamento
        if (data.paymentUrl) {
          localStorage.setItem('lastCreditId', data.creditId);
          localStorage.setItem('lastPaymentUrl', data.paymentUrl);
          window.location.href = `/booking/pending?credit=${data.creditId}&type=credit`;
          return;
        } else {
          throw new Error('Erro ao gerar pagamento. Tente novamente.');
        }
      }

      // HORA AVULSA → fluxo normal de reserva
      const startAt = setMinutes(setHours(formData.date!, formData.startHour), 0);
      const endAt = addHours(startAt, formData.duration);

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formData.userName,
          userPhone: formData.userPhone,
          userEmail: formData.userEmail || undefined,
          userCpf: formData.userCpf.replace(/\D/g, ''),
          roomId: room.id,
          productId: formData.productId || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          payNow: true,
          couponCode: formData.couponCode || undefined,
          notes: formData.notes || undefined,
          paymentMethod: formData.paymentMethod,
          installmentCount: formData.paymentMethod === 'CARD' ? formData.installmentCount : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar reserva');
      }

      // Se tem valor a pagar, DEVE ter paymentUrl
      if (data.amountToPay > 0) {
        if (data.paymentUrl) {
          localStorage.setItem('lastBookingId', data.bookingId);
          localStorage.setItem('lastPaymentUrl', data.paymentUrl);
          window.location.href = `/booking/pending?booking=${data.bookingId}`;
          return;
        } else {
          throw new Error('Erro ao gerar pagamento. Tente novamente.');
        }
      }

      // Sucesso SEM pagamento (100% pago com créditos)
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar reserva');
    } finally {
      setSubmitting(false);
    }
  };

  // Se reserva foi criada com sucesso
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 text-center modal-content my-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Reserva Criada!</h2>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">
            Sua reserva foi criada com sucesso. Em breve você receberá uma confirmação.
          </p>
          <button
            onClick={onClose}
            className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition min-h-[48px] w-full sm:w-auto"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 modal-backdrop overflow-y-auto"
      onClick={(e) => !submitting && e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-content my-2 sm:my-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reservar {getRoomDisplayName(room.name)}</h2>
            <p className="text-sm text-gray-500">Preencha os dados abaixo</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className={`text-2xl transition ${
              submitting
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            ×
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              disabled={submitting}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-base ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300'
              }`}
              placeholder="Seu nome"
              required
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefone *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={formData.userPhone}
              onChange={(e) => {
                const masked = maskPhone(e.target.value);
                setFormData({ ...formData, userPhone: masked });
                // Limpar erro ao digitar
                if (phoneError) {
                  const newError = getPhoneError(masked);
                  setPhoneError(newError);
                }
              }}
              onBlur={() => {
                // Validar ao sair do campo
                setPhoneError(getPhoneError(formData.userPhone));
              }}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : phoneError 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300'
              }`}
              placeholder="(31) 99999-9999"
              required
              autoComplete="tel"
            />
            {phoneError && (
              <p className="mt-1 text-sm text-red-600">{phoneError}</p>
            )}
          </div>

          {/* Email (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.userEmail}
              onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300'
              }`}
              placeholder="seu@email.com"
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.userCpf}
              onChange={(e) => {
                const masked = maskCpf(e.target.value);
                setFormData({ ...formData, userCpf: masked });
                if (cpfError && isValidCpf(masked)) setCpfError(null);
              }}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : cpfError
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
              }`}
              placeholder="000.000.000-00"
              required
            />
            {cpfError && (
              <p className="mt-1 text-sm text-red-600">{cpfError}</p>
            )}
          </div>

          {/* Tipo de Reserva - PRIMEIRO para clareza */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              O que você deseja?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, productType: 'hourly', productId: '' })}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  formData.productType === 'hourly'
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500 ring-offset-2'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-lg font-semibold text-gray-900">🗓️ Agendar horário</div>
                <div className="text-sm text-gray-500 mt-1">Escolha data e hora agora</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, productType: 'package' })}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  formData.productType === 'package'
                    ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-500 ring-offset-2'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-lg font-semibold text-gray-900">💰 Comprar créditos</div>
                <div className="text-sm text-gray-500 mt-1">Agende depois, na sua conta</div>
              </button>
            </div>
          </div>

          {/* PACOTE: Seletor + Aviso (SEM calendário) */}
          {formData.productType === 'package' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  O que você quer comprar?
                </label>
                
                {/* Opção: Horas Avulsas */}
                <div className="space-y-3">
                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.productId === 'hourly_credit' 
                        ? 'border-accent-500 bg-accent-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFormData({ ...formData, productId: 'hourly_credit' })}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">⏱️ Horas Avulsas</div>
                        <div className="text-sm text-gray-500">Compre horas para usar quando quiser</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-accent-600">{formatCurrency(hourlyPrice)}/hora</div>
                      </div>
                    </div>
                    
                    {formData.productId === 'hourly_credit' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label htmlFor="hours-credit-select" className="block text-sm font-medium text-gray-700 mb-1">
                          Quantas horas?
                        </label>
                        <div className="flex items-center gap-3">
                          <select
                            id="hours-credit-select"
                            aria-label="Quantidade de horas"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500"
                          >
                            {[1, 2, 3, 4, 5, 6, 8, 10].map((h) => (
                              <option key={h} value={h}>{h} hora{h > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                          <div className="text-lg font-bold text-gray-900">
                            = {formatCurrency(hourlyPrice * formData.duration)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divisor */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-gray-200"></div>
                    <span className="text-sm text-gray-400">ou escolha um pacote</span>
                    <div className="flex-1 border-t border-gray-200"></div>
                  </div>

                  {/* Pacotes */}
                  {filteredProducts.filter(p => p.type !== 'HOURLY_RATE').map((product) => (
                    <div 
                      key={product.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.productId === product.id 
                          ? 'border-accent-500 bg-accent-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setFormData({ ...formData, productId: product.id })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{product.name}</div>
                          {product.hoursIncluded && (
                            <div className="text-sm text-gray-500">{product.hoursIncluded} horas incluídas</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-accent-600">{formatCurrency(product.price)}</div>
                          {product.hoursIncluded && (
                            <div className="text-xs text-green-600">
                              {formatCurrency(Math.round(product.price / product.hoursIncluded))}/hora
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso claro sobre créditos */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💳</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Você está comprando créditos</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      O agendamento será feito depois, na sua área do cliente. 
                      Seus créditos ficam disponíveis imediatamente após o pagamento.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* HORA AVULSA: Data + Horário + Duração */}
          {formData.productType === 'hourly' && (
            <>
              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <DatePicker
                  selected={formData.date}
                  onChange={(date) => setFormData({ ...formData, date })}
                  locale="pt-BR"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Selecione a data"
                  disabled={submitting}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    submitting
                      ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                      : 'border-gray-300'
                  }`}
                  minDate={new Date()}
                  filterDate={(date) => date.getDay() !== 0} // Bloqueia domingos
                />
              </div>

              {/* Horário - Grid Visual de Disponibilidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário * {loadingAvailability && (
                    <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin ml-2" />
                  )}
                </label>
                
                {!formData.date ? (
                  <p className="text-sm text-gray-500 italic">Selecione uma data para ver os horários disponíveis</p>
                ) : (
                  <>
                    {/* Grid de Horários */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {hourOptions.map((hour) => {
                        const slot = availabilitySlots.find(s => s.hour === hour);
                        const isAvailable = slot?.available ?? true;
                        const isSelected = formData.startHour === hour;
                        
                        return (
                          <button
                            key={hour}
                            type="button"
                            disabled={!isAvailable || submitting || loadingAvailability}
                            onClick={() => setFormData({ ...formData, startHour: hour })}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2'
                                : isAvailable
                                  ? 'bg-white border border-gray-300 text-gray-700 hover:border-primary-400 hover:bg-primary-50'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                            } ${submitting || loadingAvailability ? 'cursor-not-allowed opacity-50' : ''}`}
                          >
                            {String(hour).padStart(2, '0')}:00
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Legenda */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-white border border-gray-300"></div>
                        <span>Disponível</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-gray-100"></div>
                        <span>Ocupado</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-primary-600"></div>
                        <span>Selecionado</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Duração */}
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duração
                </label>
                <select
                  id="duration"
                  aria-label="Duração da reserva"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  disabled={submitting}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    submitting
                      ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                      : 'border-gray-300'
                  }`}
                >
                  {/* E1: Só mostra durações válidas (que não ultrapassam 20h) */}
                  {[1, 2, 3, 4]
                    .filter((hours) => formData.startHour + hours <= 20)
                    .map((hours) => (
                      <option key={hours} value={hours}>
                        {hours} hora{hours > 1 ? 's' : ''}
                      </option>
                    ))}
                </select>
                {formData.startHour && formData.startHour >= 17 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Horário próximo ao fechamento. Duração máxima: {20 - formData.startHour}h
                  </p>
                )}
              </div>
            </>
          )}

          {/* Cupom de Desconto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cupom de Desconto
            </label>
            <input
              type="text"
              value={formData.couponCode}
              onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : isCouponValid()
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300'
              }`}
              placeholder="Digite seu cupom (opcional)"
            />
            {isCouponValid() && (
              <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Cupom aplicado! Novo valor: {formatCurrency(getTotalPrice())}
              </p>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300'
              }`}
              rows={2}
              placeholder="Alguma informação adicional?"
            />
          </div>

          {/* Resumo */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Consultório</span>
              <span className="font-medium">{getRoomDisplayName(room.name)}</span>
            </div>
            {formData.date && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Data/Hora</span>
                <span className="font-medium">
                  {format(formData.date, 'dd/MM/yyyy')} às {String(formData.startHour).padStart(2, '0')}:00
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary-600">
                {formatCurrency(getTotalPrice())}
              </span>
            </div>
          </div>

          {/* Seletor de Método de Pagamento */}
          {getTotalPrice() > 0 && (
            <PaymentMethodSelector
              selected={formData.paymentMethod}
              onSelect={(method) => setFormData(prev => ({ ...prev, paymentMethod: method }))}
              showInstallments={formData.paymentMethod === 'CARD'}
              installmentCount={formData.installmentCount}
              onInstallmentChange={(count) => setFormData(prev => ({ ...prev, installmentCount: count }))}
              totalAmount={getTotalPrice()}
              disabled={submitting}
            />
          )}

          {/* Aceite de Termos - LGPD */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="acceptTerms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={submitting}
              className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="acceptTerms" className="text-sm text-gray-600">
              Li e aceito os{' '}
              <Link 
                href="/termos" 
                target="_blank" 
                className="text-primary-600 hover:underline"
              >
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link 
                href="/privacidade" 
                target="_blank" 
                className="text-primary-600 hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </label>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 pb-safe">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`flex-1 px-4 py-3 min-h-[48px] border rounded-lg font-semibold transition text-base ${
                submitting
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 px-4 py-3 min-h-[48px] rounded-lg font-semibold transition flex items-center justify-center gap-2 text-base ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
              }`}
            >
              {submitting && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Processando...' : 'Reservar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
