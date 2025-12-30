// ===========================================================
// Componente RoomCard - Card de consultório com botão reservar
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
    case 'sala-a': return 'Espaço premium';
    case 'sala-b': return 'Consultório amplo';
    case 'sala-c': return 'Espaço intimista';
    default: return '';
  }
};

// Nome do consultório baseado no slug
const getRoomName = (slug: string): string => {
  switch (slug) {
    case 'sala-a': return 'Consultório 1 | Prime';
    case 'sala-b': return 'Consultório 2 | Executive';
    case 'sala-c': return 'Consultório 3 | Essential';
    default: return '';
  }
};

// Descrição baseada no slug
const getDescription = (slug: string): string => {
  switch (slug) {
    case 'sala-a': return 'Consultório amplo com maca e circulação livre 360º.';
    case 'sala-b': return 'Consultório amplo com maca e circulação livre 360º.';
    case 'sala-c': return 'Consultório acolhedor com poltronas confortáveis.';
    default: return 'Consultório equipado para atendimentos de saúde.';
  }
};

// Imagem principal de cada sala
const getRoomImage = (slug: string): string => {
  switch (slug) {
    case 'sala-a': return '/images/sala-a/foto-4.jpeg';
    case 'sala-b': return '/images/sala-b/02-3.jpeg';
    case 'sala-c': return '/images/sala-c/03-1.jpeg';
    default: return '/images/hero/banner.jpeg';
  }
};

export default function RoomCard({ room, onReservar }: RoomCardProps) {
  // Pega o preço da hora avulsa do produto ou do hourlyRate da sala
  const hourlyProduct = room.products?.find(p => p.type === 'HOURLY_RATE');
  const hourlyPrice = hourlyProduct?.price || room.hourlyRate || 0;
  const imageUrl = getRoomImage(room.slug);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group border border-warm-200">
      {/* Imagem */}
      <div className="relative h-48 sm:h-56 overflow-hidden bg-warm-100">
        <Image
          src={imageUrl}
          alt={getRoomName(room.slug)}
          fill
          className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        <div className="mb-2">
          <h3 className="text-lg sm:text-xl font-bold text-primary-900">{getRoomName(room.slug)}</h3>
          <p className="text-sm text-accent-600 font-medium">{getSubtitle(room.slug)}</p>
        </div>
        
        <p className="text-secondary-600 text-sm mb-4 line-clamp-2">
          {room.description || getDescription(room.slug)}
        </p>

        {/* Amenidades */}
        <div className="flex flex-wrap gap-2 mb-4">
          {room.amenities.slice(0, 4).map((amenity, index) => (
            <span
              key={index}
              className="bg-warm-100 text-primary-800 text-xs px-2 py-1 rounded"
            >
              {amenity}
            </span>
          ))}
          {room.amenities.length > 4 && (
            <span className="text-secondary-500 text-xs py-1">
              +{room.amenities.length - 4} mais
            </span>
          )}
        </div>

        {/* Preço e Botão */}
        <div className="flex items-center justify-between pt-4 border-t border-warm-200">
          <div>
            <span className="text-sm text-secondary-500">A partir de</span>
            <div>
              <span className="text-2xl font-bold text-accent-600">
                {formatCurrency(hourlyPrice)}
              </span>
              <span className="text-secondary-500 text-sm">/hora</span>
            </div>
          </div>
          
          <button
            onClick={onReservar}
            className="bg-accent-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-accent-700 transition-colors"
          >
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}
