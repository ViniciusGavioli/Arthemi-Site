// ===========================================================
// Página: /account - Dashboard do Cliente (Protegida)
// ===========================================================
// Exige login via getServerSideProps (SSR)

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { requireAuthSSR, AuthUser } from '@/lib/auth';

interface AccountPageProps {
  user: {
    userId: string;
    role: 'CUSTOMER' | 'ADMIN';
  };
  error?: string;
}

export const getServerSideProps: GetServerSideProps<AccountPageProps> = async (ctx) => {
  // Exige login
  const result = requireAuthSSR(ctx, '/login');
  
  // Não autenticado - redirect
  if ('redirect' in result) {
    return result;
  }

  // Erro da query (ex: tentou acessar admin sem permissão)
  const error = ctx.query.error === 'unauthorized' 
    ? 'Você não tem permissão para acessar essa área.' 
    : undefined;

  return {
    props: {
      user: result.auth,
      error,
    },
  };
};

export default function AccountPage({ user, error }: AccountPageProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <Head>
        <title>Minha Conta | Espaço Arthemi</title>
        <meta name="description" content="Gerencie sua conta no Espaço Arthemi" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/">
                <Image
                  src="/images/Logo/logo.png"
                  alt="Espaço Arthemi"
                  width={140}
                  height={45}
                  priority
                />
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
              >
                {loggingOut ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Boas-vindas */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Bem-vindo(a)! 👋
            </h1>
            <p className="text-gray-600">
              Gerencie suas reservas e créditos no Espaço Arthemi.
            </p>
            
            {/* Debug info (remover em produção) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm font-mono">
                <p><strong>User ID:</strong> {user.userId}</p>
                <p><strong>Role:</strong> {user.role}</p>
              </div>
            )}
          </div>

          {/* Menu de navegação */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Minhas Reservas */}
            <Link
              href="/minha-conta/reservas"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-2xl">
                  📅
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    Minhas Reservas
                  </h2>
                  <p className="text-sm text-gray-500">
                    Veja suas reservas atuais
                  </p>
                </div>
              </div>
            </Link>

            {/* Nova Reserva */}
            <Link
              href="/minha-conta/nova-reserva"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                  ➕
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    Nova Reserva
                  </h2>
                  <p className="text-sm text-gray-500">
                    Agende um consultório
                  </p>
                </div>
              </div>
            </Link>

            {/* Meus Créditos */}
            <Link
              href="/minha-conta"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-2xl">
                  💳
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    Meus Créditos
                  </h2>
                  <p className="text-sm text-gray-500">
                    Saldo e pacotes de horas
                  </p>
                </div>
              </div>
            </Link>

            {/* Meu Perfil */}
            <Link
              href="/minha-conta"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    Meu Perfil
                  </h2>
                  <p className="text-sm text-gray-500">
                    Dados pessoais
                  </p>
                </div>
              </div>
            </Link>

            {/* Admin (só aparece para admins) */}
            {user.role === 'ADMIN' && (
              <Link
                href="/admin/dashboard"
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group border-2 border-primary-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-2xl">
                    ⚙️
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                      Painel Admin
                    </h2>
                    <p className="text-sm text-gray-500">
                      Gerenciar sistema
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Voltar ao site */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Voltar para o site
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
