// ===========================================================
// Componente BookingModal - Modal de reserva com formulário
// ===========================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { formatCurrency, maskPhone, getPhoneError } from '@/lib/utils';
import Link from 'next/link';

import { PaymentMethodSelector } from '@/components/booking';
import { getPricingInfoForUI } from '@/lib/pricing';
import { getHourOptionsForDate, getBusinessHoursForDate, isClosedDay } from '@/lib/business-hours';
import { calculatePaymentTotals } from '@/utils/financial';

// Registrar locale português
registerLocale('pt-BR', ptBR);

// ===========================================================
// UTILITIES: Seleção de bloco de horários (FIX A)
// ===========================================================

/**
 * Computa array de slots selecionados baseado em horário inicial e duração
 * @param startHour - Hora inicial (ex: 9)
 * @param duration - Duração em horas (ex: 4)
 * @returns Array de horas [9, 10, 11, 12]
 */
function computeSelectedSlots(startHour: number, duration: number): number[] {
  const slots: number[] = [];
  for (let i = 0; i < duration; i++) {
    slots.push(startHour + i);
  }
  return slots;
}

/**
 * Computa hora de término
 * @param startHour - Hora inicial
 * @param duration - Duração em horas
 * @returns Hora de término (ex: 9 + 4 = 13)
 */
function computeEndHour(startHour: number, duration: number): number {
  return startHour + duration;
}

/**
 * Formata intervalo de horário para exibição
 * @param startHour - Hora inicial
 * @param duration - Duração em horas
 * @returns String formatada "09:00–13:00 (4h)"
 */
function formatTimeRange(startHour: number, duration: number): string {
  const endHour = computeEndHour(startHour, duration);
  const startStr = String(startHour).padStart(2, '0') + ':00';
  const endStr = String(endHour).padStart(2, '0') + ':00';
  return `${startStr}–${endStr} (${duration}h)`;
}

/**
 * Verifica se todos os slots de um bloco estão disponíveis
 * @param startHour - Hora inicial
 * @param duration - Duração em horas
 * @param availabilitySlots - Array de slots com disponibilidade
 * @returns { valid: boolean, unavailableSlots: number[] }
 */
