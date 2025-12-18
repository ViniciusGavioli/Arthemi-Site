// ===========================================================
// RoomGalleryModal - Modal com galeria de fotos da sala
// ===========================================================

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface RoomGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    name: string;
    slug: string;
    description: string;
    features: string[];
    price: string;
  };
}

// Fotos de cada sala
const roomImages: Record<string, { images: string[]; video?: string }> = {
  'sala-a': {
    images: [
      '/images/sala-a/foto-1.jpeg',
      '/images/sala-a/foto-2.jpeg',
      '/images/sala-a/foto-3.jpeg',
      '/images/sala-a/foto-4.jpeg',
      '/images/sala-a/foto-5.jpeg',
      '/images/sala-a/foto-6.jpeg',
      '/images/sala-a/foto-7.jpeg',
    ],
    video: '/images/sala-a/video.mp4',
  },
  'sala-b': {
    images: [
      '/images/sala-b/02-1.jpeg',
      '/images/sala-b/02-3.jpeg',
      '/images/sala-b/02-4.jpeg',
      '/images/sala-b/02-5.jpeg',
      '/images/sala-b/02-6.jpeg',
    ],
    video: '/images/sala-b/02-1.mp4',
  },
  'sala-c': {
    images: [
      '/images/sala-c/03-1.jpeg',
      '/images/sala-c/03-2.jpeg',
      '/images/sala-c/03-3.jpeg',
      '/images/sala-c/03-4.jpeg',
    ],
    video: '/images/sala-c/03-1.mp4',
  },
};

export default function RoomGalleryModal({ isOpen, onClose, room }: RoomGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const roomData = roomImages[room.slug] || { images: [], video: undefined };
  const images = roomData.images;
  const video = roomData.video;

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setShowVideo(false);
    }
  }, [isOpen]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Navegação com setas
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    if (isOpen && !showVideo) {
      document.addEventListener('keydown', handleKey);
    }
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showVideo, images.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl mx-2 sm:mx-4 bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-warm-200">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary-900">{room.name}</h2>
            <p className="text-secondary-600 text-xs sm:text-sm">{room.description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar galeria"
            className="p-2 hover:bg-warm-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6 text-secondary-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main Image/Video */}
          <div className="flex-1 relative bg-warm-100 min-h-[300px] md:min-h-[400px]">
            {showVideo && video ? (
              <video
                src={video}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : images.length > 0 ? (
              <>
                <Image
                  src={images[currentIndex]}
                  alt={`${room.name} - Foto ${currentIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 60vw"
                  priority
                />
                
                {/* Navigation Arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      aria-label="Foto anterior"
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                    >
                      <ChevronLeft className="w-6 h-6 text-primary-800" />
                    </button>
                    <button
                      onClick={nextImage}
                      aria-label="Próxima foto"
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                    >
                      <ChevronRight className="w-6 h-6 text-primary-800" />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-6xl">🏥</span>
              </div>
            )}
          </div>

          {/* Sidebar - Thumbnails & Info */}
          <div className="w-full md:w-72 p-4 bg-warm-50 overflow-y-auto">
            {/* Thumbnails */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-secondary-600 mb-3">Galeria</h3>
              <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowVideo(false);
                    }}
                    aria-label={`Ver foto ${idx + 1}`}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      currentIndex === idx && !showVideo
                        ? 'border-accent-500 ring-2 ring-accent-500/30'
                        : 'border-transparent hover:border-warm-300'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
                
                {/* Video Thumbnail */}
                {video && (
                  <button
                    onClick={() => setShowVideo(true)}
                    aria-label="Ver vídeo da sala"
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all bg-primary-900 flex items-center justify-center ${
                      showVideo
                        ? 'border-accent-500 ring-2 ring-accent-500/30'
                        : 'border-transparent hover:border-warm-300'
                    }`}
                  >
                    <Play className="w-8 h-8 text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-secondary-600 mb-3">Características</h3>
              <div className="space-y-2">
                {room.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-primary-800">
                    <span className="w-2 h-2 bg-accent-500 rounded-full" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="bg-white rounded-xl p-4 border border-warm-200">
              <div className="text-sm text-secondary-500 mb-1">A partir de</div>
              <div className="text-3xl font-bold text-accent-600">{room.price}</div>
              <div className="text-sm text-secondary-500">/hora</div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-3 sm:p-4 border-t border-warm-200 bg-white pb-safe">
          <Link
            href="/salas"
            className="block w-full bg-gradient-to-r from-accent-600 to-accent-700 text-white text-center py-3 min-h-[48px] rounded-xl font-semibold hover:shadow-lg hover:shadow-accent-500/30 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            Ver Preços e Reservar
          </Link>
        </div>
      </div>
    </div>
  );
}
