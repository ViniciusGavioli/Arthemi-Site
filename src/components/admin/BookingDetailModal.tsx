// ===========================================================
// BookingDetailModal - Modal completo de detalhes da reserva
// COM HARDENING OPERACIONAL + UX POLISH
// ===========================================================

import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Modal, Button, Badge, Input, Select, Textarea } from './ui';
import ConfirmationModal from './ConfirmationModal';
import { 
  formatDate, formatTime, formatCurrency, getWhatsAppLink, getPhoneLink,
  statusLabels, statusColors, statusIcons, specialBadges, ToastType, fetchApi
} from './helpers';
import { getHourOptionsForDate, getBusinessHoursForDate, isClosedDay } from '@/lib/business-hours';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amountPaid: number;
  creditsUsed?: number;
  isManual?: boolean;
  notes?: string;
  room: { id: string; name: string };
  user: { id: string; name: string; phone: string | null; email: string };
  product?: { id: string; name: string; price: number } | null;
}

interface Props {
  booking: Booking;
  onClose: () => void;
  onUpdate: () => void;
  showToast: (message: string, type: ToastType) => void;
}

type ConfirmAction = 'reschedule' | 'change-room' | 'cancel' | 'no-show' | 'retroactive' | null;

const roomNames: Record<string, string> = {
  'sala-a': 'Consultório 1 | Prime',
  'sala-b': 'Consultório 2 | Executive',
  'sala-c': 'Consultório 3 | Essential',
};

