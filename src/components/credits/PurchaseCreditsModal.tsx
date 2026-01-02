// ===========================================================
// Componente: PurchaseCreditsModal - Compra de créditos no painel
// Usa /api/credits/purchase para criar pagamento
// ===========================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { X, Package, Clock, Check } from 'lucide-react';

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

// Pacotes disponíveis (hardcoded para simplicidade - iguais ao /salas)
const PACKAGES: Product[] = [
  { id: 'pkg-5h', name: 'Pacote 5 horas', hours: 5, price: 28500, discount: 5 },
  { id: 'pkg-10h', name: 'Pacote 10 horas', hours: 10, price: 54000, discount: 10 },
  { id: 'pkg-20h', name: 'Pacote 20 horas', hours: 20, price: 96000, discount: 20 },
];

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
  const [selectedPackage, setSelectedPackage] = useState<Product | null>(null);

  // Dados do usuário (pré-preenchidos)
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    cpf: user.cpf || '',
  });

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
    if (!selectedRoom || !selectedPackage) {
      setError('Selecione sala e pacote');
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
          hours: selectedPackage.hours,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao processar compra');
        return;
      }

      // Sucesso - redireciona para pagamento
      if (data.paymentUrl) {
        // Salva referência para retorno
        sessionStorage.setItem('purchasePending', data.creditId);
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
            <p className="text-sm text-gray-500 mt-1">Escolha um pacote e pague via PIX</p>
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

              {/* Seleção de Pacote */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pacote de horas
                </label>
                <div className="grid gap-2">
                  {PACKAGES.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                        selectedPackage?.id === pkg.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{pkg.name}</p>
                          <p className="text-sm text-gray-500">{pkg.hours} horas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary-600">{formatCurrency(pkg.price)}</p>
                        {pkg.discount > 0 && (
                          <p className="text-xs text-green-600">-{pkg.discount}% desconto</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Resumo */}
              {selectedRoom && selectedPackage && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pacote</span>
                    <span className="font-medium">{selectedPackage.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Consultório</span>
                    <span className="font-medium">{selectedRoom.name}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-primary-600 text-lg">
                      {formatCurrency(selectedPackage.price)}
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
            disabled={!selectedRoom || !selectedPackage || submitting || loading}
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
                Pagar via PIX
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
