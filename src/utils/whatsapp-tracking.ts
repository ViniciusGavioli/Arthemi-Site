// ===========================================================
// whatsapp-tracking.ts
// Hook que registra evento GA4 "generate_lead" toda vez que
// o usuário clica em qualquer link WhatsApp (wa.me /
// api.whatsapp.com) no site inteiro.
//
// ✅ Seguro em SSR (guard typeof window)
// ✅ Funciona com SPA / Next Router
// ✅ Sem duplicatas (listener é removido no cleanup)
// ✅ Não interfere no Meta Pixel
// ===========================================================

import { useEffect } from 'react';

/** Padrão que identifica links WhatsApp */
const WA_PATTERN = /wa\.me|api\.whatsapp\.com/i;

/** Dispara evento GA4 de conversão por clique no WhatsApp */
function fireGA4Lead(): void {
    if (typeof window === 'undefined') return;
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;

    gtag('event', 'generate_lead', {
        event_category: 'engagement',
        event_label: 'whatsapp_click',
        value: 1,
    });
}

/**
 * Sobe pelo DOM a partir do elemento clicado até encontrar
 * um <a> com href de WhatsApp (suporta clique em ícone/span dentro do <a>).
 */
function findWhatsAppAnchor(target: EventTarget | null): boolean {
    let el = target as HTMLElement | null;
    while (el && el !== document.body) {
        if (el.tagName === 'A') {
            const href = (el as HTMLAnchorElement).href ?? '';
            return WA_PATTERN.test(href);
        }
        el = el.parentElement;
    }
    return false;
}

/** Handler global instalado no document */
function handleDocumentClick(event: MouseEvent): void {
    if (findWhatsAppAnchor(event.target)) {
        fireGA4Lead();
    }
}

/**
 * Hook a ser usado UMA vez no _app.tsx.
 * Instala / remove listener no ciclo de vida do app.
 */
export function useWhatsAppTracking(): void {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        document.addEventListener('click', handleDocumentClick, { capture: true });

        return () => {
            document.removeEventListener('click', handleDocumentClick, { capture: true });
        };
    }, []); // sem dependências → executa só no mount/unmount do App
}
