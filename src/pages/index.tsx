// ===========================================================
// Página Inicial - Landing Page de Conversão (MVP WhatsApp)
// ===========================================================

import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import RoomGalleryModal from '@/components/RoomGalleryModal';
import LeadFormModal from '@/components/LeadFormModal';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { formatCurrency } from '@/lib/utils';
import { PRICES_V3, formatPrice } from '@/constants/prices';
import { Lightbulb, CheckCircle2, Eye } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { WHATSAPP_NUMBER } from '@/config/contact';

// ============================================================
// FUNÇÃO PARA CONSTRUIR URL WHATSAPP
// ============================================================
function buildWhatsAppUrl(roomName: string): string {
    const message = `Olá, estou no site da Arthemi e gostaria de saber mais sobre a reserva do ${roomName}`;
    return `https://wa.me/5531999923910?text=${encodeURIComponent(message)}`;
}

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

interface HomeProps {
    rooms: Room[];
}

export default function Home({ rooms }: HomeProps) {
    const router = useRouter();
    const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string } | null>(null);
    const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
    const [selectedRoomName, setSelectedRoomName] = useState('');

    // Track de ViewContent: evita disparo duplicado para a mesma sala na mesma sessão
    const viewedRoomsRef = useRef<Set<string>>(new Set());

    // Handler para abrir o formulário de qualificação (Substitui o redirect direto)
    const handleOpenBooking = (roomName: string) => {
        setSelectedRoomName(roomName);
        setIsLeadFormOpen(true);
    };

    // Handler para abrir galeria de fotos (dispara ViewContent)
    const handleOpenGallery = (galleryData: { name: string; slug: string }) => {
        setGalleryRoom(galleryData);

        // Disparar ViewContent apenas 1x por sala por sessão
        if (!viewedRoomsRef.current.has(galleryData.slug)) {
            viewedRoomsRef.current.add(galleryData.slug);

            const room = rooms.find(r => r.slug === galleryData.slug);
            if (room) {
                analytics.roomViewed(room.id, galleryData.name, room.hourlyRate);
            }
        }
    };

    return (
        <>
            <SEO
                title={PAGE_SEO.home.title}
                description={PAGE_SEO.home.description}
                keywords={PAGE_SEO.home.keywords}
                path="/"
            />
            <BreadcrumbSchema items={[
                { name: 'Home', path: '/' },
                { name: 'Consultórios e Investimento', path: '/' },
            ]} />

            <Layout compactFooter>
                {/* Hero */}
                <div className="relative text-white py-16 overflow-hidden">
                    {/* Foto de fundo desfocada */}
                    <Image
                        src="/images/espaco/Recepcao-01.jpeg"
                        alt=""
                        aria-hidden="true"
                        fill
                        className="object-cover"
                        style={{ filter: 'blur(8px)', transform: 'scale(1.05)' }}
                        priority
                    />
                    {/* Overlay nude/warm */}
                    <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(135deg, rgba(180,150,130,0.55) 0%, rgba(160,130,110,0.65) 100%)' }}
                    />
                    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Consultórios e investimento</h1>
                        <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-6">
                            Valores claros e sem surpresas. Transparência total em relação aos preços praticados.
                        </p>
                        <p className="text-white/60 text-sm font-medium">
                            Sem taxa de adesão. Sem fidelidade.
                        </p>
                    </div>
                </div>

                {/* Lista de Consultórios */}
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Bloco de inclusões */}
                    <div className="bg-accent-50 rounded-xl p-8 mb-12 border border-accent-200">
                        <div className="flex items-start gap-5">
                            <div className="flex-shrink-0 w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center">
                                <Lightbulb className="w-6 h-6 text-accent-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-primary-900 mb-5">
                                    A reserva do consultório inclui:
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                                    {['Consultório profissional', 'Internet de alta velocidade', 'Recepção', 'Limpeza', 'Café e água', 'Insumos básicos'].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 py-1">
                                            <CheckCircle2 className="w-5 h-5 text-accent-600 flex-shrink-0" />
                                            <span className="text-sm text-secondary-700">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cards dos Consultórios com imagens clicáveis */}
                    <div data-cards-section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 scroll-mt-20">
                        {rooms.length > 0 ? (
                            rooms.map((room) => {
                                // HARDCODED ASSETS FOR PREMIUM DESIGN
                                let imageUrl = room.imageUrl;
                                let shortDescription = room.description;

                                if (room.slug === 'sala-a') {
                                    imageUrl = '/images/sala-a/foto-4.jpeg';
                                    shortDescription = 'Espaço premium';
                                } else if (room.slug === 'sala-b') {
                                    imageUrl = '/images/sala-b/02-3.jpeg';
                                    shortDescription = 'Consultório amplo';
                                } else if (room.slug === 'sala-c') {
                                    imageUrl = '/images/sala-c/03-1.jpeg';
                                    shortDescription = 'Espaço intimista';
                                }

                                return (
                                    <div
                                        key={room.id}
                                        className="group relative rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white border border-warm-200"
                                    >
                                        <div
                                            className="relative w-full h-48 sm:h-56 cursor-pointer"
                                            onClick={() => handleOpenGallery({ name: room.name, slug: room.slug })}
                                        >
                                            <Image
                                                src={imageUrl || '/images/hero/banner.jpeg'}
                                                alt={room.name}
                                                fill
                                                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary-800 px-4 py-2 rounded-full font-semibold flex items-center gap-2">
                                                    <Eye className="w-4 h-4" />
                                                    Ver fotos
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-primary-900 mb-1">{room.name}</h3>
                                            <p className="text-sm text-accent-600 font-medium mb-3">{shortDescription}</p>
                                            <div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-bold text-accent-600">
                                                        {formatCurrency(room.hourlyRate / 100)}
                                                    </span>
                                                    <span className="text-secondary-500 text-sm">/hora</span>
                                                </div>
                                            </div>

                                            {/* Botão de Reserva */}
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                <button
                                                    onClick={() => handleOpenBooking(room.name)}
                                                    className="bg-accent-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors w-full"
                                                >
                                                    Reservar agora
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-3 text-center py-12 text-secondary-500">
                                Nenhum consultório disponível no momento.
                            </div>
                        )}
                    </div>

                    {/* Tabela de Preços por Consultório */}
                    <section>
                        <h2 className="text-2xl font-bold text-primary-900 mb-4 text-center">
                            Tabela completa de preços
                        </h2>
                        <p className="text-center text-secondary-600 mb-8 max-w-2xl mx-auto">
                            Compare as opções e escolha a que melhor se encaixa na sua rotina de atendimentos.
                        </p>

                        {[
                            { slug: 'sala-a', key: 'SALA_A' as const, title: 'Consultório 1 | Prime — Espaço premium', name: 'Consultório 1 | Prime' },
                            { slug: 'sala-b', key: 'SALA_B' as const, title: 'Consultório 2 | Executive — Consultório amplo', name: 'Consultório 2 | Executive' },
                            { slug: 'sala-c', key: 'SALA_C' as const, title: 'Consultório 3 | Essential — Espaço intimista', name: 'Consultório 3 | Essential' },
                        ].map((roomData) => {
                            const roomPrices = PRICES_V3[roomData.key].prices;
                            const baseHourlyPrice = roomPrices.HOURLY_RATE;

                            const packages = [
                                { hours: 1, label: '1h', price: baseHourlyPrice, isHourly: true },
                                { hours: 10, label: '10h', price: roomPrices.PACKAGE_10H, isHourly: false },
                                { hours: 20, label: '20h', price: roomPrices.PACKAGE_20H, isHourly: false },
                                { hours: 40, label: '40h', price: roomPrices.PACKAGE_40H, isHourly: false },
                            ];

                            return (
                                <div key={roomData.slug} className="mb-10">
                                    <h3 className="text-xl font-semibold text-primary-800 mb-4">
                                        {roomData.title}
                                    </h3>
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-warm-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[600px]">
                                                <thead className="bg-warm-100">
                                                    <tr>
                                                        <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Hora avulsa</th>
                                                        <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Horas contratadas</th>
                                                        <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Preço total</th>
                                                        <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Preço por hora</th>
                                                        <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Desconto</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-warm-100">
                                                    {packages.map((pkg, idx) => {
                                                        const pricePerHour = pkg.price / pkg.hours;
                                                        const discount = pkg.isHourly ? 0 : Math.round(((baseHourlyPrice - pricePerHour) / baseHourlyPrice) * 100);

                                                        return (
                                                            <tr key={idx} className={`hover:bg-warm-50 ${!pkg.isHourly ? 'bg-accent-50/30' : ''}`}>
                                                                <td className="px-4 sm:px-6 py-4 text-center">
                                                                    <span className="text-secondary-600">
                                                                        {formatPrice(baseHourlyPrice)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 sm:px-6 py-4 text-center text-secondary-600 font-medium">
                                                                    {pkg.label}
                                                                </td>
                                                                <td className="px-4 sm:px-6 py-4 text-center">
                                                                    <span className="font-semibold text-accent-600">
                                                                        {formatPrice(pkg.price)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 sm:px-6 py-4 text-center">
                                                                    <span className="font-medium text-primary-800">
                                                                        {formatPrice(pricePerHour)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 sm:px-6 py-4 text-center">
                                                                    {discount > 0 ? (
                                                                        <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                                                                            -{discount}%
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-secondary-400">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* CTA Reservar para cada sala */}
                                        <div className="border-t border-warm-200 bg-accent-50/50 p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-sm text-secondary-700">
                                                    Quer reservar? Clique no botão abaixo!
                                                </p>
                                                <button
                                                    onClick={() => handleOpenBooking(roomData.name)}
                                                    className="bg-accent-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors text-sm"
                                                >
                                                    Reservar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    {/* Bloco de confiança */}
                    <section className="mt-16 bg-warm-100 rounded-xl p-8 text-center">
                        <h2 className="text-2xl font-bold text-primary-900 mb-4">
                            Sem letras miúdas
                        </h2>
                        <p className="text-secondary-600 max-w-2xl mx-auto mb-6">
                            O valor que você vê é o valor que você paga. Não cobramos taxa de adesão,
                            não temos fidelidade e não há custos extras. Se precisar cancelar ou remarcar,
                            basta avisar com 24 horas de antecedência.
                        </p>
                        <Link
                            href="/faq"
                            className="inline-block text-accent-600 font-medium hover:text-accent-700 transition"
                        >
                            Ver perguntas frequentes →
                        </Link>
                    </section>
                </main>
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

            {/* Modal de Qualificação de Lead */}
            <LeadFormModal
                isOpen={isLeadFormOpen}
                onClose={() => setIsLeadFormOpen(false)}
                initialRoomName={selectedRoomName}
            />
        </>
    );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
    const requestId = `ssr-home-${Date.now()}`;

    try {
        console.log(`[${requestId}] SSR /home (MVP WhatsApp) iniciado`);

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

        console.log(`[${requestId}] roomsCount: ${rooms.length}`);

        return {
            props: {
                rooms: rooms.map(room => ({
                    ...room,
                    hourlyRate: room.hourlyRate || 0,
                })),
            },
        };
    } catch (error) {
        console.error(`[${requestId}] ERRO no SSR /home:`, error);
        return {
            props: {
                rooms: [],
            },
        };
    }
};
