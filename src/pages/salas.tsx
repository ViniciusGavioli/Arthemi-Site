// ===========================================================
// Página /salas - Lista de Salas com RoomCard
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
import { Lightbulb, CheckCircle2, Eye } from 'lucide-react';

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
  const [galleryRoom, setGalleryRoom] = useState<{ name: string; slug: string; description: string; features: string[]; price: string } | null>(null);

  // Dados para modal de galeria
  const roomsGalleryData = [
    {
      name: 'Consultório 1 | Prime',
      slug: 'sala-a',
      description: 'Espaço premium',
      features: ['Espaço premium', 'Consultório amplo', 'Maca com circulação livre (360º)', 'Ar-condicionado', 'Lavatório', 'Armário', 'Iluminação'],
      price: 'R$ 59,99',
    },
    {
      name: 'Consultório 2 | Executive',
      slug: 'sala-b',
      description: 'Consultório amplo',
      features: ['Consultório amplo', 'Maca com circulação livre (360º)', 'Ar-condicionado', 'Lavatório', 'Armário', 'Iluminação'],
      price: 'R$ 49,99',
    },
    {
      name: 'Consultório 3 | Essential',
      slug: 'sala-c',
      description: 'Consultório acolhedor',
      features: ['Consultório acolhedor', 'Espaço intimista', 'Poltronas', 'Ar-condicionado', 'Lavatório', 'Iluminação'],
      price: 'R$ 39,99',
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
        { name: 'Consultórios e preços', path: '/salas' },
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

        {/* Lista de Salas */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Bloco de inclusões */}
          <div className="bg-accent-50 rounded-xl p-6 mb-12 border border-accent-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-primary-900 mb-3">
                  A reserva do consultório inclui:
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {['Consultório profissional', 'Internet', 'Recepção', 'Limpeza', 'Café e água'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-600 flex-shrink-0" />
                      <span className="text-sm text-secondary-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cards dos Consultórios com imagens clicáveis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {rooms.map((room, index) => {
              const galleryData = roomsGalleryData[index];
              const imageUrl = room.slug === 'sala-a' ? '/images/sala-a/foto-1.jpeg' : 
                               room.slug === 'sala-b' ? '/images/sala-b/02-3.jpeg' : 
                               '/images/sala-c/03-1.jpeg';
              return (
                <div 
                  key={room.id}
                  className="group relative rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white border border-warm-200 cursor-pointer"
                  onClick={() => setGalleryRoom(galleryData)}
                >
                  <div className="relative w-full h-48 sm:h-56">
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
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-accent-600">{galleryData.price}</span>
                      <span className="text-secondary-500 text-sm">/hora</span>
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
            
            {rooms.map((room, roomIndex) => {
              // Filtrar produtos (remover diária) e formatar nomes
              const filteredProducts = room.products.filter(p => 
                !p.name.toLowerCase().includes('diária') && 
                !p.name.toLowerCase().includes('diaria')
              );

              // Calcular desconto baseado no preço por hora vs hora avulsa
              const hourlyProduct = filteredProducts.find(p => p.type === 'HOURLY_RATE');
              const baseHourlyPrice = hourlyProduct?.price || room.hourlyRate || 0;

              // Preços de sábado por consultório
              const saturdayPrices = {
                'sala-a': { hourly: 69.99, shift: 239.99 },
                'sala-b': { hourly: 59.99, shift: 199.99 },
                'sala-c': { hourly: 49.99, shift: 159.99 },
              };

              const satPrice = saturdayPrices[room.slug as keyof typeof saturdayPrices] || { hourly: 0, shift: 0 };

              return (
                <div key={room.id} className="mb-10">
                  <h3 className="text-xl font-semibold text-primary-800 mb-4">
                    {room.slug === 'sala-a' ? 'Consultório 1 | Prime — Espaço premium' : 
                     room.slug === 'sala-b' ? 'Consultório 2 | Executive — Consultório amplo' : 
                     'Consultório 3 | Essential — Espaço intimista'}
                  </h3>
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-warm-200">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-warm-100">
                          <tr>
                            <th className="px-4 sm:px-6 py-4 text-left text-sm font-semibold text-primary-900">Produto</th>
                            <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Horas contratadas</th>
                            <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Preço</th>
                            <th className="px-4 sm:px-6 py-4 text-center text-sm font-semibold text-primary-900">Desconto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-warm-100">
                          {filteredProducts.map((product) => {
                            // Formatar nome do produto
                            let displayName = product.name
                              .replace(` - ${room.name}`, '')
                              .replace('(16h)', '')
                              .replace('Turno fixo mensal', 'Turno fixo semanal')
                              .trim();

                            // Calcular desconto
                            let discount = 0;
                            if (product.hoursIncluded && product.hoursIncluded > 0 && baseHourlyPrice > 0) {
                              const pricePerHour = product.price / product.hoursIncluded;
                              discount = Math.round(((baseHourlyPrice - pricePerHour) / baseHourlyPrice) * 100);
                            }

                            // Determinar se é hora avulsa ou turno
                            const isHourly = product.type === 'HOURLY_RATE';
                            const isShift = displayName.toLowerCase().includes('turno');

                            return (
                              <tr key={product.id} className={`hover:bg-warm-50 ${isShift ? 'bg-accent-50/30' : ''}`}>
                                <td className="px-4 sm:px-6 py-4">
                                  <span className={`font-medium ${isHourly ? 'text-primary-900' : 'text-primary-800'}`}>
                                    {displayName}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-center text-secondary-600">
                                  {product.hoursIncluded ? `${product.hoursIncluded}h` : '-'}
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-center">
                                  <span className="font-semibold text-accent-600">
                                    {formatCurrency(product.price)}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-center">
                                  {discount > 0 ? (
                                    <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                                      -{discount}%
                                    </span>
                                  ) : (
                                    <span className="text-secondary-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Linha: Sábado - Hora avulsa */}
                          <tr className="hover:bg-warm-50 border-t-2 border-accent-200">
                            <td className="px-4 sm:px-6 py-4">
                              <span className="font-medium text-primary-900">Sábado – Hora avulsa</span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center text-secondary-600">1h</td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <span className="font-semibold text-accent-600">
                                {formatCurrency(satPrice.hourly)}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <span className="text-secondary-400">-</span>
                            </td>
                          </tr>
                          {/* Linha: Sábado - Turno fixo semanal */}
                          <tr className="hover:bg-warm-50 bg-accent-50/30">
                            <td className="px-4 sm:px-6 py-4">
                              <span className="font-medium text-primary-800">Sábado – Turno fixo semanal</span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center text-secondary-600">4h</td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <span className="font-semibold text-accent-600">
                                {formatCurrency(satPrice.shift)}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                                -{Math.round(((satPrice.hourly - (satPrice.shift / 4)) / satPrice.hourly) * 100)}%
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
              Ver todas as dúvidas frequentes →
            </Link>
          </section>
        </main>
      </Layout>

      {/* Modal de Reserva */}
      {isModalOpen && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          products={selectedRoom.products}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de Galeria */}
      {galleryRoom && (
        <RoomGalleryModal
          isOpen={!!galleryRoom}
          onClose={() => setGalleryRoom(null)}
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
