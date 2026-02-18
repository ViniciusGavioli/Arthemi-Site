// ===========================================================
// _app.tsx - Componente raiz do Next.js
// ===========================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { LocalBusinessSchema, WebSiteSchema } from '@/components/SEO';
import { SITE_CONFIG, BUSINESS_INFO, getFullUrl, getOgImageUrl } from '@/constants/seo';
import { getMetaPixelScript, getMetaPixelId, trackPageView } from '@/lib/meta-pixel';
import { pageview as gtagPageview, saveUtmParams, GA4_MEASUREMENT_ID } from '@/lib/gtag';
import CookieConsent, { COOKIE_CONSENT_KEY } from '@/components/CookieConsent';
import '../styles/globals.css';

// Domínio do Plausible (configurável via env)
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'arthemisaude.com';
const PLAUSIBLE_SCRIPT = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT || 'https://plausible.io/js/script.js';

// Meta Pixel ID e Script
const META_PIXEL_ID = getMetaPixelId();
const META_PIXEL_SCRIPT = getMetaPixelScript();

// Container GTM - Produção
const GTM_ID = 'GTM-K4T74F6W';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [consentGiven, setConsentGiven] = useState(false);

  // Verifica consentimento ao carregar
  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent === 'accepted') {
      setConsentGiven(true);
    }
  }, []);

  // Salva UTMs na primeira visita (para atribuição de conversão)
  useEffect(() => {
    saveUtmParams();
  }, []);

  // Dispara PageView em cada navegação (SPA) - APENAS SE TIVER CONSENTIMENTO
  useEffect(() => {
    if (!consentGiven) return;

    const handleRouteChange = (url: string) => {
      // GA4 pageview
      gtagPageview(url);
      // Meta Pixel PageView
      trackPageView();
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, consentGiven]);

  return (
    <>
      <Head>
        {/* Viewport e tema - iOS otimizado */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content={SITE_CONFIG.themeColor} />
        <meta name="msapplication-TileColor" content={SITE_CONFIG.themeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />

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

      {/* RASTREAMENTO CONDICIONAL (Só carrega se consentGiven for true) */}
      {consentGiven && (
        <>
          {/* Plausible Analytics - Privacy-first */}
          {process.env.NODE_ENV === 'production' && (
            <Script
              defer
              data-domain={PLAUSIBLE_DOMAIN}
              src={PLAUSIBLE_SCRIPT}
              strategy="afterInteractive"
            />
          )}

          {/* Meta Pixel */}
          {process.env.NODE_ENV === 'production' && META_PIXEL_ID && META_PIXEL_SCRIPT && (
            <>
              <Script
                id="meta-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{ __html: META_PIXEL_SCRIPT }}
              />
              <noscript>
                <img
                  height="1"
                  width="1"
                  style={{ display: 'none' }}
                  src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                  alt=""
                />
              </noscript>
            </>
          )}

          {/* Google Analytics 4 + Google Ads - gtag.js */}
          {process.env.NODE_ENV === 'production' && (
            <>
              <Script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
                strategy="afterInteractive"
              />
              <Script
                id="google-analytics"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    
                    // GA4 Config
                    gtag('config', '${GA4_MEASUREMENT_ID}', {
                      page_path: window.location.pathname,
                    });

                    // Google Ads Config (Remarketing + Conversions)
                    // AW-17960843080
                    gtag('config', 'AW-17960843080');
                  `,
                }}
              />
            </>
          )}

          {/* Google Tag Manager - Script (HEAD) */}
          {process.env.NODE_ENV === 'production' && (
            <Script
              id="google-tag-manager"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');`,
              }}
            />
          )}
        </>
      )}

      {/* GTM NoScript (Body) - Só se consentido */}
      {consentGiven && process.env.NODE_ENV === 'production' && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}

      <Component {...pageProps} />
      <CookieConsent />
    </>
  );
}
