// ===========================================================
// Página: /minha-conta/nova-reserva - Agendar usando crédito
// Wrapper que reutiliza CreditBookingWizard
// ===========================================================

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CreditBookingWizard } from '@/components/booking';

interface User {
  id: string;
  email: string;
  name: string;
}

export default function NovaReservaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        if (!authData.authenticated) {
          router.push('/login');
          return;
        }
        setUser(authData.user);
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  function handleSuccess(bookingId: string) {
    router.push(`/minha-conta/reservas?created=${bookingId}`);
  }

  function handleCancel() {
    router.push('/minha-conta');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Nova Reserva | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/minha-conta">
              <span className="text-primary-600 hover:text-primary-700">← Voltar</span>
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <CreditBookingWizard
            userId={user.id}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </main>
      </div>
    </>
  );
}
