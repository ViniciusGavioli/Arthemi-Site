// ===========================================================
// Componente RoomCard - Card de sala com botão reservar
// ===========================================================

import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  type: string;
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
  products?: Product[];
}

interface RoomCardProps {
  room: Room;
  onReservar: () => void;
}

// Subtitulo baseado no slug
const getSubtitle = (slug: string): string => {
  switch (slug) {
    case 'sala-a': return 'Grande (com maca)';
    case 'sala-b': return 'Média (com maca)';
    case 'sala-c': return 'Pequena (sem maca)';
    default: return '';
  }
};

export default function RoomCard({ room, onReservar }: RoomCardProps) {
  // Pega o preço da hora avulsa do produto ou do hourlyRate da sala
  const hourlyProduct = room.products?.find(p => p.type === 'HOURLY_RATE');
  const hourlyPrice = hourlyProduct?.price || room.hourlyRate || 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
      {/* Imagem */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        {room.imageUrl ? (
          <Image
            src={room.imageUrl}
            alt={room.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
            <span className="text-6xl">🏥</span>
          </div>
        )}
        
        {/* Badge de capacidade */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700">
          👥 {room.capacity} pessoas
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        <div className="mb-2">
          <h3 className="text-xl font-bold text-gray-900">{room.name}</h3>
          <p className="text-sm text-primary-600 font-medium">{getSubtitle(room.slug)}</p>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {room.description || 'Sala equipada para atendimentos de saúde.'}
        </p>

        {/* Amenidades */}
        <div className="flex flex-wrap gap-2 mb-4">
          {room.amenities.slice(0, 4).map((amenity, index) => (
            <span
              key={index}
              className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
            >
              {amenity}
            </span>
          ))}
          {room.amenities.length > 4 && (
            <span className="text-gray-500 text-xs py-1">
              +{room.amenities.length - 4} mais
            </span>
          )}
        </div>

        {/* Preço e Botão */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <span className="text-sm text-gray-500">A partir de</span>
            <div>
              <span className="text-2xl font-bold text-primary-600">
                {formatCurrency(hourlyPrice)}
              </span>
              <span className="text-gray-500 text-sm">/hora</span>
            </div>
          </div>
          
          <button
            onClick={onReservar}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}
