// ===========================================================
// Página /lp-promo - Landing Page Matadora de Conversão (CRO v2)
// ===========================================================

import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import RoomGalleryModal from '@/components/RoomGalleryModal';
import LeadFormModal from '@/components/LeadFormModal';
import SEO from '@/components/SEO';
import Layout from '@/components/Layout';
import { formatCurrency } from '@/lib/utils';
import { PRICES_V3, formatPrice } from '@/constants/prices';
import {
    CheckCircle2,
    Eye,
    MessageCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    Clock,
    Coffee,
    Wifi,
    Sparkles,
    Users,
    Star,
    MapPin,
    HelpCircle,
    ArrowRight,
    X,
    Calendar,
    Building2,
    UserCheck,
} from 'lucide-react';

import { WHATSAPP_NUMBER } from '@/config/contact';
import { BUSINESS_INFO } from '@/constants/seo';

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    hoursIncluded: number | null;
    type: string;
    roomId: string | null;
}

interface Room {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    capacity: number;
    amenities: string[];
    hourlyRate: number;
    products: Product[];
}

interface LPPromoPageProps {
    rooms: any[];
}

export default function LPPromoPage({ rooms }: LPPromoPageProps) {
    const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string } | null>(null);
    const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
    const [selectedRoomName, setSelectedRoomName] = useState('');
    const [activeFaq, setActiveFaq] = useState<number | null>(0);


    // Mini-triagem state
    const [triagemNome, setTriagemNome] = useState('');
    const [triagemProfissao, setTriagemProfissao] = useState('');
    const [triagemConsultorio, setTriagemConsultorio] = useState('');
    const [triagemHoras, setTriagemHoras] = useState('');
    const [hideMobileCta, setHideMobileCta] = useState(false);

    // Intersection Observer — scroll reveal + hide mobile CTA near footer
    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const observer = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
            { threshold: 0.12 }
        );
        els.forEach(el => observer.observe(el));

        // Hide mobile CTA when any section with a prominent button is visible
        const watchIds = ['hero', 'como-funciona-cta', 'triagem', 'cta-final-section', 'footer-main'];
        const ctaObserver = new IntersectionObserver(
            (entries) => {
                const anyVisible = entries.some(e => e.isIntersecting);
                setHideMobileCta(anyVisible);
            },
            { threshold: 0.1 }
        );
        watchIds.forEach(id => {
            const el = document.getElementById(id) || (id === 'footer-main' ? document.querySelector('footer') : null);
            if (el) ctaObserver.observe(el);
        });

        return () => { observer.disconnect(); ctaObserver.disconnect(); };
    }, []);



    // Tracking Scroll
    useEffect(() => {
        let fired50 = false;
        let fired90 = false;

        const handleScroll = () => {
            const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
            if (scrollPercent >= 0.5 && !fired50) {
                trackEvent('scroll_50');
                fired50 = true;
            }
            if (scrollPercent >= 0.9 && !fired90) {
                trackEvent('scroll_90');
                fired90 = true;
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const trackEvent = (eventName: string, params: any = {}) => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', eventName, params);
        }
        if (typeof window !== 'undefined' && (window as any).fbq) {
            if (eventName === 'clique_reservar') {
                (window as any).fbq('track', 'Contact', {
                    content_name: params.room || 'Geral',
                    content_category: 'WhatsApp Click',
                    ...params
                });
            } else {
                (window as any).fbq('trackCustom', eventName, params);
            }
        }
    };

    const trackWhatsAppClick = (intent: string, ctaId: string) => {
        let fired = false;
        return (message: string) => {
            if (fired) return;
            fired = true;

            const payload = {
                page_path: typeof window !== 'undefined' ? window.location.pathname : '',
                intent,
                cta_id: ctaId
            };

            // Dispara evento oficial e o antigo como fallback
            if (typeof window !== 'undefined' && (window as any).gtag) {
                (window as any).gtag('event', 'clique_whatsapp', payload);
                (window as any).gtag('event', 'whatsapp_click', payload);
            }

            if (typeof window !== 'undefined' && (window as any).fbq) {
                (window as any).fbq('track', 'Lead', payload);
                (window as any).fbq('track', 'Contact', payload); // compatibilidade
            }

            setTimeout(() => {
                window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
            }, 200);
        };
    };

    const handleOpenBooking = (roomName: string) => {
        trackEvent('clique_reservar', { room: roomName });
        setSelectedRoomName(roomName);
        setIsLeadFormOpen(true);
    };

    const handleOpenWhatsApp = (intent: 'horarios' | 'visita', locationStr: string) => {
        trackEvent('cta_para_triagem', { intent, source: locationStr });
        scrollToTriagem();
    };

    const scrollToTriagem = () => {
        const el = document.getElementById('triagem');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleOpenGallery = (galleryData: { name: string; slug: string }) => {
        trackEvent('clique_fotos', { room: galleryData.name });
        setGalleryRoom(galleryData);
    };

    const faqs = [
        {
            q: "Tem contrato de fidelidade?",
            a: "Não. Você reserva por hora e usa quando quiser, sem vínculos ou multas."
        },
        {
            q: "Tem taxa de adesão?",
            a: "Não. Nenhuma taxa para começar. Você paga só pelo tempo reservado."
        },
        {
            q: "Posso cancelar ou remarcar?",
            a: "Sim. Cancelamentos e remarcações são aceitos com até 48h de antecedência, sem custo."
        },
        {
            q: "Atende aos sábados?",
            a: "Sim. Temos disponibilidade aos sábados — consulte pelo WhatsApp."
        },
        {
            q: "Emite nota fiscal ou recibo?",
            a: "Sim. Emitimos documento fiscal conforme o serviço contratado."
        },
        {
            q: "O que está incluso na reserva?",
            a: "Recepção para seus pacientes, limpeza entre atendimentos, Wi-Fi, café e água. Sem cobranças extras."
        },
    ];

    const handleTriagemWhatsApp = () => {
        const nome = triagemNome || 'não informado';
        const profissao = triagemProfissao || 'não informada';
        const consultorio = triagemConsultorio || 'não informado';
        const horas = triagemHoras || 'não informado';
        
        const msg = `Olá! Gostaria de consultar a disponibilidade e valores. Aqui estão meus dados para agilizar o atendimento:

👤 *Nome:* ${nome}
💼 *Profissão:* ${profissao}
🏢 *Consultório que mais gostei:* ${consultorio}
⏱️ *Pretendo atender (por semana):* ${horas}

Fico no aguardo!`;

        trackWhatsAppClick('mini_triagem', 'cta-triagem-whatsapp')(msg);
    };

    // Todas as fotos misturadas — layout colagem (8 fotos)
    const collagePhotos = [
        { src: "/images/espaco/Recepcao-01.jpeg", alt: "Recepção", slug: "espaco" },
        { src: "/images/sala-a/foto-4.jpeg", alt: "Consultório 1", slug: "sala-a" },
        { src: "/images/sala-c/03-1.jpeg", alt: "Consultório 3", slug: "sala-c" },
        { src: "/images/sala-b/02-3.jpeg", alt: "Consultório 2", slug: "sala-b" },
        { src: "/images/espaco/Recepcao-02.jpeg", alt: "Recepção", slug: "espaco" },
        { src: "/images/sala-a/foto-2.jpeg", alt: "Consultório 1", slug: "sala-a" },
        { src: "/images/sala-b/02-1.jpeg", alt: "Consultório 2", slug: "sala-b" },
        { src: "/images/sala-c/03-2.jpeg", alt: "Consultório 3", slug: "sala-c" },
    ];

    // Alturas variadas para efeito de colagem
    const collageHeights = ['h-56', 'h-40', 'h-64', 'h-44', 'h-60', 'h-36', 'h-52', 'h-48'];

    const STATIC_ROOMS = [
        {
            id: 'sala-a',
            slug: 'sala-a',
            name: PRICES_V3.SALA_A.name,
            subtitle: PRICES_V3.SALA_A.subtitle,
            imageUrl: '/images/sala-a/foto-4.jpeg',
            badge: 'Mais espaço',
            hourlyRate: Math.round(PRICES_V3.SALA_A.prices.HOURLY_RATE * 100),
            packages: [
                { hours: 10, total: Math.round(PRICES_V3.SALA_A.prices.PACKAGE_10H * 100) },
                { hours: 20, total: Math.round(PRICES_V3.SALA_A.prices.PACKAGE_20H * 100) },
                { hours: 40, total: Math.round(PRICES_V3.SALA_A.prices.PACKAGE_40H * 100) },
            ],
        },
        {
            id: 'sala-b',
            slug: 'sala-b',
            name: PRICES_V3.SALA_B.name,
            subtitle: PRICES_V3.SALA_B.subtitle,
            imageUrl: '/images/sala-b/02-3.jpeg',
            badge: 'Mais procurado',
            hourlyRate: Math.round(PRICES_V3.SALA_B.prices.HOURLY_RATE * 100),
            packages: [
                { hours: 10, total: Math.round(PRICES_V3.SALA_B.prices.PACKAGE_10H * 100) },
                { hours: 20, total: Math.round(PRICES_V3.SALA_B.prices.PACKAGE_20H * 100) },
                { hours: 40, total: Math.round(PRICES_V3.SALA_B.prices.PACKAGE_40H * 100) },
            ],
        },
        {
            id: 'sala-c',
            slug: 'sala-c',
            name: PRICES_V3.SALA_C.name,
            subtitle: PRICES_V3.SALA_C.subtitle,
            imageUrl: '/images/sala-c/03-1.jpeg',
            badge: 'Melhor custo-benefício',
            hourlyRate: Math.round(PRICES_V3.SALA_C.prices.HOURLY_RATE * 100),
            packages: [
                { hours: 10, total: Math.round(PRICES_V3.SALA_C.prices.PACKAGE_10H * 100) },
                { hours: 20, total: Math.round(PRICES_V3.SALA_C.prices.PACKAGE_20H * 100) },
                { hours: 40, total: Math.round(PRICES_V3.SALA_C.prices.PACKAGE_40H * 100) },
            ],
        },
    ];


    return (
        <>
            <SEO
                title="Consultório por hora na área hospitalar de BH | Espaço Arthemi"
                description="Atenda seus pacientes em consultório completo sem precisar de clínica própria. Reserva por hora, recepção incluída, sem contrato. Área hospitalar de BH."
                path="/lp-promo"
            />

            <Layout noHeader noFooter className="bg-white lp-promo">
                {/* ============= HEADER ============= */}
                {/* ============= HEADER ============= */}
                <header className="sticky top-0 z-50 bg-warm-50/90 backdrop-blur-xl border-b border-warm-200">
                    <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
                        <Image
                            src="/images/Logo/logo.webp"
                            alt="Espaço Arthemi"
                            width={110}
                            height={44}
                            className="h-8 w-auto"
                            priority
                        />
                        <button
                            id="header-cta-whatsapp"
                            onClick={() => {
                                const el = document.getElementById('secao-precos');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors shadow-md"
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Ver consultórios
                        </button>
                    </div>
                </header>

                {/* ============= 1) HERO ============= */}
                <section id="hero" className="relative min-h-[90vh] sm:min-h-[85vh] flex items-center overflow-hidden">

                    {/* Foto de fundo — next/image otimizada */}
                    <Image
                        src="/images/espaco/Recepcao-01.jpeg"
                        alt="Espaço Arthemi — Recepção"
                        fill
                        priority
                        quality={85}
                        sizes="100vw"
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />

                    {/* Overlay — mais forte no mobile pra legibilidade */}
                    <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to right, rgba(28,20,14,0.86) 0%, rgba(28,20,14,0.60) 50%, rgba(28,20,14,0.20) 100%)' }} />
                    <div className="absolute inset-0 z-[1] sm:hidden" style={{ background: 'linear-gradient(to bottom, rgba(20,14,10,0.44) 0%, rgba(20,14,10,0.86) 100%)' }} />
                    <div className="absolute inset-0 z-[1] hidden sm:block" style={{ background: 'linear-gradient(to top, rgba(28,20,14,0.55) 0%, transparent 55%)' }} />

                    {/* Conteúdo */}
                    <div className="relative z-10 max-w-6xl mx-auto px-4 w-full py-20 sm:py-32">
                        <div className="max-w-2xl">
                            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/12 border border-white/25 text-white text-[10px] sm:text-xs font-bold mb-5 uppercase tracking-[0.14em] backdrop-blur-sm">
                                Área Hospitalar de BH · Santa Efigênia
                            </span>

                            <h1 className="text-[38px] sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.02] mb-5 tracking-tight">
                                Seu consultório pronto
                                <br />
                                <span className="text-accent-400">para atender.</span>
                            </h1>

                            <p className="text-[21px] sm:text-lg text-white/85 mb-8 leading-relaxed max-w-xl">
                                Sem clínica própria, sem custo fixo alto. Reserve por hora na área hospitalar de BH e pague só pelo uso.
                            </p>

                            {/* HERO: 1 CTA Principal */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    id="cta-hero-precos"
                                    onClick={() => {
                                        const el = document.getElementById('secao-precos');
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className="w-full sm:w-auto bg-accent-600 hover:bg-accent-700 text-white px-8 py-[18px] rounded-2xl font-bold text-base sm:text-lg shadow-2xl shadow-accent-900/25 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Building2 className="w-5 h-5" />
                                    Ver preços e escolher consultório
                                </button>
                            </div>
                            <p className="text-sm text-white/75 mt-3 max-w-md">
                                Conheça nossos consultórios e encontre o espaço ideal para sua rotina.
                            </p>

                            {/* Quick proof */}
                            <div className="mt-9 sm:mt-12 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-5 sm:items-center pt-2">
                                <div className="inline-flex w-fit items-center gap-2 px-3.5 py-2 rounded-full border border-white/25 bg-white/12 backdrop-blur-sm shadow-lg">
                                    <div className="flex text-yellow-400">
                                        {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />)}
                                    </div>
                                    <span className="text-xs sm:text-sm font-semibold text-white/95">4,9 no Google</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/85 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                                    Sem contrato de fidelidade
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seta de scroll */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center text-white/40 animate-bounce">
                        <ChevronDown className="w-6 h-6" />
                    </div>
                </section>

                {/* ============= 2) COMO FUNCIONA ============= */}
                <section id="como-funciona" data-section="como-funciona" className="py-24 border-y border-warm-200 relative overflow-hidden" style={{ backgroundColor: '#faf8f5' }}>
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none' stroke='%23715d4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M30 25h10v-10h10v10h10v10h-10v10h-10v-10h-10z'/%3E%3Crect x='90' y='20' width='14' height='28' rx='7' transform='rotate(45 97 34)'/%3E%3Cline x1='87' y1='34' x2='107' y2='34' transform='rotate(45 97 34)'/%3E%3Ccircle cx='90' cy='45' r='3'/%3E%3Cpath d='M135 30a8 8 0 0 1 16 0c0 9-12 15-16 22c-4-7-16-13-16-22a8 8 0 0 1 16 0z'/%3E%3Cpolyline points='120 37,130 37,133 30,137 43,140 37,150 37'/%3E%3Cpath d='M25 80a15 15 0 0 0 30 0v-15'/%3E%3Ccircle cx='25' cy='65' r='3'/%3E%3Ccircle cx='55' cy='65' r='3'/%3E%3Cpath d='M40 95v15'/%3E%3Ccircle cx='40' cy='115' r='5'/%3E%3Crect x='85' y='75' width='12' height='30' rx='2' transform='rotate(-45 91 90)'/%3E%3Cpath d='M130 85a10 10 0 0 1 10 10v15h-15v-5'/%3E%3Cpath d='M25 140h6v-6h4v6h6v4h-6v6h-4v-6h-6z'/%3E%3Cpath d='M125 130c15 10 15 20 0 30'/%3E%3Cpath d='M145 130c-15 10-15 20 0 30'/%3E%3C/svg%3E")`, backgroundSize: '160px' }} />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-400/50 to-transparent" />
                    <div className="max-w-5xl mx-auto px-4 relative z-10">
                        <div className="text-center mb-14 reveal">
                            <span className="inline-block text-green-700 text-[10px] font-bold tracking-[0.25em] uppercase mb-3 border border-green-200 bg-green-50 px-3 py-1 rounded-full">Passo a passo</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">Como funciona?</h2>
                            <p className="text-secondary-600 text-lg">Sem burocracia: você chama no WhatsApp, escolhe horário e já sai com sua reserva confirmada.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                            {[
                                {
                                    step: "01",
                                    icon: MessageCircle,
                                    title: "Chama no WhatsApp oficial",
                                    desc: "Você fala com a equipe e já recebe opções de horários, valores e qual consultório faz mais sentido para sua rotina."
                                },
                                {
                                    step: "02",
                                    icon: Building2,
                                    title: "Escolhe como começar",
                                    desc: "Você decide se quer visitar primeiro ou reservar direto. Se já quiser agilizar, fechamos tudo no atendimento."
                                },
                                {
                                    step: "03",
                                    icon: Calendar,
                                    title: "Recebe link e confirma",
                                    desc: "Enviamos o link oficial de agendamento e pagamento (PIX/link). A reserva é confirmada após a compensação."
                                },
                                {
                                    step: "04",
                                    icon: UserCheck,
                                    title: "Vem atender com tudo pronto",
                                    desc: "No dia, o consultório está pronto para uso. Recepção, limpeza e suporte já estão incluídos para você focar no paciente."
                                },
                            ].map((item, i) => (
                                <div key={i} className={`reveal reveal-delay-${i + 1} card-lift relative flex flex-col items-center text-center p-7 rounded-2xl border border-warm-200 group`} style={{ background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
                                    <div className="text-6xl font-black text-accent-400/40 mb-2 leading-none group-hover:text-accent-500/60 transition-colors">{item.step}</div>
                                    <div className="w-12 h-12 rounded-2xl bg-accent-100 border border-accent-200 shadow-sm flex items-center justify-center mb-4">
                                        <item.icon className="w-6 h-6 text-accent-700" />
                                    </div>
                                    <h3 className="text-lg font-bold text-primary-950 mb-2 tracking-tight">{item.title}</h3>
                                    <p className="text-sm text-secondary-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div id="como-funciona-cta" className="text-center mt-10">
                            <p className="text-secondary-500 text-sm mb-4">
                                Pode reagendar sem perda com 48h de antecedência. Em caso de dúvida, respondemos na hora pelo WhatsApp.
                            </p>
                            <button
                                id="cta-como-funciona-precos"
                                onClick={() => {
                                    const el = document.getElementById('secao-precos');
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white px-7 py-4 rounded-xl font-bold text-base shadow-lg transition-colors"
                            >
                                <Building2 className="w-5 h-5" />
                                Ver consultórios disponíveis
                            </button>
                        </div>
                    </div>
                </section>

                {/* ============= 3) FOTOS DO ESPAÇO ============= */}
                <section className="py-16 bg-primary-950 relative texture-diamonds">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">O espaço por dentro</h2>
                            <p className="text-primary-200/80">Recepção profissional, consultórios decorados e ambiente preparado para seus pacientes.</p>
                        </div>

                        {/* Colagem masonry — alturas variadas, sem separadores */}
                        <div className="columns-2 md:columns-3 gap-3">
                            {collagePhotos.map((photo, i) => (
                                <div
                                    key={i}
                                    className={`break-inside-avoid mb-3 overflow-hidden rounded-2xl group cursor-pointer relative ${collageHeights[i % collageHeights.length]}`}
                                    onClick={() => handleOpenGallery({ name: photo.alt, slug: photo.slug })}
                                >
                                    <Image
                                        src={photo.src}
                                        alt={photo.alt}
                                        fill
                                        loading={i < 6 ? 'eager' : 'lazy'}
                                        sizes="(max-width: 768px) 50vw, 33vw"
                                        quality={85}
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-xs text-secondary-400 mt-6">
                            Clique em qualquer foto para ampliar
                        </p>
                    </div>
                </section>


                {/* ============= 4) PARA QUEM É ============= */}
                < section className="py-24 bg-primary-900 relative texture-diamonds" >
                    <div className="absolute inset-0 bg-gradient-to-tr from-accent-600/5 via-transparent to-transparent pointer-events-none" />
                    <div className="max-w-5xl mx-auto px-4">
                        <div className="text-center mb-12 reveal">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Para quem é a Arthemi?</h2>
                            <p className="text-primary-200/80 text-lg">Para profissionais de saúde que querem atender bem sem os custos de uma clínica própria.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Psicólogos", desc: "Salas silenciosas e privativas para sessões com total sigilo." },
                                { label: "Nutricionistas", desc: "Espaço adequado para anamnese, avaliações e acompanhamento." },
                                { label: "Fisioterapeutas", desc: "Consultórios com maca profissional e espaço para movimentação." },
                                { label: "Médicos e Especialistas", desc: "Localização na área hospitalar de BH, estrutura compatível." },
                            ].map((item, i) => (
                                <div key={i} className={`reveal reveal-delay-${i + 1} p-6 rounded-2xl bg-white/5 border border-white/10 hover:-translate-y-2 transition-all duration-300`}>
                                    <h4 className="text-base font-bold text-white mb-2">{item.label}</h4>
                                    <p className="text-xs text-primary-200/70 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>


                    </div>
                </section>

                {/* ============= 5) O QUE ESTÁ INCLUSO ============= */}
                <section data-section="incluso" className="py-24 border-y border-warm-200 relative overflow-hidden" style={{ backgroundColor: '#fdfcfb' }}>
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.035, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none' stroke='%23715d4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M30 25h10v-10h10v10h10v10h-10v10h-10v-10h-10z'/%3E%3Crect x='90' y='20' width='14' height='28' rx='7' transform='rotate(45 97 34)'/%3E%3Cline x1='87' y1='34' x2='107' y2='34' transform='rotate(45 97 34)'/%3E%3Ccircle cx='90' cy='45' r='3'/%3E%3Cpath d='M135 30a8 8 0 0 1 16 0c0 9-12 15-16 22c-4-7-16-13-16-22a8 8 0 0 1 16 0z'/%3E%3Cpolyline points='120 37,130 37,133 30,137 43,140 37,150 37'/%3E%3Cpath d='M25 80a15 15 0 0 0 30 0v-15'/%3E%3Ccircle cx='25' cy='65' r='3'/%3E%3Ccircle cx='55' cy='65' r='3'/%3E%3Cpath d='M40 95v15'/%3E%3Ccircle cx='40' cy='115' r='5'/%3E%3Crect x='85' y='75' width='12' height='30' rx='2' transform='rotate(-45 91 90)'/%3E%3Cpath d='M130 85a10 10 0 0 1 10 10v15h-15v-5'/%3E%3Cpath d='M25 140h6v-6h4v6h6v4h-6v6h-4v-6h-6z'/%3E%3Cpath d='M125 130c15 10 15 20 0 30'/%3E%3Cpath d='M145 130c-15 10-15 20 0 30'/%3E%3C/svg%3E")`, backgroundSize: '160px' }} />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-400/50 to-transparent" />
                    <div className="max-w-6xl mx-auto px-4 relative z-10">
                        <div className="text-center mb-14 reveal">
                            <span className="inline-block text-green-700 text-[10px] font-bold tracking-[0.25em] uppercase mb-3 border border-green-200 bg-green-50 px-3 py-1 rounded-full">Tudo incluso</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">O que está incluso em toda reserva</h2>
                            <p className="text-secondary-600 text-lg">Você não paga nada além da hora reservada.</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                            {[
                                { icon: Users, title: "Recepção", desc: "Profissional para recepcionar seus pacientes." },
                                { icon: Sparkles, title: "Limpeza", desc: "Higienização do consultório entre cada uso." },
                                { icon: Wifi, title: "Wi-Fi", desc: "Internet de alta velocidade incluída." },
                                { icon: Coffee, title: "Café e água", desc: "Para você e seus pacientes." },
                                { icon: ShieldCheck, title: "Sem contrato", desc: "Sem fidelidade e sem taxa de adesão." },
                                { icon: Clock, title: "Flexibilidade", desc: "Reserve por hora conforme sua agenda." },
                                { icon: CheckCircle2, title: "Endereço profissional", desc: "Área hospitalar de BH — Santa Efigênia." },
                            ].map((item, i) => (
                                <div key={i} className={`reveal reveal-delay-${(i % 4) + 1} card-lift p-6 rounded-2xl border border-warm-200 flex flex-col gap-3 group`} style={{ background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
                                    <div className="w-12 h-12 rounded-xl bg-accent-100 border border-accent-200 flex items-center justify-center group-hover:bg-accent-200 transition-colors duration-300">
                                        <item.icon className="w-5 h-5 text-accent-700" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary-950 text-sm tracking-tight">{item.title}</p>
                                        <p className="text-xs text-secondary-500 mt-1 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 6) VALORES E CONSULTÓRIOS ============= */}
                {/* ============= 6) VALORES E CONSULTÓRIOS ============= */}
                <section id="secao-precos" data-section="precos" className="py-24 relative overflow-hidden" style={{ backgroundColor: '#faf8f5' }}>
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-400/50 to-transparent" />
                    <div className="max-w-6xl mx-auto px-4 relative z-10">

                        {/* Introdução editorial */}
                        <div className="max-w-2xl mx-auto text-center mb-16">
                            <span className="inline-block text-green-700 text-[10px] font-bold tracking-[0.25em] uppercase mb-3 border border-green-200 bg-green-50 px-3 py-1 rounded-full">Nossos consultórios</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-4">
                                Escolha o consultório ideal para a sua rotina
                            </h2>
                            <p className="text-secondary-600 text-lg leading-relaxed mb-4">
                                A Arthemi oferece 3 opções de consultório com condições flexíveis para quem quer começar a atender com estrutura profissional, sem assumir os custos de uma clínica própria.
                            </p>
                            <p className="text-sm text-secondary-500 flex items-start justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-accent-600 mt-0.5" />
                                Recepção, limpeza entre atendimentos, Wi-Fi, café e água já incluídos.
                            </p>
                        </div>

                        {/* Grid de Consultórios — 1 col mobile, 3 col desktop */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            {STATIC_ROOMS.map((room) => {
                                const roomTitle = room.name;
                                const pkg10h = room.packages.find(p => p.hours === 10)?.total ? formatCurrency(room.packages.find(p => p.hours === 10)!.total) : '—';
                                const pkg20h = room.packages.find(p => p.hours === 20)?.total ? formatCurrency(room.packages.find(p => p.hours === 20)!.total) : '—';
                                const pkg40h = room.packages.find(p => p.hours === 40)?.total ? formatCurrency(room.packages.find(p => p.hours === 40)!.total) : '—';
                                const savings40h = room.hourlyRate * 40 - (room.packages.find(p => p.hours === 40)?.total || 0);
                                const savings = savings40h > 0 ? `Pacote 40h economiza ${formatCurrency(savings40h)} vs hora avulsa.` : '';

                                return (
                                    <div key={room.id} className="reveal card-lift rounded-[2rem] overflow-hidden border border-warm-200 group flex flex-col" style={{ background: '#fff', boxShadow: '0 6px 24px rgba(0,0,0,0.09)' }}>

                                        {/* Foto */}
                                        <div className="relative h-64 cursor-pointer overflow-hidden flex-shrink-0" onClick={() => handleOpenGallery({ name: room.name, slug: room.slug })}>
                                            <Image
                                                src={room.imageUrl || '/images/espaco/Recepcao-01.jpeg'}
                                                alt={roomTitle}
                                                fill
                                                loading="lazy"
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                quality={90}
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                            {/* Badge sóbrio */}
                                            {room.badge && (
                                                <div className="absolute top-4 left-4 bg-accent-100 text-accent-800 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm border border-accent-200">
                                                    {room.badge}
                                                </div>
                                            )}
                                            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-white/90 text-xs font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                                <Eye className="w-3.5 h-3.5" /> Ver fotos
                                            </div>
                                        </div>

                                        {/* Conteúdo */}
                                        <div className="p-7 flex-1 flex flex-col">
                                            <div className="mb-5">
                                                <p className="text-xs font-bold tracking-[0.15em] uppercase text-accent-600 mb-1">{room.subtitle}</p>
                                                <h3 className="text-xl font-extrabold text-primary-950 leading-tight tracking-tight">{room.name}</h3>
                                            </div>

                                            {/* Preço principal */}
                                            <div className="mb-6 pb-6 border-b border-warm-100/80">
                                                <p className="text-xs text-secondary-400 font-medium mb-1 tracking-wide uppercase">A partir de</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-primary-950">{formatCurrency(room.hourlyRate)}</span>
                                                    <span className="text-secondary-400 font-medium text-sm">/ hora</span>
                                                </div>
                                                <p className="text-[11px] text-accent-600 font-semibold mt-1.5 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> Condição especial para começar
                                                </p>
                                            </div>

                                            {/* Tabela de pacotes */}
                                            <div className="space-y-3 mb-5 flex-1">
                                                {[
                                                    { label: 'Pacote 10h', value: pkg10h },
                                                    { label: 'Pacote 20h', value: pkg20h },
                                                    { label: 'Pacote 40h', value: pkg40h },
                                                ].map((pkg, pi) => (
                                                    <div key={pi} className="flex justify-between items-center text-sm py-1.5 border-b border-warm-50 last:border-0">
                                                        <span className="text-secondary-500">{pkg.label}</span>
                                                        <span className="font-semibold text-primary-950">{pkg.value}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Microcopy de vantagem por volume */}
                                            {savings && (
                                                <p className="text-[11px] text-secondary-400 mb-5 flex items-center gap-1.5">
                                                    <span className="inline-block w-3 h-[1px] bg-secondary-300 flex-shrink-0" />
                                                    {savings}
                                                </p>
                                            )}

                                            {/* CTAs do card */}
                                            <button
                                                id={`cta-quero-${room.slug}`}
                                                onClick={() => {
                                                    trackEvent('cta_para_triagem', { intent: `consultorio_${room.slug.replace('sala-', '')}`, source: `cta-quero-${room.slug}` });
                                                    scrollToTriagem();
                                                }}
                                                className="w-full cta-whatsapp py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 group/btn mt-auto mb-2"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                Quero este consultório
                                            </button>
                                            <button
                                                id={`cta-preco-${room.slug}`}
                                                onClick={() => {
                                                    trackEvent('cta_para_triagem', { intent: `consultorio_${room.slug.replace('sala-', '')}_precos`, source: `cta-preco-${room.slug}` });
                                                    scrollToTriagem();
                                                }}
                                                className="w-full bg-white text-primary-950 border border-warm-200 py-3 rounded-xl font-semibold text-sm hover:bg-warm-50 transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                Consultar disponibilidade
                                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Nota de rodapé */}
                        <p className="text-center text-sm text-secondary-400 mt-10">
                            Valores para dias úteis (seg–sex). Atendimentos aos sábados — consulte pelo WhatsApp.
                        </p>
                    </div>
                </section>

                {/* ============= MINI-TRIAGEM ============= */}
                < section id="triagem" className="py-14 bg-primary-950 relative overflow-hidden texture-diamonds" >
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160' viewBox='0 0 180 160' fill='none' stroke='white' stroke-width='1'%3E%3Cpolygon points='45,15 63,25 63,45 45,55 27,45 27,25'/%3E%3Cpolygon points='135,15 153,25 153,45 135,55 117,45 117,25'/%3E%3Cpolygon points='90,60 108,70 108,90 90,100 72,90 72,70'/%3E%3Cpolygon points='45,105 63,115 63,135 45,145 27,135 27,115'/%3E%3Cpolygon points='135,105 153,115 153,135 135,145 117,135 117,115'/%3E%3Cline x1='63' y1='35' x2='72' y2='70' stroke-width='0.7'/%3E%3Cline x1='117' y1='35' x2='108' y2='70' stroke-width='0.7'/%3E%3Cline x1='72' y1='90' x2='63' y2='115' stroke-width='0.7'/%3E%3Cline x1='108' y1='90' x2='117' y2='115' stroke-width='0.7'/%3E%3Ccircle cx='67.5' cy='52.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='112.5' cy='52.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='67.5' cy='102.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='112.5' cy='102.5' r='2' fill='white' stroke='none'/%3E%3Crect x='42' y='30' width='6' height='2' fill='white' stroke='none'/%3E%3Crect x='44' y='28' width='2' height='6' fill='white' stroke='none'/%3E%3Crect x='87' y='78' width='6' height='2' fill='white' stroke='none'/%3E%3Crect x='89' y='76' width='2' height='6' fill='white' stroke='none'/%3E%3Cpath d='M131,28a4,4 0 0 1 8,0c0 5-8 10-8 10s-8-5-8-10a4,4 0 0 1 8,0z' fill='white' stroke='none'/%3E%3Cline x1='45' y1='118' x2='45' y2='131' stroke-width='1.5'/%3E%3Cline x1='38.5' y1='124.5' x2='51.5' y2='124.5' stroke-width='1.5'/%3E%3Cline x1='41' y1='120' x2='49' y2='129' stroke-width='1'/%3E%3Cline x1='49' y1='120' x2='41' y2='129' stroke-width='1'/%3E%3Crect x='132' y='121' width='6' height='2' fill='white' stroke='none'/%3E%3Crect x='134' y='119' width='2' height='6' fill='white' stroke='none'/%3E%3C/svg%3E")`, backgroundSize: '180px' }} />
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold text-white mb-2">Já sabe o que precisa?</h2>
                            <p className="text-primary-200/70 text-sm">Preencha seus dados rápidos para agilizarmos seu atendimento no WhatsApp.</p>
                        </div>

                        <div className="relative bg-gradient-to-b from-white/[0.10] to-white/[0.03] rounded-3xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.30)] backdrop-blur-md p-6 sm:p-8 space-y-6 overflow-hidden">
                            <div className="pointer-events-none absolute -top-14 -right-14 w-40 h-40 rounded-full bg-accent-500/15 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-green-500/15 blur-3xl" />
                            
                            {/* Pergunta 1 */}
                            <div className="relative z-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
                                <p className="text-sm font-bold text-white mb-3">Nome:</p>
                                <input
                                    type="text"
                                    placeholder="Seu nome"
                                    value={triagemNome}
                                    onChange={(e) => setTriagemNome(e.target.value)}
                                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-accent-400 focus:bg-white/10 transition-colors"
                                />
                            </div>

                            {/* Pergunta 2 */}
                            <div className="relative z-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
                                <p className="text-sm font-bold text-white mb-3">Profissão:</p>
                                <input
                                    type="text"
                                    placeholder="Ex: Psicólogo, Nutricionista..."
                                    value={triagemProfissao}
                                    onChange={(e) => setTriagemProfissao(e.target.value)}
                                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-accent-400 focus:bg-white/10 transition-colors"
                                />
                            </div>

                            {/* Pergunta 3 */}
                            <div className="relative z-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
                                <p className="text-sm font-bold text-white mb-3">Qual consultório gostou mais?</p>
                                <div className="flex flex-wrap gap-2">
                                    {['Consultório 1', 'Consultório 2', 'Consultório 3', 'Ainda não sei'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setTriagemConsultorio(opt)}
                                            className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all ${triagemConsultorio === opt
                                                ? 'bg-accent-600 text-white border-accent-500 shadow-md shadow-accent-900/30'
                                                : 'bg-white/5 text-white/85 border-white/20 hover:border-accent-300 hover:bg-white/10'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pergunta 4 */}
                            <div className="relative z-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
                                <p className="text-sm font-bold text-white mb-3">Quantas horas por semana pretende atender?</p>
                                <div className="flex flex-wrap gap-2">
                                    {['1–2h', '3–5h', '6h+'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setTriagemHoras(opt)}
                                            className={`px-6 py-2.5 rounded-full text-sm font-semibold border transition-all ${triagemHoras === opt
                                                ? 'bg-accent-600 text-white border-accent-500 shadow-md shadow-accent-900/30'
                                                : 'bg-white/5 text-white/85 border-white/20 hover:border-accent-300 hover:bg-white/10'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                id="cta-triagem-whatsapp"
                                onClick={handleTriagemWhatsApp}
                                className="relative z-10 w-full cta-whatsapp py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 hover:-translate-y-0.5 transition-transform"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Enviar no WhatsApp
                            </button>
                            <p className="relative z-10 text-center text-xs text-primary-200/60">Somente aqui você abre o WhatsApp com sua triagem preenchida para atendimento mais rápido.</p>
                        </div>
                    </div>
                </section>






                {/* ============= 7) DEPOIMENTOS ============= */}
                < section className="py-20 bg-primary-900 border-t border-primary-800 relative overflow-hidden texture-diamonds" >
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160' viewBox='0 0 180 160' fill='none' stroke='white' stroke-width='1'%3E%3Cpolygon points='45,15 63,25 63,45 45,55 27,45 27,25'/%3E%3Cpolygon points='135,15 153,25 153,45 135,55 117,45 117,25'/%3E%3Cpolygon points='90,60 108,70 108,90 90,100 72,90 72,70'/%3E%3Cpolygon points='45,105 63,115 63,135 45,145 27,135 27,115'/%3E%3Cpolygon points='135,105 153,115 153,135 135,145 117,135 117,115'/%3E%3Cline x1='63' y1='35' x2='72' y2='70' stroke-width='0.7'/%3E%3Cline x1='117' y1='35' x2='108' y2='70' stroke-width='0.7'/%3E%3Cline x1='72' y1='90' x2='63' y2='115' stroke-width='0.7'/%3E%3Cline x1='108' y1='90' x2='117' y2='115' stroke-width='0.7'/%3E%3Ccircle cx='67.5' cy='52.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='112.5' cy='52.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='67.5' cy='102.5' r='2' fill='white' stroke='none'/%3E%3Ccircle cx='112.5' cy='102.5' r='2' fill='white' stroke='none'/%3E%3Cpolyline points='75,80 80,80 82,72 86,88 90,76 92,80 105,80' stroke-width='1.5'/%3E%3Cpath d='M40,27a5,5 0 0 1 10,0c0 6-10 12-10 12s-10-6-10-12a5,5 0 0 1 10,0z' fill='white' stroke='none'/%3E%3Cpath d='M130,27a5,5 0 0 1 10,0c0 6-10 12-10 12s-10-6-10-12a5,5 0 0 1 10,0z' fill='white' stroke='none'/%3E%3Ccircle cx='45' cy='124' r='8' stroke-width='1'/%3E%3Cline x1='42' y1='124' x2='48' y2='124' stroke-width='1.5'/%3E%3Cline x1='45' y1='121' x2='45' y2='127' stroke-width='1.5'/%3E%3Crect x='129' y='116' width='12' height='16' rx='2' stroke-width='1'/%3E%3Cline x1='133' y1='120' x2='139' y2='120' stroke-width='1'/%3E%3Cline x1='133' y1='124' x2='139' y2='124' stroke-width='1'/%3E%3Cline x1='133' y1='128' x2='139' y2='128' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: '180px' }} />
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <div className="flex items-center justify-center gap-1.5 mb-3">
                                <div className="flex text-yellow-500">
                                    {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
                                </div>
                                <span className="font-black text-white">4.9 no Google</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">O que dizem quem já atende aqui</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    initials: "RS",
                                    role: "Psicólogo",
                                    text: "Localização ótima e ambiente bem cuidado. Meus pacientes entram já se sentindo em um espaço profissional. Pra mim, o que pesou foi a flexibilidade — consigo ajustar conforme minha agenda.",
                                    stars: 5
                                },
                                {
                                    initials: "AC",
                                    role: "Nutricionista",
                                    text: "Sai de um aluguel fixo que pesava no mês mesmo quando eu atendia pouco. Aqui pago só o que uso. A diferença no custo mensal foi bem real.",
                                    stars: 5
                                },
                                {
                                    initials: "FS",
                                    role: "Fisioterapeuta",
                                    text: "Chego, abro o consultório e começo a atender. Sem preocupação com limpeza, recepção ou manutenção. Isso vale muito quando você quer focar só nos pacientes.",
                                    stars: 5
                                }
                            ].map((item, i) => (
                                <div key={i} className="bg-white/5 p-7 rounded-2xl border border-white/10 shadow-sm flex flex-col gap-5">
                                    <div className="flex text-yellow-400 gap-0.5">
                                        {[...Array(item.stars)].map((_, s) => <Star key={s} className="w-4 h-4 fill-current" />)}
                                    </div>
                                    <p className="text-primary-100 leading-relaxed text-sm flex-1">&ldquo;{item.text}&rdquo;</p>
                                    <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">{item.initials}</div>
                                        <p className="text-xs text-primary-200/60 font-medium">{item.role} · via Google</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 8) FAQ ============= */}
                < section className="py-20 bg-white border-t border-warm-100 relative overflow-hidden" >
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none' stroke='%23715d4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M30 25h10v-10h10v10h10v10h-10v10h-10v-10h-10z'/%3E%3Crect x='90' y='20' width='14' height='28' rx='7' transform='rotate(45 97 34)'/%3E%3Cline x1='87' y1='34' x2='107' y2='34' transform='rotate(45 97 34)'/%3E%3Ccircle cx='90' cy='45' r='3'/%3E%3Cpath d='M135 30a8 8 0 0 1 16 0c0 9-12 15-16 22c-4-7-16-13-16-22a8 8 0 0 1 16 0z'/%3E%3Cpolyline points='120 37,130 37,133 30,137 43,140 37,150 37'/%3E%3Cpath d='M25 80a15 15 0 0 0 30 0v-15'/%3E%3Ccircle cx='25' cy='65' r='3'/%3E%3Ccircle cx='55' cy='65' r='3'/%3E%3Cpath d='M40 95v15'/%3E%3Ccircle cx='40' cy='115' r='5'/%3E%3Crect x='85' y='75' width='12' height='30' rx='2' transform='rotate(-45 91 90)'/%3E%3Cpath d='M130 85a10 10 0 0 1 10 10v15h-15v-5'/%3E%3Cpath d='M25 140h6v-6h4v6h6v4h-6v6h-4v-6h-6z'/%3E%3Cpath d='M125 130c15 10 15 20 0 30'/%3E%3Cpath d='M145 130c-15 10-15 20 0 30'/%3E%3C/svg%3E")`, backgroundSize: '160px' }} />
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">Perguntas que você provavelmente tem</h2>
                        </div>

                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-warm-50 border border-warm-200 rounded-2xl overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between p-6 text-left"
                                        onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                    >
                                        <span className="font-bold text-primary-950 text-base pr-4">{faq.q}</span>
                                        <ChevronDown className={`w-5 h-5 text-accent-600 flex-shrink-0 transition-transform duration-200 ${activeFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    {activeFaq === i && (
                                        <div className="px-6 pb-6">
                                            <p className="text-secondary-600 leading-relaxed text-sm">{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 9) LOCALIZAÇÃO ============= */}
                < section className="py-20 bg-primary-900 border-t border-primary-800 relative texture-diamonds" >
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div>
                                <span className="text-accent-500 font-bold text-sm tracking-widest uppercase mb-4 block">LOCALIZAÇÃO</span>
                                <h2 className="text-3xl font-extrabold text-white mb-5">No coração da Área Hospitalar de BH</h2>
                                <p className="text-primary-200/80 text-lg mb-7 leading-relaxed">
                                    Bairro Santa Efigênia — referência em saúde na cidade. Fácil acesso para você e seus pacientes.
                                </p>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-5 h-5 text-accent-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Endereço</p>
                                        <p className="text-primary-200/70">
                                            Avenida Brasil, 248 - Santa Efigênia<br />
                                            Belo Horizonte - MG, 30.140-900
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[380px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/10">
                                <iframe
                                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1875.4!2d-43.922652!3d-19.9245428!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa699518a3297b3%3A0xff0a67224623033e!2sEspa%C3%A7o%20Arthemi%20-%20Coworking%20de%20Sa%C3%BAde%20em%20BH!5e0!3m2!1spt-BR!2sbr!4v1702857600000!5m2!1spt-BR!2sbr"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="Localização do Espaço Arthemi - Av. Brasil, 248, Santa Efigênia, Belo Horizonte"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ============= 10) CTA FINAL ============= */}
                < section id="cta-final-section" className="py-20 relative overflow-hidden" style={{ backgroundColor: '#faf8f5' }
                }>
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.035, pointerEvents: 'none', zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none' stroke='%23715d4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M30 25h10v-10h10v10h10v10h-10v10h-10v-10h-10z'/%3E%3Crect x='90' y='20' width='14' height='28' rx='7' transform='rotate(45 97 34)'/%3E%3Cline x1='87' y1='34' x2='107' y2='34' transform='rotate(45 97 34)'/%3E%3Ccircle cx='90' cy='45' r='3'/%3E%3Cpath d='M135 30a8 8 0 0 1 16 0c0 9-12 15-16 22c-4-7-16-13-16-22a8 8 0 0 1 16 0z'/%3E%3Cpolyline points='120 37,130 37,133 30,137 43,140 37,150 37'/%3E%3Cpath d='M25 80a15 15 0 0 0 30 0v-15'/%3E%3Ccircle cx='25' cy='65' r='3'/%3E%3Ccircle cx='55' cy='65' r='3'/%3E%3Cpath d='M40 95v15'/%3E%3Ccircle cx='40' cy='115' r='5'/%3E%3Crect x='85' y='75' width='12' height='30' rx='2' transform='rotate(-45 91 90)'/%3E%3Cpath d='M130 85a10 10 0 0 1 10 10v15h-15v-5'/%3E%3Cpath d='M25 140h6v-6h4v6h6v4h-6v6h-4v-6h-6z'/%3E%3Cpath d='M125 130c15 10 15 20 0 30'/%3E%3Cpath d='M145 130c-15 10-15 20 0 30'/%3E%3C/svg%3E")`, backgroundSize: '160px' }} />
                    <div className="max-w-2xl mx-auto px-4 text-center">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-4 leading-tight">
                            Quer entender se a Arthemi faz sentido para a sua rotina?
                        </h2>
                        <p className="text-secondary-500 text-base sm:text-lg mb-10 leading-relaxed">
                            Agende uma visita, conheça o espaço pessoalmente e tire suas dúvidas antes de decidir.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                id="cta-final-whatsapp"
                                data-event="whatsapp_click"
                                data-intent="visita"
                                onClick={scrollToTriagem}
                                className="inline-flex items-center gap-3 cta-whatsapp px-10 py-5 rounded-2xl font-bold text-lg shadow-xl w-full sm:w-auto justify-center"
                            >
                                <MessageCircle className="w-6 h-6" />
                                Fazer triagem rápida
                            </button>
                            <a
                                href="#secao-precos"
                                className="inline-flex items-center gap-2 border border-warm-300 text-primary-700 px-8 py-5 rounded-2xl font-semibold text-base hover:bg-warm-100 transition-all w-full sm:w-auto justify-center"
                            >
                                <ArrowRight className="w-5 h-5" />
                                Ver consultórios e preços
                            </a>
                        </div>
                        <p className="text-secondary-400 text-sm mt-4">
                            Atendimento em horário comercial · Resposta em até 5 min
                        </p>
                    </div>
                </section>

                <footer>
                    <div id="footer-main" className="py-10 bg-primary-950 border-t border-primary-900 relative texture-diamonds">
                        <div className="max-w-6xl mx-auto px-4 text-center">
                            <Image
                                src="/images/Logo/logo.webp"
                                alt="Espaço Arthemi"
                                width={100}
                                height={40}
                                className="h-8 w-auto mx-auto mb-5 opacity-60 hover:opacity-100 transition-opacity"
                                style={{ filter: 'brightness(0) invert(1)' }}
                            />
                            <p className="text-primary-200/50 text-sm">
                                © {new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
                            </p>
                            <div className="mt-3 flex justify-center gap-6 text-xs text-primary-200/40">
                                <Link href="/termos" className="hover:text-white transition">Termos de Uso</Link>
                                <Link href="/privacidade" className="hover:text-white transition">Privacidade</Link>
                            </div>
                        </div>
                    </div>
                </footer>

                {/* Floating Mobile CTA — hides when CTA Final is visible */}
                < div className={`md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-t border-warm-100 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ${hideMobileCta ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                    <button
                        id="mobile-cta-whatsapp"
                        onClick={() => {
                            const el = document.getElementById('secao-precos');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="flex items-center justify-center gap-2 bg-accent-600 text-white w-full py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-accent-700/20"
                    >
                        <Building2 className="w-5 h-5" />
                        Ver consultórios e preços
                    </button>
                </div >
            </Layout >

            {/* Modal de Galeria */}
            {
                galleryRoom && (
                    <RoomGalleryModal
                        isOpen={!!galleryRoom}
                        onClose={() => setGalleryRoom(null)}
                        onReservar={() => {
                            if (galleryRoom) {
                                const name = galleryRoom.name;
                                setGalleryRoom(null);
                                handleOpenBooking(name);
                            }
                        }}
                        room={galleryRoom}
                    />
                )
            }

            {/* Modal de Lead */}
            <LeadFormModal
                isOpen={isLeadFormOpen}
                onClose={() => setIsLeadFormOpen(false)}
                initialRoomName={selectedRoomName}
            />



            <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        .lp-promo {
          font-family: 'Outfit', 'Inter', system-ui, sans-serif !important;
          -webkit-font-smoothing: antialiased;
        }
        .lp-promo * {
          font-family: inherit;
        }
        .lp-promo h1, .lp-promo h2, .lp-promo h3 {
          letter-spacing: -0.01em;
        }

        /* WhatsApp CTA */
        .lp-promo .cta-whatsapp {
          background-color: #25D366 !important;
          color: #fff !important;
        }
        .lp-promo .cta-whatsapp:hover {
          background-color: #1fb855 !important;
        }

        /* Accent tone */
        .lp-promo .text-accent-600 { color: #c48830 !important; }
        .lp-promo .text-accent-700 { color: #a87228 !important; }
        .lp-promo .text-accent-500 { color: #d49a3c !important; }
        .lp-promo .text-accent-400 { color: #e0ad55 !important; }
        .lp-promo .bg-accent-600 { background-color: #c48830 !important; }
        .lp-promo .bg-accent-100 { background-color: #fdf4e3 !important; }
        .lp-promo .border-b-accent-100 { border-bottom-color: #fdf4e3 !important; }
        .lp-promo .hover\\:bg-accent-700:hover { background-color: #a87228 !important; }
        .lp-promo .shadow-accent-600\\/30 { --tw-shadow-color: rgba(196,136,48,0.3) !important; }

        .texture-grain {
          position: relative;
        }
        .texture-grain::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.02;
          pointer-events: none;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .texture-diamonds {
          position: relative;
        }
        .texture-diamonds::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.025;
          pointer-events: none;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 20L10 10L0 20L10 30L20 20z M40 20L30 10L20 20L30 30L40 20z M20 0L10 -10L0 0L10 10L20 0z M20 40L10 30L0 40L10 50L20 40z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        /* Section backgrounds */
        [data-section="como-funciona"] {
          background-color: #f2e8db !important;
        }
        [data-section="incluso"] {
          background-color: #f8f2ea !important;
        }
        [data-section="precos"] {
          background-color: #f2e8db !important;
        }

        /* Card hover effects */
        [data-section="como-funciona"] .group:hover,
        [data-section="incluso"] .group:hover,
        [data-section="precos"] .group:hover {
          box-shadow: 0 12px 40px rgba(0,0,0,0.14) !important;
          border-color: #dfc08e !important;
        }

        /* Icon container gold */
        [data-section="como-funciona"] .group .rounded-2xl.bg-accent-100,
        [data-section="incluso"] .group .rounded-xl.bg-accent-100 {
          background-color: #faf5eb !important;
          border-color: #ead6b3 !important;
        }

        .texture-lines {
          position: relative;
        }
        .texture-lines::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.025;
          pointer-events: none;
          z-index: 0;
          background-image: repeating-linear-gradient(
            60deg,
            transparent,
            transparent 30px,
            #7a6050 30px,
            #7a6050 31px
          );
        }

        .texture-medical {
          position: relative;
        }
        .texture-medical::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.22;
          pointer-events: none;
          z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none' stroke='%23ceb698' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M 30 25 h 10 v -10 h 10 v 10 h 10 v 10 h -10 v 10 h -10 v -10 h -10 z' /%3E%3Crect x='90' y='20' width='14' height='28' rx='7' transform='rotate(45 97 34)' /%3E%3Cline x1='87' y1='34' x2='107' y2='34' transform='rotate(45 97 34)' /%3E%3Ccircle cx='90' cy='45' r='3' /%3E%3Ccircle cx='100' cy='50' r='2' /%3E%3Cpath d='M 135 30 a 8 8 0 0 1 16 0 c 0 9 -12 15 -16 22 c -4 -7 -16 -13 -16 -22 a 8 8 0 0 1 16 0 z' /%3E%3Cpolyline points='120 37, 130 37, 133 30, 137 43, 140 37, 150 37' /%3E%3Cpath d='M 25 80 a 15 15 0 0 0 30 0 v -15' /%3E%3Ccircle cx='25' cy='65' r='3' /%3E%3Ccircle cx='55' cy='65' r='3' /%3E%3Cpath d='M 40 95 v 15' /%3E%3Ccircle cx='40' cy='115' r='5' /%3E%3Crect x='85' y='75' width='12' height='30' rx='2' transform='rotate(-45 91 90)' /%3E%3Cline x1='91' y1='75' x2='91' y2='65' transform='rotate(-45 91 90)' /%3E%3Cline x1='82' y1='105' x2='100' y2='105' transform='rotate(-45 91 90)' /%3E%3Cline x1='85' y1='85' x2='97' y2='85' transform='rotate(-45 91 90)' /%3E%3Cline x1='85' y1='95' x2='97' y2='95' transform='rotate(-45 91 90)' /%3E%3Cpath d='M 130 85 a 10 10 0 0 1 10 10 v 15 h -15 v -5' /%3E%3Crect x='135' y='75' width='10' height='20' transform='rotate(30 140 85)' /%3E%3Cline x1='120' y1='110' x2='150' y2='110' /%3E%3Cpath d='M 25 140 h 6 v -6 h 4 v 6 h 6 v 4 h -6 v 6 h -4 v -6 h -6 z' /%3E%3Crect x='75' y='130' width='16' height='32' rx='8' transform='rotate(60 83 146)' /%3E%3Crect x='79' y='138' width='8' height='16' transform='rotate(60 83 146)' /%3E%3Ccircle cx='83' cy='142' r='1' transform='rotate(60 83 146)' /%3E%3Ccircle cx='83' cy='150' r='1' transform='rotate(60 83 146)' /%3E%3Cpath d='M 125 130 c 15 10 15 20 0 30' /%3E%3Cpath d='M 145 130 c -15 10 -15 20 0 30' /%3E%3Cline x1='128' y1='135' x2='142' y2='135' /%3E%3Cline x1='130' y1='145' x2='140' y2='145' /%3E%3Cline x1='128' y1='155' x2='142' y2='155' /%3E%3C/svg%3E");
          background-size: 160px;
        }
      `}</style>
        </>
    );
}