function validateBlockAvailability(
  startHour: number,
  duration: number,
  availabilitySlots: AvailabilitySlot[]
): { valid: boolean; unavailableSlots: number[] } {
  const selectedSlots = computeSelectedSlots(startHour, duration);
  const unavailableSlots: number[] = [];

  for (const hour of selectedSlots) {
    const slot = availabilitySlots.find(s => s.hour === hour);
    // Se slot não existe ou não está disponível
    if (!slot || slot.available !== true) {
      unavailableSlots.push(hour);
    }
  }

  return {
    valid: unavailableSlots.length === 0,
    unavailableSlots,
  };
}

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
  slug: string;
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
  professionalRegister: string;
  date: Date | null;
  startHour: number;
  duration: number;
  productType: 'hourly' | 'package';
  productId: string;
  couponCode: string;
  notes: string;
  paymentMethod: 'PIX' | 'CARD';
  installmentCount: number; // Número de parcelas (1 = à vista, 2-12 = parcelado)
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
    professionalRegister: '',
    date: null,
    startHour: 9,
    duration: 1,
    productType: 'hourly',
    productId: '',
    couponCode: '',
    notes: '',
    paymentMethod: 'PIX',
    installmentCount: 1, // Parcelas (1 = à vista)
  });

  // Estado para dados do usuário autenticado
  const [userData, setUserData] = useState<{
    name: string | null;
    email: string;
    phone?: string;
    professionalRegister?: string;
  } | null>(null);

  // Buscar dados do usuário autenticado
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUserData({
            name: data.user.name,
            email: data.user.email,
            phone: undefined, // API não retorna phone, será preenchido pelo formulário
            professionalRegister: undefined, // API não retorna professionalRegister, será preenchido pelo formulário
          });
        }
      } catch (error) {
        console.error('[BookingModal] Erro ao buscar dados do usuário:', error);
      }
    };
    fetchUserData();
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Estado auxiliar para profissão (controla label dinâmico do registro)
  const [profession, setProfession] = useState('Médico');

  // Mapeamento de Labels e Placeholders
  const professionConfigs: Record<string, { label: string; placeholder: string }> = {
    'Médico': { label: 'CRM', placeholder: 'Ex: 123456-SP' },
    'Psicólogo': { label: 'CRP', placeholder: 'Ex: 06/123456' },
    'Nutricionista': { label: 'CRN', placeholder: 'Ex: 12345' },
    'Fisioterapeuta': { label: 'CREFITO', placeholder: 'Ex: 12345-F' },
    'Fonoaudiólogo': { label: 'CRFa', placeholder: 'Ex: 12345' },
    'Outros': { label: 'Registro Profissional', placeholder: 'Seu registro profissional' },
  };

  // Cooldown para evitar múltiplos cliques no botão
  const [buttonCooldown, setButtonCooldown] = useState(false);

  // Ref para scroll automático ao topo quando houver erro
  const modalContentRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Estados de disponibilidade
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Estado para erro de bloco indisponível (FIX A)
  const [blockError, setBlockError] = useState<string | null>(null);

  // Compute selected slots para destacar visualmente (FIX A)
  const selectedSlots = useMemo(() => {
    if (formData.productType !== 'hourly' || !formData.date) return [];
    return computeSelectedSlots(formData.startHour, formData.duration);
  }, [formData.productType, formData.date, formData.startHour, formData.duration]);

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



  // Obter informações de preço usando helper unificado (weekday vs saturday)
  const pricingInfo = getPricingInfoForUI(room.id, formData.date, room.slug);

  // Produtos filtrados para esta sala - apenas pacotes de horas
  // Turnos (SHIFT_FIXED, SATURDAY_SHIFT) são tratados manualmente via WhatsApp/Admin
  // Excluídos: DAY_PASS, SATURDAY_5H (descontinuados)
  const officialTypes = ['PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H'];
  const filteredProducts = products
    .filter((p) => officialTypes.includes(p.type))
    .map((p) => {
      // CORREÇÃO: Se o preço parece estar incorreto (muito alto), corrigir automaticamente
      // Valores acima de 1000000 centavos (R$ 10.000,00) são suspeitos para pacotes
      // Pacotes normalmente custam entre R$ 300 e R$ 2.000 (30000 a 200000 centavos)
      if (p.price > 1000000 && p.type.startsWith('PACKAGE_')) {
        // Tentar detectar se está multiplicado por 10 ou 100
        // Se dividir por 10 resulta em um valor razoável (entre 30000 e 200000), usar esse valor
        const dividedBy10 = Math.round(p.price / 10);
        if (dividedBy10 >= 30000 && dividedBy10 <= 200000) {
          console.warn(`⚠️ [BookingModal] Corrigindo preço de ${p.name}: ${p.price} → ${dividedBy10} centavos (estava multiplicado por 10)`);
          return { ...p, price: dividedBy10 };
        }
        // Se dividir por 100 resulta em um valor razoável, usar esse valor
        const dividedBy100 = Math.round(p.price / 100);
        if (dividedBy100 >= 30000 && dividedBy100 <= 200000) {
          console.warn(`⚠️ [BookingModal] Corrigindo preço de ${p.name}: ${p.price} → ${dividedBy100} centavos (estava multiplicado por 100)`);
          return { ...p, price: dividedBy100 };
        }
      }
      return p;
    });

  // Estado de cupom
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    discountAmount: number;
    netAmount: number;
    message: string;
  } | null>(null);

  // Helper para calcular preço base (sem desconto)
  const getBasePrice = useCallback(() => {
    let basePrice: number;
    if (formData.productType === 'package' && formData.productId) {
      // Usar filteredProducts para obter o produto corrigido
      const product = filteredProducts.find((p) => p.id === formData.productId);
      basePrice = product?.price || 0;
    } else {
      // Usar preço da sala conforme data (helper unificado)
      basePrice = pricingInfo.hourlyPrice * formData.duration;
    }
    return basePrice; // EM CENTAVOS
  }, [formData.productType, formData.productId, formData.duration, products, pricingInfo]);

  // Validar cupom via API
  const handleApplyCoupon = async () => {
    const price = getBasePrice();
    if (!price || !couponCode.trim()) {
      setCouponError('Digite um cupom');
      return;
    }

    setCouponValidating(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          grossAmount: price,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setCouponError(data.message || 'Cupom inválido');
        return;
      }

      // Cupom válido
      setCouponApplied({
        code: data.code,
        discountAmount: data.discountAmount,
        netAmount: data.netAmount,
        message: data.message,
      });

      // Atualizar no formData para envio
      setFormData(prev => ({ ...prev, couponCode: data.code }));
    } catch (err) {
      setCouponError('Erro ao validar cupom');
    } finally {
      setCouponValidating(false);
    }
  };

  // Remover cupom
  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(null);
    setCouponError(null);
    setFormData(prev => ({ ...prev, couponCode: '' }));
  };

  // Resetar cupom quando muda produto/duração (pois o preço muda)
  useEffect(() => {
    if (couponApplied) {
      handleRemoveCoupon();
    }
  }, [formData.productType, formData.productId, formData.duration, formData.date]);

  // Calcular valor total (com ou sem desconto)
  // Se applyDiscount = false, retorna o preço cheio (para subtotal)
  const getTotalPrice = (applyDiscount = true) => {
    // Se temos cupom aplicado e validado, usar o netAmount dele
    if (applyDiscount && couponApplied) {
      return couponApplied.netAmount;
    }
    return getBasePrice();
  };

  // Opções de horário DINÂMICAS baseadas na data selecionada
  // Sábado: [8,9,10,11], Seg-Sex: [8..19], Domingo: []
  const hourOptions = useMemo(() => {
    return getHourOptionsForDate(formData.date);
  }, [formData.date]);

  // Horário de fechamento para a data selecionada
  const businessHours = useMemo(() => {
    return formData.date ? getBusinessHoursForDate(formData.date) : { start: 8, end: 20 };
  }, [formData.date]);

  // Verificar se é dia fechado
  const isClosed = formData.date ? isClosedDay(formData.date) : false;

  // E1: Ajustar duração e startHour quando data/horário mudar
  useEffect(() => {
    if (formData.productType === 'hourly' && formData.date) {
      const hours = getBusinessHoursForDate(formData.date);

      // Se dia fechado, resetar horário
      if (!hours) {
        return;
      }

      // Se startHour está fora do range válido, resetar para primeiro disponível
      if (formData.startHour < hours.start || formData.startHour >= hours.end) {
        setFormData(prev => ({ ...prev, startHour: hours.start }));
        return;
      }

      // FIX A: Revalidar bloco quando duração mudar
      if (availabilitySlots.length > 0) {
        const validation = validateBlockAvailability(formData.startHour, formData.duration, availabilitySlots);
        if (!validation.valid) {
          setBlockError(`Bloco indisponível. Slots ocupados: ${validation.unavailableSlots.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')}. Selecione outro horário.`);
        } else {
          setBlockError(null);
        }
      }

      // Ajustar duração se ultrapassar fechamento
      const maxDuration = hours.end - formData.startHour;
      if (formData.duration > maxDuration) {
        setFormData(prev => ({ ...prev, duration: Math.max(1, maxDuration) }));
      }
    }
  }, [formData.startHour, formData.date, formData.productType, formData.duration, availabilitySlots]);

  // ===========================================================
  // UX HELPER: Scroll para mensagem de erro e cooldown do botão
  // ===========================================================
  const scrollToError = useCallback(() => {
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (modalContentRef.current) {
        modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  }, []);

  const showErrorWithScroll = useCallback((message: string) => {
    setError(message);
    scrollToError();
  }, [scrollToError]);

  // Ativar cooldown temporário no botão após clique
  const activateButtonCooldown = useCallback(() => {
    setButtonCooldown(true);
    setTimeout(() => setButtonCooldown(false), 2000); // 2 segundos de cooldown
  }, []);

  // Handler de submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Ativar cooldown para evitar múltiplos cliques
    activateButtonCooldown();

    // Validações comuns (nome, telefone, termos)
    if (!formData.userName || !formData.userPhone) {
      showErrorWithScroll('Por favor, preencha nome e telefone.');
      return;
    }

    // Validar aceite dos termos
    if (!acceptedTerms) {
      showErrorWithScroll('Você precisa aceitar os Termos de Uso e Política de Privacidade.');
      return;
    }

    // Validar telefone
    const phoneValidationError = getPhoneError(formData.userPhone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      showErrorWithScroll(phoneValidationError);
      return;
    }

    // Validar CPF antes de enviar
    if (!isValidCpf(formData.userCpf)) {
      setCpfError('CPF inválido (11 dígitos)');
      showErrorWithScroll('CPF inválido.');
      return;
    }
    setCpfError(null);

    // E5: Validação defensiva por tipo
    if (formData.productType === 'hourly') {
      // Hora avulsa PRECISA de data e horário
      if (!formData.userCpf) {
        showErrorWithScroll('Por favor, informe seu CPF.');
        return;
      }

      if (!formData.professionalRegister || formData.professionalRegister.trim().length < 3) {
        showErrorWithScroll('Por favor, informe seu Registro Profissional (CRM, CRP, etc).');
        return;
      }

      if (!formData.date) {
        showErrorWithScroll('Por favor, selecione uma data.');
        return;
      }

      // Verificar se é dia fechado
      const bh = getBusinessHoursForDate(formData.date);
      if (!bh) {
        showErrorWithScroll('Fechado neste dia. Por favor, selecione outra data.');
        return;
      }

      if (!formData.startHour) {
        showErrorWithScroll('Por favor, selecione um horário.');
        return;
      }
      // E1: Validar que horário não ultrapassa fechamento (usa businessHours.end dinâmico)
      if (formData.startHour + formData.duration > bh.end) {
        showErrorWithScroll(`A reserva ultrapassa o horário de fechamento (${bh.end}h). Duração máxima disponível: ${bh.end - formData.startHour}h.`);
        return;
      }

      // FIX A: Validar que bloco inteiro está disponível
      const blockValidation = validateBlockAvailability(formData.startHour, formData.duration, availabilitySlots);
      if (!blockValidation.valid) {
        setBlockError(`Bloco indisponível. Slots ocupados: ${blockValidation.unavailableSlots.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')}`);
        showErrorWithScroll('Alguns horários do bloco selecionado estão ocupados. Escolha outro horário.');
        return;
      }
      setBlockError(null);
    } else {
      // Pacote PRECISA de productId selecionado
      if (!formData.productId) {
        showErrorWithScroll('Por favor, selecione um pacote.');
        return;
      }
    }

    setSubmitting(true);



    try {
      // Se é PACOTE/CRÉDITO → usa endpoint de crédito (sem criar booking)
      if (formData.productType === 'package') {
        // Determinar se é horas avulsas ou pacote
        const isHourlyCredit = formData.productId === 'hourly_credit';
        // Buscar o produto selecionado para obter o type
        // Tentar buscar em filteredProducts primeiro, depois em products geral
        const selectedProduct = filteredProducts.find((p) => p.id === formData.productId) ||
          products.find((p) => p.id === formData.productId);
        const response = await fetch('/api/credits/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName: formData.userName,
            userPhone: formData.userPhone,
            userEmail: formData.userEmail || undefined,
            userCpf: formData.userCpf.replace(/\D/g, ''),
            roomId: room.id,
            // Se é hora avulsa, envia hours; se é pacote, envia productType
            productType: isHourlyCredit ? undefined : selectedProduct?.type,
            hours: isHourlyCredit ? formData.duration : undefined,
            couponCode: formData.couponCode || undefined,
            paymentMethod: formData.paymentMethod,
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
          // FIX B: Salvar método de pagamento para exibir copy correta
          localStorage.setItem('lastPaymentMethod', formData.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX');
          const paymentMethodParam = formData.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX';
          window.location.href = `/booking/pending?credit=${data.creditId}&type=credit&paymentMethod=${paymentMethodParam}`;
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
          userPhone: formData.userPhone.replace(/\D/g, ''),
          userEmail: formData.userEmail,
          userCpf: formData.userCpf.replace(/\D/g, ''),
          professionalRegister: formData.professionalRegister.trim(),
          productId: undefined, // Hora avulsa não usa productId
          roomId: room.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          payNow: true,
          useCredits: true, // FIX: Sempre tentar usar créditos no modo "Agendar horário"
          couponCode: formData.couponCode || undefined,
          notes: formData.notes || undefined,
          paymentMethod: formData.paymentMethod,
          installmentCount: formData.paymentMethod === 'CARD' && formData.installmentCount > 1
            ? formData.installmentCount
            : undefined,
          // Valores sincronizados pela utility financial.ts
          ...(formData.paymentMethod === 'CARD' && formData.installmentCount > 1 ? (() => {
            // FIX: Usar preço BASE (sem desconto) e passar o desconto explicitamente
            const basePrice = getTotalPrice(false);
            const discount = couponApplied?.discountAmount || 0;
            const calc = calculatePaymentTotals(basePrice, formData.installmentCount, discount);
            return {
              adjustedTotalCents: calc.adjustedTotalCents,
              installmentValueCents: calc.installmentValueCents,
            };
          })() : {}),
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
          localStorage.setItem('lastPaymentMethod', formData.paymentMethod === 'CARD' ? 'CREDIT_CARD' : 'PIX');

          if (formData.paymentMethod === 'CARD') {
            // CARTÃO: Redireciona direto para checkout Asaas (cliente escolhe parcelas lá)
            window.location.href = data.paymentUrl;
          } else {
            // PIX: Vai para página pending com QR code
            window.location.href = `/booking/pending?booking=${data.bookingId}&paymentMethod=PIX`;
          }
          return;
        } else {
          throw new Error('Erro ao gerar pagamento. Tente novamente.');
        }
      }

      // Sucesso SEM pagamento (100% pago com créditos)
      setSuccess(true);
    } catch (err) {
      showErrorWithScroll(err instanceof Error ? err.message : 'Erro ao processar reserva');
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
      <div
        ref={modalContentRef}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-content my-2 sm:my-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reservar {getRoomDisplayName(room.name)}</h2>
            <p className="text-sm text-gray-500">Preencha os dados abaixo</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className={`text-2xl transition ${submitting
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
            <div
              ref={errorRef}
              className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm shadow-sm"
              role="alert"
              style={{
                animation: 'shake 0.5s ease-in-out'
              }}
            >
              <span className="font-semibold">⚠️ Atenção:</span> {error}
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
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-base ${submitting
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
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

          {/* PROFISSÃO E REGISTRO PROFISSIONAL (OBRIGATÓRIOS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {/* Seleção de Profissão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qual sua profissão? *
              </label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                disabled={submitting}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300'
                  }`}
              >
                {Object.keys(professionConfigs).map((prof) => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
            </div>

            {/* Registro Profissional Dinâmico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {professionConfigs[profession].label} *
              </label>
              <input
                type="text"
                value={formData.professionalRegister}
                onChange={(e) => setFormData({ ...formData, professionalRegister: e.target.value })}
                disabled={submitting}
                placeholder={professionConfigs[profession].placeholder}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
                  ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  : (!formData.professionalRegister && !submitting) // Visual hint if empty
                    ? 'border-gray-300'
                    : 'border-gray-300'
                  }`}
                required
              />
            </div>
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
                className={`p-4 rounded-lg border-2 transition-all text-left ${formData.productType === 'hourly'
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
                className={`p-4 rounded-lg border-2 transition-all text-left ${formData.productType === 'package'
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
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.productId === 'hourly_credit'
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
                        <div className="font-bold text-accent-600">{formatCurrency(pricingInfo.hourlyPrice)}/hora</div>
                        {pricingInfo.isSaturday && (
                          <div className="text-xs text-amber-600 mt-1">{pricingInfo.label}</div>
                        )}
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
                            = {formatCurrency(pricingInfo.hourlyPrice * formData.duration)}
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
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.productId === product.id
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
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
                ) : isClosed ? (
                  /* UI para dia fechado */
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <span className="text-2xl">🚫</span>
                    <p className="text-amber-800 font-medium mt-2">Fechado neste dia</p>
                    <p className="text-amber-600 text-sm mt-1">Por favor, selecione outra data.</p>
                  </div>
                ) : hourOptions.length === 0 ? (
                  /* Sem horários disponíveis */
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <span className="text-2xl">📅</span>
                    <p className="text-gray-600 font-medium mt-2">Nenhum horário disponível</p>
                  </div>
                ) : (
                  <>
                    {/* Grid de Horários */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {hourOptions.map((hour) => {
                        const slot = availabilitySlots.find(s => s.hour === hour);
                        // CORREÇÃO: Se slot não existe no payload, considerar INDISPONÍVEL (não default true)
                        const isAvailable = slot?.available === true;
                        // FIX A: Destacar TODOS os slots do intervalo selecionado
                        const isInSelectedRange = selectedSlots.includes(hour);
                        const isStartHour = formData.startHour === hour;

                        return (
                          <button
                            key={hour}
                            type="button"
                            disabled={!isAvailable || submitting || loadingAvailability}
                            onClick={() => {
                              // FIX A: Ao clicar, validar se o bloco inteiro está disponível
                              const validation = validateBlockAvailability(hour, formData.duration, availabilitySlots);
                              if (!validation.valid) {
                                setBlockError(`Horário indisponível. Slots ocupados: ${validation.unavailableSlots.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')}. Selecione um horário com ${formData.duration} horas consecutivas disponíveis.`);
                                return;
                              }
                              setBlockError(null);
                              setFormData({ ...formData, startHour: hour });
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${isInSelectedRange
                              ? isStartHour
                                ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2'
                                : 'bg-primary-500 text-white'
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

                    {/* FIX A: Mostrar intervalo selecionado */}
                    {formData.duration > 1 && formData.startHour && (
                      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-2">
                        <p className="text-primary-800 font-medium text-sm">
                          📅 Horário selecionado: {formatTimeRange(formData.startHour, formData.duration)}
                        </p>
                      </div>
                    )}

                    {/* FIX A: Erro de bloco indisponível */}
                    {blockError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                        <p className="text-red-700 text-sm">{blockError}</p>
                      </div>
                    )}

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
                  disabled={submitting || isClosed}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting || isClosed
                    ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                    : 'border-gray-300'
                    }`}
                >
                  {/* Durações válidas baseadas no horário de fechamento DINÂMICO */}
                  {[1, 2, 3, 4]
                    .filter((hours) => businessHours && formData.startHour + hours <= businessHours.end)
                    .map((hours) => (
                      <option key={hours} value={hours}>
                        {hours} hora{hours > 1 ? 's' : ''}
                      </option>
                    ))}
                </select>
                {businessHours && formData.startHour && formData.startHour >= businessHours.end - 3 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Horário próximo ao fechamento. Duração máxima: {businessHours.end - formData.startHour}h
                  </p>
                )}
              </div>
            </>
          )}


          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${submitting
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
                  {format(formData.date, 'dd/MM/yyyy')} • {formatTimeRange(formData.startHour, formData.duration)}
                </span>
              </div>
            )}
            {/* Subtotal (se tem cupom aplicado) */}
            {couponApplied && (
              <>
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-500">
                    {formatCurrency(getTotalPrice(false))}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-green-600">Desconto ({couponApplied.code})</span>
                  <span className="font-medium text-green-600">
                    -{formatCurrency(couponApplied.discountAmount)}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-2 border-t mt-4">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary-600">
                {(() => {
                  const base = getTotalPrice();
                  if (formData.paymentMethod === 'CARD' && formData.installmentCount > 1) {
                    const calc = calculatePaymentTotals(base, formData.installmentCount);
                    return formatCurrency(calc.adjustedTotalCents);
                  }
                  return formatCurrency(base);
                })()}
              </span>
            </div>

            {/* Campo de Cupom */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                Cupom de desconto
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  disabled={!!couponApplied || submitting}
                  className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${couponError ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300' :
                    couponApplied ? 'border-green-300 bg-green-50 text-green-900' :
                      'border-gray-300'
                    }`}
                  placeholder="Código do cupom"
                />
                {!couponApplied ? (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || couponValidating || submitting}
                    className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {couponValidating ? (
                      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Aplicar'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
              {couponError && (
                <p className="mt-1 text-xs text-red-600">{couponError}</p>
              )}
              {couponApplied && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <span className="font-semibold">Sucesso!</span> {couponApplied.message}
                </p>
              )}
            </div>
          </div>

          {/* Seletor de Método de Pagamento */}
          {getTotalPrice() > 0 && (
            <PaymentMethodSelector
              selected={formData.paymentMethod}
              onSelect={(method) => {
                setFormData(prev => ({
                  ...prev,
                  paymentMethod: method,
                  // Reset parcelas ao selecionar PIX
                  installmentCount: method === 'PIX' ? 1 : prev.installmentCount,
                  userName: userData?.name || '',
                  userEmail: userData?.email || '',
                  userPhone: userData?.phone || formData.userPhone || '',
                  professionalRegister: userData?.professionalRegister || formData.professionalRegister || '',
                }));
              }}
              disabled={submitting}
              totalAmount={getTotalPrice()} // Já está em centavos
              selectedInstallments={formData.installmentCount}
              onInstallmentChange={(installments) =>
                setFormData(prev => ({ ...prev, installmentCount: installments }))
              }
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
              className={`flex-1 px-4 py-3 min-h-[48px] border rounded-lg font-semibold transition text-base ${submitting
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || buttonCooldown}
              className={`flex-1 px-4 py-3 min-h-[48px] rounded-lg font-semibold transition flex items-center justify-center gap-2 text-base ${submitting || buttonCooldown
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
                }`}
            >
              {(submitting || buttonCooldown) && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Processando...' : buttonCooldown ? 'Aguarde...' : 'Reservar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
