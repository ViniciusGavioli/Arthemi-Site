// ===========================================================
// Componente BookingModal - Modal de reserva com formulário
// ===========================================================

import { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

// Registrar locale português
registerLocale('pt-BR', ptBR);

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
  date: Date | null;
  startHour: number;
  duration: number;
  productType: 'hourly' | 'package';
  productId: string;
  notes: string;
}

export default function BookingModal({ room, products, onClose }: BookingModalProps) {
  const [formData, setFormData] = useState<BookingFormData>({
    userName: '',
    userPhone: '',
    userEmail: '',
    date: null,
    startHour: 9,
    duration: 1,
    productType: 'hourly',
    productId: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pegar preço da hora avulsa desta sala
  const hourlyProduct = products.find(p => p.type === 'HOURLY_RATE');
  const hourlyPrice = hourlyProduct?.price || room.hourlyRate || 0;

  // Calcular valor total
  const getTotalPrice = () => {
    if (formData.productType === 'package' && formData.productId) {
      const product = products.find((p) => p.id === formData.productId);
      return product?.price || 0;
    }
    return hourlyPrice * formData.duration;
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

    setSubmitting(true);

    try {
      // Montar data/hora de início e fim
      const startAt = setMinutes(setHours(formData.date, formData.startHour), 0);
      const endAt = addHours(startAt, formData.duration);

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formData.userName,
          userPhone: formData.userPhone,
          userEmail: formData.userEmail || undefined,
          roomId: room.id,
          productId: formData.productId || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          payNow: true,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar reserva');
      }

      // Se tem paymentUrl, redireciona para pagamento
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Sucesso sem pagamento
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center modal-content">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Reserva Criada!</h2>
          <p className="text-gray-600 mb-6">
            Sua reserva foi criada com sucesso. Em breve você receberá uma confirmação.
          </p>
          <button
            onClick={onClose}
            className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-content">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reservar {room.name}</h2>
            <p className="text-sm text-gray-500">Preencha os dados abaixo</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              value={formData.userPhone}
              onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="(11) 99999-9999"
              required
            />
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              minDate={new Date()}
              filterDate={(date) => date.getDay() !== 0} // Bloqueia domingos
            />
          </div>

          {/* Horário e Duração */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-hour" className="block text-sm font-medium text-gray-700 mb-1">
                Horário *
              </label>
              <select
                id="start-hour"
                aria-label="Horário de início"
                value={formData.startHour}
                onChange={(e) => setFormData({ ...formData, startHour: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duração
              </label>
              <select
                id="duration"
                aria-label="Duração da reserva"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={formData.productType === 'package'}
              >
                {[1, 2, 3, 4].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} hora{hours > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo de Reserva */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Reserva
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.productType === 'hourly'}
                  onChange={() => setFormData({ ...formData, productType: 'hourly', productId: '' })}
                  className="mr-2"
                />
                <span className="text-sm">Hora Avulsa</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.productType === 'package'}
                  onChange={() => setFormData({ ...formData, productType: 'package' })}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {submitting ? 'Processando...' : 'Reservar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
