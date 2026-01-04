// ===========================================================
// Página: /criar-senha - Criar Senha (após verificação de email)
// ===========================================================
// Recebe token da URL, permite definir senha para ativar conta

import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

type Status = 'form' | 'loading' | 'success' | 'error';

export default function CriarSenhaPage() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('form');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    // Validações frontend
    if (!token || typeof token !== 'string') {
      setErrorMessage('Link inválido. Solicite um novo email de ativação.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setStatus('success');
        // Redirecionar para minha-conta após 2 segundos
        setTimeout(() => {
          router.push('/minha-conta');
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Erro ao definir senha.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Erro de conexão. Tente novamente.');
    }
  }

  // Se não tem token na URL
  if (router.isReady && (!token || typeof token !== 'string')) {
    return (
      <>
        <Head>
          <title>Criar Senha | Espaço Arthemi</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 to-white px-4">
          <Link href="/" className="mb-8">
            <Image
              src="/images/Logo/logo.png"
              alt="Espaço Arthemi"
              width={180}
              height={60}
              priority
            />
          </Link>

          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Link inválido
            </h1>
            <p className="text-gray-600 mb-6">
              Este link de ativação é inválido ou expirou.
            </p>
            <Link
              href="/login"
              className="block w-full py-3 px-4 bg-accent-600 text-white rounded-lg font-medium hover:bg-accent-700 transition-colors"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Criar Senha | Espaço Arthemi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 to-white px-4 py-8">
        {/* Logo */}
        <Link href="/" className="mb-8">
          <Image
            src="/images/Logo/logo.png"
            alt="Espaço Arthemi"
            width={180}
            height={60}
            priority
          />
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          
          {/* Sucesso */}
          {status === 'success' && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Conta ativada com sucesso!
              </h1>
              <p className="text-gray-600 mb-4">
                Sua senha foi definida. Redirecionando...
              </p>
              <div className="animate-pulse text-accent-600">
                Aguarde...
              </div>
            </div>
          )}

          {/* Erro geral (após submit) */}
          {status === 'error' && (
            <div className="text-center">
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Erro ao criar senha
              </h1>
              <p className="text-red-600 mb-6">
                {errorMessage}
              </p>
              <button
                onClick={() => setStatus('form')}
                className="w-full py-3 px-4 bg-accent-600 text-white rounded-lg font-medium hover:bg-accent-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Formulário */}
          {(status === 'form' || status === 'loading') && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
                Crie sua senha
              </h1>
              <p className="text-gray-600 text-center mb-6">
                Defina uma senha para acessar sua conta.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Senha */}
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
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      required
                      minLength={8}
                      disabled={status === 'loading'}
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

                {/* Confirmar Senha */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Senha
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha novamente"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    required
                    minLength={8}
                    disabled={status === 'loading'}
                  />
                </div>

                {/* Erro inline */}
                {errorMessage && status === 'form' && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {errorMessage}
                  </div>
                )}

                {/* Botão Submit */}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 px-4 bg-accent-600 text-white rounded-lg font-medium hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Criando senha...
                    </span>
                  ) : (
                    'Criar senha e acessar conta'
                  )}
                </button>
              </form>

              {/* Link login */}
              <div className="mt-6 text-center text-sm text-gray-600">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-accent-600 hover:underline font-medium">
                  Faça login
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-sm text-gray-500">
          © {new Date().getFullYear()} Espaço Arthemi
        </p>
      </div>
    </>
  );
}
