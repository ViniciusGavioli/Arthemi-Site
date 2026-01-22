// ===========================================================
// Página: /confirme-seu-email - Confirmação de Email pós-pagamento
// ===========================================================
// Após pagamento confirmado, usuário é direcionado aqui para
// confirmar email via magic link e criar senha

import { useState, FormEvent, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { getAuthFromSSR } from '@/lib/auth';

interface ConfirmeEmailProps {
  initialEmail: string | null;
  next: string;
}

export const getServerSideProps: GetServerSideProps<ConfirmeEmailProps> = async (ctx) => {
  // Se já logado, redireciona para o destino
  const auth = getAuthFromSSR(ctx);
  
  if (auth) {
    const next = (ctx.query.next as string) || '/minha-conta?confirmed=true';
    return {
      redirect: {
        destination: next,
        permanent: false,
      },
    };
  }

  // Email pode vir da query (pré-preenchido do checkout)
  const email = (ctx.query.email as string) || null;
  const next = (ctx.query.next as string) || '/minha-conta?confirmed=true';

  return {
    props: {
      initialEmail: email,
      next,
    },
  };
};

type Status = 'form' | 'loading' | 'success' | 'error' | 'rate-limited';

export default function ConfirmeEmailPage({ initialEmail, next }: ConfirmeEmailProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail || '');
  const [status, setStatus] = useState<Status>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetAt, setResetAt] = useState<string | null>(null);

  // Verifica se email veio na query ao montar
  useEffect(() => {
    if (router.isReady && router.query.email && typeof router.query.email === 'string') {
      setEmail(router.query.email);
    }
  }, [router.isReady, router.query.email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !email.includes('@')) {
      setErrorMessage('Digite um email válido.');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/auth/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.status === 429) {
        // Rate limited
        setStatus('rate-limited');
        setResetAt(data.resetAt || null);
        setErrorMessage(data.error || 'Muitas tentativas. Tente novamente em alguns minutos.');
        return;
      }

      if (response.ok && data.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Erro ao enviar email. Tente novamente.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Erro de conexão. Tente novamente.');
    }
  }

  return (
    <>
      <Head>
        <title>Confirme seu Email | Espaço Arthemi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 to-white px-4">
        {/* Logo */}
        <Link href="/" className="mb-8">
          <Image
            src="/images/Logo/logo.webp"
            alt="Espaço Arthemi"
            width={180}
            height={60}
            priority
          />
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          
          {/* Estado: Formulário */}
          {(status === 'form' || status === 'error') && (
            <>
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">📧</div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Confirme seu email para acessar sua compra
                </h1>
                <p className="text-gray-600 text-sm">
                  Enviaremos um link de confirmação para você criar sua senha e acessar sua conta.
                </p>
              </div>

              {/* Erro */}
              {status === 'error' && errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Seu email
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
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                >
                  Enviar link de confirmação
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Já tem uma conta?{' '}
                  <Link href="/login" className="text-primary-600 hover:underline">
                    Fazer login
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Estado: Loading */}
          {status === 'loading' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Enviando link...</p>
            </div>
          )}

          {/* Estado: Sucesso */}
          {status === 'success' && (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Enviamos um link para seu email
              </h1>
              <p className="text-gray-600 mb-6">
                Abra o email e clique no link para confirmar sua conta. O link expira em 12 horas.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  📬 Verifique também a caixa de spam se não encontrar o email.
                </p>
              </div>
              <button
                onClick={() => setStatus('form')}
                className="text-primary-600 hover:underline text-sm"
              >
                Não recebeu? Enviar novamente
              </button>
            </div>
          )}

          {/* Estado: Rate Limited */}
          {status === 'rate-limited' && (
            <div className="text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Aguarde um momento
              </h1>
              <p className="text-gray-600 mb-4">
                {errorMessage}
              </p>
              {resetAt && (
                <p className="text-sm text-gray-500 mb-6">
                  Tente novamente após {new Date(resetAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <button
                onClick={() => setStatus('form')}
                className="text-primary-600 hover:underline text-sm"
              >
                Voltar
              </button>
            </div>
          )}
        </div>

        {/* Link para ajuda */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Precisa de ajuda?{' '}
            <a href="https://wa.me/5531999923910" className="text-primary-600 hover:underline">
              Fale conosco
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
