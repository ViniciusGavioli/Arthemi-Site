// ===========================================================
// Home Page - Espaço Arthemi (Design Premium)
// ===========================================================

import Link from 'next/link';
import Image from 'next/image';
import SEO from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { 
  Sparkles, 
  Clock, 
  Shield, 
  Wifi, 
  Coffee, 
  CheckCircle2, 
  ArrowRight,
  MapPin,
  Phone,
  Calendar,
  Users,
  Heart,
  Stethoscope,
  Brain,
  Leaf,
} from 'lucide-react';

export default function Home() {
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
        <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
          {/* Background Image */}
          <Image 
            src="/images/IMG-20251217-WA0136.jpg" 
            alt="Espaço Arthemi"
            fill
            className="object-cover"
            priority
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
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-warm-100 mb-6 leading-[1.1]">
                Você atende.
                <br />
                <span className="bg-gradient-to-r from-primary-300 via-warm-200 to-accent-400 bg-clip-text text-transparent">
                  A gente cuida do resto.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-warm-200 mb-10 max-w-2xl mx-auto leading-relaxed">
                Salas prontas para profissionais de saúde.
                <br className="hidden md:block" />
                <span className="text-warm-300">Recepção, limpeza, internet — tudo incluso.</span>
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link
                  href="/salas"
                  className="group bg-gradient-to-r from-accent-600 to-accent-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-accent-500/30 transition-all duration-300 hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  Ver Salas e Preços
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/como-funciona"
                  className="bg-warm-100 text-primary-800 px-8 py-4 rounded-full font-bold text-lg border-2 border-warm-300 hover:border-accent-400 hover:text-accent-700 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Como Funciona
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center gap-6 text-sm text-warm-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Sem contrato
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Sem fidelidade
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent-400" />
                  Cancele quando quiser
                </div>
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
                { number: '24h', label: 'Para remarcar', icon: <Clock className="w-6 h-6" /> },
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
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  color: 'from-primary-500 to-primary-600',
                  icon: <Sparkles className="w-6 h-6" />,
                  title: 'Sala equipada', 
                  desc: 'Mobiliário profissional, ar-condicionado, boa iluminação e ambiente silencioso' 
                },
                { 
                  color: 'from-secondary-500 to-secondary-600',
                  icon: <Users className="w-6 h-6" />,
                  title: 'Recepção dedicada', 
                  desc: 'Recebemos seus pacientes, confirmamos agenda e avisamos quando chegarem' 
                },
                { 
                  color: 'from-accent-500 to-accent-600',
                  icon: <Leaf className="w-6 h-6" />,
                  title: 'Limpeza completa', 
                  desc: 'Higienização profissional entre cada atendimento, sempre impecável' 
                },
                { 
                  color: 'from-primary-600 to-primary-700',
                  icon: <Wifi className="w-6 h-6" />,
                  title: 'Internet ultra rápida', 
                  desc: 'Wi-Fi de alta velocidade para prontuário online, teleconsultas e chamadas' 
                },
                { 
                  color: 'from-accent-600 to-accent-700',
                  icon: <Coffee className="w-6 h-6" />,
                  title: 'Copa e café', 
                  desc: 'Café fresquinho, água e espaço confortável para você e seus pacientes' 
                },
                { 
                  color: 'from-secondary-600 to-secondary-700',
                  icon: <Shield className="w-6 h-6" />,
                  title: 'Prontuário online', 
                  desc: 'Sistema seguro e prático para seus registros de atendimento' 
                },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-200 group"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-primary-900 mb-3">{item.title}</h3>
                  <p className="text-secondary-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Para quem é - Visual Impact */}
        <section className="py-20 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-warm-100 mb-4">
                Para quem é o Espaço Arthemi?
              </h2>
              <p className="text-xl text-warm-300 max-w-2xl mx-auto">
                Se você se identifica com isso, vai gostar do que oferecemos
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {[
                'Quer atender sem pagar aluguel fixo',
                'Não quer se preocupar com recepção e limpeza',
                'Precisa de um espaço profissional',
                'Quer começar sem investir em consultório',
                'Atende poucos dias por semana',
                'Busca praticidade: chegar, atender e ir',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3 bg-warm-100/10 backdrop-blur-sm rounded-2xl p-5 hover:bg-warm-100/20 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 bg-warm-200/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-warm-200" />
                  </div>
                  <p className="text-warm-100 font-medium">{text}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {[
                { icon: <Stethoscope className="w-5 h-5" />, text: 'Médicos' },
                { icon: <Brain className="w-5 h-5" />, text: 'Psicólogos' },
                { icon: <Heart className="w-5 h-5" />, text: 'Fisioterapeutas' },
                { icon: <Leaf className="w-5 h-5" />, text: 'Nutricionistas' },
                { icon: <Sparkles className="w-5 h-5" />, text: 'Terapeutas' },
              ].map((prof, i) => (
                <div key={i} className="flex items-center gap-2 bg-warm-100 text-primary-800 px-5 py-2.5 rounded-full font-semibold">
                  {prof.icon}
                  {prof.text}
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
                Nossas Salas
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
                Escolha a sala ideal para você
              </h2>
              <p className="text-xl text-secondary-600">
                Três opções pensadas para diferentes necessidades
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Sala A */}
              <div className="group relative rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white border border-warm-200">
                <div className="relative w-full h-48">
                  <Image 
                    src="/images/IMG-20251217-WA0141.jpg" 
                    alt="Sala A"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-warm-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">Grande</span>
                    <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-sm font-medium">Com maca</span>
                  </div>
                  <h3 className="text-2xl font-bold text-primary-900 mb-2">Sala A</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Ideal para fisioterapia, massoterapia e procedimentos que precisam de espaço.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-accent-600">R$ 59,99</span>
                      <span className="text-secondary-500">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sala B - Featured */}
              <div className="group relative rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-accent-500/30 transition-all duration-500 hover:-translate-y-2 md:scale-105 bg-white border-2 border-accent-500">
                <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-accent-600 text-white px-4 py-1 rounded-b-lg text-sm font-bold z-10">
                  Mais popular
                </div>
                <div className="relative w-full h-48">
                  <Image 
                    src="/images/IMG-20251217-WA0140.jpg" 
                    alt="Sala B"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-warm-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">Média</span>
                    <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-sm font-medium">Com maca</span>
                  </div>
                  <h3 className="text-2xl font-bold text-primary-900 mb-2">Sala B</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Perfeita para consultas médicas, nutrição e avaliações físicas.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-accent-600">R$ 49,99</span>
                      <span className="text-secondary-500">/hora</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sala C */}
              <div className="group relative rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white border border-warm-200">
                <div className="relative w-full h-48">
                  <Image 
                    src="/images/IMG-20251217-WA0139.jpg" 
                    alt="Sala C"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-warm-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">Compacta</span>
                    <span className="bg-secondary-400 text-white px-3 py-1 rounded-full text-sm font-medium">Sem maca</span>
                  </div>
                  <h3 className="text-2xl font-bold text-primary-900 mb-2">Sala C</h3>
                  <p className="text-secondary-600 text-sm mb-4">
                    Ótima para psicologia, terapia e atendimentos focados em conversa.
                  </p>
                  <div className="border-t border-warm-200 pt-4">
                    <div className="text-secondary-500 text-sm">A partir de</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-accent-600">R$ 39,99</span>
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
                Ver Todos os Preços e Pacotes
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
                '/images/IMG-20251217-WA0157.jpg',
                '/images/IMG-20251217-WA0156.jpg',
                '/images/IMG-20251217-WA0155.jpg',
                '/images/IMG-20251217-WA0154.jpg',
                '/images/IMG-20251217-WA0153.jpg',
                '/images/IMG-20251217-WA0141.jpg',
                '/images/IMG-20251217-WA0140.jpg',
                '/images/IMG-20251217-WA0139.jpg',
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
              Quero Conhecer as Salas
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
                Estamos em Santa Efigênia, região central de Belo Horizonte, 
                com fácil acesso de carro e transporte público.
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
                        Santa Efigênia<br />
                        Belo Horizonte — MG
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
                        Sábado: 8h às 14h
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-primary-900">Contato</p>
                      <a 
                        href="tel:+5531999999999" 
                        className="text-accent-600 hover:text-accent-700 transition"
                      >
                        (31) 99999-9999
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-warm-200">
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=Santa+Efigenia,Belo+Horizonte,MG"
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
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3750.8889559082066!2d-43.93061842394395!3d-19.919999137739!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa699e146c3f743%3A0x2b42b8c18e8e4fc2!2sSanta%20Efig%C3%AAnia%2C%20Belo%20Horizonte%20-%20MG!5e0!3m2!1spt-BR!2sbr!4v1702857600000!5m2!1spt-BR!2sbr"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '400px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização do Espaço Arthemi em Santa Efigênia, Belo Horizonte"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
