// ===========================================================
// _document.tsx - Documento base do Next.js com Google Tag Manager + GA4
// ===========================================================

import { Html, Head, Main, NextScript } from 'next/document';

// Container GTM - Produção
const GTM_ID = 'GTM-PFFZKL5L';

// Google Analytics 4 - Measurement ID
const GA4_ID = 'G-379R20W0J1';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* Scripts de Analytics foram movidos para _app.tsx para controle de consentimento (LGPD) */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
