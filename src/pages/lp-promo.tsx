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
    const [showPopup, setShowPopup] = useState(false);

    // Mini-triagem state
    const [triagemArea, setTriagemArea] = useState('');
    const [triagemMaca, setTriagemMaca] = useState('');
    const [triagemHoras, setTriagemHoras] = useState('');

    // Popup Logic — exit intent only OR após 50s
    useEffect(() => {
        let shown = false;

        const showIt = () => {
            if (!shown) {
                setShowPopup(true);
                shown = true;
            }
        };

        // 50 segundos de delay (não 10)
        const timer = setTimeout(showIt, 50000);

        // Exit intent para desktop
        const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 5 && !shown) {
                showIt();
            }
        };

        document.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
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
        const text = intent === 'horarios' ? 'HORÁRIOS' : 'Oi, tudo bem? Vi o site de vocês e gostaria de marcar um horário para conhecer a estrutura.';
        const ctaId = locationStr === 'hero' ? 'hero_primary' : (locationStr === 'footer' ? 'final_cta' : `cta_${locationStr}`);
        const realIntent = intent === 'visita' ? 'agendar_visita' : 'horarios';

        trackWhatsAppClick(realIntent, ctaId)(text);
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
            a: "Sim. Temos disponibilidade aos sábados com tabela específica — consulte pelo WhatsApp."
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
        const area = triagemArea || 'não informada';
        const maca = triagemMaca || 'não informado';
        const horas = triagemHoras || 'não informado';
        const msg = `Olá! Minha área é *${area}*. Preciso de maca: *${maca}*. Pretendo reservar *${horas} horas/semana*. Queria ver horários e valores.`;
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

    return (
        <>
            <SEO
                title="Consultório por hora na área hospitalar de BH | Espaço Arthemi"
                description="Atenda seus pacientes em consultório completo sem precisar de clínica própria. Reserva por hora, recepção incluída, sem contrato. Área hospitalar de BH."
                path="/lp-promo"
            />

            <Layout noHeader noFooter className="bg-white lp-promo">
                {/* ============= HEADER ============= */}
                <header className="sticky top-0 z-50 bg-warm-50/90 backdrop-blur-xl border-b border-warm-200 overflow-hidden relative">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
                    <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent-500/20 to-transparent"></div>

                    <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between relative z-10">
                        <Image
                            src="/images/Logo/logo.webp"
                            alt="Espaço Arthemi"
                            width={130}
                            height={52}
                            className="h-10 w-auto"
                            priority
                        />
                        <button
                            id="header-cta-whatsapp"
                            onClick={() => handleOpenWhatsApp('visita', 'header')}
                            className="hidden sm:flex items-center gap-2 text-accent-700 font-semibold text-sm hover:underline"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Falar no WhatsApp
                        </button>
                    </div>
                </header>

                {/* ============= 1) HERO ============= */}
                <section className="relative min-h-[90vh] sm:min-h-[85vh] flex items-center overflow-hidden">

                    {/* Foto de fundo — next/image otimizada (WebP + preload automático) */}
                    <Image
                        src="/images/espaco/Recepcao-01.jpeg"
                        alt="Espaço Arthemi — Recepção"
                        fill
                        priority
                        quality={85}
                        sizes="100vw"
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />

                    {/* Overlay horizontal — escuro à esquerda onde fica o texto */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to right, rgba(28,20,14,0.85) 0%, rgba(28,20,14,0.60) 55%, rgba(28,20,14,0.15) 100%)' }} />
                    {/* Overlay vertical — escurece o rodapé */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to top, rgba(28,20,14,0.55) 0%, transparent 55%)' }} />

                    {/* Conteúdo */}
                    <div className="relative z-10 max-w-6xl mx-auto px-4 w-full py-24 sm:py-32">
                        <div className="max-w-2xl">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] sm:text-xs font-bold mb-5 uppercase tracking-widest backdrop-blur-sm">
                                Área Hospitalar de BH · Santa Efigênia
                            </span>

                            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-5 tracking-tight">
                                Seu consultório pronto para atender,{' '}
                                <span className="text-accent-400">sem clínica própria.</span>
                            </h1>

                            <p className="text-base sm:text-lg text-white/75 mb-8 leading-relaxed max-w-lg">
                                Receba seus pacientes em uma estrutura profissional na área hospitalar de BH, reservando por hora e pagando só pelo uso.
                            </p>

                            {/* HERO: 2 CTAs */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    id="cta-hero-visita"
                                    data-event="whatsapp_click"
                                    data-intent="visita"
                                    onClick={() => handleOpenWhatsApp('visita', 'hero')}
                                    className="w-full sm:w-auto cta-whatsapp px-8 py-4 rounded-xl font-bold text-base sm:text-lg shadow-2xl flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    Agendar visita pelo WhatsApp
                                </button>
                                <a
                                    id="cta-hero-precos"
                                    href="#secao-precos"
                                    className="w-full sm:w-auto bg-white/15 hover:bg-white/25 border border-white/30 text-white px-8 py-4 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all backdrop-blur-sm"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    Ver preços e escolher consultório
                                </a>
                            </div>
                            <p className="text-sm text-white/50 mt-3 max-w-sm">
                                Você pode agendar uma visita ou reservar direto se já souber o que precisa.
                            </p>

                            {/* Quick proof */}
                            <div className="mt-12 flex flex-wrap gap-5 items-center border-t border-white/20 pt-8">
                                <div className="flex items-center gap-1.5">
                                    <div className="flex text-yellow-400">
                                        {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                                    </div>
                                    <span className="text-sm font-semibold text-white/90">4.9 no Google</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/70 font-medium">
                                    <Clock className="w-4 h-4 text-accent-400" />
                                    Resposta em até 5 min
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/70 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
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
                <section className="py-20 bg-white border-y border-warm-100">
                    <div className="max-w-5xl mx-auto px-4">
                        <div className="text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">Como funciona?</h2>
                            <p className="text-secondary-600 text-lg">Do primeiro contato até o primeiro atendimento — em 4 passos simples.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                            {[
                                {
                                    step: "01",
                                    icon: MessageCircle,
                                    title: "Você agenda uma visita",
                                    desc: "Manda mensagem no WhatsApp e escolhe um dia pra conhecer o espaço pessoalmente."
                                },
                                {
                                    step: "02",
                                    icon: Building2,
                                    title: "Conhece o espaço",
                                    desc: "Fazemos um tour pela recepção e pelos consultórios. Você tira todas as dúvidas no local. Se preferir, você também pode reservar direto pelo WhatsApp."
                                },
                                {
                                    step: "03",
                                    icon: Calendar,
                                    title: "Escolhe seus horários",
                                    desc: "Vê a agenda disponível e reserva os períodos que fazem sentido pra sua rotina."
                                },
                                {
                                    step: "04",
                                    icon: UserCheck,
                                    title: "Começa a atender",
                                    desc: "Chega no horário, a sala está pronta. Você foca nos pacientes — o resto é com a gente."
                                },
                            ].map((item, i) => (
                                <div key={i} className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-warm-50 border border-warm-100">
                                    <div className="text-5xl font-black text-accent-600/20 mb-3 leading-none">{item.step}</div>
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-warm-200 shadow-sm flex items-center justify-center mb-4">
                                        <item.icon className="w-6 h-6 text-accent-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-primary-950 mb-2">{item.title}</h3>
                                    <p className="text-sm text-secondary-600 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-10">
                            <button
                                id="cta-como-funciona-visita"
                                data-event="whatsapp_click"
                                data-intent="visita"
                                onClick={() => handleOpenWhatsApp('visita', 'como-funciona')}
                                className="inline-flex items-center gap-2 cta-whatsapp px-7 py-4 rounded-xl font-bold text-base shadow-lg"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Agendar visita pelo WhatsApp
                            </button>
                        </div>
                    </div>
                </section>

                {/* ============= 3) FOTOS DO ESPAÇO ============= */}
                <section className="py-16 bg-warm-50/40">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">O espaço por dentro</h2>
                            <p className="text-secondary-600">Recepção profissional, consultórios decorados e ambiente preparado para seus pacientes.</p>
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
                <section className="py-20 bg-white">
                    <div className="max-w-5xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">Para quem é a Arthemi?</h2>
                            <p className="text-secondary-600 text-lg">Para profissionais de saúde que querem atender bem sem os custos de uma clínica própria.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Psicólogos", desc: "Salas silenciosas e privativas para sessões com total sigilo." },
                                { label: "Nutricionistas", desc: "Espaço adequado para anamnese, avaliações e acompanhamento." },
                                { label: "Fisioterapeutas", desc: "Consultórios com maca profissional e espaço para movimentação." },
                                { label: "Médicos e Especialistas", desc: "Localização na área hospitalar de BH, estrutura compatível." },
                            ].map((item, i) => (
                                <div key={i} className="p-6 rounded-2xl bg-warm-50 border border-warm-100 hover:-translate-y-1 transition-all">
                                    <h4 className="text-base font-bold text-primary-950 mb-2">{item.label}</h4>
                                    <p className="text-xs text-secondary-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Não é ideal para */}
                        <div className="mt-8 p-6 rounded-2xl bg-warm-50 border border-warm-100">
                            <h3 className="text-sm font-bold text-secondary-500 uppercase tracking-widest mb-3">Não atende bem quem precisa de:</h3>
                            <div className="flex flex-wrap gap-3">
                                {["Internação hospitalar", "Descarte de resíduos cirúrgicos pesados", "Exclusividade de sala por meses"].map((text, i) => (
                                    <span key={i} className="text-sm text-secondary-500 bg-white border border-warm-200 px-3 py-1.5 rounded-full">{text}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ============= 5) O QUE ESTÁ INCLUSO ============= */}
                <section className="py-20 bg-warm-50/30 border-y border-warm-100">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
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
                                { icon: Building2, title: "Armário com chave", desc: "Para guardar seus materiais com segurança." },
                                { icon: CheckCircle2, title: "Endereço profissional", desc: "Área hospitalar de BH — Santa Efigênia." },
                            ].map((item, i) => (
                                <div key={i} className="bg-white p-5 rounded-2xl border border-warm-100 shadow-sm flex flex-col gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-warm-50 border border-warm-200 flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-accent-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary-950 text-sm">{item.title}</p>
                                        <p className="text-xs text-secondary-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 6) VALORES E CONSULTÓRIOS ============= */}
                <section id="secao-precos" className="py-20 bg-white">
                    <div className="max-w-6xl mx-auto px-4">

                        {/* Introdução editorial */}
                        <div className="max-w-2xl mx-auto text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-4">
                                Escolha o consultório ideal para a sua rotina
                            </h2>
                            <p className="text-secondary-600 text-lg leading-relaxed mb-4">
                                A Arthemi oferece 3 opções de consultório com condições flexíveis para quem quer começar a atender com estrutura profissional, sem assumir os custos de uma clínica própria.
                            </p>
                            <p className="text-sm text-secondary-500 flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-accent-600" />
                                Recepção, limpeza entre atendimentos, Wi-Fi, café e água já incluídos.
                            </p>
                        </div>

                        {/* Cards de consultório */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {rooms.map((room) => {
                                let imageUrl = room.imageUrl;
                                let roomTitle = room.name;
                                let roomSubtitle = '';
                                let badge = '';
                                let pkg10h = '';
                                let pkg20h = '';
                                let pkg40h = '';
                                let shiftFixed = '';
                                let savings = '';

                                // Puxar preços dinâmicos dos produtos vinculados à sala
                                const p10 = room.products?.find((p: any) => p.type === 'PACKAGE_10H');
                                const p20 = room.products?.find((p: any) => p.type === 'PACKAGE_20H');
                                const p40 = room.products?.find((p: any) => p.type === 'PACKAGE_40H');

                                pkg10h = p10 ? formatCurrency(p10.price) : '—';
                                pkg20h = p20 ? formatCurrency(p20.price) : '—';
                                pkg40h = p40 ? formatCurrency(p40.price) : '—';

                                if (room.slug === 'sala-a') {
                                    imageUrl = '/images/sala-a/foto-4.jpeg';
                                    roomTitle = 'Consultório 1 — Grande com maca';
                                    roomSubtitle = 'Mais espaço para atendimentos com maca';
                                    badge = 'Mais escolhido';
                                    savings = 'Pacotes com vantagem progressiva — até 18% de economia';
                                } else if (room.slug === 'sala-b') {
                                    imageUrl = '/images/sala-b/02-3.jpeg';
                                    roomTitle = 'Consultório 2 — Médio com maca';
                                    roomSubtitle = 'Equilíbrio entre estrutura e investimento';
                                    badge = 'Melhor custo-benefício';
                                    savings = 'Pacotes com vantagem progressiva — até 22% de economia';
                                } else if (room.slug === 'sala-c') {
                                    imageUrl = '/images/sala-c/03-1.jpeg';
                                    roomTitle = 'Consultório 3 — Compacto sem maca';
                                    roomSubtitle = 'Ideal para atendimentos individuais';
                                    badge = 'Valor de lançamento';
                                    savings = 'Pacotes com vantagem progressiva — até 25% de economia';
                                }


                                return (
                                    <div key={room.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-warm-200 group flex flex-col">

                                        {/* Foto */}
                                        <div className="relative h-52 cursor-pointer overflow-hidden flex-shrink-0" onClick={() => handleOpenGallery({ name: room.name, slug: room.slug })}>
                                            <Image
                                                src={imageUrl || '/images/espaco/Recepcao-01.jpeg'}
                                                alt={roomTitle}
                                                fill
                                                loading="lazy"
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                quality={90}
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                            {/* Badge sóbrio */}
                                            {badge && (
                                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-primary-950 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full shadow-sm border border-warm-200">
                                                    {badge}
                                                </div>
                                            )}
                                            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-white/90 text-xs font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                                <Eye className="w-3.5 h-3.5" /> Ver fotos
                                            </div>
                                        </div>

                                        {/* Conteúdo */}
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="mb-5">
                                                <h3 className="text-lg font-extrabold text-primary-950 leading-tight mb-1">{roomTitle}</h3>
                                                <p className="text-sm text-secondary-500 leading-relaxed">{roomSubtitle}</p>
                                            </div>

                                            {/* Preço principal */}
                                            <div className="mb-5 pb-5 border-b border-warm-100">
                                                <p className="text-xs text-secondary-400 font-medium mb-1">A partir de</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-primary-950">{formatCurrency(room.hourlyRate)}</span>
                                                    <span className="text-secondary-400 font-medium text-sm">/ hora</span>
                                                </div>
                                                <p className="text-[11px] text-accent-600 font-semibold mt-1.5 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> Condição especial para começar
                                                </p>
                                            </div>

                                            {/* Tabela de pacotes */}
                                            <div className="space-y-2 mb-4 flex-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-secondary-500">Pacote 10h</span>
                                                    <span className="font-semibold text-primary-950">{pkg10h}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-secondary-500">Pacote 20h</span>
                                                    <span className="font-semibold text-primary-950">{pkg20h}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-secondary-500">Pacote 40h</span>
                                                    <span className="font-semibold text-primary-950">{pkg40h}</span>
                                                </div>
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
                                                data-event="whatsapp_click"
                                                data-intent={`consultorio_${room.slug.replace('sala-', '')}`}
                                                onClick={() => {
                                                    const roomNum = roomTitle.split('Consultório')[1]?.split('—')[0]?.trim() || '';
                                                    const msgEspecifica = `Olá! Quero o Consultório ${roomNum}. Pode me passar a disponibilidade de horários e valores?`;
                                                    trackWhatsAppClick(`consultorio_${room.slug.replace('sala-', '')}`, `cta-quero-${room.slug}`)(msgEspecifica);
                                                }}
                                                className="w-full cta-whatsapp py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 group/btn mt-auto mb-2"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                Quero este consultório
                                            </button>
                                            <button
                                                id={`cta-preco-${room.slug}`}
                                                data-event="whatsapp_click"
                                                data-intent={`consultorio_${room.slug.replace('sala-', '')}`}
                                                onClick={() => {
                                                    const msgEspecifica = `Oi! Adorei a estrutura do ${roomTitle.split('—')[0].trim()} que vi no site. Podemos conferir a disponibilidade?`;
                                                    trackWhatsAppClick(`consultorio_${room.slug.replace('sala-', '')}_precos`, `cta-preco-${room.slug}`)(msgEspecifica);
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
                            Valores para dias úteis (seg–sex). Atendimentos aos sábados têm tabela específica — consulte pelo WhatsApp.
                        </p>
                    </div>
                </section>

                {/* ============= MINI-TRIAGEM ============= */}
                <section className="py-14 bg-warm-100/60 border-y border-warm-200">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold text-primary-950 mb-2">Não sabe qual escolher?</h2>
                            <p className="text-secondary-500 text-sm">Responda 3 perguntas rápidas e receba indicação personalizada no WhatsApp.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-6 sm:p-8 space-y-6">
                            {/* Pergunta 1 */}
                            <div>
                                <p className="text-sm font-bold text-primary-950 mb-3">Sua área de atuação:</p>
                                <div className="flex flex-wrap gap-2">
                                    {['Psicologia', 'Nutrição', 'Fisioterapia', 'Medicina', 'Outra'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setTriagemArea(opt)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${triagemArea === opt
                                                ? 'bg-accent-600 text-white border-accent-600 shadow-sm'
                                                : 'bg-warm-50 text-secondary-700 border-warm-200 hover:border-accent-400'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pergunta 2 */}
                            <div>
                                <p className="text-sm font-bold text-primary-950 mb-3">Precisa de maca?</p>
                                <div className="flex gap-2">
                                    {['Sim', 'Não'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setTriagemMaca(opt)}
                                            className={`px-6 py-2 rounded-full text-sm font-semibold border transition-all ${triagemMaca === opt
                                                ? 'bg-accent-600 text-white border-accent-600 shadow-sm'
                                                : 'bg-warm-50 text-secondary-700 border-warm-200 hover:border-accent-400'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pergunta 3 */}
                            <div>
                                <p className="text-sm font-bold text-primary-950 mb-3">Quantas horas por semana pretende atender?</p>
                                <div className="flex gap-2">
                                    {['1–2h', '3–5h', '6h+'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setTriagemHoras(opt)}
                                            className={`px-6 py-2 rounded-full text-sm font-semibold border transition-all ${triagemHoras === opt
                                                ? 'bg-accent-600 text-white border-accent-600 shadow-sm'
                                                : 'bg-warm-50 text-secondary-700 border-warm-200 hover:border-accent-400'
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
                                className="w-full cta-whatsapp py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Enviar no WhatsApp
                            </button>
                            <p className="text-center text-xs text-secondary-400">Nossas indicações são enviadas pelo WhatsApp em até 5 minutos.</p>
                        </div>
                    </div>
                </section>






                {/* ============= 7) DEPOIMENTOS ============= */}
                <section className="py-20 bg-warm-50/50">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <div className="flex items-center justify-center gap-1.5 mb-3">
                                <div className="flex text-yellow-500">
                                    {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
                                </div>
                                <span className="font-black text-primary-950">4.9 no Google</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">O que dizem quem já atende aqui</h2>
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
                                    text: "Chego, abro a sala e começo a atender. Sem preocupação com limpeza, recepção ou manutenção. Isso vale muito quando você quer focar só nos pacientes.",
                                    stars: 5
                                }
                            ].map((item, i) => (
                                <div key={i} className="bg-white p-7 rounded-2xl border border-warm-200 shadow-sm flex flex-col gap-5">
                                    <div className="flex text-yellow-400 gap-0.5">
                                        {[...Array(item.stars)].map((_, s) => <Star key={s} className="w-4 h-4 fill-current" />)}
                                    </div>
                                    <p className="text-secondary-600 leading-relaxed text-sm flex-1">&ldquo;{item.text}&rdquo;</p>
                                    <div className="flex items-center gap-3 pt-3 border-t border-warm-100">
                                        <div className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center font-bold text-secondary-600 text-xs flex-shrink-0">{item.initials}</div>
                                        <p className="text-xs text-secondary-500 font-medium">{item.role} · via Google</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 8) FAQ ============= */}
                <section className="py-20 bg-white">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-950 mb-3">Perguntas que você provavelmente tem</h2>
                        </div>

                        <div className="space-y-4">
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
                                            <p className="text-secondary-700 leading-relaxed text-sm">{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============= 9) LOCALIZAÇÃO ============= */}
                <section className="py-20 bg-warm-50/30">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div>
                                <span className="text-accent-600 font-bold text-sm tracking-widest uppercase mb-4 block">LOCALIZAÇÃO</span>
                                <h2 className="text-3xl font-extrabold text-primary-950 mb-5">No coração da Área Hospitalar de BH</h2>
                                <p className="text-secondary-600 text-lg mb-7 leading-relaxed">
                                    Bairro Santa Efigênia — referência em saúde na cidade. Fácil acesso para você e seus pacientes.
                                </p>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-5 h-5 text-accent-700" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary-900">Endereço</p>
                                        <p className="text-secondary-600">
                                            Avenida Brasil, 248 - Santa Efigênia<br />
                                            Belo Horizonte - MG, 30.140-900
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[380px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
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
                </section >

                {/* ============= 10) CTA FINAL ============= */}
                < section className="py-20 bg-primary-950" >
                    <div className="max-w-2xl mx-auto px-4 text-center">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
                            Quer entender se a Arthemi faz sentido para a sua rotina?
                        </h2>
                        <p className="text-primary-300 text-base sm:text-lg mb-10 leading-relaxed">
                            Agende uma visita, conheça o espaço pessoalmente e tire suas dúvidas antes de decidir.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                id="cta-final-whatsapp"
                                data-event="whatsapp_click"
                                data-intent="visita"
                                onClick={() => handleOpenWhatsApp('visita', 'footer')}
                                className="inline-flex items-center gap-3 bg-white text-primary-950 px-10 py-5 rounded-2xl font-bold text-lg hover:bg-warm-50 transition-all shadow-2xl w-full sm:w-auto justify-center"
                            >
                                <MessageCircle className="w-6 h-6 text-accent-600" />
                                Agendar visita pelo WhatsApp
                            </button>
                            <a
                                href="#secao-precos"
                                className="inline-flex items-center gap-2 border border-white/30 text-white/80 px-8 py-5 rounded-2xl font-semibold text-base hover:bg-white/10 transition-all w-full sm:w-auto justify-center"
                            >
                                <ArrowRight className="w-5 h-5" />
                                Ver consultórios e preços
                            </a>
                        </div>
                        <p className="text-primary-500 text-sm mt-4">
                            Atendimento em horário comercial · Resposta em até 5 min
                        </p>
                    </div>
                </section >

                {/* Footer */}
                < footer className="py-10 bg-warm-50 border-t border-warm-200" >
                    <div className="max-w-6xl mx-auto px-4 text-center">
                        <Image
                            src="/images/Logo/logo.webp"
                            alt="Espaço Arthemi"
                            width={100}
                            height={40}
                            className="h-8 w-auto mx-auto mb-5 grayscale opacity-60"
                        />
                        <p className="text-secondary-400 text-sm">
                            © {new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
                        </p>
                        <div className="mt-3 flex justify-center gap-6 text-xs text-secondary-400">
                            <Link href="/termos" className="hover:text-accent-600 transition">Termos de Uso</Link>
                            <Link href="/privacidade" className="hover:text-accent-600 transition">Privacidade</Link>
                        </div>
                    </div>
                </footer >

                {/* Floating Mobile CTA */}
                < div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-t border-warm-100 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]" >
                    <button
                        id="mobile-cta-whatsapp"
                        onClick={() => handleOpenWhatsApp('visita', 'mobile-sticky')}
                        className="flex items-center justify-center gap-2 cta-whatsapp w-full py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-green-700/20"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Agendar visita pelo WhatsApp
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

            {/* Popup — exit intent / após 50s */}
            {
                showPopup && (
                    <div className="fixed inset-0 z-[999] bg-primary-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 rounded-[2.5rem] p-8 md:p-12 max-w-xl w-full shadow-[0_0_50px_rgba(0,0,0,0.4)] border border-primary-800 relative mt-auto mb-auto overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-accent-500/20 rounded-full blur-[60px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-accent-400/20 rounded-full blur-[60px] pointer-events-none" />

                            <button
                                onClick={() => setShowPopup(false)}
                                className="absolute top-6 right-6 w-10 h-10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors z-20 border border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 text-white/90 rounded-full text-xs font-bold tracking-widest uppercase mb-6 shadow-sm">
                                    <Sparkles className="w-4 h-4 text-accent-400" />
                                    Condição de Lançamento
                                </div>
                                <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-5 leading-tight tracking-tight px-2">
                                    Quer conhecer antes de decidir?
                                </h3>
                                <p className="text-primary-100 mb-8 text-lg md:text-xl leading-relaxed max-w-md mx-auto font-light">
                                    Agende uma visita gratuita. Você vê o espaço, conversa com a equipe e decide com calma — sem compromisso.
                                </p>
                                <div className="w-full flex flex-col gap-4">
                                    <button
                                        id="cta-whatsapp-popup-visita"
                                        data-event="whatsapp_click"
                                        data-intent="visita"
                                        onClick={() => {
                                            setShowPopup(false);
                                            handleOpenWhatsApp('visita', 'popup');
                                        }}
                                        className="w-full bg-white text-primary-950 py-4 md:py-5 rounded-2xl font-bold text-lg hover:bg-warm-50 transition-all flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 group"
                                    >
                                        <MessageCircle className="w-5 h-5 text-accent-600" />
                                        Agendar visita pelo WhatsApp
                                        <ArrowRight className="w-5 h-5 text-accent-600 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={() => setShowPopup(false)}
                                        className="w-full bg-transparent text-primary-400 py-3 rounded-xl font-medium text-sm hover:text-white transition-colors"
                                    >
                                        Fechar e continuar lendo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

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
      `}</style>
        </>
    );
}

export const getServerSideProps: GetServerSideProps<LPPromoPageProps> = async (context) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                imageUrl: true,
                capacity: true,
                amenities: true,
                hourlyRate: true,
                products: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        hoursIncluded: true,
                        type: true,
                        roomId: true,
                    },
                },
            },
        });

        return {
            props: {
                rooms: rooms.map(room => ({
                    ...room,
                    hourlyRate: room.hourlyRate || 0,
                })),
            },
        };
    } catch (error) {
        console.error(`ERRO no SSR /lp-promo:`, error);
        return {
            props: {
                rooms: [],
            },
        };
    }
};
