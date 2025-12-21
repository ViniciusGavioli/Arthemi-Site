// ===========================================================
// Página: /auth/entrar - Login do Cliente via Magic Link
// ===========================================================

import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

export default function EntrarPage() {
  const router = useRouter();
  const { error, redirect } = router.query;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Mensagens de erro da URL
  const urlErrorMessages: Record<string, string> = {
    invalid: 'Link inválido. Solicite um novo.',
    expired: 'Link expirado. Solicite um novo.',
    server: 'Erro no servidor. Tente novamente.',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.rateLimited) {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos.');
        setLoading(false);
        return;
      }

      // Sempre mostra sucesso (não revela se email existe)
      setSent(true);
    } catch {
      setErrorMessage('Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso (email enviado)
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
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link de acesso.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              O link expira em 12 horas.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Tentar com outro email
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Entrar | Espaço Arthemi</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/">
              <Image
                src="/images/Logo/logo-horizontal.png"
                alt="Espaço Arthemi"
                width={180}
                height={60}
                className="mx-auto"
              />
            </Link>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Acesse sua conta
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Digite seu email para receber um link de acesso
          </p>

          {/* Erros da URL */}
          {error && typeof error === 'string' && urlErrorMessages[error] && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{urlErrorMessages[error]}</p>
            </div>
          )}

          {/* Erro do formulário */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-shake">
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-colors text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Enviando...
                </span>
              ) : (
                'Enviar link de acesso'
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 text-center">
              Não tem conta? Ao fazer sua primeira reserva, sua conta será criada automaticamente.
            </p>
          </div>

          {/* Voltar */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
