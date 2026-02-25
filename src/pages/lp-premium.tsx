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
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

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

    const handleOpenWhatsApp = () => {
        trackEvent('clique_whatsapp');
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de saber mais sobre o Espaço Arthemi.`;
        window.open(url, '_blank');
    };

    const handleOpenGallery = (galleryData: { name: string; slug: string }) => {
        trackEvent('clique_fotos', { room: galleryData.name });
        setGalleryRoom(galleryData);
    };

    const faqs = [
        { q: "Precisa contrato longo?", a: "Não. Aqui você reserva por hora ou pacote de horas, sem fidelidade e sem burocracia." },
        { q: "Tem taxa de adesão?", a: "Absolutamente não. R$0 de taxa de adesão. Você só paga pelo que usar." },
        { q: "Posso cancelar ou remarcar?", a: "Sim! Com até 48h de antecedência você pode cancelar ou remarcar sem custos profissionais." },
        { q: "Tem recepção e limpeza inclusos?", a: "Sim, estrutura completa: recepção para seus pacientes, limpeza impecável, café, água e internet fibra." },
        { q: "Serve para minha profissão?", a: "Atendemos Psicólogos, Nutricionistas, Fisioterapeutas, Médicos e diversos outros profissionais da saúde e bem-estar." },
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
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-warm-100">
                    <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
                        <Image
                            src="/images/Logo/logo.webp"
                            alt="Espaço Arthemi"
                            width={130}
                            height={52}
                            className="h-10 w-auto"
                            priority
                        />
                        <button
                            onClick={handleOpenWhatsApp}
                            className="hidden sm:flex items-center gap-2 text-accent-700 font-semibold text-sm hover:underline"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Falar no WhatsApp
                        </button>
                    </div>
                </header>

                {/* Hero Section */}
                <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-32 overflow-hidden bg-gradient-to-b from-warm-50 to-white">
                    <div className="max-w-6xl mx-auto px-4 relative z-10">
                        <div className="max-w-3xl">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-accent-100 text-accent-700 text-sm font-bold mb-6 animate-fade-in">
                                SOLUÇÃO PREMIUM PARA PROFISSIONAIS DE SAÚDE
                            </span>
                            <h1 className="text-4xl sm:text-6xl font-black text-primary-950 leading-[1.1] mb-6">
                                Atenda em consultório premium na área hospitalar de BH <span className="text-accent-600">sem aluguel fixo</span>.
                            </h1>
                            <p className="text-xl text-secondary-600 mb-10 leading-relaxed max-w-xl">
                                Reserve por hora, atenda com estrutura completa e sem burocracia <br className="hidden md:block" /> — recepção, limpeza e internet inclusos.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => handleOpenBooking('')}
                                    className="bg-accent-600 text-white px-8 py-5 rounded-2xl font-bold text-lg shadow-xl shadow-accent-600/20 hover:bg-accent-700 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                                >
                                    Quero reservar meu consultório
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleOpenWhatsApp}
                                    className="bg-white text-secondary-800 border-2 border-warm-200 px-8 py-5 rounded-2xl font-bold text-lg hover:bg-warm-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-6 h-6 text-green-600" />
                                    Falar no WhatsApp agora
                                </button>
                            </div>

                            {/* Quick Proof */}
                            <div className="mt-12 flex flex-wrap gap-8 items-center border-t border-warm-200 pt-8">
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
                    </div>

                    {/* Hero Decorative Image (Desktop) */}
                    <div className="hidden lg:block absolute top-20 right-[-10%] w-[50%] h-[80%] rounded-3xl overflow-hidden shadow-2xl rotate-2">
                        <Image
                            src="/images/espaco/Recepcao-01.jpeg"
                            alt="Espaço Arthemi"
                            fill
                            className="object-cover"
                        />
                    </div>
                </section>

                {/* Benefits Section */}
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

                {/* Incentive Section */}
                <section className="bg-primary-950 py-12">
                    <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="text-white">
                            <h3 className="text-2xl font-bold mb-2">Primeira vez na Arthemi?</h3>
                            <p className="text-primary-200">Ganhe uma visita guiada com café e tour pelo espaço antes da sua primeira reserva.</p>
                        </div>
                        <button
                            onClick={handleOpenWhatsApp}
                            className="bg-white text-primary-950 px-8 py-4 rounded-xl font-bold hover:bg-primary-50 transition-colors whitespace-nowrap"
                        >
                            Quero agendar uma visita
                        </button>
                    </div>
                </section>

                {/* Rooms Section */}
                <section className="py-24 bg-warm-50">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Nossos Consultórios</h2>
                                <p className="text-secondary-600 text-lg">Valores transparentes e indicações de uso para facilitar sua escolha.</p>
                            </div>
                            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Responda em minutos via WhatsApp
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
                                                onClick={() => handleOpenBooking(room.name)}
                                                className="w-full bg-primary-950 text-white py-4 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group"
                                            >
                                                Reservar agora
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Segmented Section */}
                <section className="py-24 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-black text-primary-950 mb-4">Perfeito para sua especialidade</h2>
                            <p className="text-secondary-600 text-lg">Ambientes pensados para diferentes nichos de atuação.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                            {[
                                { label: "Psicólogos", desc: "Ambientes acolhedores e privativos." },
                                { label: "Nutricionistas", desc: "Estrutura para avaliações completas." },
                                { label: "Fisioterapeutas", desc: "Salas com espaço para maca e mobilidade." },
                                { label: "Médicos", desc: "Design profissional e área hospitalar." },
                            ].map((item, i) => (
                                <div key={i} className="text-center p-6 rounded-3xl bg-warm-50 border border-warm-100">
                                    <h4 className="text-lg font-bold text-primary-950 mb-2">{item.label}</h4>
                                    <p className="text-xs text-secondary-500">{item.desc}</p>
                                </div>
                            ))}
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

                        <div className="space-y-4">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
                                    <button
                                        onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                        className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-warm-50 transition-colors"
                                    >
                                        <span className="text-lg font-bold text-primary-900">{faq.q}</span>
                                        <ChevronDown className={`w-5 h-5 text-secondary-400 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    {activeFaq === i && (
                                        <div className="px-8 pb-6 text-secondary-600 leading-relaxed border-t border-warm-50 pt-4 animate-in slide-in-from-top-4">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-8 rounded-[2rem] bg-accent-600 text-white text-center">
                            <h3 className="text-2xl font-bold mb-4">Ainda tem alguma pergunta?</h3>
                            <p className="mb-8 text-accent-100">Nosso time está pronto para te ajudar no WhatsApp agora.</p>
                            <button
                                onClick={handleOpenWhatsApp}
                                className="bg-white text-accent-700 px-8 py-4 rounded-xl font-bold hover:bg-warm-50 transition-all flex items-center justify-center gap-2 mx-auto"
                            >
                                Chamar no WhatsApp
                                <MessageCircle className="w-5 h-5" />
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
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-warm-100 p-4 grid grid-cols-2 gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={handleOpenWhatsApp}
                        className="flex items-center justify-center gap-2 bg-green-100 text-green-700 py-4 rounded-xl font-bold text-sm"
                    >
                        <MessageCircle className="w-5 h-5" />
                        WhatsApp
                    </button>
                    <button
                        onClick={() => handleOpenBooking('')}
                        className="bg-accent-600 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-accent-600/20"
                    >
                        Reservar Agora
                    </button>
                </div>
            </Layout>

            {/* Modal de Galeria */}
            {galleryRoom && (
                <RoomGalleryModal
                    isOpen={!!galleryRoom}
                    onClose={() => setGalleryRoom(null)}
                    onReservar={() => {
                        setGalleryRoom(null);
                        handleOpenBooking(galleryRoom.name);
                    }}
                    room={galleryRoom}
                />
            )}

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
