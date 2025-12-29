// ===========================================================
// Home Page - Espaço Arthemi (Design Premium)
// ===========================================================

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SEO from '@/components/SEO';
import Layout from '@/components/Layout';
import RoomGalleryModal from '@/components/RoomGalleryModal';
import { PAGE_SEO, BUSINESS_INFO } from '@/constants/seo';
import { 
  Sparkles, 
  Clock, 
  Shield, 
  Wifi, 
  Coffee, 
  CheckCircle2, 
  ArrowRight,
  MapPin,
  Calendar,
  Users,
  Heart,
  Stethoscope,
  Brain,
  Leaf,
  Eye,
  MessageCircle,
} from 'lucide-react';

// Dados das salas para o modal
const roomsData = [
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

export default function Home() {
  const [selectedRoom, setSelectedRoom] = useState<typeof roomsData[0] | null>(null);
  const whatsappLink = `https://wa.me/${BUSINESS_INFO.whatsapp}`;

  return (
    <>
      <SEO
        title={PAGE_SEO.home.title}
        description={PAGE_SEO.home.description}
        keywords={PAGE_SEO.home.keywords}
        path="/"
      />

      <Layout headerVariant="fixed" className="overflow-x-hidden">
        {/* Hero Section - Full Impact */}
        <section className="relative min-h-[100svh] flex items-center pt-20 pb-8 overflow-hidden">
          {/* Background Image */}
          <Image 
            src="/images/espaco/Recepcao.jpeg" 
            alt="Recepção do Espaço Arthemi"
            fill
            className="object-cover object-center"
            priority
            quality={90}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-950/85 via-secondary-900/75 to-primary-950/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          {/* Floating Elements */}
          <div className="absolute top-32 left-[10%] animate-bounce hidden lg:block" style={{ animationDuration: '3s' }}>
            <div className="bg-warm-100 shadow-xl rounded-2xl p-4 rotate-[-5deg]">
              <Stethoscope className="w-8 h-8 text-primary-700" />
            </div>
          </div>
          <div className="absolute top-48 right-[15%] animate-bounce hidden lg:block" style={{ animationDuration: '4s', animationDelay: '1s' }}>
            <div className="bg-warm-100 shadow-xl rounded-2xl p-4 rotate-[5deg]">
              <Brain className="w-8 h-8 text-accent-600" />
            </div>
          </div>
          <div className="absolute bottom-32 left-[20%] animate-bounce hidden lg:block" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
            <div className="bg-warm-100 shadow-xl rounded-2xl p-4 rotate-[3deg]">
              <Heart className="w-8 h-8 text-rose-400" />
            </div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-warm-200/30 backdrop-blur-sm text-warm-100 px-4 py-2 rounded-full text-sm font-semibold mb-8 border border-warm-300/20">
                <MapPin className="w-4 h-4" />
                Santa Efigênia, Belo Horizonte
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-warm-100 mb-6 leading-[1.1]">
                Você atende,
                <br />
                <span className="bg-gradient-to-r from-primary-300 via-warm-200 to-accent-400 bg-clip-text text-transparent">
                  nós cuidamos do resto.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl md:text-2xl text-warm-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                Consultórios preparados para profissionais da saúde.
              </p>

              {/* Trust Badges - Linha de apoio */}
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-warm-200 mb-10">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Reserva online
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Sem burocracia
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Consultórios premium
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
                <Link
                  href="/salas"
                  className="group bg-gradient-to-r from-accent-600 to-accent-700 text-white px-8 py-4 min-h-[52px] rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-accent-500/30 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Ver consultórios e preços
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/como-funciona"
                  className="bg-warm-100 text-primary-800 px-8 py-4 min-h-[52px] rounded-full font-bold text-lg border-2 border-warm-300 hover:border-accent-400 hover:text-accent-700 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Como funciona
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
            <div className="w-6 h-10 border-2 border-warm-300/50 rounded-full flex justify-center pt-2">
              <div className="w-1.5 h-3 bg-warm-200/70 rounded-full animate-pulse" />
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-warm-50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { number: '3', label: 'Salas disponíveis', icon: <Users className="w-6 h-6" /> },
                { number: '100%', label: 'Tudo incluso', icon: <CheckCircle2 className="w-6 h-6" /> },
                { number: 'R$0', label: 'Taxa de adesão', icon: <Shield className="w-6 h-6" /> },
                { number: '48h', label: 'Para cancelar', icon: <Clock className="w-6 h-6" /> },
              ].map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-warm-200 to-warm-100 rounded-2xl mb-4 text-primary-700 group-hover:scale-110 transition-transform">
                    {stat.icon}
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-primary-900 mb-1">{stat.number}</div>
                  <div className="text-secondary-600 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O que está incluso - Cards Premium */}
        <section className="py-20 bg-gradient-to-b from-warm-100 to-warm-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                Tudo Incluso
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
                Chegue e atenda. Simples assim.
              </h2>
              <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
                Sem custos extras, sem surpresas. O valor que você vê já inclui tudo isso:
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  color: 'from-primary-500 to-primary-600',
                  icon: <Sparkles className="w-6 h-6" />,
                  title: 'Consultórios completos', 
                  desc: 'Ambiente agradável, mobiliário profissional, ar-condicionado e iluminação adequada.' 
                },
                { 
                  color: 'from-secondary-500 to-secondary-600',
                  icon: <Users className="w-6 h-6" />,
                  title: 'Recepção dedicada', 
                  desc: 'Secretária profissional, acolhimento dos pacientes e comunicação da chegada.' 
                },
                { 
                  color: 'from-accent-500 to-accent-600',
                  icon: <Leaf className="w-6 h-6" />,
                  title: 'Limpeza completa', 
                  desc: 'Higienização do espaço e descarte dos resíduos seguindo as normas técnicas.' 
                },
                { 
                  color: 'from-primary-600 to-primary-700',
                  icon: <Wifi className="w-6 h-6" />,
                  title: 'Internet ultrarrápida', 
                  desc: 'Wi-fi de alta velocidade adequado para teleconsultas e chamadas.' 
                },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-200 group"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-primary-900 mb-3">{item.title}</h3>
                  <p className="text-secondary-600 leading-relaxed text-sm sm:text-base">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Para quem é - Visual Impact */}
        <section className="py-20 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-warm-100 mb-8">
                Para quem é o Espaço Arthemi?
              </h2>
              
              {/* Pills de profissionais */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {[
                  { icon: <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Médicos' },
                  { icon: <Brain className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Psicólogos' },
                  { icon: <Leaf className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Nutricionistas' },
                  { icon: <Heart className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Fisioterapeutas' },
                  { icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Fonoaudiólogos' },
                  { icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Terapeutas' },
                ].map((prof, i) => (
                  <div key={i} className="flex items-center gap-2 bg-warm-100 text-primary-800 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-semibold text-sm sm:text-base">
                    {prof.icon}
                    {prof.text}
                  </div>
                ))}
              </div>

              {/* Texto destaque */}
              <p className="text-2xl sm:text-3xl font-bold text-accent-400 mb-8">
                Que desejam:
              </p>
            </div>
            
            {/* Cards com desejos */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {[
                'Ter um consultório sem ter que lidar com burocracia.',
                'Flexibilidade e facilidade para reserva dos horários.',
                'Atender em um espaço premium sem fazer um alto investimento.',
                'Não se preocupar com recepção e limpeza do espaço.',
                'Baixo custo para manutenção de um espaço profissional.',
                'Atender na localização mais tradicional de Belo Horizonte.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 bg-warm-100/10 backdrop-blur-sm rounded-2xl p-5 hover:bg-warm-100/20 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  </div>
                  <p className="text-warm-100 font-medium text-sm sm:text-base leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Salas Preview - Cards Modernos */}
        <section className="py-20 bg-warm-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                Nossos Consultórios
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-900 mb-4">
                Escolha o espaço ideal para você
              </h2>
              <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl mx-auto">
                Três layouts pensados para diferentes necessidades
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Consultório 1 | Prime */}
              <div 
                className="group relative rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white border border-warm-200 cursor-pointer"
                onClick={() => setSelectedRoom(roomsData[0])}
              >
                <div className="relative w-full h-48 sm:h-56">
                  <Image 
                    src="/images/sala-a/foto-4.jpeg" 
                    alt="Consultório 1 | Prime"
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {/* Overlay com botão Ver Fotos */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary-800 px-4 py-2 rounded-full font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Ver fotos
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-accent-100 text-accent-700 px-3 py-1 rounded-full text-sm font-medium">Espaço premium</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">Consultório 1 | Prime</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Consultório amplo com maca e circulação livre 360º.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-accent-600">R$ 59,99</span>
                      <span className="text-secondary-500">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Consultório 2 | Executive - Featured */}
              <div 
                className="group relative rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-accent-500/30 transition-all duration-500 hover:-translate-y-2 md:scale-105 bg-white border-2 border-accent-500 cursor-pointer"
                onClick={() => setSelectedRoom(roomsData[1])}
              >
                <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-accent-600 text-white px-4 py-1 rounded-b-lg text-sm font-bold z-10">
                  Mais popular
                </div>
                <div className="relative w-full h-48 sm:h-56">
                  <Image 
                    src="/images/sala-b/02-3.jpeg" 
                    alt="Consultório 2 | Executive"
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {/* Overlay com botão Ver Fotos */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary-800 px-4 py-2 rounded-full font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Ver fotos
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-accent-100 text-accent-700 px-3 py-1 rounded-full text-sm font-medium">Consultório amplo</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">Consultório 2 | Executive</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Consultório amplo com maca e circulação livre 360º.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-accent-600">R$ 49,99</span>
                      <span className="text-secondary-500">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Consultório 3 | Essential */}
              <div 
                className="group relative rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white border border-warm-200 cursor-pointer"
                onClick={() => setSelectedRoom(roomsData[2])}
              >
                <div className="relative w-full h-48 sm:h-56">
                  <Image 
                    src="/images/sala-c/03-1.jpeg" 
                    alt="Consultório 3 | Essential"
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    quality={85}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {/* Overlay com botão Ver Fotos */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary-800 px-4 py-2 rounded-full font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Ver fotos
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-warm-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">Espaço intimista</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">Consultório 3 | Essential</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Consultório acolhedor com poltronas confortáveis.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-accent-600">R$ 39,99</span>
                      <span className="text-secondary-500">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <Link
                href="/salas"
                className="inline-flex items-center gap-2 bg-primary-800 text-warm-100 px-8 py-4 rounded-full font-bold text-lg hover:bg-primary-900 transition-colors"
              >
                Ver todos os preços e pacotes
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Galeria de Fotos */}
        <section className="py-20 bg-warm-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                Conheça o Espaço
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
                Um ambiente que inspira confiança
              </h2>
              <p className="text-xl text-secondary-600">
                Veja como é o Espaço Arthemi por dentro
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                '/images/sala-a/foto-4.jpeg',
                '/images/sala-a/foto-7.jpeg',
                '/images/sala-a/foto-6.jpeg',
                '/images/sala-a/foto-2.jpeg',
                '/images/sala-c/03-1.jpeg',
                '/images/sala-c/03-2.jpeg',
                '/images/espaco/Recepcao.jpeg',
                '/images/espaco/Recepcao-01.jpeg',
              ].map((src, i) => (
                <div 
                  key={i} 
                  className="relative overflow-hidden rounded-2xl group cursor-pointer aspect-square"
                >
                  <Image 
                    src={src} 
                    alt={`Espaço Arthemi ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    quality={85}
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bloco de Confiança Final */}
        <section className="py-20 bg-gradient-to-br from-primary-900 via-primary-950 to-secondary-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-500 rounded-full blur-[150px]" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-warm-400 rounded-full blur-[150px]" />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Sparkles className="w-12 h-12 text-accent-400 mx-auto mb-6" />
            <h2 className="text-4xl md:text-5xl font-bold text-warm-100 mb-6">
              Um espaço que funciona para você
            </h2>
            <p className="text-xl text-warm-300 mb-8 leading-relaxed">
              A gente sabe que montar consultório é caro, burocrático e trabalhoso. 
              Por isso criamos o Espaço Arthemi: para você ter estrutura profissional 
              sem precisar lidar com tudo isso.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <div className="flex items-center gap-2 text-warm-300">
                <CheckCircle2 className="w-5 h-5 text-accent-400" />
                Sem contrato longo
              </div>
              <div className="flex items-center gap-2 text-warm-300">
                <CheckCircle2 className="w-5 h-5 text-accent-400" />
                Sem fidelidade
              </div>
              <div className="flex items-center gap-2 text-warm-300">
                <CheckCircle2 className="w-5 h-5 text-accent-400" />
                Sem surpresas
              </div>
            </div>
            <Link
              href="/salas"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-accent-500 to-accent-600 text-white px-10 py-5 rounded-full font-bold text-xl hover:shadow-2xl hover:shadow-accent-500/30 transition-all duration-300 hover:-translate-y-1"
            >
              Ver consultórios e preços
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </section>

        {/* Seção de Localização com Mapa */}
        <section id="localizacao" className="py-20 bg-warm-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                Localização
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
                Fácil de chegar
              </h2>
              <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
                Localizado na área hospitalar de Belo Horizonte, com fácil acesso para você e seus pacientes.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Informações de contato */}
              <div className="bg-white rounded-3xl p-8 shadow-lg shadow-warm-200/50">
                <h3 className="text-xl font-bold text-primary-900 mb-6">
                  Como chegar
                </h3>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-primary-900">Endereço</p>
                      <p className="text-secondary-600">
                        Av. Brasil, n. 248, sala 215<br />
                        Santa Efigênia – Belo Horizonte/MG
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-primary-900">Horário</p>
                      <p className="text-secondary-600">
                        Seg a Sex: 8h às 20h<br />
                        Sáb: 8h às 12h
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-primary-900">WhatsApp</p>
                      <a 
                        href={whatsappLink} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-600 hover:text-accent-700 transition"
                      >
                        (31) 98491-6090
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-warm-200">
                  <a
                    href="https://www.google.com/maps/place/Espa%C3%A7o+Arthemi+-+Coworking+de+Sa%C3%BAde+em+BH/@-19.9245428,-43.922652,17z"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-accent-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-accent-700 transition"
                  >
                    <MapPin className="w-5 h-5" />
                    Abrir no Google Maps
                  </a>
                </div>
              </div>

              {/* Mapa embed */}
              <div className="lg:col-span-2 rounded-3xl overflow-hidden shadow-lg shadow-warm-200/50 bg-warm-200">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1875.4!2d-43.922652!3d-19.9245428!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa699518a3297b3%3A0xff0a67224623033e!2sEspa%C3%A7o%20Arthemi%20-%20Coworking%20de%20Sa%C3%BAde%20em%20BH!5e0!3m2!1spt-BR!2sbr!4v1702857600000!5m2!1spt-BR!2sbr"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '400px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização do Espaço Arthemi - Av. Brasil, 248, Santa Efigênia, Belo Horizonte"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </section>
      </Layout>

      {/* Modal de Galeria */}
      {selectedRoom && (
        <RoomGalleryModal
          isOpen={!!selectedRoom}
          onClose={() => setSelectedRoom(null)}
          room={selectedRoom}
        />
      )}
    </>
  );
}
