// ===========================================================
// _app.tsx - Componente raiz do Next.js
// ===========================================================

import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { LocalBusinessSchema, WebSiteSchema } from '@/components/SEO';
import { SITE_CONFIG, BUSINESS_INFO, getFullUrl, getOgImageUrl } from '@/constants/seo';
import '../styles/globals.css';

// Domínio do Plausible (configurável via env)
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'espacoarthemi.com.br';
const PLAUSIBLE_SCRIPT = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT || 'https://plausible.io/js/script.js';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* Viewport e tema */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={SITE_CONFIG.themeColor} />
        <meta name="msapplication-TileColor" content={SITE_CONFIG.themeColor} />
        
        {/* SEO básico global (páginas individuais sobrescrevem) */}
        <meta name="author" content={BUSINESS_INFO.name} />
        <meta name="generator" content="Next.js" />
        <meta httpEquiv="content-language" content={SITE_CONFIG.language} />
        
        {/* Open Graph defaults (páginas sobrescrevem) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_CONFIG.name} />
        <meta property="og:locale" content={SITE_CONFIG.locale} />
        <meta property="og:image" content={getOgImageUrl()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={getOgImageUrl()} />
        
        {/* Favicon e ícones */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        
        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />
      </Head>
      
      {/* Schema.org JSON-LD global */}
      <LocalBusinessSchema />
      <WebSiteSchema />
      
      {/* Plausible Analytics - Privacy-first, sem cookies, LGPD-compliant */}
      {process.env.NODE_ENV === 'production' && (
        <Script
          defer
          data-domain={PLAUSIBLE_DOMAIN}
          src={PLAUSIBLE_SCRIPT}
          strategy="afterInteractive"
        />
      )}
      
      <Component {...pageProps} />
    </>
  );
}