export default function BookingDetailModal({ booking, onClose, onUpdate, showToast }: Props) {
  const router = useRouter();
  
  // Estado de edição
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    date: booking.startTime.split('T')[0],
    startHour: new Date(booking.startTime).getHours(),
    endHour: new Date(booking.endTime).getHours(),
    roomId: booking.room.id,
    notes: booking.notes || '',
  });
  
  // Estado de cancelamento - P0-4
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedRefundType, setSelectedRefundType] = useState<'CREDITS' | 'MONEY' | 'NONE'>('CREDITS');
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF');
  const [pixKey, setPixKey] = useState('');
  
  // Estado de confirmação
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [noShowReason, setNoShowReason] = useState('');
  
  // Loading states
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // =====================================================
  // TRAVAS DE ESTADO
  // =====================================================
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';
  const isLocked = isCompleted || isCancelled;
  
  // Verificar se é ação retroativa (reserva no passado)
  const isRetroactive = useMemo(() => {
    const now = new Date();
    return new Date(booking.startTime) < now;
  }, [booking.startTime]);

  // Detectar mudanças para confirmação
  const hasDateChange = editData.date !== booking.startTime.split('T')[0];
  const hasTimeChange = editData.startHour !== new Date(booking.startTime).getHours() ||
                        editData.endHour !== new Date(booking.endTime).getHours();
  const hasRoomChange = editData.roomId !== booking.room.id;
  const hasOnlyNotesChange = !hasDateChange && !hasTimeChange && !hasRoomChange;

  // =====================================================
  // HELPERS
  // =====================================================
  function getBookingInfo() {
    return {
      client: booking.user.name,
      room: booking.room.name,
      date: booking.startTime,
      startTime: booking.startTime,
      endTime: booking.endTime,
      amount: booking.amountPaid + (booking.creditsUsed || 0),
    };
  }

  function getEditedBookingInfo() {
    const startTime = new Date(editData.date);
    startTime.setHours(editData.startHour, 0, 0, 0);
    const endTime = new Date(editData.date);
    endTime.setHours(editData.endHour, 0, 0, 0);
    
    return {
      client: booking.user.name,
      room: roomNames[editData.roomId] || editData.roomId,
      date: editData.date,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      amount: booking.amountPaid,
    };
  }

  // =====================================================
  // AÇÕES
  // =====================================================
  
  // Atualizar status
  async function handleUpdateStatus(status: string, reason?: string) {
    setActionLoading(status);
    try {
      const { error } = await fetchApi(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status,
          notes: reason ? `${booking.notes || ''}\n[${status}] ${reason}`.trim() : booking.notes,
        }),
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      showToast(`Reserva ${statusLabels[status]?.toLowerCase() || 'atualizada'}`, 'success');
      onUpdate();
      onClose();
    } catch {
      showToast('Erro ao atualizar reserva', 'error');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  // Cancelar com opção de refundType (P0-4)
  async function handleCancel() {
    // Validar PIX se refundType=MONEY
    if (selectedRefundType === 'MONEY' && !pixKey.trim()) {
      showToast('Informe a chave PIX para estorno em dinheiro', 'error');
      return;
    }
    
    setActionLoading('cancel');
    try {
      // P0-4: Enviar refundType escolhido pelo admin
      const body: {
        bookingId: string;
        reason?: string;
        refundType: 'CREDITS' | 'MONEY' | 'NONE';
        pixKeyType?: string;
        pixKey?: string;
      } = {
        bookingId: booking.id,
        reason: cancelReason,
        refundType: selectedRefundType,
      };
      
      if (selectedRefundType === 'MONEY') {
        body.pixKeyType = pixKeyType;
        body.pixKey = pixKey.trim();
      }
      
      const { data, error } = await fetchApi<{ creditAmount?: number; refundType?: string }>('/api/admin/bookings/cancel', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      // Mostrar mensagem baseada na resposta da API
      if (data?.refundType === 'CREDITS' && data?.creditAmount && data.creditAmount > 0) {
        showToast(`Reserva cancelada. Crédito de ${formatCurrency(data.creditAmount)} devolvido.`, 'success');
      } else if (data?.refundType === 'MONEY' && data?.creditAmount && data.creditAmount > 0) {
        showToast(`Reserva cancelada. Estorno de ${formatCurrency(data.creditAmount)} em processamento.`, 'success');
      } else {
        showToast('Reserva cancelada (sem devolução).', 'success');
      }
      
      onUpdate();
      onClose();
    } catch {
      showToast('Erro ao cancelar reserva', 'error');
    } finally {
      setActionLoading(null);
      setShowCancelOptions(false);
      setConfirmAction(null);
    }
  }

  // Salvar edições (com verificação de confirmação)
  function handleRequestSave() {
    // Guard: Não permitir salvar horário em dia fechado
    if (isClosedDate && !hasOnlyNotesChange) {
      showToast('Não é possível agendar em dia fechado (domingo)', 'error');
      return;
    }

    if (isLocked && !hasOnlyNotesChange) {
      showToast('Não é possível alterar reservas concluídas ou canceladas', 'error');
      return;
    }

    if (hasOnlyNotesChange) {
      // Observações podem ser editadas sem confirmação
      handleSaveEdit();
      return;
    }

    // Precisa confirmação
    if (hasRoomChange && !hasDateChange && !hasTimeChange) {
      setConfirmAction('change-room');
    } else if (isRetroactive) {
      setConfirmAction('retroactive');
    } else {
      setConfirmAction('reschedule');
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      // Construir datas
      const startTime = new Date(editData.date);
      startTime.setHours(editData.startHour, 0, 0, 0);
      const endTime = new Date(editData.date);
      endTime.setHours(editData.endHour, 0, 0, 0);

      const { error } = await fetchApi(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          roomId: editData.roomId,
          notes: editData.notes,
        }),
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      showToast('Reserva atualizada com sucesso', 'success');
      setIsEditing(false);
      setConfirmAction(null);
      onUpdate();
    } catch {
      showToast('Erro ao salvar alterações', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Handler para No-Show
  function handleRequestNoShow() {
    setConfirmAction('no-show');
  }

  async function handleConfirmNoShow() {
    await handleUpdateStatus('NO_SHOW', noShowReason);
    setNoShowReason('');
  }

  // Handler para iniciar cancelamento
  function handleRequestCancel() {
    setConfirmAction('cancel');
  }

  // Gerar opções de hora DINÂMICAS baseadas na data de edição
  const hourOptions = useMemo(() => {
    const date = editData.date ? new Date(editData.date + 'T12:00:00') : null;
    const hours = getHourOptionsForDate(date);
    return hours.map(h => ({
      value: String(h),
      label: `${String(h).padStart(2, '0')}:00`,
    }));
  }, [editData.date]);

  // Verificar se dia selecionado é fechado
  const isClosedDate = useMemo(() => {
    if (!editData.date) return false;
    const date = new Date(editData.date + 'T12:00:00');
    return isClosedDay(date);
  }, [editData.date]);

  // =====================================================
  // RENDER
  // =====================================================
  
  // P0-4: Calcular se haverá devolução baseado na antecedência
  const hoursUntilStart = Math.floor((new Date(booking.startTime).getTime() - Date.now()) / (1000 * 60 * 60));
  const willRefundCredits = hoursUntilStart >= 48;
  const totalValue = booking.amountPaid + (booking.creditsUsed || 0);
  
  return (
    <>
      <Modal open={true} onClose={onClose} title="Detalhes da Reserva" size="lg">
        {/* Cancelamento options - P0-4 */}
        {showCancelOptions ? (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800">Cancelar Reserva</h3>
            
            {/* P0-4: Escolha do tipo de devolução */}
            {totalValue > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de devolução
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* CREDITS */}
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedRefundType === 'CREDITS' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="refundType"
                      value="CREDITS"
                      checked={selectedRefundType === 'CREDITS'}
                      onChange={() => setSelectedRefundType('CREDITS')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-800">💳 Créditos</p>
                      <p className="text-sm text-gray-600">
                        Cliente recebe {formatCurrency(totalValue)} em créditos para usar no sistema
                      </p>
                    </div>
                  </label>
                  
                  {/* MONEY */}
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedRefundType === 'MONEY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="refundType"
                      value="MONEY"
                      checked={selectedRefundType === 'MONEY'}
                      onChange={() => setSelectedRefundType('MONEY')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-800">💵 Dinheiro (PIX)</p>
                      <p className="text-sm text-gray-600">
                        Estorno de {formatCurrency(totalValue)} via PIX
                      </p>
                    </div>
                  </label>
                  
                  {/* NONE */}
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedRefundType === 'NONE' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="refundType"
                      value="NONE"
                      checked={selectedRefundType === 'NONE'}
                      onChange={() => setSelectedRefundType('NONE')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-800">🚫 Sem devolução</p>
                      <p className="text-sm text-gray-600">
                        Cancelar sem devolver valores
                      </p>
                    </div>
                  </label>
                </div>
                
                {/* Info sobre política */}
                <p className="text-xs text-gray-500">
                  Antecedência: {hoursUntilStart}h | Política automática: {willRefundCredits ? 'devolveria créditos' : 'não devolveria (< 48h)'}
                </p>
                
                {/* HARDENING: Aviso sobre cupons */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mt-3">
                  <p className="font-medium">⚠️ Importante</p>
                  <p className="mt-1 text-amber-700">
                    Reembolso é do valor efetivamente pago. Cupons promocionais não são restaurados.
                  </p>
                </div>
              </div>
            )}
            
            {/* Campos PIX se MONEY selecionado */}
            {selectedRefundType === 'MONEY' && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de chave PIX <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="RANDOM">Chave aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chave PIX <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      pixKeyType === 'CPF' ? '000.000.000-00' :
                      pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                      pixKeyType === 'EMAIL' ? 'email@exemplo.com' :
                      pixKeyType === 'PHONE' ? '(00) 00000-0000' :
                      'Chave aleatória'
                    }
                  />
                </div>
              </div>
            )}

            {/* Campo de motivo obrigatório */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo do cancelamento <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo do cancelamento..."
              />
              {cancelReason.length > 0 && cancelReason.trim().length < 5 && (
                <p className="text-xs text-red-500 mt-1">Motivo deve ter pelo menos 5 caracteres</p>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="danger"
                size="lg"
                onClick={handleRequestCancel}
                disabled={actionLoading !== null || cancelReason.trim().length < 5 || (selectedRefundType === 'MONEY' && !pixKey.trim())}
                icon="🚫"
              >
                Confirmar Cancelamento
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setShowCancelOptions(false);
                  setCancelReason('');
                  setSelectedRefundType('CREDITS');
                  setPixKey('');
                }}
                disabled={actionLoading !== null}
                icon="←"
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Header com status e ID */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusColors[booking.status]} icon={statusIcons[booking.status]} size="lg">
                  {statusLabels[booking.status]}
                </Badge>
                {booking.isManual && (
                  <Badge variant={specialBadges.MANUAL.color} icon={specialBadges.MANUAL.icon}>
                    {specialBadges.MANUAL.label}
                  </Badge>
                )}
                {booking.creditsUsed ? (
                  <Badge variant={specialBadges.CREDIT.color} icon={specialBadges.CREDIT.icon}>
                    {specialBadges.CREDIT.label}
                  </Badge>
                ) : null}
                {isLocked && (
                  <Badge variant={specialBadges.LOCKED.color} icon={specialBadges.LOCKED.icon}>
                    {specialBadges.LOCKED.label}
                  </Badge>
                )}
              </div>
              <span className="text-sm text-gray-400 font-mono">#{booking.id.slice(0, 8)}</span>
            </div>

            {/* Aviso de reserva bloqueada */}
            {isLocked && (
              <div className={`rounded-xl p-4 mb-4 text-sm flex items-start gap-3 ${
                isCancelled ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-gray-50 text-gray-700 border border-gray-200'
              }`}>
                <span className="text-lg">{isCancelled ? '❌' : '🔒'}</span>
                <div>
                  <strong>Reserva {isCancelled ? 'cancelada' : 'concluída'}</strong>
                  <p className="mt-1 opacity-80">
                    {isCancelled 
                      ? 'Esta reserva foi cancelada e não pode mais ser alterada.'
                      : 'Esta reserva foi concluída. Apenas observações podem ser editadas.'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Informações do Cliente */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{booking.user.name}</h3>
                  {booking.user.phone && (
                    <p className="text-sm text-gray-600 mt-1">📱 {booking.user.phone}</p>
                  )}
                  <p className="text-sm text-gray-500">✉️ {booking.user.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {booking.user.phone && (
                    <>
                      <a href={getWhatsAppLink(booking.user.phone, `Olá ${booking.user.name}! Sobre sua reserva no Espaço Arthemi...`)} target="_blank" rel="noopener noreferrer">
                        <Button variant="success" size="md" icon="💬">WhatsApp</Button>
                      </a>
                      <a href={getPhoneLink(booking.user.phone)}>
                        <Button variant="secondary" size="md" icon="📞">Ligar</Button>
                      </a>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="👤"
                    onClick={() => router.push(`/admin/clientes/${booking.user.id}`)}
                  >
                    Ver Ficha
                  </Button>
                </div>
              </div>
            </div>

            {/* Detalhes da Reserva */}
            {isEditing ? (
              <div className="space-y-4 mb-6">
                {/* Aviso se só pode editar observações */}
                {isCompleted && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    ⚠️ <strong>Reserva concluída:</strong> Apenas observações podem ser editadas.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Data"
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData(d => ({ ...d, date: e.target.value }))}
                    disabled={isCompleted}
                  />
                  <div></div>
                  
                  {/* Aviso de dia fechado */}
                  {isClosedDate && (
                    <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                      🚫 Fechado neste dia (domingo). Selecione outra data.
                    </div>
                  )}
                  
                  <Select
                    label="Horário Início"
                    value={String(editData.startHour)}
                    onChange={(e) => setEditData(d => ({ ...d, startHour: Number(e.target.value) }))}
                    options={hourOptions}
                    disabled={isCompleted || isClosedDate}
                  />
                  <Select
                    label="Horário Fim"
                    value={String(editData.endHour)}
                    onChange={(e) => setEditData(d => ({ ...d, endHour: Number(e.target.value) }))}
                    options={hourOptions.filter(o => Number(o.value) > editData.startHour)}
                    disabled={isCompleted || isClosedDate}
                  />
                </div>
                <Select
                  label="Consultório"
                  value={editData.roomId}
                  onChange={(e) => setEditData(d => ({ ...d, roomId: e.target.value }))}
                  options={[
                    { value: 'sala-a', label: 'Consultório 1 | Prime' },
                    { value: 'sala-b', label: 'Consultório 2 | Executive' },
                    { value: 'sala-c', label: 'Consultório 3 | Essential' },
                  ]}
                  disabled={isCompleted}
                />
                <Textarea
                  label="Observações"
                  value={editData.notes}
                  onChange={(e) => setEditData(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                />

                {/* Indicadores de mudança */}
                {!isCompleted && (hasDateChange || hasTimeChange || hasRoomChange) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="font-medium text-blue-800 mb-1">Alterações detectadas:</p>
                    <ul className="text-blue-700 space-y-1">
                      {hasDateChange && <li>• Data: {formatDate(booking.startTime)} → {formatDate(editData.date)}</li>}
                      {hasTimeChange && <li>• Horário: {formatTime(booking.startTime)}-{formatTime(booking.endTime)} → {String(editData.startHour).padStart(2, '0')}:00-{String(editData.endHour).padStart(2, '0')}:00</li>}
                      {hasRoomChange && <li>• Consultório: {booking.room.name} → {roomNames[editData.roomId]}</li>}
                    </ul>
                    {isRetroactive && (
                      <p className="mt-2 text-yellow-700 font-medium">⚠️ Esta é uma alteração retroativa (reserva no passado)</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={handleRequestSave} 
                    loading={saving}
                    disabled={saving || (isCompleted && !hasOnlyNotesChange) || (isClosedDate && !hasOnlyNotesChange)}
                  >
                    💾 Salvar Alterações
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        date: booking.startTime.split('T')[0],
                        startHour: new Date(booking.startTime).getHours(),
                        endHour: new Date(booking.endTime).getHours(),
                        roomId: booking.room.id,
                        notes: booking.notes || '',
                      });
                    }} 
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Data</p>
                  <p className="font-medium">{formatDate(booking.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Horário</p>
                  <p className="font-medium">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Consultório</p>
                  <p className="font-medium">{booking.room.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Produto</p>
                  <p className="font-medium">{booking.product?.name || 'Avulso'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Pago</p>
                  <p className="font-medium">{formatCurrency(booking.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Créditos Usados</p>
                  <p className="font-medium">{booking.creditsUsed ? formatCurrency(booking.creditsUsed) : '-'}</p>
                </div>
                {booking.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Observações</p>
                    <p className="font-medium whitespace-pre-wrap">{booking.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            {!isEditing && !isCancelled && (
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>⚙️</span> Ações Disponíveis
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Editar (sempre disponível, mas com restrições internas) */}
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setIsEditing(true)}
                    disabled={actionLoading !== null}
                    icon="✏️"
                  >
                    {isCompleted ? 'Editar Observações' : 'Editar Reserva'}
                  </Button>

                  {/* Confirmar - só para PENDING */}
                  {booking.status === 'PENDING' && (
                    <Button
                      variant="success"
                      size="lg"
                      onClick={() => handleUpdateStatus('CONFIRMED')}
                      loading={actionLoading === 'CONFIRMED'}
                      disabled={actionLoading !== null}
                      icon="✅"
                    >
                      Confirmar Reserva
                    </Button>
                  )}

                  {/* Compareceu - só para CONFIRMED */}
                  {booking.status === 'CONFIRMED' && (
                    <Button
                      variant="success"
                      size="lg"
                      onClick={() => handleUpdateStatus('COMPLETED')}
                      loading={actionLoading === 'COMPLETED'}
                      disabled={actionLoading !== null}
                      icon="👤"
                    >
                      Cliente Compareceu
                    </Button>
                  )}

                  {/* Não Compareceu - só para CONFIRMED */}
                  {booking.status === 'CONFIRMED' && (
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={handleRequestNoShow}
                      loading={actionLoading === 'NO_SHOW'}
                      disabled={actionLoading !== null}
                      icon="🚷"
                    >
                      Cliente Não Veio
                    </Button>
                  )}

                  {/* Cancelar - só se não está COMPLETED ou CANCELLED */}
                  {!isCompleted && (
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={() => setShowCancelOptions(true)}
                      disabled={actionLoading !== null}
                      icon="🚫"
                    >
                      Cancelar Reserva
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ========================================= */}
      {/* MODAIS DE CONFIRMAÇÃO                    */}
      {/* ========================================= */}

      {/* Confirmação: Reagendar */}
      <ConfirmationModal
        open={confirmAction === 'reschedule'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleSaveEdit}
        loading={saving}
        title="Confirmar Reagendamento"
        description="Você está alterando a data/horário desta reserva."
        booking={getEditedBookingInfo()}
        variant="warning"
        confirmText="Confirmar Reagendamento"
        impact={
          <div>
            <p><strong>De:</strong> {formatDate(booking.startTime)} às {formatTime(booking.startTime)}</p>
            <p><strong>Para:</strong> {formatDate(editData.date)} às {String(editData.startHour).padStart(2, '0')}:00</p>
          </div>
        }
      />

      {/* Confirmação: Trocar Consultório */}
      <ConfirmationModal
        open={confirmAction === 'change-room'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleSaveEdit}
        loading={saving}
        title="Confirmar Troca de Consultório"
        description="Você está alterando o consultório desta reserva."
        booking={getEditedBookingInfo()}
        variant="warning"
        confirmText="Confirmar Troca"
        impact={
          <div>
            <p><strong>De:</strong> {booking.room.name}</p>
            <p><strong>Para:</strong> {roomNames[editData.roomId]}</p>
          </div>
        }
      />

      {/* Confirmação: Ação Retroativa */}
      <ConfirmationModal
        open={confirmAction === 'retroactive'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleSaveEdit}
        loading={saving}
        title="⚠️ Ação Retroativa"
        description="Esta reserva está no passado. Tem certeza que deseja alterar?"
        booking={getEditedBookingInfo()}
        variant="danger"
        confirmText="Confirmar Alteração"
        impact={
          <div className="font-medium">
            Alterações em reservas passadas afetam o histórico. Certifique-se de que isso é necessário.
          </div>
        }
      />

      {/* Confirmação: Cancelar (cálculo automático de crédito) */}
      <ConfirmationModal
        open={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancel}
        loading={actionLoading === 'cancel'}
        title={willRefundCredits ? "Cancelar COM Devolução" : "Cancelar SEM Devolução"}
        description={willRefundCredits 
          ? "O cliente receberá crédito automaticamente (≥48h de antecedência)."
          : "Crédito NÃO será devolvido (<48h de antecedência)."
        }
        booking={getBookingInfo()}
        variant={willRefundCredits ? "warning" : "danger"}
        confirmText="Confirmar Cancelamento"
        impact={
          <div>
            <p>• Reserva será cancelada</p>
            {willRefundCredits ? (
              <p>• <strong className="text-green-700">Crédito gerado: {formatCurrency(totalValue)}</strong></p>
            ) : (
              <p>• <strong className="text-red-700">Nenhum crédito (antecedência: {hoursUntilStart}h)</strong></p>
            )}
            <p className="mt-2 text-sm">Motivo: {cancelReason}</p>
          </div>
        }
      />

      {/* Confirmação: No-Show */}
      <ConfirmationModal
        open={confirmAction === 'no-show'}
        onClose={() => {
          setConfirmAction(null);
          setNoShowReason('');
        }}
        onConfirm={handleConfirmNoShow}
        loading={actionLoading === 'NO_SHOW'}
        title="Marcar como Não Compareceu"
        description="O cliente não compareceu à reserva."
        booking={getBookingInfo()}
        variant="danger"
        confirmText="Confirmar No-Show"
        requireReason
        reason={noShowReason}
        onReasonChange={setNoShowReason}
        reasonLabel="Motivo do No-Show"
        reasonPlaceholder="Ex: Cliente não atendeu ligações, sem aviso prévio..."
        impact={
          <div>
            <p>• Reserva será marcada como <strong>NO_SHOW</strong></p>
            <p>• Pode afetar o histórico do cliente</p>
          </div>
        }
      />
    </>
  );
}
