// ===========================================================
// Página: /reset-password - Redefinir Senha
// ===========================================================

import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { getAuthFromSSR } from '@/lib/auth';

interface ResetPasswordPageProps {
  token: string;
  email: string;
  hasParams: boolean;
}

export const getServerSideProps: GetServerSideProps<ResetPasswordPageProps> = async (ctx) => {
  // Se já logado, redireciona para account
  const auth = getAuthFromSSR(ctx);
  
  if (auth) {
    return {
      redirect: {
        destination: '/account',
        permanent: false,
      },
    };
  }

  const token = ctx.query.token as string || '';
  const email = ctx.query.email as string || '';
  const hasParams = !!(token && email);

  return {
    props: {
      token,
      email,
      hasParams,
    },
  };
};

export default function ResetPasswordPage({ token, email, hasParams }: ResetPasswordPageProps) {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Se não tem parâmetros, mostrar erro
  if (!hasParams) {
    return (
      <>
        <Head>
          <title>Link Inválido | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-warm-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Link inválido
            </h1>
            <p className="text-gray-600 mb-6">
              O link para redefinir senha é inválido ou expirou.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Validar confirmação
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    // Validar tamanho
    if (newPassword.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao redefinir senha');
        setLoading(false);
        return;
      }

      // Sucesso - redirecionar para login
      router.push('/login?reset=1');

    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Redefinir Senha | Espaço Arthemi</title>
        <meta name="description" content="Crie uma nova senha para sua conta" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <Image
                src="/images/Logo/logo.png"
                alt="Espaço Arthemi"
                width={180}
                height={60}
                className="mx-auto"
                priority
              />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-6">
              Criar nova senha
            </h1>
            <p className="text-gray-600 mt-2">
              Digite sua nova senha abaixo
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors pr-12"
                  placeholder="Mínimo 8 caracteres"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nova senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="Repita a nova senha"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </span>
              ) : (
                'Salvar nova senha'
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
