// ===========================================================
// Página: /login - Login do Cliente (Email + Senha)
// ===========================================================

import { useState, FormEvent, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { getAuthFromSSR } from '@/lib/auth';
import { safeNext, getSuccessMessage } from '@/lib/redirect';
import { analytics } from '@/lib/analytics';

interface LoginPageProps {
  successMessage: string | null;
  isFromRegistration: boolean;
}

export const getServerSideProps: GetServerSideProps<LoginPageProps> = async (ctx) => {
  // Se já logado, redireciona para account
  const auth = getAuthFromSSR(ctx);

  if (auth) {
    const next = safeNext(ctx.query.next, '/minha-conta');
    return {
      redirect: {
        destination: next,
        permanent: false,
      },
    };
  }

  // Mensagem de sucesso (registro ou reset)
  const successMessage = getSuccessMessage(ctx.query as Record<string, unknown>);

  // Flag para disparar CompleteRegistration
  const isFromRegistration = ctx.query.registered === '1';

  return {
    props: {
      successMessage,
      isFromRegistration,
    },
  };
};

export default function LoginPage({ successMessage, isFromRegistration }: LoginPageProps) {
  const router = useRouter();
  const { next } = router.query;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Ref para garantir que CompleteRegistration dispara apenas 1x
  const registrationTrackedRef = useRef(false);

  // Disparar CompleteRegistration quando vindo do registro
  useEffect(() => {
    if (isFromRegistration && !registrationTrackedRef.current) {
      registrationTrackedRef.current = true;
      analytics.registrationCompleted();
    }
  }, [isFromRegistration]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Lança erro para cair no catch e ser tratado unificadamente
        throw new Error(data.error || 'Erro ao fazer login');
      }

      // Login OK - redirecionar
      const destination = safeNext(next, '/minha-conta');

      try {
        const navigated = await router.push(destination);
        // router.push retorna false quando a navegação é cancelada/abortada
        if (navigated === false) {
          window.location.href = destination;
        }
      } catch (navError) {
        console.error('Erro de navegação:', navError);
        // Fallback: hard redirect se router.push falhar
        window.location.href = destination;
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      // Exibe mensagem visual de erro
      setError(err.message || 'Erro de conexão. Tente novamente.');
    } finally {
      // Garante que o estado de loading seja resetado sempre
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Entrar | Espaço Arthemi</title>
        <meta name="description" content="Faça login na sua conta do Espaço Arthemi" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <Image
                src="/images/Logo/logo.webp"
                alt="Espaço Arthemi"
                width={180}
                height={60}
                className="mx-auto"
                priority
              />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-6">
              Entrar na sua conta
            </h1>
            <p className="text-gray-600 mt-2">
              Acesse para gerenciar suas reservas
            </p>
          </div>

          {/* Mensagem de sucesso */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {successMessage}
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Link para registro */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Não tem uma conta?{' '}
              <Link
                href="/register"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Criar conta
              </Link>
            </p>
          </div>

          {/* Voltar */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
