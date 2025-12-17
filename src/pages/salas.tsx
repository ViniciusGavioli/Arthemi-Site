// ===========================================================
// Página /salas - Lista de Salas com RoomCard
// ===========================================================

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RoomCard from '@/components/RoomCard';
import BookingModal from '@/components/BookingModal';
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
      <Head>
        <title>Salas | Espaço Arthemi</title>
        <meta name="description" content="Conheça nossas salas equipadas para profissionais de saúde" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-primary-600">Arthemi</span>
              </Link>
              <div className="flex items-center space-x-6">
                <Link href="/" className="text-gray-600 hover:text-primary-600 transition">
                  Home
                </Link>
                <Link href="/admin" className="text-gray-600 hover:text-primary-600 transition">
                  Admin
                </Link>
              </div>
            </div>
          </nav>
        </header>

        {/* Hero */}
        <div className="bg-primary-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold mb-4">Nossas Salas</h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Ambientes pensados para o conforto do profissional e do paciente. 
              Reserve por hora, pacote ou turno fixo.
            </p>
          </div>
        </div>

        {/* Lista de Salas */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Tabela de Preços V3
            </h2>
            
            {rooms.map((room) => (
              <div key={room.id} className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {room.name} - {room.slug === 'sala-a' ? 'Grande (com maca)' : 
                                 room.slug === 'sala-b' ? 'Média (com maca)' : 
                                 'Pequena (sem maca)'}
                </h3>
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Produto</th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Horas</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {room.products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900">{product.name.replace(` - ${room.name}`, '')}</span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-600">
                            {product.hoursIncluded ? `${product.hoursIncluded}h` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-primary-600">
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
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-gray-400">
              © {new Date().getFullYear()} Espaço Arthemi. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>

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
