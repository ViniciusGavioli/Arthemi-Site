// ===========================================================
// RoomDetailsModal - Modal de detalhes do consultório
// ===========================================================

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, Play, CheckCircle2 } from 'lucide-react';

interface RoomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReservar?: () => void;
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
      '/images/sala-a/foto-4.jpeg',
      '/images/sala-a/foto-7.jpeg',
      '/images/sala-a/foto-6.jpeg',
      '/images/sala-a/foto-2.jpeg',
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

export default function RoomDetailsModal({ isOpen, onClose, onReservar, room }: RoomDetailsModalProps) {
  // ESTADOS SEPARADOS - Obrigatório
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const roomData = roomImages[room.slug] || { images: [], video: undefined };
  const images = roomData.images;
  const video = roomData.video;

  // Reset ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsGalleryOpen(false);
      setGalleryIndex(0);
    }
  }, [isOpen]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isGalleryOpen) {
          setIsGalleryOpen(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isGalleryOpen, onClose]);

  // Navegação do lightbox com setas
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      if (e.key === 'ArrowLeft') {
        setGalleryIndex((prev) => (prev - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight') {
        setGalleryIndex((prev) => (prev + 1) % images.length);
      }
    };
    if (isOpen && isGalleryOpen) {
      document.addEventListener('keydown', handleKey);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, isGalleryOpen, images.length]);

  // Handler: Abrir galeria
  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setIsGalleryOpen(true);
  };

  // Handler: Fechar galeria
  const closeGallery = () => {
    setIsGalleryOpen(false);
  };

  // Handler: Próxima imagem no lightbox
  const nextGalleryImage = () => {
    setGalleryIndex((prev) => (prev + 1) % images.length);
  };

  // Handler: Imagem anterior no lightbox
  const prevGalleryImage = () => {
    setGalleryIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* MODAL DE DETALHES */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-3 z-20 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
          >
            <X className="w-5 h-5 text-primary-800" />
          </button>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Imagem Principal - Clicável para abrir galeria */}
            <div 
              className="relative w-full aspect-[16/10] bg-warm-100 cursor-pointer group"
              onClick={() => openGallery(currentIndex)}
            >
              {images.length > 0 && (
                <>
                  <Image
                    src={images[currentIndex]}
                    alt={`${room.name} - Foto ${currentIndex + 1}`}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 672px"
                    priority
                    quality={85}
                  />
                  
                  {/* Overlay hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-primary-800 px-4 py-2 rounded-full font-medium text-sm">
                      Ampliar fotos
                    </span>
                  </div>

                  {/* Image Counter */}
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                    {currentIndex + 1}/{images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails - Clicáveis para abrir galeria */}
            <div className="bg-warm-50 px-4 py-2 border-b border-warm-100">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide justify-center">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => openGallery(idx)}
                    aria-label={`Ver foto ${idx + 1}`}
                    className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      currentIndex === idx
                        ? 'border-accent-500'
                        : 'border-transparent hover:border-warm-300'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </button>
                ))}
                
                {/* Video Thumbnail */}
                {video && (
                  <button
                    onClick={() => openGallery(0)}
                    aria-label="Ver vídeo"
                    className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-transparent hover:border-warm-300 bg-primary-700 flex items-center justify-center"
                  >
                    <Play className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Section */}
            <div className="p-5">
              {/* Header */}
              <div className="mb-4">
                <span className="inline-block bg-accent-50 text-accent-700 px-2.5 py-0.5 rounded-full text-xs font-medium mb-2">
                  {room.description}
                </span>
                <h2 className="text-xl font-bold text-primary-900">
                  {room.name}
                </h2>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-xs font-semibold text-secondary-400 uppercase tracking-wider mb-3">
                  Características
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {room.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-600 flex-shrink-0" />
                      <span className="text-sm text-primary-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer with Price & CTAs */}
          <div className="border-t border-warm-200 bg-warm-50 p-4">
            <div className="flex flex-col gap-3">
              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-secondary-500">A partir de</span>
                <span className="text-xl font-bold text-accent-600">{room.price}</span>
                <span className="text-sm text-secondary-500">/hora</span>
              </div>
              
              {/* CTA Buttons */}
              <div className="flex gap-3">
                <Link
                  href={`/salas#${room.slug}`}
                  onClick={onClose}
                  className="flex-1 border-2 border-accent-600 text-accent-600 text-center py-3 px-4 rounded-xl font-semibold hover:bg-accent-50 transition-all active:scale-[0.98]"
                >
                  Ver pacotes de horas
                </Link>
                <button
                  onClick={() => {
                    onClose();
                    onReservar?.();
                  }}
                  className="flex-1 bg-gradient-to-r from-accent-600 to-accent-700 text-white text-center py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  Reservar agora
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX DE GALERIA - Renderizado FORA do modal, z-index maior */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Overlay escuro */}
          <div 
            className="absolute inset-0 bg-black/95"
            onClick={closeGallery}
          />

          {/* Close Button */}
          <button
            onClick={closeGallery}
            aria-label="Fechar galeria"
            className="absolute top-4 right-4 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Imagem Principal do Lightbox */}
          <div className="relative z-10 w-full h-full max-w-5xl max-h-[80vh] mx-4 flex items-center justify-center">
            <div className="relative w-full h-full">
              <Image
                src={images[galleryIndex]}
                alt={`${room.name} - Foto ${galleryIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                priority
                quality={90}
              />
            </div>
          </div>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevGalleryImage}
                aria-label="Foto anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={nextGalleryImage}
                aria-label="Próxima foto"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            </>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium">
            {galleryIndex + 1} / {images.length}
          </div>

          {/* Thumbnails no Lightbox */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                aria-label={`Ver foto ${idx + 1}`}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  galleryIndex === idx
                    ? 'border-white'
                    : 'border-white/30 hover:border-white/60'
                }`}
              >
                <Image
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
