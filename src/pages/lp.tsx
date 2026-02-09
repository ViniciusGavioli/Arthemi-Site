// ===========================================================
// Página /lp - Landing Page de Conversão via WhatsApp
// Cópia da /salas com CTAs redirecionando para WhatsApp
// ===========================================================

import { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import RoomGalleryModal from '@/components/RoomGalleryModal';
import BookingModal from '@/components/BookingModal';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { formatCurrency } from '@/lib/utils';
import { PRICES_V3, formatPrice, getAllProductsForRoom } from '@/constants/prices';
import { Lightbulb, CheckCircle2, Eye } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { WHATSAPP_NUMBER } from '@/config/contact';

// ============================================================
// FUNÇÃO PARA CONSTRUIR URL WHATSAPP COM UTMs
// ============================================================
function buildWhatsAppUrl(roomName: string, utmParams: Record<string, string | undefined>): string {
  const baseMessage = `Oi! Quero reservar a sala ${roomName} no Espaço Arthemi. Pode me passar horários disponíveis e valores?`;
  
  // Adiciona UTMs se existirem
  const utmParts: string[] = [];
  if (utmParams.utm_source) utmParts.push(`utm_source: ${utmParams.utm_source}`);
  if (utmParams.utm_medium) utmParts.push(`utm_medium: ${utmParams.utm_medium}`);
  if (utmParams.utm_campaign) utmParts.push(`utm_campaign: ${utmParams.utm_campaign}`);
  if (utmParams.utm_content) utmParts.push(`utm_content: ${utmParams.utm_content}`);
  if (utmParams.utm_term) utmParts.push(`utm_term: ${utmParams.utm_term}`);
  
  const fullMessage = utmParts.length > 0 
    ? `${baseMessage}\n\n[${utmParts.join(' | ')}]`
    : baseMessage;
  
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(fullMessage)}`;
}

// Helper para calcular menor preço por hora de um consultório
function getLowestHourlyPrice(salaKey: 'SALA_A' | 'SALA_B' | 'SALA_C'): number {
  const prices = PRICES_V3[salaKey].prices;
  
  const hourlyOptions = [
    prices.HOURLY_RATE,
    prices.PACKAGE_10H / 10,
    prices.PACKAGE_20H / 20,
    prices.PACKAGE_40H / 40,
  ];
  
  return Math.min(...hourlyOptions);
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

interface LPPageProps {
  rooms: Room[];
}

export default function LPPage({ rooms }: LPPageProps) {
  const router = useRouter();
  const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string } | null>(null);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  
  // Captura UTMs da URL
  const utmParams = {
    utm_source: router.query.utm_source as string | undefined,
    utm_medium: router.query.utm_medium as string | undefined,
    utm_campaign: router.query.utm_campaign as string | undefined,
    utm_content: router.query.utm_content as string | undefined,
    utm_term: router.query.utm_term as string | undefined,
  };
  
  // Track de ViewContent: evita disparo duplicado para a mesma sala na mesma sessão
  const viewedRoomsRef = useRef<Set<string>>(new Set());

  // Dados para modal de galeria e cards (com preço calculado dinamicamente)
  const roomsGalleryData = [
    {
      name: 'Consultório 1 | Prime',
      slug: 'sala-a',
      description: 'Espaço premium',
      price: formatPrice(getLowestHourlyPrice('SALA_A')),
    },
    {
      name: 'Consultório 2 | Executive',
      slug: 'sala-b',
      description: 'Consultório amplo',
      price: formatPrice(getLowestHourlyPrice('SALA_B')),
    },
    {
      name: 'Consultório 3 | Essential',
      slug: 'sala-c',
      description: 'Espaço intimista',
      price: formatPrice(getLowestHourlyPrice('SALA_C')),
    },
  ];

  // Handler para abrir modal de reserva (igual à página inicial)
  const handleOpenBooking = (roomSlug: string) => {
    // Busca a sala do banco pelo slug
    const dbRoom = rooms.find(r => r.slug === roomSlug);
    if (dbRoom) {
      setBookingRoom(dbRoom);
    } else {
      // Fallback: se não encontrou a sala no banco, redireciona para WhatsApp
      const whatsappUrl = buildWhatsAppUrl('Espaço Arthemi', utmParams);
      window.open(whatsappUrl, '_blank');
    }
  };

  // Handler para abrir WhatsApp (mantido para outros casos)
  const handleReservar = (roomName: string) => {
    const whatsappUrl = buildWhatsAppUrl(roomName, utmParams);
    window.open(whatsappUrl, '_blank');
  };

  // Handler para abrir galeria de fotos (dispara ViewContent)
  const handleOpenGallery = (galleryData: { name: string; slug: string }) => {
    setGalleryRoom(galleryData);
    
    // Disparar ViewContent apenas 1x por sala por sessão
    if (!viewedRoomsRef.current.has(galleryData.slug)) {
      viewedRoomsRef.current.add(galleryData.slug);
      
      const room = rooms.find(r => r.slug === galleryData.slug);
      if (room) {
        const roomKey = galleryData.slug === 'sala-a' ? 'SALA_A' : 
                        galleryData.slug === 'sala-b' ? 'SALA_B' : 'SALA_C';
        const lowestPrice = getLowestHourlyPrice(roomKey);
        
        analytics.roomViewed(room.id, galleryData.name, lowestPrice * 100);
      }
    }
  };


  return (
    <>
      <SEO
        title={PAGE_SEO.salas.title}
        description={PAGE_SEO.salas.description}
        keywords={PAGE_SEO.salas.keywords}
        path="/lp"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', path: '/' },
        { name: 'Consultórios e Investimento', path: '/lp' },
      ]} />

      <Layout compactFooter>
        {/* Hero */}
        <div className="bg-accent-700 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Consultórios e investimento</h1>
            <p className="text-lg sm:text-xl text-accent-100 max-w-2xl mx-auto mb-6">
              Valores claros e sem surpresas. Transparência total em relação aos preços praticados.
            </p>
            <p className="text-accent-200 text-sm font-medium">
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
              rooms.map((room, index) => {
                const galleryData = roomsGalleryData[index];
                const imageUrl = room.slug === 'sala-a' ? '/images/sala-a/foto-4.jpeg' : 
                                 room.slug === 'sala-b' ? '/images/sala-b/02-3.jpeg' : 
                                 '/images/sala-c/03-1.jpeg';
                return (
                  <div 
                    key={room.id}
                    className="group relative rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white border border-warm-200"
                  >
                    <div 
                      className="relative w-full h-48 sm:h-56 cursor-pointer"
                      onClick={() => handleOpenGallery(galleryData)}
                    >
                      <Image 
                        src={imageUrl}
                        alt={galleryData.name}
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
                      <h3 className="text-lg font-bold text-primary-900 mb-1">{galleryData.name}</h3>
                      <p className="text-sm text-accent-600 font-medium mb-3">{galleryData.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-secondary-500">A partir de</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-accent-600">{galleryData.price}</span>
                            <span className="text-secondary-500 text-sm">/hora</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenBooking(galleryData.slug)}
                          className="bg-accent-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors"
                        >
                          Reservar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback quando rooms está vazio */
              roomsGalleryData.map((galleryData, index) => {
                const imageUrl = galleryData.slug === 'sala-a' ? '/images/sala-a/foto-4.jpeg' : 
                                 galleryData.slug === 'sala-b' ? '/images/sala-b/02-3.jpeg' : 
                                 '/images/sala-c/03-1.jpeg';
                return (
                  <div 
                    key={galleryData.slug}
                    className="group relative rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white border border-warm-200"
                  >
                    <div 
                      className="relative w-full h-48 sm:h-56 cursor-pointer"
                      onClick={() => handleOpenGallery(galleryData)}
                    >
                      <Image 
                        src={imageUrl}
                        alt={galleryData.name}
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
                      <h3 className="text-lg font-bold text-primary-900 mb-1">{galleryData.name}</h3>
                      <p className="text-sm text-accent-600 font-medium mb-3">{galleryData.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-secondary-500">A partir de</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-accent-600">{galleryData.price}</span>
                            <span className="text-secondary-500 text-sm">/hora</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenBooking(galleryData.slug)}
                          className="bg-accent-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors"
                        >
                          Reservar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
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
                          onClick={() => handleOpenBooking(roomData.slug)}
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

        {/* Botão CTA Flutuante - Mobile (abre WhatsApp geral) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 backdrop-blur-sm border-t border-warm-200 md:hidden pb-safe">
          <button
            onClick={() => handleReservar('Espaço Arthemi')}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Reservar pelo WhatsApp
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
            handleOpenBooking(galleryRoom.slug);
          }}
          room={galleryRoom}
        />
      )}

      {/* Modal de Reserva */}
      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          products={bookingRoom.products}
          onClose={() => setBookingRoom(null)}
        />
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<LPPageProps> = async (context) => {
  const requestId = `ssr-lp-${Date.now()}`;
  
  try {
    console.log(`[${requestId}] SSR /lp iniciado`);
    
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
    console.error(`[${requestId}] ERRO no SSR /lp:`, error);
    return {
      props: {
        rooms: [],
      },
    };
  }
};
