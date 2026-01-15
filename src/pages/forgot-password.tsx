// ===========================================================
// Página: /forgot-password - Esqueci minha senha
// ===========================================================

import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { getAuthFromSSR } from '@/lib/auth';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Se já logado, redireciona para account
  const auth = getAuthFromSSR(ctx);
  
  if (auth) {
    return {
      redirect: {
        destination: '/minha-conta',
        permanent: false,
      },
    };
  }

  return { props: {} };
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Sempre mostra sucesso (não revelar se email existe)
      setSent(true);
    } catch {
      // Mesmo com erro, mostra sucesso (segurança)
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso
  if (sent) {
    return (
      <>
        <Head>
          <title>Verifique seu Email | Espaço Arthemi</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-warm-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Verifique seu email
            </h1>
            <p className="text-gray-600 mb-6">
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              O link expira em 1 hora.
            </p>
            <Link
              href="/login"
              className="inline-block bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Esqueci minha senha | Espaço Arthemi</title>
        <meta name="description" content="Recupere sua senha no Espaço Arthemi" />
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
              Esqueceu sua senha?
            </h1>
            <p className="text-gray-600 mt-2">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </p>
          </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Enviando...
                </span>
              ) : (
                'Enviar link de recuperação'
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-600">
              Lembrou a senha?{' '}
              <Link
                href="/login"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Fazer login
              </Link>
            </p>
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 text-sm block"
            >
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
