// ===========================================================
// Página: /verificar-email - Verificação de Email
// ===========================================================
// Recebe token da URL, chama API para verificar, redireciona para criar-senha

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

type Status = 'loading' | 'success' | 'error';

export default function VerificarEmailPage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Aguarda token estar disponível
    if (!router.isReady) return;
    
    if (!token || typeof token !== 'string') {
      setStatus('error');
      setErrorMessage('Link inválido. Solicite um novo email de ativação.');
      return;
    }

    // Verificar token via API
    async function verifyToken() {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token as string)}`);
        const data = await response.json();

        if (response.ok && data.ok) {
          setStatus('success');
          // Redirecionar para criar-senha após 2 segundos
          setTimeout(() => {
            router.push(`/criar-senha?token=${encodeURIComponent(token as string)}`);
          }, 2000);
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Erro ao verificar email.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Erro de conexão. Tente novamente.');
      }
    }

    verifyToken();
  }, [router.isReady, token, router]);

  return (
    <>
      <Head>
        <title>Verificar Email | Espaço Arthemi</title>
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
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          
          {/* Loading */}
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600 mx-auto mb-4"></div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Verificando seu email...
              </h1>
              <p className="text-gray-600">
                Aguarde um momento.
              </p>
            </>
          )}

          {/* Sucesso */}
          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Email verificado!
              </h1>
              <p className="text-gray-600 mb-4">
                Redirecionando para criar sua senha...
              </p>
              <div className="animate-pulse text-accent-600">
                Aguarde...
              </div>
            </>
          )}

          {/* Erro */}
          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Erro na verificação
              </h1>
              <p className="text-red-600 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="block w-full py-3 px-4 bg-accent-600 text-white rounded-lg font-medium hover:bg-accent-700 transition-colors"
                >
                  Ir para Login
                </Link>
                <Link
                  href="/"
                  className="block text-accent-600 hover:underline"
                >
                  Voltar para o início
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
