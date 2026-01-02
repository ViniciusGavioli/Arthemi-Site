// ===========================================================
// Página: /minha-conta - Dashboard do Cliente
// ===========================================================
// Mostra saldo de créditos, reservas e opções

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  email: string;
  name: string;
}

interface CreditSummary {
  total: number;
  byRoom: { roomId: string | null; roomName: string; amount: number; tier: number | null }[];
}

interface Booking {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function MinhaContaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Busca dados do usuário
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();

      if (!authData.authenticated) {
        router.push('/login');
        return;
      }

      setUser(authData.user);

      // Busca créditos (via cookie - não precisa passar phone)
      const creditsRes = await fetch('/api/user/credits');
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.summary) {
          setCredits(creditsData.summary);
        }
      }

      // Busca reservas futuras (via cookie - não precisa passar phone)
      const bookingsRes = await fetch('/api/user/bookings?upcoming=true');
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        if (bookingsData.bookings) {
          setBookings(bookingsData.bookings);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Minha Conta | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/">
              <Image
                src="/images/Logo/logo-horizontal.png"
                alt="Espaço Arthemi"
                width={140}
                height={45}
              />
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Olá, <strong>{user?.name?.split(' ')[0]}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          {/* Título */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Minha Conta</h1>
            <p className="text-gray-600 mt-1">
              Gerencie suas reservas e acompanhe seu saldo
            </p>
          </div>

          {/* Cards principais */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Card Saldo */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">💰 Meu Saldo</h2>
                <Link
                  href="/minha-conta/extrato"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Ver extrato →
                </Link>
              </div>

              {credits && credits.total > 0 ? (
                <>
                  <p className="text-4xl font-bold text-primary-600 mb-4">
                    {formatCurrency(credits.total)}
                  </p>
                  
                  {credits.byRoom.length > 0 && (
                    <div className="space-y-2">
                      {credits.byRoom.map((room, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{room.roomName}</span>
                          <span className="text-gray-900 font-medium">
                            {formatCurrency(room.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-4">Você não tem créditos disponíveis</p>
                  <Link
                    href="/salas"
                    className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Comprar pacote de horas
                  </Link>
                </div>
              )}
            </div>

            {/* Card Ações Rápidas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Ações Rápidas</h2>
              
              <div className="space-y-3">
                <Link
                  href="/minha-conta/nova-reserva"
                  className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-medium text-gray-900">Nova Reserva</p>
                    <p className="text-sm text-gray-600">Reservar usando seu saldo</p>
                  </div>
                </Link>

                <Link
                  href="/minha-conta/reservas"
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="font-medium text-gray-900">Minhas Reservas</p>
                    <p className="text-sm text-gray-600">Ver todas as reservas</p>
                  </div>
                </Link>

                <Link
                  href="/salas"
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-medium text-gray-900">Comprar mais horas</p>
                    <p className="text-sm text-gray-600">Ver pacotes disponíveis</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Próximas reservas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">📅 Próximas Reservas</h2>
              <Link
                href="/minha-conta/reservas"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Ver todas →
              </Link>
            </div>

            {bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.slice(0, 3).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{booking.roomName}</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(booking.startTime), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        {' • '}
                        {format(new Date(booking.startTime), 'HH:mm')} - {format(new Date(booking.endTime), 'HH:mm')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'CONFIRMED' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {booking.status === 'CONFIRMED' ? 'Confirmada' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Você não tem reservas agendadas</p>
                {credits && credits.total > 0 && (
                  <Link
                    href="/minha-conta/nova-reserva"
                    className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Fazer primeira reserva
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Info de conta */}
          <div className="mt-8 p-4 bg-gray-100 rounded-xl">
            <p className="text-sm text-gray-600">
              <strong>Email:</strong> {user?.email}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
