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

      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center p-4">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 animate-fadeIn">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-accent-500 to-primary-500 rounded-3xl blur-xl opacity-20" />
          
          <div className="relative">
            {/* Logo */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl shadow-lg mb-6">
                <Image 
                  src="/images/Logo/logo.png" 
                  alt="Espaço Arthemi" 
                  width={50}
                  height={50}
                  className="w-12 h-12 brightness-0 invert"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                Painel Administrativo
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Entre com sua senha para acessar
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                  <span>❌</span>
                  {error}
                </div>
              )}

              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  🔐 Senha de Acesso
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-accent-500/20 focus:border-accent-500 transition-all text-lg"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 text-white py-4 rounded-xl font-bold text-lg hover:from-accent-600 hover:to-accent-700 hover:shadow-xl hover:shadow-accent-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Entrar no Painel
                  </>
                )}
              </button>
            </form>

            {/* Link voltar */}
            <div className="mt-8 text-center">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-accent-600 text-sm transition-colors inline-flex items-center gap-2"
              >
                <span>←</span>
                Voltar para o site
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
