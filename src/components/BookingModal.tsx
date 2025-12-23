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

// Registrar locale português
registerLocale('pt-BR', ptBR);

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

  // Produtos filtrados para esta sala (excluindo hora avulsa que é calculado automaticamente)
  const filteredProducts = products.filter((p) => 
    ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'SHIFT_FIXED', 'DAY_PASS', 'SATURDAY_5H'].includes(p.type)
  );

  // Handler de submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações básicas
    if (!formData.userName || !formData.userPhone || !formData.date) {
      setError('Por favor, preencha todos os campos obrigatórios.');
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

    setSubmitting(true);

    // Rastrear tentativa de reserva
    analytics.bookingSubmitted(room.name, getTotalPrice());

    try {
      // Montar data/hora de início e fim
      const startAt = setMinutes(setHours(formData.date, formData.startHour), 0);
      const endAt = addHours(startAt, formData.duration);

      // Validar CPF antes de enviar
      if (!isValidCpf(formData.userCpf)) {
        setCpfError('CPF inválido (11 dígitos)');
        setSubmitting(false);
        return;
      }
      setCpfError(null);

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
            <h2 className="text-xl font-bold text-gray-900">Reservar {room.name}</h2>
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
              disabled={submitting || formData.productType === 'package'}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                submitting || formData.productType === 'package'
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300'
              }`}
            >
              {[1, 2, 3, 4].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} hora{hours > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Reserva */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Reserva
            </label>
            <div className="flex gap-4">
              <label className={`flex items-center ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="radio"
                  checked={formData.productType === 'hourly'}
                  onChange={() => setFormData({ ...formData, productType: 'hourly', productId: '' })}
                  disabled={submitting}
                  className="mr-2"
                />
                <span className="text-sm">Hora Avulsa</span>
              </label>
              <label className={`flex items-center ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="radio"
                  checked={formData.productType === 'package'}
                  onChange={() => setFormData({ ...formData, productType: 'package' })}
                  disabled={submitting}
                  className="mr-2"
                />
                <span className="text-sm">Pacote</span>
              </label>
            </div>
          </div>

          {/* Seletor de Pacote */}
          {formData.productType === 'package' && (
            <div>
              <label htmlFor="package-select" className="block text-sm font-medium text-gray-700 mb-1">
                Selecionar Pacote
              </label>
              <select
                id="package-select"
                aria-label="Selecionar pacote"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                disabled={submitting}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                  submitting
                    ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                    : 'border-gray-300'
                }`}
              >
                <option value="">Selecione...</option>
                {filteredProducts.filter(p => p.type !== 'HOURLY_RATE').map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(product.price)}
                  </option>
                ))}
              </select>
            </div>
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
              <span className="text-gray-600">Sala</span>
              <span className="font-medium">{room.name}</span>
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
