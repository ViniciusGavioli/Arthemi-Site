// ===========================================================
// Página: /minha-conta - Dashboard do Cliente (Redesign Premium)
// ===========================================================

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Plus,
  ShoppingBag,
  MessageCircle,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';

import {
  DashboardHeader,
  KpiCard,
  KpiCardSkeleton,
  BookingListItem,
  BookingListItemSkeleton,
  EmptyState,
  QuickActionCard,
  EmailVerificationBanner,
} from '@/components/dashboard';
import { BookingWizardModal } from '@/components/booking';
import { PurchaseCreditsModal } from '@/components/credits';

// ===========================================================
// TIPOS
// ===========================================================

interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

interface CreditSummary {
  total: number;
  totalHours: number;
  byRoom: { roomId: string | null; roomName: string; amount: number; hours: number; tier: number | null }[];
}

interface Booking {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
}

// Helper: exibe nome do usuário com fallback
function getDisplayName(user: User | null): string {
  if (!user) return 'Usuário';
  if (user.name && user.name.trim()) {
    return user.name.split(' ')[0];
  }
  // Fallback: usar parte antes do @ do email
  if (user.email) {
    const prefix = user.email.split('@')[0];
    // Capitalizar primeira letra
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'Usuário';
}

// ===========================================================
// COMPONENTE PRINCIPAL
// ===========================================================

export default function MinhaContaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Modal de reserva
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Detecta retorno de compra via ?afterPurchase=1 OU sessionStorage
  useEffect(() => {
    if (!router.isReady) return;

    const fromQuery = router.query.afterPurchase === '1';
    const fromStorage = sessionStorage.getItem('purchasePending') === '1';

    if (fromQuery || fromStorage) {
      // Limpa flags
      if (fromQuery) {
        const { afterPurchase, ...rest } = router.query;
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
      }
      if (fromStorage) {
        sessionStorage.removeItem('purchasePending');
        sessionStorage.removeItem('purchaseRoomId');
      }

      // Mostra toast de sucesso
      setSuccessMessage('Créditos liberados! Agora agende seu horário.');

      // Refetch para atualizar créditos
      refetchData();

      // Abre modal de reserva após pequeno delay
      setTimeout(() => {
        setBookingModalOpen(true);
      }, 500);

      // Limpa mensagem após 5s
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        // Busca dados do usuário
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();

        if (!mounted) return;

        if (!authData.authenticated) {
          setRedirecting(true);
          router.replace('/login');
          return;
        }

        setUser(authData.user);

        // Busca créditos e reservas em paralelo
        const [creditsRes, bookingsRes] = await Promise.all([
          fetch('/api/user/credits'),
          fetch('/api/user/bookings?upcoming=true'),
        ]);

        if (!mounted) return;

        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          if (creditsData.summary) {
            setCredits(creditsData.summary);
          }
        }

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          if (bookingsData.bookings) {
            setBookings(bookingsData.bookings);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Se está redirecionando, não renderiza nada (evita flash)
  if (redirecting) {
    return null;
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function handleBookingSuccess(bookingId: string) {
    setBookingModalOpen(false);
    setSuccessMessage('Reserva criada com sucesso!');
    refetchData();
    // Limpa mensagem após 5s
    setTimeout(() => setSuccessMessage(''), 5000);
  }

  async function refetchData() {
    setLoading(true);
    setError(false);

    try {
      const [creditsRes, bookingsRes] = await Promise.all([
        fetch('/api/user/credits'),
        fetch('/api/user/bookings?upcoming=true'),
      ]);

      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.summary) {
          setCredits(creditsData.summary);
        }
      }

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        if (bookingsData.bookings) {
          setBookings(bookingsData.bookings);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(true);
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

  function formatHoursDisplay(hours: number): string {
    if (hours <= 0) return '0h';
    if (hours === 1) return '1 hora';
    if (Number.isInteger(hours)) return `${hours} horas`;
    return `${hours.toFixed(1)}h`;
  }

  // Próxima reserva
  const nextBooking = bookings.find(b => b.status === 'CONFIRMED');

  // Nome para exibição
  const displayName = getDisplayName(user);

  return (
    <>
      <Head>
        <title>Minha Conta | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Banner de verificação de email - fixo no topo */}
        {user && !user.emailVerified && (
          <EmailVerificationBanner userEmail={user.email} />
        )}

        {/* Header */}
        <DashboardHeader userName={displayName} onLogout={handleLogout} />

        {/* Conteúdo Principal */}
        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Saudação */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {loading ? (
                <span className="inline-block h-8 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                `Olá, ${displayName}! 👋`
              )}
            </h1>
            <p className="text-gray-500 mt-1">
              Gerencie suas reservas e acompanhe seu saldo de horas
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Erro ao carregar dados</p>
                <p className="text-red-600 text-sm">Verifique sua conexão e tente novamente.</p>
              </div>
              <button
                onClick={refetchData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {loading ? (
              <>
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
              </>
            ) : (
              <>
                {/* Próxima Reserva */}
                <KpiCard
                  icon={<Calendar className="w-6 h-6" />}
                  title="Próxima reserva"
                  value={
                    nextBooking
                      ? format(new Date(nextBooking.startTime), "d 'de' MMM", { locale: ptBR })
                      : '—'
                  }
                  subtitle={
                    nextBooking
                      ? `${nextBooking.roomName} • ${format(new Date(nextBooking.startTime), 'HH:mm')}`
                      : 'Nenhuma agendada'
                  }
                  variant={nextBooking ? 'primary' : 'default'}
                  href="/minha-conta/reservas"
                />

                {/* Horas disponíveis */}
                <KpiCard
                  icon={<Clock className="w-6 h-6" />}
                  title="Horas disponíveis"
                  value={credits?.totalHours ? formatHoursDisplay(credits.totalHours) : '0h'}
                  subtitle={credits?.totalHours ? `≈ ${formatCurrency(credits.total)}` : 'Compre créditos'}
                  variant={credits?.totalHours && credits.totalHours > 0 ? 'success' : 'default'}
                  href="/minha-conta"
                />

                {/* Info */}
                <KpiCard
                  icon={<Clock className="w-6 h-6" />}
                  title="Política de cancelamento"
                  value="48h antes"
                  subtitle="Cancelamento gratuito"
                  variant="default"
                />
              </>
            )}
          </div>

          {/* Grid Principal */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Coluna Principal (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Próximas Reservas */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Próximas Reservas</h2>
                  <Link
                    href="/minha-conta/reservas"
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    Ver todas
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="p-4">
                  {loading ? (
                    <div className="space-y-3">
                      <BookingListItemSkeleton />
                      <BookingListItemSkeleton />
                    </div>
                  ) : bookings.length > 0 ? (
                    <div className="space-y-3">
                      {bookings.slice(0, 3).map((booking) => (
                        <BookingListItem
                          key={booking.id}
                          id={booking.id}
                          roomName={booking.roomName}
                          startTime={booking.startTime}
                          endTime={booking.endTime}
                          status={booking.status}
                          showActions={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState variant="bookings" />
                  )}
                </div>
              </section>

              {/* Detalhes de Horas por Sala */}
              {credits && credits.byRoom.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Horas por Consultório</h2>
                  </div>

                  <div className="p-4 space-y-2">
                    {credits.byRoom.map((room, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                      >
                        <span className="font-medium text-gray-900">{room.roomName}</span>
                        <div className="text-right">
                          <span className="text-primary-600 font-semibold">
                            {formatHoursDisplay(room.hours)}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({formatCurrency(room.amount)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar (1/3) */}
            <div className="space-y-6">
              {/* Ações Rápidas */}
              <section className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
                <div className="space-y-3">
                  <QuickActionCard
                    icon={<Plus className="w-5 h-5 text-white" />}
                    title="Nova Reserva"
                    description="Agendar usando créditos"
                    onClick={() => setBookingModalOpen(true)}
                    variant="primary"
                  />
                  <QuickActionCard
                    icon={<ShoppingBag className="w-5 h-5 text-gray-600" />}
                    title="Comprar Horas"
                    description="Adquirir pacote de créditos"
                    onClick={() => setPurchaseModalOpen(true)}
                  />
                  <QuickActionCard
                    icon={<Calendar className="w-5 h-5 text-gray-600" />}
                    title="Minhas Reservas"
                    description="Ver histórico completo"
                    href="/minha-conta/reservas"
                  />
                </div>
              </section>

              {/* Avisos (se houver menos de 2 horas) */}
              {credits && credits.totalHours > 0 && credits.totalHours < 2 && (
                <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-900">Poucas horas restantes</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Você tem menos de 2 horas disponíveis. Considere adquirir um novo pacote.
                      </p>
                      <button
                        onClick={() => setPurchaseModalOpen(true)}
                        className="inline-block mt-3 text-sm font-medium text-amber-700 hover:text-amber-800"
                      >
                        Comprar pacote →
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Suporte */}
              <section className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Precisa de ajuda?</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Nossa equipe está disponível para auxiliar você.
                    </p>
                    <a
                      href="https://wa.me/5511999999999"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Falar pelo WhatsApp →
                    </a>
                  </div>
                </div>
              </section>

              {/* Info da conta */}
              <div className="text-sm text-gray-500 px-1">
                <p>
                  <strong>Email:</strong> {user?.email || '...'}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Modal de Nova Reserva */}
        {user && (
          <BookingWizardModal
            isOpen={bookingModalOpen}
            onClose={() => setBookingModalOpen(false)}
            userId={user.id}
            emailVerified={user.emailVerified}
            onSuccess={handleBookingSuccess}
            onPurchaseCredits={() => setPurchaseModalOpen(true)}
            onResendVerification={async () => {
              const res = await fetch('/api/auth/resend-activation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
              });
              const data = await res.json();
              if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Falha ao reenviar');
              }
            }}
          />
        )}

        {/* Modal de Compra de Créditos */}
        {user && (
          <PurchaseCreditsModal
            isOpen={purchaseModalOpen}
            onClose={() => setPurchaseModalOpen(false)}
            user={user}
          />
        )}

        {/* Toast de Sucesso */}
        {successMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom fade-in duration-300">
            <div className="flex items-center gap-3 bg-green-600 text-white px-6 py-4 rounded-xl shadow-lg">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
              <Link
                href="/minha-conta/reservas"
                className="text-green-100 hover:text-white underline"
              >
                Ver reservas
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
