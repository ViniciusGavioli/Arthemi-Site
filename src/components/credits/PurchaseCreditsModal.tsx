// ===========================================================
// Componente: PurchaseCreditsModal - Compra de créditos no painel
// HUB central para hora avulsa e pacotes
// Suporta PIX e Cartão de Crédito
// ===========================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { X, Package, Clock, Check } from 'lucide-react';
import { PaymentMethodSelector, PaymentMethod } from '@/components/booking/PaymentMethodSelector';

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
  type: 'avulsa' | 'pacote';
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

// Pacotes com desconto (fixos)
const PACKAGES: Omit<Product, 'price'>[] = [
  { id: 'pkg-5h', name: 'Pacote 5 horas', hours: 5, discount: 5, type: 'pacote' },
  { id: 'pkg-10h', name: 'Pacote 10 horas', hours: 10, discount: 10, type: 'pacote' },
  { id: 'pkg-20h', name: 'Pacote 20 horas', hours: 20, discount: 20, type: 'pacote' },
];

// Horas avulsas (preço cheio)
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
  const [installmentCount, setInstallmentCount] = useState(1);

  // Dados do usuário (pré-preenchidos)
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    cpf: user.cpf || '',
  });

  // Gera produtos dinamicamente baseado na sala selecionada
  const products = useMemo<Product[]>(() => {
    if (!selectedRoom) return [];
    
    const pricePerHour = selectedRoom.pricePerHour; // já em centavos
    
    // Horas avulsas (preço cheio)
    const avulsas: Product[] = AVULSA_OPTIONS.map(hours => ({
      id: `avulsa-${hours}h`,
      name: `${hours} hora${hours > 1 ? 's' : ''}`,
      hours,
      price: pricePerHour * hours,
      discount: 0,
      type: 'avulsa' as const,
    }));
    
    // Pacotes com desconto
    const pacotes: Product[] = PACKAGES.map(pkg => ({
      ...pkg,
      price: Math.round(pricePerHour * pkg.hours * (1 - pkg.discount / 100)),
    }));
    
    return [...avulsas, ...pacotes];
  }, [selectedRoom]);

  // Limpa seleção de produto quando muda sala
  useEffect(() => {
    setSelectedProduct(null);
  }, [selectedRoom]);

  // Fecha com ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      fetchRooms();
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        // Seleciona primeira sala por padrão
        if (data.rooms?.length > 0) {
          setSelectedRoom(data.rooms[0]);
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

    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formData.name,
          userPhone: phoneDigits,
          userEmail: user.email,
          userCpf: cpfDigits,
          roomId: selectedRoom.id,
          hours: selectedProduct.hours,
          // Método de pagamento: PIX ou CARD
          paymentMethod,
          installmentCount: paymentMethod === 'CARD' ? installmentCount : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao processar compra');
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
              </div>

              {/* Método de Pagamento */}
              {selectedProduct && (
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  disabled={submitting}
                  showInstallments={true}
                  installmentCount={installmentCount}
                  onInstallmentChange={setInstallmentCount}
                  totalAmount={selectedProduct.price}
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
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-primary-600 text-lg">
                      {formatCurrency(selectedProduct.price)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!selectedRoom || !selectedProduct || submitting || loading}
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
