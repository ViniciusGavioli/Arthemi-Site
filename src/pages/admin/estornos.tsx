// ===========================================================
// Página: /admin/estornos - Gerenciar Pedidos de Estorno
// ===========================================================

import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAdminSSR, AuthUser } from '@/lib/auth';
import { ADMIN_COPY } from '@/lib/policies';

interface RefundItem {
  id: string;
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  roomName: string;
  bookingStart: string;
  bookingEnd: string;
  amount: number;
  pixKeyType: string;
  pixKey: string;
  status: string;
  reason: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  proofUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Tipo para refunds parciais/pendentes (vindos do gateway)
interface PendingRefund {
  id: string;
  bookingId: string;
  userId: string;
  userName: string;
  userEmail: string;
  roomName: string;
  bookingDate: string;
  expectedAmount: number;
  refundedAmount: number;
  creditsReturned: number;
  moneyReturned: number;
  totalRefunded: number;
  isPartial: boolean;
  status: string;
  gateway: string;
  externalRefundId: string | null;
  reason: string | null;
  createdAt: string;
}

interface PageProps {
  user: AuthUser;
}

type ActionType = 'REVIEW' | 'APPROVE' | 'REJECT' | 'MARK_PAID';

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx: GetServerSidePropsContext) => {
  const result = requireAdminSSR(ctx);
  
  if ('redirect' in result) {
    return result;
  }
  
  return {
    props: {
      user: result.auth,
    },
  };
};

