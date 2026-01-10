// ===========================================================
// CreditModal - Modal para criar crédito manual
// COM HARDENING OPERACIONAL
// P1-5: Cupom validado no backend (não duplicar VALID_COUPONS aqui)
// ===========================================================

import { useState, useMemo } from 'react';
import { Modal, Button, Input, Select, Textarea } from './ui';
import { ToastType, fetchApi, formatCurrency } from './helpers';

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type: ToastType) => void;
}

interface ValidationErrors {
  amount?: string;
  notes?: string;
  expiresAt?: string;
}

// P1-5: VALID_COUPONS agora está APENAS em /lib/coupons.ts
// Lista para UX apenas - não usar para validação real
const COUPON_HINTS = ['TESTE50', 'ARTHEMI10', 'PRIMEIRACOMPRA'];

export default function CreditModal({ userId, userName, onClose, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    type: 'MANUAL',
    roomId: '',
    amount: '',
    expiresInMonths: '12',
    notes: '',
    couponCode: '', // P1-5: Campo de cupom (validado no backend)
  });

  // =====================================================
  // VALIDAÇÕES
  // =====================================================
  const validationErrors = useMemo<ValidationErrors>(() => {
    const errors: ValidationErrors = {};
    const amountNum = Number(formData.amount);

    // Valor negativo ou zero
    if (formData.amount && amountNum <= 0) {
      errors.amount = 'O valor deve ser maior que zero';
    }

    // Valor muito alto (proteção contra erro de digitação)
    if (amountNum > 10000) {
      errors.amount = 'Valor parece muito alto. Verifique se digitou corretamente.';
    }

    // Motivo obrigatório e com mínimo de caracteres
    if (!formData.notes || formData.notes.trim().length < 10) {
      errors.notes = 'Motivo deve ter pelo menos 10 caracteres';
    }

    return errors;
  }, [formData.amount, formData.notes]);

  // P1-5: Cupom é validado no backend - aqui só mostramos dica visual
  const couponHint = formData.couponCode 
    ? COUPON_HINTS.includes(formData.couponCode.toUpperCase().trim())
      ? 'Cupom reconhecido (desconto aplicado no servidor)'
      : 'Cupom será validado ao salvar'
    : null;

  const hasErrors = Object.keys(validationErrors).length > 0;
  const canSubmit = formData.amount && Number(formData.amount) > 0 && !hasErrors;

  // Calcular data de validade para exibir
  const expirationDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + Number(formData.expiresInMonths));
    return date.toLocaleDateString('pt-BR');
  }, [formData.expiresInMonths]);

  // =====================================================
  // SUBMIT
  // =====================================================
  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) {
      if (!formData.amount || Number(formData.amount) <= 0) {
        showToast('Informe um valor válido maior que zero', 'warning');
      } else if (validationErrors.notes) {
        showToast('Motivo é obrigatório (mínimo 10 caracteres)', 'warning');
      }
      return;
    }

    // Abrir confirmação
    setShowConfirmation(true);
  }

  async function handleConfirmSubmit() {
    setLoading(true);
    try {
      const { error } = await fetchApi('/api/admin/credits/create', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          type: formData.type,
          roomId: formData.roomId || undefined,
          amount: Math.round(Number(formData.amount) * 100), // Converter para centavos
          expiresInMonths: Number(formData.expiresInMonths),
          notes: formData.notes,
          couponCode: formData.couponCode ? formData.couponCode.toUpperCase().trim() : undefined, // P1-5
        }),
      });

      if (error) {
        showToast(error, 'error');
        setShowConfirmation(false);
        return;
      }

      showToast(`Crédito de ${formatCurrency(Number(formData.amount) * 100)} criado com sucesso!`, 'success');
      onSuccess();
    } catch {
      showToast('Erro ao criar crédito', 'error');
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RENDER - CONFIRMAÇÃO
  // =====================================================
  if (showConfirmation) {
    return (
      <Modal open={true} onClose={() => setShowConfirmation(false)} title="" size="md">
        <div className="text-center mb-6">
          {/* Ícone */}
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎁</span>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-gray-800 mb-2">Confirmar Crédito Manual</h2>
          <p className="text-gray-600">Revise os dados antes de confirmar</p>
        </div>

        {/* Resumo */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Cliente:</span>
            <span className="font-semibold text-gray-800">{userName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Valor:</span>
            <span className="font-semibold text-green-600 text-lg">
              {formatCurrency(Number(formData.amount) * 100)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tipo:</span>
            <span className="font-medium text-gray-800">
              {formData.type === 'MANUAL' && 'Manual (Cortesia)'}
              {formData.type === 'PROMO' && 'Promocional'}
              {formData.type === 'SATURDAY' && 'Sábado'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Consultório:</span>
            <span className="font-medium text-gray-800">
              {formData.roomId === '' && 'Qualquer consultório'}
              {formData.roomId === 'sala-a' && 'Consultório 1 | Prime'}
              {formData.roomId === 'sala-b' && 'Consultório 2 | Executive'}
              {formData.roomId === 'sala-c' && 'Consultório 3 | Essential'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Validade:</span>
            <span className="font-medium text-gray-800">{expirationDate}</span>
          </div>
          {/* P1-5: Mostrar cupom se informado */}
          {formData.couponCode && (
            <div className="flex justify-between">
              <span className="text-gray-600">Cupom:</span>
              <span className="font-medium text-blue-600">
                🎫 {formData.couponCode.toUpperCase()} (desconto aplicado no servidor)
              </span>
            </div>
          )}
          <div className="pt-2 border-t">
            <span className="text-gray-600 text-sm">Motivo:</span>
            <p className="text-gray-800 mt-1">{formData.notes}</p>
          </div>
        </div>

        {/* Aviso */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          ⚡ <strong>Atenção:</strong> Esta ação será registrada no log de auditoria com seu usuário admin.
        </div>

        {/* Botões */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => setShowConfirmation(false)}
            disabled={loading}
          >
            Voltar
          </Button>
          <Button
            variant="success"
            onClick={handleConfirmSubmit}
            loading={loading}
          >
            🎁 Confirmar Crédito
          </Button>
        </div>
      </Modal>
    );
  }

  // =====================================================
  // RENDER - FORMULÁRIO
  // =====================================================
  return (
    <Modal open={true} onClose={onClose} title="Dar Crédito Manual" size="md">
      <form onSubmit={handleRequestSubmit} className="space-y-4">
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800 font-medium">
            {userName}
          </div>
        </div>

        {/* Tipo */}
        <Select
          label="Tipo de Crédito"
          value={formData.type}
          onChange={(e) => setFormData(d => ({ ...d, type: e.target.value }))}
          options={[
            { value: 'MANUAL', label: 'Manual (Cortesia)' },
            { value: 'PROMO', label: 'Promocional' },
            { value: 'SATURDAY', label: 'Sábado' },
          ]}
        />

        {/* Consultório */}
        <Select
          label="Consultório (restrição de uso)"
          value={formData.roomId}
          onChange={(e) => setFormData(d => ({ ...d, roomId: e.target.value }))}
          options={[
            { value: '', label: 'Genérico (qualquer consultório)' },
            { value: 'sala-a', label: 'Consultório 1 | Prime' },
            { value: 'sala-b', label: 'Consultório 2 | Executive' },
            { value: 'sala-c', label: 'Consultório 3 | Essential' },
          ]}
        />
        <p className="text-xs text-gray-500 -mt-2">
          Se selecionar um consultório, o crédito só poderá ser usado nele.
        </p>

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor (R$) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(d => ({ ...d, amount: e.target.value }))}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                validationErrors.amount
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              placeholder="0,00"
              required
            />
          </div>
          {validationErrors.amount && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.amount}</p>
          )}
        </div>

        {/* Validade */}
        <Select
          label="Validade"
          value={formData.expiresInMonths}
          onChange={(e) => setFormData(d => ({ ...d, expiresInMonths: e.target.value }))}
          options={[
            { value: '1', label: '1 mês' },
            { value: '3', label: '3 meses' },
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
            { value: '24', label: '24 meses' },
          ]}
        />
        <p className="text-xs text-gray-500 -mt-2">
          Válido até: <strong>{expirationDate}</strong>
        </p>

        {/* P1-5: Cupom (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cupom (opcional)
          </label>
          <Input
            value={formData.couponCode}
            onChange={(e) => setFormData(d => ({ ...d, couponCode: e.target.value.toUpperCase() }))}
            placeholder="Ex: ARTHEMI10, PRIMEIRACOMPRA"
            maxLength={20}
          />
          {couponHint && (
            <p className="text-xs text-blue-600 mt-1">{couponHint}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Cupons aceitos: TESTE50, ARTHEMI10, PRIMEIRACOMPRA
          </p>
        </div>

        {/* Motivo - OBRIGATÓRIO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
            rows={3}
            placeholder="Ex: Cortesia por problema na reserva anterior, compensação por..."
          />
          {formData.notes.length > 0 && validationErrors.notes && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.notes}</p>
          )}
          {!formData.notes && (
            <p className="text-xs text-gray-500 mt-1">
              Campo obrigatório. Descreva o motivo desta cortesia.
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {formData.notes.length}/10 caracteres mínimos
          </p>
        </div>

        {/* Aviso de auditoria */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          ℹ️ Esta ação será registrada no log de auditoria com seu usuário admin.
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            variant="primary" 
            disabled={!canSubmit}
          >
            🎁 Prosseguir
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
