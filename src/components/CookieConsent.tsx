'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export const COOKIE_CONSENT_KEY = 'arthemi_cookie_consent';

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already made a choice
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consent) {
            // Show banner after a small delay for better UX
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
        setIsVisible(false);
        // Reload to activate pixels immediately
        window.location.reload();
    };

    const handleReject = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-full duration-500">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-warm-200 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">

                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-bold text-primary-900 mb-2">
                            Valorizamos sua privacidade
                        </h3>
                        <p className="text-secondary-600 text-sm leading-relaxed">
                            Utilizamos cookies para melhorar sua experiência e analisar o tráfego do site.
                            As informações sobre o seu uso do site são compartilhadas com nossos parceiros de publicidade e análise.
                            Ao clicar em &quot;Aceitar&quot;, você concorda com nossa{' '}
                            <Link href="/privacidade" className="text-accent-600 hover:underline font-medium">
                                Política de Privacidade
                            </Link>.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto min-w-[300px]">
                        <button
                            onClick={handleReject}
                            className="px-6 py-3 rounded-xl text-primary-700 font-semibold hover:bg-warm-100 transition-colors border border-warm-200"
                        >
                            Rejeitar
                        </button>
                        <button
                            onClick={handleAccept}
                            className="px-6 py-3 rounded-xl bg-accent-600 text-white font-bold hover:bg-accent-700 shadow-lg shadow-accent-500/30 transition-all hover:-translate-y-0.5 flex-1"
                        >
                            Aceitar Cookies
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