export default function AdminEstornosPage({ user: _user }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Estado para refunds parciais/pendentes (do gateway)
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefund[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Modal state
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    refundId: string | null;
    action: ActionType | null;
    refund: RefundItem | null;
  }>({
    isOpen: false,
    refundId: null,
    action: null,
    refund: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [notes, setNotes] = useState('');

  const fetchRefunds = useCallback(async () => {
    try {
      const url = filter ? `/api/admin/refunds?status=${filter}` : '/api/admin/refunds';
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setRefunds(data.refunds || []);
      } else {
        setError(data.error || 'Erro ao carregar pedidos');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch refunds parciais/pendentes do gateway
  const fetchPendingRefunds = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/refunds/pending');
      const data = await res.json();
      if (data.ok) {
        setPendingRefunds(data.refunds || []);
      }
    } catch {
      // Silenciar erro - seção é opcional
      console.error('Erro ao buscar refunds pendentes');
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
    fetchPendingRefunds();
  }, [fetchRefunds, fetchPendingRefunds]);

  // Formatar data
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }

  // Formatar hora
  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Formatar valor
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  }

  // Badge de status
  function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
      REQUESTED: 'bg-yellow-100 text-yellow-800',
      REVIEWING: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      REQUESTED: 'Solicitado',
      REVIEWING: 'Em análise',
      APPROVED: 'Aprovado',
      PAID: 'Pago',
      REJECTED: 'Rejeitado',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  }

  // Abrir modal de ação
  function openActionModal(refund: RefundItem, action: ActionType) {
    setActionModal({
      isOpen: true,
      refundId: refund.id,
      action,
      refund,
    });
    setRejectionReason('');
    setProofUrl('');
    setNotes('');
    setError('');
  }

  // Fechar modal
  function closeActionModal() {
    setActionModal({
      isOpen: false,
      refundId: null,
      action: null,
      refund: null,
    });
  }

  // Processar ação
  async function handleAction() {
    if (!actionModal.refundId || !actionModal.action) return;

    // Validar
    if (actionModal.action === 'REJECT' && !rejectionReason.trim()) {
      setError('Informe o motivo da rejeição');
      return;
    }

    setProcessingId(actionModal.refundId);
    setError('');
    setSuccessMessage('');

    try {
      const body: {
        action: ActionType;
        notes?: string;
        rejectionReason?: string;
        proofUrl?: string;
      } = {
        action: actionModal.action,
      };

      if (notes.trim()) {
        body.notes = notes.trim();
      }

      if (actionModal.action === 'REJECT') {
        body.rejectionReason = rejectionReason.trim();
      }

      if (actionModal.action === 'MARK_PAID' && proofUrl.trim()) {
        body.proofUrl = proofUrl.trim();
      }

      const res = await fetch(`/api/admin/refunds/${actionModal.refundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        setSuccessMessage(data.message || 'Ação realizada com sucesso!');
        closeActionModal();
        await fetchRefunds();
      } else {
        setError(data.error || 'Erro ao processar ação');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setProcessingId(null);
    }
  }

  // Verificar se ação está disponível
  function canDoAction(refund: RefundItem, action: ActionType): boolean {
    const transitions: Record<string, string[]> = {
      REQUESTED: ['REVIEW', 'APPROVE', 'REJECT'],
      REVIEWING: ['APPROVE', 'REJECT'],
      APPROVED: ['MARK_PAID', 'REJECT'],
      PAID: [],
      REJECTED: [],
    };
    return transitions[refund.status]?.includes(action) || false;
  }

  return (
    <>
      <Head>
        <title>Estornos | Admin Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-xl font-bold text-amber-600">
                Arthemi Admin
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-gray-700 font-medium">Estornos</span>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                Reservas
              </Link>
            </nav>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pedidos de Estorno</h1>
              <p className="text-gray-600">Gerencie as solicitações de devolução</p>
            </div>

            {/* Filtro de status */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Todos</option>
              <option value="REQUESTED">Solicitados</option>
              <option value="REVIEWING">Em análise</option>
              <option value="APPROVED">Aprovados</option>
              <option value="PAID">Pagos</option>
              <option value="REJECTED">Rejeitados</option>
            </select>
          </div>

          {/* ================================================================ */}
          {/* SEÇÃO: Refunds Parciais/Pendentes (do Gateway) */}
          {/* ================================================================ */}
          {!loadingPending && pendingRefunds.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-orange-600 text-xl">⚠️</span>
                <h2 className="text-lg font-semibold text-orange-800">
                  {ADMIN_COPY.partialRefunds.sectionTitle} ({pendingRefunds.length})
                </h2>
              </div>
              <p className="text-sm text-orange-700 mb-4">
                {ADMIN_COPY.partialRefunds.description}
              </p>
              <div className="space-y-2">
                {pendingRefunds.map((refund) => (
                  <div 
                    key={refund.id} 
                    className="bg-white rounded-lg p-3 border border-orange-200 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{refund.userName}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{refund.roomName}</span>
                        {refund.isPartial && (
                          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                            Parcial
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Esperado: {formatCurrency(refund.expectedAmount)} → 
                        Estornado: <span className="text-orange-600 font-medium">{formatCurrency(refund.refundedAmount)}</span>
                        <span className="text-gray-400 ml-2">
                          (Diferença: {formatCurrency(refund.expectedAmount - refund.refundedAmount)})
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {refund.gateway} • {new Date(refund.createdAt).toLocaleDateString('pt-BR')}
                        {refund.externalRefundId && ` • ID: ${refund.externalRefundId}`}
                      </div>
                    </div>
                    <Link
                      href={`/admin?booking=${refund.bookingId}`}
                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      Ver Booking
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagens */}
          {successMessage && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-6">
              {successMessage}
            </div>
          )}

          {error && !actionModal.isOpen && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
          )}

          {!loading && refunds.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center border border-gray-200">
              <p className="text-gray-500">Nenhum pedido de estorno encontrado</p>
            </div>
          )}

          {/* Tabela */}
          {!loading && refunds.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserva</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIX</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(refund.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{refund.userName}</div>
                        <div className="text-gray-500 text-xs">{refund.userEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{refund.roomName}</div>
                        <div className="text-gray-500 text-xs">
                          {formatDate(refund.bookingStart)} {formatTime(refund.bookingStart)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(refund.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{refund.pixKeyType}</div>
                        <div className="text-gray-500 text-xs truncate max-w-[120px]" title={refund.pixKey}>
                          {refund.pixKey}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={refund.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {canDoAction(refund, 'REVIEW') && (
                            <button
                              onClick={() => openActionModal(refund, 'REVIEW')}
                              disabled={processingId === refund.id}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              Analisar
                            </button>
                          )}
                          {canDoAction(refund, 'APPROVE') && (
                            <button
                              onClick={() => openActionModal(refund, 'APPROVE')}
                              disabled={processingId === refund.id}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                            >
                              Aprovar
                            </button>
                          )}
                          {canDoAction(refund, 'REJECT') && (
                            <button
                              onClick={() => openActionModal(refund, 'REJECT')}
                              disabled={processingId === refund.id}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            >
                              Rejeitar
                            </button>
                          )}
                          {canDoAction(refund, 'MARK_PAID') && (
                            <button
                              onClick={() => openActionModal(refund, 'MARK_PAID')}
                              disabled={processingId === refund.id}
                              className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50"
                            >
                              Marcar Pago
                            </button>
                          )}
                          {refund.status === 'PAID' && refund.proofUrl && (
                            <a
                              href={refund.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Comprovante
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Modal de ação */}
      {actionModal.isOpen && actionModal.refund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {actionModal.action === 'REVIEW' && 'Marcar em Análise'}
                {actionModal.action === 'APPROVE' && 'Aprovar Estorno'}
                {actionModal.action === 'REJECT' && 'Rejeitar Estorno'}
                {actionModal.action === 'MARK_PAID' && 'Marcar como Pago'}
              </h3>

              {/* Info do estorno */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <p><strong>Cliente:</strong> {actionModal.refund.userName}</p>
                <p><strong>Valor:</strong> {formatCurrency(actionModal.refund.amount)}</p>
                <p><strong>PIX:</strong> {actionModal.refund.pixKeyType} - {actionModal.refund.pixKey}</p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              {/* Campo de motivo para rejeição */}
              {actionModal.action === 'REJECT' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo da rejeição *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Informe o motivo..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              )}

              {/* Campo de comprovante para marcar como pago */}
              {actionModal.action === 'MARK_PAID' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link do comprovante (opcional)
                  </label>
                  <input
                    type="text"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pode ser um link do Google Drive, WhatsApp, ou outro
                  </p>
                </div>
              )}

              {/* Notas internas */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas internas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações para registro interno..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={closeActionModal}
                  disabled={processingId !== null}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAction}
                  disabled={processingId !== null}
                  className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
                    actionModal.action === 'REJECT'
                      ? 'bg-red-600 hover:bg-red-700'
                      : actionModal.action === 'APPROVE'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {processingId ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
