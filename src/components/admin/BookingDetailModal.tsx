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

type CancelOption = 'none' | 'full' | 'partial';
type ConfirmAction = 'reschedule' | 'change-room' | 'cancel-no-credit' | 'cancel-with-credit' | 'no-show' | 'retroactive' | null;

const roomNames: Record<string, string> = {
  'sala-a': 'Consultório 1',
  'sala-b': 'Consultório 2',
  'sala-c': 'Consultório 3',
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
  
  // Estado de cancelamento
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [cancelOption, setCancelOption] = useState<CancelOption>('full');
  const [partialCreditValue, setPartialCreditValue] = useState(booking.amountPaid);
  const [cancelReason, setCancelReason] = useState('');
  
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

  // Cancelar com opções de crédito
  async function handleCancel() {
    setActionLoading('cancel');
    try {
      if (cancelOption === 'none') {
        // Cancelar sem crédito
        const { error } = await fetchApi(`/api/admin/bookings/${booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            status: 'CANCELLED',
            notes: `${booking.notes || ''}\n[CANCELADO] ${cancelReason}`.trim(),
          }),
        });

        if (error) {
          showToast(error, 'error');
          return;
        }

        showToast('Reserva cancelada sem crédito', 'success');
        onUpdate();
        onClose();
        return;
      }

      // Cancelar com crédito
      const { error } = await fetchApi('/api/admin/bookings/cancel', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          generateCredit: true,
          creditAmount: cancelOption === 'partial' ? partialCreditValue : undefined,
          reason: cancelReason,
        }),
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      const creditValue = cancelOption === 'partial' ? partialCreditValue : booking.amountPaid + (booking.creditsUsed || 0);
      showToast(`Reserva cancelada. Crédito de ${formatCurrency(creditValue)} gerado.`, 'success');
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
    if (cancelOption === 'none') {
      setConfirmAction('cancel-no-credit');
    } else {
      setConfirmAction('cancel-with-credit');
    }
  }

  // Gerar opções de hora
  const hourOptions = Array.from({ length: 15 }, (_, i) => ({
    value: String(7 + i),
    label: `${String(7 + i).padStart(2, '0')}:00`,
  }));

  // =====================================================
  // RENDER
  // =====================================================
  
  return (
    <>
      <Modal open={true} onClose={onClose} title="Detalhes da Reserva" size="lg">
        {/* Cancelamento options */}
        {showCancelOptions ? (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800">Opções de Cancelamento</h3>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors">
                <input
                  type="radio"
                  name="cancelOption"
                  checked={cancelOption === 'none'}
                  onChange={() => setCancelOption('none')}
                  className="mt-1 w-5 h-5"
                />
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-lg">❌</span> Cancelar sem gerar crédito
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Apenas cancela a reserva. O cliente <strong>não</strong> recebe nenhum crédito de volta.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors">
                <input
                  type="radio"
                  name="cancelOption"
                  checked={cancelOption === 'full'}
                  onChange={() => setCancelOption('full')}
                  className="mt-1 w-5 h-5"
                />
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-lg">💳</span> Cancelar e gerar crédito integral
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Cliente receberá <strong className="text-green-700">{formatCurrency(booking.amountPaid + (booking.creditsUsed || 0))}</strong> de crédito para usar em futuras reservas
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 transition-colors">
                <input
                  type="radio"
                  name="cancelOption"
                  checked={cancelOption === 'partial'}
                  onChange={() => setCancelOption('partial')}
                  className="mt-1 w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-lg">✂️</span> Cancelar e gerar crédito parcial
                  </p>
                  <p className="text-sm text-gray-600 mt-1 mb-2">Digite o valor do crédito a ser devolvido:</p>
                  {cancelOption === 'partial' && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={(booking.amountPaid + (booking.creditsUsed || 0)) / 100}
                        value={partialCreditValue / 100}
                        onChange={(e) => setPartialCreditValue(Math.round(Number(e.target.value) * 100))}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>

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
                disabled={actionLoading !== null || cancelReason.trim().length < 5}
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
                  setCancelOption('full');
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
                  <Select
                    label="Horário Início"
                    value={String(editData.startHour)}
                    onChange={(e) => setEditData(d => ({ ...d, startHour: Number(e.target.value) }))}
                    options={hourOptions}
                    disabled={isCompleted}
                  />
                  <Select
                    label="Horário Fim"
                    value={String(editData.endHour)}
                    onChange={(e) => setEditData(d => ({ ...d, endHour: Number(e.target.value) }))}
                    options={hourOptions}
                    disabled={isCompleted}
                  />
                </div>
                <Select
                  label="Consultório"
                  value={editData.roomId}
                  onChange={(e) => setEditData(d => ({ ...d, roomId: e.target.value }))}
                  options={[
                    { value: 'sala-a', label: 'Consultório 1' },
                    { value: 'sala-b', label: 'Consultório 2' },
                    { value: 'sala-c', label: 'Consultório 3' },
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
                    disabled={saving || (isCompleted && !hasOnlyNotesChange)}
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
                  <p className="text-sm text-gray-500">Sala</p>
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

      {/* Confirmação: Trocar Sala */}
      <ConfirmationModal
        open={confirmAction === 'change-room'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleSaveEdit}
        loading={saving}
        title="Confirmar Troca de Sala"
        description="Você está alterando a sala desta reserva."
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

      {/* Confirmação: Cancelar SEM crédito */}
      <ConfirmationModal
        open={confirmAction === 'cancel-no-credit'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancel}
        loading={actionLoading === 'cancel'}
        title="Cancelar Reserva SEM Crédito"
        description="O cliente NÃO receberá crédito por este cancelamento."
        booking={getBookingInfo()}
        variant="danger"
        confirmText="Confirmar Cancelamento"
        impact={
          <div>
            <p>• Reserva será cancelada</p>
            <p>• <strong>Nenhum crédito será gerado</strong></p>
            <p className="mt-2 text-sm">Motivo: {cancelReason}</p>
          </div>
        }
      />

      {/* Confirmação: Cancelar COM crédito */}
      <ConfirmationModal
        open={confirmAction === 'cancel-with-credit'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancel}
        loading={actionLoading === 'cancel'}
        title="Cancelar Reserva COM Crédito"
        description="O cliente receberá crédito para usar em futuras reservas."
        booking={getBookingInfo()}
        variant="warning"
        confirmText="Confirmar Cancelamento"
        impact={
          <div>
            <p>• Reserva será cancelada</p>
            <p>• <strong>Crédito gerado: {formatCurrency(
              cancelOption === 'partial' ? partialCreditValue : booking.amountPaid + (booking.creditsUsed || 0)
            )}</strong></p>
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
