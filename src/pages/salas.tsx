// ===========================================================
// Página /salas - Lista de Salas com RoomCard
// ===========================================================

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RoomCard from '@/components/RoomCard';
import BookingModal from '@/components/BookingModal';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { formatCurrency } from '@/lib/utils';

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
        { name: 'Salas e Preços', path: '/salas' },
      ]} />

      <Layout compactFooter>
        {/* Hero */}
        <div className="bg-accent-700 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold mb-4">Salas e Preços</h1>
            <p className="text-xl text-accent-100 max-w-2xl mx-auto mb-6">
              Preços claros, sem surpresas. O valor que você vê já inclui tudo: 
              sala equipada, recepção, limpeza, internet e café.
            </p>
            <p className="text-accent-200 text-sm">
              Sem taxa de adesão • Sem fidelidade • Sem custos extras
            </p>
          </div>
        </div>

        {/* Lista de Salas */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Intro de conforto */}
          <div className="bg-white rounded-xl p-6 mb-12 border border-warm-200">
            <h2 className="text-xl font-semibold text-primary-900 mb-2">
              💡 Antes de ver os preços
            </h2>
            <p className="text-secondary-600">
              Aqui não tem pegadinha. Você escolhe o que faz sentido para sua agenda: 
              hora avulsa para flexibilidade, pacotes para economia, ou turno fixo para 
              quem atende regularmente. Todos os valores já incluem recepção, limpeza, 
              internet e café. É o preço final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onReservar={() => handleReservar(room)}
              />
            ))}
          </div>

          {/* Tabela de Preços V3 por Sala */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold text-primary-900 mb-4 text-center">
              Tabela Completa de Preços
            </h2>
            <p className="text-center text-secondary-600 mb-8 max-w-2xl mx-auto">
              Compare as opções e escolha a que melhor se encaixa na sua rotina de atendimentos.
            </p>
            
            {rooms.map((room) => (
              <div key={room.id} className="mb-8">
                <h3 className="text-xl font-semibold text-primary-800 mb-4">
                  {room.name} — {room.slug === 'sala-a' ? 'Grande, com maca' : 
                                 room.slug === 'sala-b' ? 'Média, com maca' : 
                                 'Compacta, sem maca'}
                </h3>
                <p className="text-secondary-600 text-sm mb-4">
                  {room.slug === 'sala-a' 
                    ? 'Ideal para fisioterapia, massoterapia, procedimentos estéticos e atendimentos que precisam de maca e mais espaço.'
                    : room.slug === 'sala-b'
                    ? 'Perfeita para consultas médicas, nutrição e atendimentos que combinam conversa com avaliação física.'
                    : 'Ótima para psicologia, terapia, coaching e atendimentos focados em conversa. Aconchegante e reservada.'}
                </p>
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-warm-200">
                  <table className="w-full">
                    <thead className="bg-warm-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900">Produto</th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900">Horas</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-primary-900">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {room.products.map((product) => (
                        <tr key={product.id} className="hover:bg-warm-50">
                          <td className="px-6 py-4">
                            <span className="font-medium text-primary-900">{product.name.replace(` - ${room.name}`, '')}</span>
                          </td>
                          <td className="px-6 py-4 text-center text-secondary-600">
                            {product.hoursIncluded ? `${product.hoursIncluded}h` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-accent-600">
                              {formatCurrency(product.price)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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
