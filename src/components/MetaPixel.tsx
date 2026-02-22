// ===========================================================
// MetaPixel.tsx - Meta Pixel (Facebook Pixel)
// Dispara PageView no load inicial e a cada mudança de rota
// ===========================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';

declare global {
    interface Window {
        fbq: (...args: unknown[]) => void;
        _fbq: unknown;
    }
}

const PIXEL_ID = '1638076163885562';

export default function MetaPixel() {
    const router = useRouter();

    // Dispara PageView em cada mudança de rota (SPA navigation)
    useEffect(() => {
        const handleRouteChange = () => {
            if (typeof window.fbq === 'function') {
                window.fbq('track', 'PageView');
            }
        };

        router.events.on('routeChangeComplete', handleRouteChange);
        return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
        };
    }, [router.events]);

    return (
        <>
            {/* Carrega fbevents.js após hydration, sem bloquear render */}
            <Script
                id="meta-pixel-script"
                src="https://connect.facebook.net/en_US/fbevents.js"
                strategy="afterInteractive"
            />

            {/* Init + PageView do primeiro load */}
            <Script id="meta-pixel-init" strategy="afterInteractive">
                {`
          !function(f,b,e,v,n,t,s){
            if(f.fbq)return;
            n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];
          }(window,document,'script');
          fbq('init','${PIXEL_ID}');
          fbq('track','PageView');
        `}
            </Script>

            {/* Fallback noscript */}
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: 'none' }}
                    src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
        </>
    );
}
