// ===========================================================
// Componente: PurchaseCreditsModal - Compra de créditos no painel
// HUB central para hora avulsa e pacotes
// Suporta PIX e Cartão de Crédito
// ===========================================================

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { X, Package, Clock, Check } from 'lucide-react';
import { PaymentMethodSelector, PaymentMethod } from '@/components/booking/PaymentMethodSelector';
import { PRICES_V3, ROOM_SLUG_MAP, getPackagesForRoom, SHIFT_BLOCKS, SATURDAY_SHIFT_BLOCK, type RoomKey } from '@/constants/prices';

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

interface Product {
  id: string;
  name: string;
  hours: number;
  price: number;
  discount: number;
  type: 'avulsa' | 'pacote' | 'turno' | 'sabado';
  productType?: string; // Tipo do produto no banco (SHIFT_FIXED, SATURDAY_SHIFT, etc)
}

interface User {
  id: string;
  name: string | null;
  email: string;
  phone?: string;
  cpf?: string;
}

interface PurchaseCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

// Horas avulsas (preço cheio) - apenas 1, 2, 3 horas
const AVULSA_OPTIONS = [1, 2, 3];

// ===========================================================
// COMPONENTE
// ===========================================================

export function PurchaseCreditsModal({ isOpen, onClose, user }: PurchaseCreditsModalProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Seleções
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Método de pagamento (PIX default, CARD opcional)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  // Dados do usuário (pré-preenchidos)
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    cpf: user.cpf || '',
  });

  // Cupom de desconto
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    discountAmount: number;
    netAmount: number;
    message: string;
  } | null>(null);

  // Código de teste (override R$5) - apenas para equipe
  const [testCode, setTestCode] = useState('');

  // Gera produtos dinamicamente baseado na sala selecionada
  // USA PRICES_V3 como fonte única de verdade
  // Catálogo: Horas avulsas e Pacotes apenas
  // Turnos (SHIFT_FIXED, SATURDAY_SHIFT) são tratados manualmente via WhatsApp/Admin
  const products = useMemo<Product[]>(() => {
    if (!selectedRoom) return [];
    
    // Mapear slug para roomKey
    const roomKey = ROOM_SLUG_MAP[selectedRoom.slug] as RoomKey | undefined;
    if (!roomKey) return [];
    
    const roomPrices = PRICES_V3[roomKey].prices;
    const pricePerHourReais = roomPrices.HOURLY_RATE; // Em reais
    const pricePerHourCents = Math.round(pricePerHourReais * 100); // Em centavos
    
    // Horas avulsas (preço cheio)
    const avulsas: Product[] = AVULSA_OPTIONS.map(hours => ({
      id: `avulsa-${hours}h`,
      name: `${hours} hora${hours > 1 ? 's' : ''}`,
      hours,
      price: pricePerHourCents * hours,
      discount: 0,
      type: 'avulsa' as const,
      productType: 'HOURLY_RATE',
    }));
    
    // Pacotes com preços do PRICES_V3 (NÃO calculados dinamicamente)
    const packages = getPackagesForRoom(roomKey);
    const pacotes: Product[] = packages.map(pkg => ({
      id: `pkg-${pkg.hours}h`,
      name: pkg.name,
      hours: pkg.hours,
      price: pkg.priceCents, // Em centavos
      discount: pkg.discount,
      type: 'pacote' as const,
      productType: pkg.type,
    }));
    
    // REMOVIDO: Turno fixo seg-sex (tratado manualmente)
    // REMOVIDO: Sábado hora/turno (tratado manualmente)
    
    return [...avulsas, ...pacotes];
  }, [selectedRoom]);

  // Limpa seleção de produto E cupom quando muda sala
  // Usar ref para rastrear a sala anterior e evitar reset desnecessário
  const previousRoomIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Só resetar se a sala realmente mudou (comparar por ID)
    const currentRoomId = selectedRoom?.id || null;
    if (previousRoomIdRef.current !== currentRoomId) {
      // Sala mudou - resetar produto e cupom
    setSelectedProduct(null);
    // Invalidar cupom - preço diferente por sala
    setCouponApplied(null);
    setCouponError(null);
      previousRoomIdRef.current = currentRoomId;
    }
  }, [selectedRoom]);

  // Fecha com ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Usar ref para evitar chamar fetchRooms múltiplas vezes
  const hasFetchedRoomsRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      // Buscar salas apenas uma vez quando modal abre
      if (!hasFetchedRoomsRef.current) {
      fetchRooms();
        hasFetchedRoomsRef.current = true;
      }
      // NÃO resetar paymentMethod aqui - manter a seleção do usuário
    } else {
      // Reset cupom quando modal fecha
      setCouponCode('');
      setCouponError(null);
      setCouponApplied(null);
      // Reset paymentMethod apenas quando modal fecha
      setPaymentMethod('PIX');
      // Reset flag para permitir buscar salas novamente na próxima abertura
      hasFetchedRoomsRef.current = false;
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Revalidar cupom quando muda produto (preço diferente)
  // Usar useRef para evitar loop infinito
  const previousProductIdRef = useRef<string | null>(null);
  const isApplyingCouponRef = useRef(false);
  
  useEffect(() => {
    // Se está aplicando cupom, não fazer nada (evitar loop)
    if (isApplyingCouponRef.current) {
      return;
    }
    
    // Se não há produto selecionado, limpar cupom
    if (!selectedProduct) {
      setCouponApplied(null);
      setCouponError(null);
      previousProductIdRef.current = null;
      return;
    }
    
    // Se o produto mudou (ID diferente) E há cupom aplicado, limpar cupom para revalidação
    // IMPORTANTE: Não incluir couponApplied nas dependências para evitar loop
    if (previousProductIdRef.current && previousProductIdRef.current !== selectedProduct.id && couponApplied) {
      // Limpar cupom aplicado - usuário precisará reaplicar se quiser
      setCouponApplied(null);
      setCouponError(null);
    }
    
    // Atualizar referência do produto anterior
    previousProductIdRef.current = selectedProduct.id;
  }, [selectedProduct]); // Removido couponApplied das dependências para evitar loop

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        const newRooms = data.rooms || [];
        setRooms(newRooms);
        
        // Preservar seleção atual se a sala ainda existir
        if (selectedRoom) {
          const roomStillExists = newRooms.find((r: Room) => r.id === selectedRoom.id);
          if (roomStillExists) {
            // Atualizar referência do objeto mantendo a seleção
            setSelectedRoom(roomStillExists);
          } else if (newRooms.length > 0) {
            // Sala não existe mais, selecionar primeira
            setSelectedRoom(newRooms[0]);
          }
        } else if (newRooms.length > 0) {
          // Nenhuma sala selecionada, selecionar primeira
          setSelectedRoom(newRooms[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar salas:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function formatCpf(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // Validar cupom via API (preview de desconto)
  async function handleApplyCoupon() {
    if (!selectedProduct || !couponCode.trim()) {
      setCouponError('Digite um cupom');
      return;
    }

    isApplyingCouponRef.current = true;
    setCouponValidating(true);
    setCouponError(null);
    setCouponApplied(null);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          grossAmount: selectedProduct.price,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setCouponError(data.message || 'Cupom inválido');
        isApplyingCouponRef.current = false;
        setCouponValidating(false);
        return;
      }

      // Cupom válido - mostrar preview
      setCouponApplied({
        code: data.code,
        discountAmount: data.discountAmount,
        netAmount: data.netAmount,
        message: data.message,
      });
    } catch (err) {
      setCouponError('Erro ao validar cupom');
    } finally {
      setCouponValidating(false);
      isApplyingCouponRef.current = false;
    }
  }

  // Remover cupom aplicado
  function handleRemoveCoupon() {
    setCouponCode('');
    setCouponApplied(null);
    setCouponError(null);
  }

  async function handleSubmit() {
    if (!selectedRoom || !selectedProduct) {
      setError('Selecione sala e produto');
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    const cpfDigits = formData.cpf.replace(/\D/g, '');

    if (!formData.name || formData.name.length < 2) {
      setError('Nome é obrigatório');
      return;
    }

    if (phoneDigits.length < 10) {
      setError('Telefone inválido');
      return;
    }

    if (cpfDigits.length !== 11) {
      setError('CPF inválido');
      return;
    }

    setSubmitting(true);
    setError('');
    setCouponError(null);

    try {
      // Determinar se é hora avulsa ou produto específico
      const isAvulsa = selectedProduct.type === 'avulsa';
      
      // BLINDAGEM: Só enviar cupom se foi APLICADO com sucesso
      // Não confiar no input - exigir validação prévia
      // EXCEÇÃO: código de teste (testCode) é enviado direto para validação no servidor
      const couponToSend = testCode.trim() || (couponApplied ? couponApplied.code : undefined);
      
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formData.name,
          userPhone: phoneDigits,
          userEmail: user.email,
          userCpf: cpfDigits,
          roomId: selectedRoom.id,
          // Se for hora avulsa, envia hours; senão envia productType
          hours: isAvulsa ? selectedProduct.hours : undefined,
          productType: !isAvulsa ? selectedProduct.productType : undefined,
          // Método de pagamento: PIX ou CARD
          paymentMethod,
          // Parcelamento: Cliente escolhe diretamente no checkout do Asaas (não enviamos mais)
          // Cupom de desconto - APENAS se validado previamente
          couponCode: couponToSend,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Verificar se é erro de cupom pelo código estruturado
        if (data.code === 'COUPON_INVALID' || data.code === 'COUPON_MIN_AMOUNT' || data.code === 'COUPON_ALREADY_USED' || data.code === 'DEV_COUPON_NO_SESSION' || data.code === 'DEV_COUPON_NOT_ALLOWED') {
          if (couponToSend) {
            setCouponError(data.error || 'Cupom inválido ou não aplicável.');
            return;
          }
        }
        
        // Verificar se é erro de CPF
        if (data.code === 'INVALID_CPF') {
          setError(data.error || 'CPF inválido.');
          return;
        }
        
        // Fallback: detecção por texto (compatibilidade) - APENAS se não identificado pelo código
        const errorMsg = (data.error || '').toLowerCase();
        const isCouponError = 
          (errorMsg.includes('coupon') || errorMsg.includes('cupom')) && 
          !errorMsg.includes('cpf') &&
          couponToSend;
        
        if (isCouponError) {
          setCouponError(data.error || 'Cupom inválido ou não aplicável.');
        } else {
          setError(data.error || 'Erro ao processar compra');
        }
        return;
      }

      // Sucesso - redireciona para pagamento com param para retorno
      if (data.paymentUrl) {
        // Salva flags para detecção na volta
        sessionStorage.setItem('purchasePending', '1');
        sessionStorage.setItem('purchaseRoomId', selectedRoom.id);
        window.location.href = data.paymentUrl;
      } else {
        setError('URL de pagamento não disponível');
      }
    } catch (err) {
      setError('Erro ao processar compra');
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Comprar Créditos</h2>
            <p className="text-sm text-gray-500 mt-1">Escolha um pacote e pague via PIX ou Cartão</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Erro */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Seleção de Sala */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consultório
                </label>
                <div className="grid gap-2">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                        selectedRoom?.id === room.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-900">{room.name}</span>
                      <span className="text-sm text-gray-500">
                        {formatCurrency(room.pricePerHour)}/h
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção de Produto */}
              {selectedRoom && (
                <div className="space-y-4">
                  {/* Hora Avulsa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Hora Avulsa
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {products.filter(p => p.type === 'avulsa').map((product) => (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProduct(product)}
                          className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                            selectedProduct?.id === product.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-semibold text-gray-900">{product.hours}h</span>
                          <span className="text-sm text-primary-600 font-medium">
                            {formatCurrency(product.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pacotes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Package className="w-4 h-4 inline mr-1" />
                      Pacotes com Desconto
                    </label>
                    <div className="grid gap-2">
                      {products.filter(p => p.type === 'pacote').map((product) => (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProduct(product)}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                            selectedProduct?.id === product.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                              <Package className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-green-600 font-medium">
                                -{product.discount}% de desconto
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary-600">
                              {formatCurrency(product.price)}
                            </p>
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrency(selectedRoom.pricePerHour * product.hours)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dados do usuário */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="000.000.000-00"
                  />
                </div>

                {/* Campo de cupom de desconto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cupom de desconto (opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError(null);
                        if (couponApplied) setCouponApplied(null);
                      }}
                      className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        couponError ? 'border-red-400' : couponApplied ? 'border-green-400 bg-green-50' : 'border-gray-300'
                      }`}
                      placeholder="Ex: ARTHEMI10"
                      disabled={submitting || couponValidating || !!couponApplied}
                    />
                    {!couponApplied && couponCode.trim() && (
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 py-3 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                        disabled={submitting || couponValidating || !selectedProduct}
                      >
                        {couponValidating ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          'Aplicar'
                        )}
                      </button>
                    )}
                    {couponApplied && (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="px-4 py-3 text-sm text-gray-600 hover:text-red-600 border border-gray-300 rounded-xl hover:border-red-300 transition-colors"
                        disabled={submitting}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  {couponError && (
                    <p className="mt-1 text-sm text-red-600">{couponError}</p>
                  )}
                  {couponApplied && (
                    <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {couponApplied.message}
                    </p>
                  )}
                </div>

                {/* Campo de código de teste - APENAS para equipe (NEXT_PUBLIC_ENABLE_TEST_OVERRIDE=true) */}
                {process.env.NEXT_PUBLIC_ENABLE_TEST_OVERRIDE === 'true' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de teste (apenas equipe)
                    </label>
                    <input
                      type="text"
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                      disabled={submitting}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        submitting ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'
                      }`}
                      placeholder="Ex: TESTE5"
                    />
                    {testCode.trim() && (
                      <p className="mt-1 text-xs text-amber-600">
                        ⚠️ Código de teste será validado no servidor
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Método de Pagamento */}
              {selectedProduct && (
                <PaymentMethodSelector
                  key={`payment-${selectedProduct.id}`}
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  disabled={submitting}
                  totalAmount={couponApplied ? couponApplied.netAmount : selectedProduct.price}
                />
              )}

              {/* Resumo */}
              {selectedRoom && selectedProduct && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Produto</span>
                    <span className="font-medium">
                      {selectedProduct.name}
                      {selectedProduct.type === 'avulsa' && ' (avulsa)'}
                      {selectedProduct.discount > 0 && ` (-${selectedProduct.discount}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Consultório</span>
                    <span className="font-medium">{selectedRoom.name}</span>
                  </div>
                  {/* Subtotal (se tem cupom aplicado) */}
                  {couponApplied && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium text-gray-500">
                          {formatCurrency(selectedProduct.price)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Desconto ({couponApplied.code})</span>
                        <span className="font-medium text-green-600">
                          -{formatCurrency(couponApplied.discountAmount)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-primary-600 text-lg">
                      {formatCurrency(couponApplied ? couponApplied.netAmount : selectedProduct.price)}
                    </span>
                  </div>
                  {/* Aviso PIX mínimo R$1,00 */}
                  {paymentMethod === 'PIX' && 
                   (couponApplied ? couponApplied.netAmount : selectedProduct.price) < 100 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        ⚠️ PIX exige mínimo de R$ 1,00. Escolha cartão ou aumente o valor.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={
              !selectedRoom || 
              !selectedProduct || 
              submitting || 
              loading ||
              (paymentMethod === 'PIX' && (couponApplied ? couponApplied.netAmount : selectedProduct?.price ?? 0) < 100)
            }
            className="w-full bg-primary-600 text-white py-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Processando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {paymentMethod === 'CARD' ? 'Pagar com Cartão' : 'Pagar via PIX'}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
