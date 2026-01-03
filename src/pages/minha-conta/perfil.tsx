// ===========================================================
// Página: /minha-conta/perfil - Perfil do Cliente
// ===========================================================

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Mail, Phone, CreditCard, Calendar, Clock, AlertTriangle, ChevronLeft } from 'lucide-react';

// ===========================================================
// TIPOS
// ===========================================================

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone?: string;
  cpf?: string;
  createdAt?: string;
}

interface CreditSummary {
  total: number;
  byRoom: { roomId: string | null; roomName: string; amount: number; tier: number | null }[];
}

interface Stats {
  totalBookings: number;
  upcomingBookings: number;
}

// ===========================================================
// COMPONENTE PRINCIPAL
// ===========================================================

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      try {
        // Busca autenticação e dados básicos do usuário
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();

        if (!mounted) return;

        if (!authData.authenticated) {
          router.replace('/login');
          return;
        }

        // Dados básicos do usuário
        setUser({
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.name,
        });

        // Busca créditos e reservas em paralelo
        const [creditsRes, bookingsRes, upcomingRes] = await Promise.all([
          fetch('/api/user/credits'),
          fetch('/api/user/bookings?limit=1000'),
          fetch('/api/user/bookings?upcoming=true'),
        ]);

        if (!mounted) return;

        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          if (creditsData.summary) {
            setCredits(creditsData.summary);
          }
        }

        // Calcular estatísticas
        let totalBookings = 0;
        let upcomingBookings = 0;

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          totalBookings = bookingsData.bookings?.length || 0;
        }

        if (upcomingRes.ok) {
          const upcomingData = await upcomingRes.json();
          upcomingBookings = upcomingData.bookings?.filter(
            (b: { status: string }) => b.status === 'CONFIRMED' || b.status === 'PENDING'
          ).length || 0;
        }

        setStats({ totalBookings, upcomingBookings });

      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <>
        <Head>
          <title>Meu Perfil | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <Link href="/minha-conta">
                <span className="text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </span>
              </Link>
            </div>
          </header>
          <main className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-red-900">Não foi possível carregar seu perfil</h2>
                <p className="text-red-700 text-sm mt-1">
                  Verifique sua conexão e tente novamente.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Meu Perfil | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/minha-conta">
              <span className="text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                Voltar ao Dashboard
              </span>
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          {/* Título */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-gray-500 mt-1">Visualize suas informações pessoais</p>
          </div>

          {/* Card de Dados Pessoais */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dados Pessoais</h2>
                <p className="text-sm text-gray-500">Informações da sua conta</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium text-gray-900">
                    {user.name || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                </div>
              </div>

              {/* Telefone */}
              {user.phone && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium text-gray-900">{user.phone}</p>
                  </div>
                </div>
              )}

              {/* CPF */}
              {user.cpf && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">CPF</p>
                    <p className="font-medium text-gray-900">
                      {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Estatísticas */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Créditos */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-primary-600 mb-2">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-sm font-medium">Saldo de Créditos</span>
                </div>
                <p className="text-2xl font-bold text-primary-900">
                  {credits ? formatCurrency(credits.total) : 'R$ 0,00'}
                </p>
              </div>

              {/* Total de Reservas */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm font-medium">Total de Reservas</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {stats?.totalBookings || 0}
                </p>
              </div>

              {/* Próximas Reservas */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">Reservas Agendadas</span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {stats?.upcomingBookings || 0}
                </p>
              </div>
            </div>
          </section>

          {/* Créditos por Sala */}
          {credits && credits.byRoom && credits.byRoom.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Créditos por Consultório</h2>
              <div className="space-y-3">
                {credits.byRoom.map((room, index) => (
                  <div
                    key={room.roomId || index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium text-gray-900">{room.roomName}</span>
                    <span className="text-primary-600 font-semibold">
                      {formatCurrency(room.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ações */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/minha-conta/reservas"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Ver Minhas Reservas
              </Link>
              <Link
                href="/minha-conta"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Comprar Créditos
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
