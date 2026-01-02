// ===========================================================
// Página: /account/refunds - Meus Pedidos de Estorno
// ===========================================================

import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSSR } from '@/lib/auth';

interface RefundItem {
  id: string;
  bookingId: string;
  roomName: string;
  bookingStart: string;
  bookingEnd: string;
  amount: number;
  pixKeyType: string;
  pixKey: string;
  status: string;
  reason: string | null;
  rejectionReason: string | null;
  proofUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PageProps {
  user: { userId: string; role: string };
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx: GetServerSidePropsContext) => {
  const result = requireAuthSSR(ctx);
  
  if ('redirect' in result) {
    return result;
  }
  
  return {
    props: {
      user: result.auth,
    },
  };
};

export default function RefundsPage({ user: _user }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [error, setError] = useState('');

  async function fetchRefunds() {
    try {
      const res = await fetch('/api/me/refunds');
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
  }

  useEffect(() => {
    fetchRefunds();
  }, []);

  // Formatar data
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

  return (
    <>
      <Head>
        <title>Meus Pedidos de Estorno | Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-amber-600">
              Arthemi
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/account" className="text-gray-600 hover:text-gray-900">
                Minha Conta
              </Link>
              <Link href="/account/bookings" className="text-gray-600 hover:text-gray-900">
                Reservas
              </Link>
              <Link href="/account/credits" className="text-gray-600 hover:text-gray-900">
                Créditos
              </Link>
              <span className="text-amber-600 font-medium">Estornos</span>
            </nav>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Meus Pedidos de Estorno</h1>
          <p className="text-gray-600 mb-8">
            Acompanhe o status dos seus pedidos de devolução
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
          )}

          {!loading && !error && refunds.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
              <p className="text-gray-500 mb-4">Nenhum pedido de estorno</p>
              <Link
                href="/account/bookings"
                className="text-amber-600 hover:text-amber-700 font-medium text-sm"
              >
                Ver minhas reservas →
              </Link>
            </div>
          )}

          {!loading && !error && refunds.length > 0 && (
            <div className="space-y-4">
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{refund.roomName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(refund.bookingStart)} às {formatTime(refund.bookingStart)}
                      </p>
                    </div>
                    <StatusBadge status={refund.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Valor</span>
                      <p className="font-medium text-gray-900">{formatCurrency(refund.amount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Chave PIX</span>
                      <p className="font-medium text-gray-900">{refund.pixKeyType}: {refund.pixKey}</p>
                    </div>
                  </div>

                  {refund.reason && (
                    <div className="text-sm mb-3">
                      <span className="text-gray-500">Motivo:</span>
                      <p className="text-gray-700">{refund.reason}</p>
                    </div>
                  )}

                  {refund.status === 'REJECTED' && refund.rejectionReason && (
                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">
                      <span className="font-medium">Motivo da rejeição:</span> {refund.rejectionReason}
                    </div>
                  )}

                  {refund.status === 'PAID' && (
                    <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-sm">
                      ✅ Pago em {refund.paidAt ? formatDate(refund.paidAt) : 'N/A'}
                      {refund.proofUrl && (
                        <a
                          href={refund.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 underline"
                        >
                          Ver comprovante
                        </a>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-400 mt-3">
                    Solicitado em {formatDate(refund.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="mt-8 bg-blue-50 text-blue-800 rounded-lg p-4 text-sm">
            <p className="font-medium mb-1">ℹ️ Como funciona o estorno</p>
            <p>
              Após a solicitação, nossa equipe analisa o pedido e realiza o pagamento via PIX.
              Você receberá um email a cada atualização do status.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
