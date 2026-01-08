// ===========================================================
// Página /salas - Lista de Consultórios com RoomCard
// ===========================================================

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import RoomCard from '@/components/RoomCard';
import BookingModal from '@/components/BookingModal';
import RoomGalleryModal from '@/components/RoomGalleryModal';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { formatCurrency } from '@/lib/utils';
import { PRICES_V3, formatPrice, getAllProductsForRoom } from '@/constants/prices';
import { Lightbulb, CheckCircle2, Eye } from 'lucide-react';

// Helper para calcular menor preço por hora de um consultório
function getLowestHourlyPrice(salaKey: 'SALA_A' | 'SALA_B' | 'SALA_C'): number {
  const prices = PRICES_V3[salaKey].prices;
  
  // Calcular preço por hora de cada opção
  const hourlyOptions = [
    prices.HOURLY_RATE,                    // Hora avulsa
    prices.PACKAGE_10H / 10,               // Pacote 10h
    prices.PACKAGE_20H / 20,               // Pacote 20h
    prices.PACKAGE_40H / 40,               // Pacote 40h
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

interface SalasPageProps {
  rooms: Room[];
}

export default function SalasPage({ rooms }: SalasPageProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string } | null>(null);

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

  const handleReservar = (room: Room) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRoom(null);
  };

  // Handler para reservar direto da galeria
  const handleReservarFromGallery = () => {
    if (galleryRoom) {
      const room = rooms.find(r => r.slug === galleryRoom.slug);
      if (room) {
        setGalleryRoom(null); // Fecha galeria
        setSelectedRoom(room);
        setIsModalOpen(true); // Abre modal de reserva
      }
    }
  };

  return (
    <>
      <SEO
        title={PAGE_SEO.salas.title}
        description={PAGE_SEO.salas.description}
        keywords={PAGE_SEO.salas.keywords}
        path="/salas"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', path: '/' },
        { name: 'Consultórios e Investimento', path: '/salas' },
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
            {rooms.map((room, index) => {
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
                    onClick={() => setGalleryRoom(galleryData)}
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
                        onClick={() => handleReservar(room)}
                        className="bg-accent-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors"
                      >
                        Reservar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela de Preços por Consultório */}
          <section>
            <h2 className="text-2xl font-bold text-primary-900 mb-4 text-center">
              Tabela completa de preços
            </h2>
            <p className="text-center text-secondary-600 mb-8 max-w-2xl mx-auto">
              Compare as opções e escolha a que melhor se encaixa na sua rotina de atendimentos.
            </p>
            
            {rooms.map((room) => {
              return (
                <div key={room.id} className="mb-10">
                  <h3 className="text-xl font-semibold text-primary-800 mb-4">
                    {room.slug === 'sala-a' ? 'Consultório 1 | Prime — Espaço premium' : 
                     room.slug === 'sala-b' ? 'Consultório 2 | Executive — Consultório amplo' : 
                     'Consultório 3 | Essential — Espaço intimista'}
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
                          {(() => {
                            // Usar PRICES_V3 como fonte única de verdade
                            const roomKey = room.slug === 'sala-a' ? 'SALA_A' : room.slug === 'sala-b' ? 'SALA_B' : 'SALA_C';
                            const roomPrices = PRICES_V3[roomKey].prices;
                            const baseHourlyPrice = roomPrices.HOURLY_RATE; // Em reais
                            
                            // Pacotes com preços do PRICES_V3 (não calculados)
                            const packages = [
                              { hours: 1, label: '1h', price: baseHourlyPrice, isHourly: true },
                              { hours: 10, label: '10h', price: roomPrices.PACKAGE_10H, isHourly: false },
                              { hours: 20, label: '20h', price: roomPrices.PACKAGE_20H, isHourly: false },
                              { hours: 40, label: '40h', price: roomPrices.PACKAGE_40H, isHourly: false },
                            ];

                            return packages.map((pkg, idx) => {
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
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Aviso sobre Turnos Fixos */}
                    <div className="border-t border-warm-200 bg-amber-50/50 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-amber-600 text-lg">💬</span>
                        <div>
                          <h4 className="text-sm font-semibold text-amber-800 mb-1">
                            Turnos fixos
                          </h4>
                          <p className="text-xs text-amber-700 mb-2">
                            Para contratar turnos fixos, entre em contato conosco pelo WhatsApp.
                          </p>
                          <a
                            href={`https://wa.me/5531991153634?text=${encodeURIComponent(`Olá! Tenho interesse em turnos fixos no ${room.name}. Podemos conversar sobre dia da semana e horário disponíveis?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 underline"
                          >
                            Falar no WhatsApp →
                          </a>
                        </div>
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

        {/* Botão CTA Flutuante - Mobile */}
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 backdrop-blur-sm border-t border-warm-200 md:hidden pb-safe">
          <button
            onClick={() => {
              // Scroll para os cards de consultórios
              const cardsSection = document.querySelector('[data-cards-section]');
              if (cardsSection) {
                cardsSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full bg-gradient-to-r from-accent-600 to-accent-700 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-accent-500/30 transition-all active:scale-[0.98]"
          >
            Ver preços e reservar
          </button>
        </div>
      </Layout>

      {/* Modal de Reserva */}
      {isModalOpen && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          products={getAllProductsForRoom(
            selectedRoom.slug === 'sala-a' ? 'SALA_A' :
            selectedRoom.slug === 'sala-b' ? 'SALA_B' : 'SALA_C'
          )}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de Galeria */}
      {galleryRoom && (
        <RoomGalleryModal
          isOpen={!!galleryRoom}
          onClose={() => setGalleryRoom(null)}
          onReservar={handleReservarFromGallery}
          room={galleryRoom}
        />
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SalasPageProps> = async () => {
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
        // Garante que hourlyRate tenha valor (fallback para pricePerHour se não existir)
        hourlyRate: room.hourlyRate || 0,
      })),
    },
  };
};
