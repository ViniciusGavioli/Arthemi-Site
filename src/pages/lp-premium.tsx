// ===========================================================
// Página /lp-premium - Landing Page Matadora de Conversão
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
    ArrowRight
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

interface LPPremiumPageProps {
    rooms: Room[];
}

export default function LPPremiumPage({ rooms }: LPPremiumPageProps) {
    const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string } | null>(null);
    const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
    const [selectedRoomName, setSelectedRoomName] = useState('');
    const [activeFaq, setActiveFaq] = useState<number | null>(0); // First FAQ open by default
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const heroImages = [
        { src: "/images/espaco/Recepcao-01.jpeg", alt: "Recepção do Espaço Arthemi" },
        { src: "/images/sala-a/foto-4.jpeg", alt: "Consultório Prime" },
        { src: "/images/sala-b/02-3.jpeg", alt: "Consultório Executive" },
        { src: "/images/sala-c/03-1.jpeg", alt: "Consultório Essential" }
    ];

    // Carousel Logic
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [heroImages.length]);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length);
    };

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

    const trackEvent = (eventName: string, params = {}) => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', eventName, params);
        }
    };

    const handleOpenBooking = (roomName: string) => {
        trackEvent('clique_reservar', { room: roomName });
        setSelectedRoomName(roomName);
        setIsLeadFormOpen(true);
    };

    const handleOpenWhatsApp = (ctaContext: any = '') => {
        const contextStr = typeof ctaContext === 'string' ? ctaContext : '';
        trackEvent('clique_whatsapp', { context: contextStr });
        const text = contextStr === 'disponibilidade'
            ? 'Olá! Vi o site e gostaria de consultar a disponibilidade dos consultórios para hoje.'
            : 'Olá! Gostaria de saber mais sobre o Espaço Arthemi.';
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handleOpenGallery = (galleryData: { name: string; slug: string }) => {
        trackEvent('clique_fotos', { room: galleryData.name });
        setGalleryRoom(galleryData);
    };

    const faqs = [
        { q: "Precisa contrato longo?", a: "Não. Reserva por hora, sem fidelidade e sem burocracia." },
        { q: "Tem taxa de adesão?", a: "Não. Você paga apenas pelo tempo reservado." },
        { q: "Posso cancelar ou remarcar?", a: "Sim, você pode cancelar ou remarcar sem custos, respeitando o prazo de 48h antes de cada reserva." },
        { q: "Tem recepção e limpeza inclusos?", a: "Sim. Inclusos em todas as reservas." },
        { q: "Serve para minha profissão?", a: "Sim — psicologia, nutrição, fisioterapia, medicina e outras áreas da saúde." },
    ];

    return (
        <>
            <SEO
                title="Consultório Premium por Hora em BH | Espaço Arthemi"
                description="Atenda em consultório premium na área hospitalar de BH sem aluguel fixo. Reserve por hora, estrutura completa com recepção e limpeza. Sem burocracia."
                path="/lp-premium"
            />

            <Layout noHeader noFooter className="bg-white">
                {/* Minimal Header */}
                <header className="sticky top-0 z-50 bg-warm-50/90 backdrop-blur-xl border-b border-warm-200 overflow-hidden relative">
                    {/* Header Texture Layer */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
                    <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent-500/20 to-transparent"></div>

                    {/* Header BG Image (Mobile Only) */}
                    <div className="md:hidden absolute inset-0 -z-10 opacity-20">
                        <Image
                            src="/images/hero/banner.jpeg"
                            alt=""
                            fill
                            className="object-cover blur-xl scale-120"
                        />
                    </div>

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
                            onClick={() => handleOpenWhatsApp('header')}
                            className="hidden sm:flex items-center gap-2 text-accent-700 font-semibold text-sm hover:underline"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Falar no WhatsApp
                        </button>
                    </div>
                </header>

                {/* Hero Section */}
                <section className="relative pt-10 pb-16 sm:pt-20 sm:pb-32 overflow-hidden bg-gradient-to-b from-warm-50 to-white">
                    <div className="max-w-6xl mx-auto px-4 relative z-10">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div className="max-w-3xl">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-accent-100 text-accent-700 text-sm font-bold mb-6 animate-fade-in uppercase tracking-wider">
                                    Solução Premium em Saúde
                                </span>
                                <h1 className="text-4xl sm:text-6xl font-black text-primary-950 leading-[1.1] mb-6 tracking-tight">
                                    Atenda em consultório premium em BH <span className="text-accent-600">sem aluguel fixo</span>.
                                </h1>

                                {/* Micro-proofs */}
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-8 mt-2 animate-fade-in delay-100">
                                    {[
                                        "Sem aluguel fixo",
                                        "Sem taxa de adesão",
                                        "Recepção e limpeza",
                                        "Área hospitalar de BH"
                                    ].map((text, i) => (
                                        <div key={i} className="flex items-center gap-2 text-primary-900/80 font-bold text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            {text}
                                        </div>
                                    ))}
                                </div>

                                <p className="text-lg sm:text-xl text-secondary-600 mb-10 leading-relaxed max-w-xl">
                                    Reserve por hora, atenda com estrutura completa e sem burocracia <br className="hidden md:block" /> — recepção, limpeza e internet inclusos.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 mb-12 lg:mb-0">
                                    <button
                                        id="cta-hero-availability"
                                        onClick={() => handleOpenWhatsApp('hero_disponibilidade')}
                                        className="bg-accent-600 text-white px-8 py-5 rounded-2xl font-bold text-lg shadow-xl shadow-accent-600/20 hover:bg-accent-700 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                                    >
                                        Ver horários disponíveis agora
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                    <button
                                        id="cta-hero-reserve"
                                        onClick={() => handleOpenWhatsApp('hero_agendar')}
                                        className="bg-white text-secondary-800 border-2 border-warm-200 px-8 py-5 rounded-2xl font-bold text-lg hover:bg-warm-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle className="w-6 h-6 text-green-600" />
                                        Quero reservar hoje
                                    </button>
                                </div>

                                {/* Quick Proof */}
                                <div className="hidden lg:flex mt-12 flex-wrap gap-8 items-center border-t border-warm-200 pt-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-accent-700" />
                                        </div>
                                        <span className="text-sm font-medium text-secondary-600">
                                            <strong className="text-primary-950">Referência</strong> na área hospitalar de BH
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex text-yellow-500">
                                            <Star className="w-5 h-5 fill-current" />
                                            <Star className="w-5 h-5 fill-current" />
                                            <Star className="w-5 h-5 fill-current" />
                                            <Star className="w-5 h-5 fill-current" />
                                            <Star className="w-5 h-5 fill-current" />
                                        </div>
                                        <span className="text-sm font-medium text-secondary-600">
                                            <strong>4.9/5</strong> no Google
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Hero Image Slider Container */}
                            <div className="relative">
                                <div
                                    className="relative aspect-[4/3] lg:aspect-square w-full rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl lg:rotate-2 group cursor-zoom-in"
                                    onClick={() => handleOpenGallery({ name: 'Espaço Arthemi', slug: 'espaco' })}
                                >
                                    {heroImages.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className={`absolute inset-0 transition-opacity duration-1000 ${currentImageIndex === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                        >
                                            <Image
                                                src={img.src}
                                                alt={img.alt}
                                                fill
                                                className="object-cover"
                                                priority={idx === 0}
                                            />
                                        </div>
                                    ))}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 z-20"></div>

                                    {/* Navigation Arrows */}
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>

                                    {/* Click Hint */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col items-center gap-2">
                                        <div className="bg-white/90 text-primary-950 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl">
                                            <Eye className="w-4 h-4" />
                                            Ver em tamanho real
                                        </div>
                                    </div>

                                    {/* Carousel Indicators */}
                                    <div className="absolute bottom-6 right-6 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 z-30 flex gap-1.5 bg-black/20 backdrop-blur-md px-3 py-2 rounded-full">
                                        {heroImages.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`w-1.5 h-1.5 rounded-full transition-all ${currentImageIndex === idx ? 'bg-white w-4' : 'bg-white/50'}`}
                                            />
                                        ))}
                                    </div>

                                    {/* Mobile Floating Badge */}
                                    <div className="absolute bottom-6 left-6 lg:hidden bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl flex items-center gap-3 z-30">
                                        <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-accent-700" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-primary-950">Área Hospitalar</p>
                                            <p className="text-[10px] text-secondary-500 uppercase tracking-widest">Belo Horizonte</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Decorative shape behind image on desktop */}
                                <div className="hidden lg:block absolute -z-10 -top-6 -right-6 w-full h-full border-2 border-accent-200 rounded-[3rem] rotate-1"></div>
                            </div>
                        </div>

                        {/* Mobile Micro-proofs - Fixed Style */}
                        <div className="lg:hidden mt-8 grid grid-cols-1 gap-3 border-t border-warm-200 pt-8 animate-fade-in">
                            {[
                                "✅ Sem taxa de adesão",
                                "✅ Sem fidelidade",
                                "✅ Recepção + limpeza inclusas"
                            ].map((text, i) => (
                                <div key={i} className="flex items-center gap-2 text-primary-900/80 font-bold text-sm">
                                    {text}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 2) NEW: Preview Rooms Section */}
                <section className="py-20 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Nossos Consultórios</h2>
                            <p className="text-secondary-600 text-lg">Escolha o ambiente ideal e veja horários disponíveis agora.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            {[
                                {
                                    title: "Consultório Premium (Mais completo)",
                                    price: "59,99",
                                    ideal: "Ideal para atendimentos que pedem mais estrutura e presença.",
                                    tag: "SALA A"
                                },
                                {
                                    title: "Consultório Premium (Melhor custo-benefício)",
                                    price: "49,99",
                                    ideal: "Equilíbrio perfeito entre conforto e economia.",
                                    tag: "SALA B"
                                },
                                {
                                    title: "Consultório Premium (Mais reservado)",
                                    price: "39,99",
                                    ideal: "Ambiente discreto e acolhedor para atendimentos individuais.",
                                    tag: "SALA C"
                                }
                            ].map((card, i) => (
                                <div key={i} className="bg-warm-50 border border-warm-200 rounded-[2rem] p-8 flex flex-col h-full hover:shadow-xl transition-all group">
                                    <span className="text-accent-600 text-[10px] font-black tracking-[0.2em] uppercase mb-4">{card.tag}</span>
                                    <h3 className="text-xl font-bold text-primary-950 mb-3">{card.title}</h3>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-black text-primary-900">R$ {card.price}</span>
                                        <span className="text-secondary-400 font-medium">/hora</span>
                                    </div>
                                    <p className="text-secondary-600 text-sm leading-relaxed mb-8 flex-1">
                                        {card.ideal}
                                    </p>
                                    <button
                                        id={`cta-preview-${card.tag.toLowerCase().replace(' ', '-')}`}
                                        onClick={() => handleOpenWhatsApp('preview_sala')}
                                        className="w-full bg-primary-950 text-white py-4 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group"
                                    >
                                        Consultar disponibilidade
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <p className="text-center text-accent-700 font-bold text-sm flex items-center justify-center gap-2 bg-accent-50 py-3 rounded-full md:w-fit md:mx-auto md:px-8">
                            <Clock className="w-4 h-4" />
                            Horários mais disputados: manhã e fim da tarde. Consulte agora.
                        </p>
                    </div>
                </section>

                {/* 3) Provas rápidas + depoimentos */}
                <section className="py-24 bg-warm-50/50">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <div className="flex items-center justify-center gap-1.5 mb-4">
                                <div className="flex text-yellow-500">
                                    <Star className="w-6 h-6 fill-current" />
                                    <Star className="w-6 h-6 fill-current" />
                                    <Star className="w-6 h-6 fill-current" />
                                    <Star className="w-6 h-6 fill-current" />
                                    <Star className="w-6 h-6 fill-current" />
                                </div>
                                <span className="text-xl font-black text-primary-950">4.9/5 no Google</span>
                            </div>
                            <span className="text-accent-600 font-bold text-sm tracking-widest uppercase mb-4 block underline decoration-accent-200 underline-offset-4">O QUE DIZEM NOSSOS PROFISSIONAIS</span>
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Quem atende, aprova o modelo Arthemi</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    name: "Dr. Ricardo Silva",
                                    role: "Psicólogo",
                                    text: "A localização é estratégica e o ambiente é excelente. Meus pacientes sempre elogiam a recepção e o café. Para mim, a flexibilidade foi o divisor de águas.",
                                    time: "Atende há 8 meses"
                                },
                                {
                                    name: "Dra. Ana Carolina",
                                    role: "Nutricionista",
                                    text: "Saí de um aluguel fixo que me prendia muito. Hoje só pago o que uso e minha margem de lucro aumentou 40% logo no primeiro mês.",
                                    time: "Atende há 1 ano"
                                },
                                {
                                    name: "Felipe Santos",
                                    role: "Fisioterapeuta",
                                    text: "As salas são amplas e já vêm com tudo pronto. Chego, atendo e vou embora sem me preocupar com limpeza ou manutenção. Sensacional.",
                                    time: "Atende há 6 meses"
                                }
                            ].map((item, i) => {
                                // Extrair iniciais ignorando Dr/Dra
                                const initials = item.name
                                    .replace(/Dr\.|Dra\./g, '')
                                    .trim()
                                    .split(' ')
                                    .map(n => n[0])
                                    .join('')
                                    .slice(0, 2);

                                return (
                                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-warm-200 shadow-sm relative h-full">
                                        <p className="text-secondary-600 mb-8 italic leading-relaxed">&quot;{item.text}&quot;</p>
                                        <div className="flex items-center gap-4 mt-auto">
                                            <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center font-bold text-accent-700">
                                                {initials}
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary-950">{item.name}</p>
                                                <p className="text-xs text-secondary-500 font-medium">{item.role} • {item.time}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>


                {/* How it Works Section */}
                <section className="py-24 bg-white border-y border-warm-100">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Como funciona? É direto ao ponto.</h2>
                            <p className="text-secondary-600 text-lg">Sem contratos complexos ou burocracia infinita.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                            {[
                                { step: "01", title: "Consulte pelo WhatsApp", desc: "Chame nossa recepção e escolha os horários que deseja atender hoje ou na semana." },
                                { step: "02", title: "Reserva Confirmada", desc: "Processo 100% online e rápido. Sem taxa de adesão ou contrato de fidelidade." },
                                { step: "03", title: "Chegue e Atenda", desc: "Estrutura pronta: ar ligado, café pronto e recepcionista aguardando seu paciente." },
                            ].map((item, i) => (
                                <div key={i} className="relative group text-center">
                                    <div className="text-7xl font-black text-accent-600/30 absolute -top-8 left-1/2 -translate-x-1/2 group-hover:text-accent-600/50 transition-colors -z-0">
                                        {item.step}
                                    </div>
                                    <div className="relative z-10 pt-8">
                                        <h3 className="text-2xl font-bold text-primary-950 mb-3">{item.title}</h3>
                                        <p className="text-secondary-600 leading-relaxed">{item.desc}</p>
                                    </div>
                                    {i < 2 && <ArrowRight className="hidden md:block absolute top-1/2 -right-6 -translate-y-12 text-warm-200 w-12 h-12" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5) Benefits Section */}
                <section className="py-24 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Estrutura completa para você focar no paciente</h2>
                            <p className="text-secondary-600 text-lg">Tudo o que você precisa em um só lugar, sem taxas extras.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { icon: ShieldCheck, title: "Zero Burocracia", desc: "Sem contrato de fidelidade ou taxa de adesão." },
                                { icon: Clock, title: "Agendamento Flexível", desc: "Reserve por hora ou em pacotes conforme sua demanda." },
                                { icon: Sparkles, title: "Estrutura Premium", desc: "Consultórios decorados, climatizados e prontos para uso." },
                                { icon: Wifi, title: "Tudo Incluso", desc: "Limpeza, recepção, internet, café, água e insumos básicos." },
                            ].map((item, i) => (
                                <div key={i} className="p-8 rounded-3xl bg-warm-50 border border-warm-100 hover:shadow-lg transition-all group">
                                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <item.icon className="w-7 h-7 text-accent-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary-950 mb-3">{item.title}</h3>
                                    <p className="text-secondary-600 leading-relaxed text-sm">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 6) Visita Guiada (Incentive Section) */}
                <section className="bg-primary-950 py-16">
                    <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="text-white">
                            <span className="text-accent-400 font-black text-sm uppercase tracking-widest mb-4 block">OFERTA PARA QUEM ESTÁ INSEGURO</span>
                            <h3 className="text-3xl sm:text-4xl font-black mb-4">Primeira vez na Arthemi?</h3>
                            <p className="text-primary-200 text-lg leading-relaxed max-w-xl">Venha conhecer pessoalmente. Ganhe uma visita guiada com café e tour pelo espaço antes da sua primeira reserva.</p>
                        </div>
                        <button
                            id="cta-visita-guiada"
                            onClick={() => handleOpenWhatsApp('visita_guiada')}
                            className="bg-accent-600 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-accent-700 transition-all flex items-center gap-3 shadow-2xl shadow-accent-600/30 group"
                        >
                            Agendar Visita Gratuita
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </section>


                {/* Rooms Section */}
                <section className="py-24 bg-warm-50">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Conheça cada ambiente</h2>
                                <p className="text-secondary-600 text-lg">Valores transparentes e indicações de uso para facilitar sua escolha.</p>
                                <p className="text-accent-700 font-bold text-sm mt-3 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Horários mais disputados: manhã e fim da tarde. Garanta o seu.
                                </p>
                            </div>
                            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Em até 5 minutos via WhatsApp
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {rooms.map((room) => {
                                let badge = "";
                                let badgeColor = "bg-accent-600";
                                let imageUrl = room.imageUrl;
                                let indication = "";

                                if (room.slug === 'sala-a') {
                                    imageUrl = '/images/sala-a/foto-4.jpeg';
                                    badge = "O MAIS COMPLETO";
                                    indication = "Ideal para procedimentos / maca";
                                } else if (room.slug === 'sala-b') {
                                    imageUrl = '/images/sala-b/02-3.jpeg';
                                    badge = "MELHOR CUSTO-BENEFÍCIO";
                                    indication = "Consultório amplo e versátil";
                                } else if (room.slug === 'sala-c') {
                                    imageUrl = '/images/sala-c/03-1.jpeg';
                                    badge = "O MAIS RESERVADO";
                                    indication = "Ideal para psicoterapia e nutrição";
                                }

                                return (
                                    <div key={room.id} className="bg-white rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-warm-200 group">
                                        <div className="relative h-64 cursor-pointer overflow-hidden" onClick={() => handleOpenGallery({ name: room.name, slug: room.slug })}>
                                            <Image
                                                src={imageUrl || '/images/hero/banner.jpeg'}
                                                alt={room.name}
                                                fill
                                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                                                <span className="text-white font-bold flex items-center gap-2">
                                                    <Eye className="w-5 h-5" /> Ver todas as fotos
                                                </span>
                                            </div>
                                            {badge && (
                                                <div className={`absolute top-4 left-4 ${badgeColor} text-white text-[10px] font-black tracking-widest px-3 py-1 rounded-full`}>
                                                    {badge}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-8">
                                            <div className="mb-4">
                                                <span className="text-accent-600 text-xs font-bold uppercase tracking-wider">{indication}</span>
                                                <h3 className="text-2xl font-bold text-primary-950 mt-1">{room.name}</h3>
                                            </div>

                                            <div className="flex items-baseline gap-1 mb-8">
                                                <span className="text-4xl font-black text-primary-900">{formatCurrency(room.hourlyRate / 100)}</span>
                                                <span className="text-secondary-400 font-medium">/hora</span>
                                            </div>

                                            <div className="space-y-3 mb-8">
                                                {room.amenities.slice(0, 4).map((amenity, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm text-secondary-600">
                                                        <CheckCircle2 className="w-4 h-4 text-accent-500" />
                                                        {amenity}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => handleOpenWhatsApp('disponibilidade')}
                                                className="w-full bg-primary-950 text-white py-4 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group"
                                            >
                                                Consultar disponibilidade
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                            <p className="text-[10px] text-center text-secondary-400 mt-2 font-medium">Sábados costumam esgotar primeiro</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Ideal for Section */}
                <section className="py-24 bg-white border-t border-warm-100">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-warm-50/50 rounded-[3rem] p-8 md:p-16 border border-warm-100">
                            <div>
                                <h3 className="text-2xl font-bold text-primary-950 mb-8 flex items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    Ideal para:
                                </h3>
                                <ul className="space-y-4">
                                    {[
                                        "Psicólogos, Nutricionistas e Médicos",
                                        "Fisioterapeutas e Esteticistas",
                                        "Profissionais que buscam flexibilidade total",
                                        "Quem quer reduzir custos fixos com consultório",
                                        "Quem precisa de localização estratégica em BH"
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-start gap-3 text-secondary-700 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent-400 mt-2 flex-shrink-0" />
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="border-t md:border-t-0 md:border-l border-warm-200 pt-8 md:pt-0 md:pl-12">
                                <h3 className="text-2xl font-bold text-primary-950 mb-8 flex items-center gap-2">
                                    <HelpCircle className="w-6 h-6 text-secondary-400" />
                                    Não é ideal para:
                                </h3>
                                <ul className="space-y-4">
                                    {[
                                        "Demandas que exigem internação ou estrutura hospitalar",
                                        "Quem busca exclusividade de sala por meses no mesmo local",
                                        "Procedimentos que exigem descarte de resíduos cirúrgicos pesados"
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-start gap-3 text-secondary-500 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-warm-300 mt-2 flex-shrink-0" />
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Segmented Section */}
                <section className="py-24 bg-warm-50/30">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Perfeito para sua especialidade</h2>
                            <p className="text-secondary-600 text-lg">Ambientes pensados para diferentes nichos de atuação.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
                            {[
                                { label: "Psicólogos", desc: "Ambientes acolhedores e privativos." },
                                { label: "Nutricionistas", desc: "Estrutura para avaliações completas." },
                                { label: "Fisioterapeutas", desc: "Salas com espaço para maca e mobilidade." },
                                { label: "Médicos", desc: "Design profissional e área hospitalar." },
                            ].map((item, i) => (
                                <div key={i} className="p-8 rounded-[2.5rem] bg-white border border-warm-100 shadow-sm hover:-translate-y-1 transition-all">
                                    <h4 className="text-lg font-bold text-primary-950 mb-3">{item.label}</h4>
                                    <p className="text-xs text-secondary-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Packages Placeholder (since mentioned but not detailed in original base) */}
                <section className="py-24 bg-white">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="bg-primary-950 rounded-[3rem] p-8 md:p-16 text-center text-white relative overflow-hidden">
                            <Sparkles className="absolute top-8 right-8 w-24 h-24 text-white/5" />
                            <h2 className="text-3xl font-black mb-6">Quer economizar ainda mais?</h2>
                            <p className="text-primary-200 text-lg mb-4 max-w-2xl mx-auto">
                                Temos pacotes de horas (10h, 20h ou mais) com valores reduzidos para quem atende com recorrência.
                            </p>
                            <p className="text-white font-bold text-xl mb-12">
                                Pra quem atende toda semana e quer reduzir o custo/hora.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-12">
                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-2xl">
                                    <p className="text-sm font-bold uppercase tracking-widest text-accent-300 mb-2">Pacote 10h</p>
                                    <p className="text-2xl font-black">Consulte Desconto</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-2xl">
                                    <p className="text-sm font-bold uppercase tracking-widest text-accent-300 mb-2">Pacote 20h</p>
                                    <p className="text-2xl font-black">Maior Economia</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleOpenWhatsApp('disponibilidade')}
                                className="bg-accent-600 text-white px-8 py-5 rounded-2xl font-bold text-lg hover:bg-accent-700 transition-all flex items-center justify-center gap-2 mx-auto"
                            >
                                Consultar pacotes ideais
                            </button>
                        </div>
                    </div>
                </section>

                {/* Anti-Objection FAQ Section */}
                <section className="py-24 bg-warm-50 overflow-hidden relative">
                    <div className="max-w-4xl mx-auto px-4 relative z-10">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Dúvidas que travam a decisão?</h2>
                            <p className="text-secondary-600">Transparência total para você começar hoje mesmo.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-warm-200 p-8 shadow-sm flex flex-col h-full border-b-[6px] border-b-accent-100">
                                    <h3 className="text-lg font-bold text-primary-950 mb-3 flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent-400 mt-2.5 flex-shrink-0" />
                                        {faq.q}
                                    </h3>
                                    <div className="bg-warm-50 p-4 rounded-xl">
                                        <p className="text-primary-900 font-medium leading-relaxed text-sm">
                                            {faq.a}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-8 rounded-[2rem] bg-accent-600 text-white text-center">
                            <h3 className="text-2xl font-bold mb-4">Pronto para começar?</h3>
                            <p className="mb-8 text-accent-100 text-lg">Nosso time responde em até 5 minutos no WhatsApp.</p>
                            <button
                                id="cta-final-whatsapp"
                                onClick={() => handleOpenWhatsApp('cta_final')}
                                className="bg-white text-accent-700 px-10 py-5 rounded-2xl font-black text-xl hover:bg-warm-50 transition-all flex items-center justify-center gap-2 mx-auto shadow-2xl"
                            >
                                Ver horários disponíveis agora no WhatsApp
                                <MessageCircle className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Decorative background element */}
                    <HelpCircle className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] text-warm-200/50 -rotate-12" />
                </section>

                {/* Location Section */}
                <section className="py-24 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div>
                                <span className="text-accent-600 font-bold text-sm tracking-widest uppercase mb-4 block">LOCALIZAÇÃO ESTRATÉGICA</span>
                                <h2 className="text-4xl font-black text-primary-950 mb-6">No coração da Área Hospitalar de BH</h2>
                                <p className="text-secondary-600 text-lg mb-8 leading-relaxed">
                                    Localizados no bairro Santa Efigênia, facilitamos o acesso para você e seus pacientes,
                                    em uma região com infraestrutura completa de serviços e transporte.
                                </p>
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-5 h-5 text-accent-700" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary-900">Endereço</p>
                                            <p className="text-secondary-600">Rua Padre Rolim, 815 - Santa Efigênia, Belo Horizonte/MG</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[400px] rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
                                <iframe
                                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3750.963240212001!2d-43.9248451241165!3d-19.925954380922886!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDU1JzMzLjQiUyA0M8KwNTUnMjEuNSJX!5e0!3m2!1spt-BR!2sbr!4v1704380601234!5m2!1spt-BR!2sbr"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Minimal Footer */}
                <footer className="py-12 bg-warm-50 border-t border-warm-200">
                    <div className="max-w-6xl mx-auto px-4 text-center">
                        <Image
                            src="/images/Logo/logo.webp"
                            alt="Espaço Arthemi"
                            width={100}
                            height={40}
                            className="h-8 w-auto mx-auto mb-6 grayscale opacity-60"
                        />
                        <p className="text-secondary-400 text-sm">
                            © {new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
                        </p>
                        <div className="mt-4 flex justify-center gap-6 text-xs text-secondary-400">
                            <Link href="/termos" className="hover:text-accent-600 transition">Termos de Uso</Link>
                            <Link href="/privacidade" className="hover:text-accent-600 transition">Privacidade</Link>
                        </div>
                    </div>
                </footer>

                {/* Floating Mobile CTA */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-t border-warm-100 p-4 grid grid-cols-2 gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                    <button
                        id="mobile-cta-availability"
                        onClick={() => handleOpenWhatsApp('mobile_disponibilidade')}
                        className="flex items-center justify-center gap-2 bg-green-100 text-green-700 py-4 rounded-xl font-bold text-sm"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Ver Horários
                    </button>
                    <button
                        id="mobile-cta-consult"
                        onClick={() => handleOpenWhatsApp('mobile_consultar')}
                        className="bg-accent-600 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-accent-600/20"
                    >
                        Consultar Agora
                    </button>
                </div>
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
      `}</style>
        </>
    );
}

export const getServerSideProps: GetServerSideProps<LPPremiumPageProps> = async (context) => {
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
        console.error(`ERRO no SSR /lp-premium:`, error);
        return {
            props: {
                rooms: [],
            },
        };
    }
};
