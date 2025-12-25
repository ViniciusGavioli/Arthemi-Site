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
      '/images/sala-b/02-3.jpeg',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/95"
        onClick={onClose}
      />

      {/* Modal - Full Gallery Layout */}
      <div className="relative z-10 w-full h-full md:w-[95vw] md:h-[95vh] md:max-w-7xl bg-black md:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Close Button - Floating */}
        <button
          onClick={onClose}
          aria-label="Fechar galeria"
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Main Image/Video - Hero */}
          <div className="relative w-full h-[60vh] md:h-[70vh] bg-black">
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
                  sizes="100vw"
                  priority
                  quality={90}
                />
                
                {/* Navigation Arrows - Over Image */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      aria-label="Foto anterior"
                      className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-3 md:p-4 rounded-full transition-all hover:scale-110"
                    >
                      <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </button>
                    <button
                      onClick={nextImage}
                      aria-label="Próxima foto"
                      className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-3 md:p-4 rounded-full transition-all hover:scale-110"
                    >
                      <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </button>
                  </>
                )}

                {/* Image Counter - Over Image */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-5 py-2 rounded-full text-sm font-medium">
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-6xl">🏥</span>
              </div>
            )}
          </div>

          {/* Thumbnails - Below Image */}
          <div className="bg-black/80 px-4 py-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setShowVideo(false);
                  }}
                  aria-label={`Ver foto ${idx + 1}`}
                  className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    currentIndex === idx && !showVideo
                      ? 'border-accent-500 ring-2 ring-accent-500/50'
                      : 'border-white/20 hover:border-white/50'
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
                  className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all bg-primary-800 flex items-center justify-center ${
                    showVideo
                      ? 'border-accent-500 ring-2 ring-accent-500/50'
                      : 'border-white/20 hover:border-white/50'
                  }`}
                >
                  <Play className="w-8 h-8 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Content - Below Gallery */}
          <div className="bg-white p-6 md:p-8">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-900 mb-2">{room.name}</h2>
              <p className="text-secondary-600">{room.description}</p>
            </div>

            {/* Features */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-primary-800 mb-4">Características</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {room.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-primary-800">
                    <span className="w-2 h-2 bg-accent-500 rounded-full flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Price & CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6 bg-warm-50 rounded-2xl">
              <div className="text-center sm:text-left">
                <div className="text-sm text-secondary-500 mb-1">A partir de</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-accent-600">{room.price}</span>
                  <span className="text-secondary-500">/hora</span>
                </div>
              </div>
              <Link
                href="/salas"
                className="flex-1 w-full sm:w-auto bg-gradient-to-r from-accent-600 to-accent-700 text-white text-center py-4 px-8 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-accent-500/30 transition-all active:scale-[0.98] flex items-center justify-center"
              >
                Ver preços e reservar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
