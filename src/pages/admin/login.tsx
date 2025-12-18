// ===========================================================
// Página de Login do Admin
// ===========================================================

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirect = (router.query.redirect as string) || '/admin';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      // Login bem sucedido - redireciona
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Login — Espaço Arthemi</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-warm-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Image 
              src="/images/Logo/logo.png" 
              alt="Espaço Arthemi" 
              width={200}
              height={80}
              className="h-20 w-auto mx-auto mb-4"
              priority
            />
            <h1 className="text-2xl font-bold text-primary-900">
              Painel Administrativo
            </h1>
            <p className="text-secondary-600 text-sm mt-1">
              Acesso restrito
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-primary-800 mb-2"
              >
                Senha de Administrador
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                required
                autoFocus
                className="w-full px-4 py-3 border border-warm-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-accent-600 text-white py-3 rounded-lg font-semibold hover:bg-accent-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Link voltar */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => router.push('/')}
              className="text-secondary-500 hover:text-accent-600 text-sm transition"
            >
              ← Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
