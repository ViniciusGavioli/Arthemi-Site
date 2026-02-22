// ===========================================================
// _document.tsx - Documento base do Next.js
// ===========================================================

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
