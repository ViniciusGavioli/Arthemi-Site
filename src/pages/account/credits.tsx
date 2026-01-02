// ===========================================================
// Página: /account/credits - Meus Créditos
// ===========================================================

import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSSR } from '@/lib/auth';

interface RoomCredit {
  roomId: string;
  roomName: string;
  roomTier: string;
  totalRemaining: number;
  creditCount: number;
}

interface CreditsSummary {
  totalRemaining: number;
  byRoom: RoomCredit[];
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

export default function CreditsPage({ user: _user }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/me/credits');
        const data = await res.json();
        if (data.ok) {
          setSummary(data.summary);
        } else {
          setError(data.error || 'Erro ao carregar créditos');
        }
      } catch {
        setError('Erro de conexão');
      } finally {
        setLoading(false);
      }
    }
    fetchCredits();
  }, []);

  // Mapear tier para nome amigável
  function getTierLabel(tier: string): string {
    const labels: Record<string, string> = {
      TIER_1: 'Horário Padrão',
      TIER_2: 'Horário Prime',
      TIER_3: 'Horário Super Prime',
    };
    return labels[tier] || tier;
  }

  // Formatar valor em reais
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  return (
    <>
      <Head>
        <title>Meus Créditos | Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header simples */}
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
              <span className="text-amber-600 font-medium">Créditos</span>
            </nav>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Meus Créditos</h1>
          <p className="text-gray-600 mb-8">
            Veja seus créditos disponíveis para cada sala
          </p>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {!loading && !error && summary && (
            <>
              {/* Total geral */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-6 mb-8">
                <p className="text-amber-100 text-sm mb-1">Total em créditos</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(summary.totalRemaining)}
                </p>
              </div>

              {/* Lista por sala */}
              {summary.byRoom.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Você ainda não possui créditos.</p>
                  <Link
                    href="/salas"
                    className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition"
                  >
                    Ver Salas Disponíveis
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {summary.byRoom.map((room) => (
                    <div
                      key={room.roomId}
                      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{room.roomName}</h3>
                          <p className="text-sm text-gray-500">
                            {getTierLabel(room.roomTier)} • {room.creditCount}{' '}
                            {room.creditCount === 1 ? 'pacote' : 'pacotes'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-amber-600">
                            {formatCurrency(room.totalRemaining)}
                          </p>
                          <p className="text-xs text-gray-500">disponível</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info adicional */}
              <div className="mt-8 bg-blue-50 text-blue-800 rounded-lg p-4 text-sm">
                <p className="font-medium mb-1">💡 Como funcionam os créditos?</p>
                <p>
                  Seus créditos são automaticamente aplicados ao fazer uma reserva para
                  a sala correspondente. Créditos têm validade e são usados do mais
                  antigo para o mais recente.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
