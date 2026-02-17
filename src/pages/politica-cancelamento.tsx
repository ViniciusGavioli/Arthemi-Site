// ===========================================================
// Redirecionamento 301 para a página unificada de Termos (Aba Reembolso)
// ===========================================================

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function PoliticaCancelamentoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/termos?tab=reembolso');
  }, [router]);

  return (
    <>
      <Head>
        <title>Redirecionando...</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-warm-50 text-secondary-500">
        Redirecionando para Política de Reembolso...
      </div>
    </>
  );
}
