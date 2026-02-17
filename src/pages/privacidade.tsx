// ===========================================================
// Redirecionamento 301 para a página unificada de Termos
// ===========================================================

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function PrivacidadeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/termos?tab=privacidade');
  }, [router]);

  return (
    <>
      <Head>
        <title>Redirecionando...</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-warm-50 text-secondary-500">
        Redirecionando...
      </div>
    </>
  );
}
