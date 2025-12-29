// ===========================================================
// Como Funciona - Espaço Arthemi
// ===========================================================

import Link from 'next/link';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';
import { LayoutGrid, Clock, CalendarCheck, CheckCircle } from 'lucide-react';

export default function ComoFunciona() {
  const steps = [
    {
      number: '01',
      title: 'Escolha o consultório',
      description: 'Escolha o layout que melhor atende suas necessidades.',
      icon: LayoutGrid,
    },
    {
      number: '02',
      title: 'Escolha seu pacote de horas',
      description: 'Contrate o consultório por hora ou por turno fixo. O pagamento é 100% online, por PIX ou cartão de crédito.',
      icon: Clock,
    },
    {
      number: '03',
      title: 'Realize a reserva do consultório',
      description: 'Agende o uso do consultório no horário desejado, com confirmação imediata.',
      icon: CalendarCheck,
    },
    {
      number: '04',
      title: 'Chegue e atenda',
      description: 'No dia e horário reservados, é só chegar. A sala estará limpa e pronta para seu uso. A recepção recebe seu paciente e avisa quando ele chegar. Você só precisa focar no seu atendimento.',
      icon: CheckCircle,
    },
  ];

  return (
    <>
      <SEO
        title={PAGE_SEO.comoFunciona.title}
        description={PAGE_SEO.comoFunciona.description}
        keywords={PAGE_SEO.comoFunciona.keywords}
        path="/como-funciona"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', path: '/' },
        { name: 'Como funciona', path: '/como-funciona' },
      ]} />

      <Layout compactFooter>
        {/* Hero - Mais elegante */}
        <section className="bg-gradient-to-b from-warm-100 to-white py-12 md:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block text-accent-600 text-sm font-medium tracking-wide uppercase mb-4">
              Simples e sem burocracia
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-900 mb-4 leading-tight tracking-tight">
              Como funciona o Espaço Arthemi?
            </h1>
            <p className="text-lg text-secondary-500 max-w-xl mx-auto">
              Reserve seu consultório em poucos passos.
            </p>
          </div>
        </section>

        {/* 4 Passos - Cards Premium em Grid */}
        <section className="py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {steps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div 
                    key={index}
                    className="group relative bg-white rounded-2xl p-6 lg:p-8 border border-warm-200 hover:border-accent-300 hover:shadow-lg hover:shadow-accent-100/50 transition-all duration-300"
                  >
                    {/* Header do Card */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* Ícone */}
                      <div className="flex-shrink-0 w-12 h-12 bg-warm-100 rounded-xl flex items-center justify-center group-hover:bg-accent-50 transition-colors">
                        <IconComponent className="w-6 h-6 text-accent-600" />
                      </div>
                      {/* Badge número */}
                      <span className="text-xs font-semibold text-accent-500 bg-accent-50 px-2.5 py-1 rounded-full tracking-wider">
                        {step.number}
                      </span>
                    </div>
                    
                    {/* Conteúdo */}
                    <h2 className="text-lg lg:text-xl font-semibold text-primary-900 mb-2">
                      {step.title}
                    </h2>
                    <p className="text-secondary-600 text-sm lg:text-base leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* O que está incluso - Visual refinado */}
        <section className="py-12 md:py-16 bg-warm-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary-900">
                Tudo isso já está incluso
              </h2>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[
                { emoji: '🛋️', label: 'Consultórios profissionais' },
                { emoji: '👋', label: 'Recepção' },
                { emoji: '🧹', label: 'Limpeza' },
                { emoji: '📶', label: 'Internet' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-5 lg:p-6 text-center border border-warm-200 hover:border-accent-200 hover:shadow-md transition-all">
                  <span className="text-2xl lg:text-3xl mb-2 block">{item.emoji}</span>
                  <h3 className="font-medium text-primary-900 text-sm lg:text-base">{item.label}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-accent-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Pronto para começar?
            </h2>
            <p className="text-lg sm:text-xl text-accent-100 mb-8">
              Escolha seu consultório e realize sua reserva.
            </p>
            <Link
              href="/salas"
              className="inline-block bg-warm-100 text-accent-700 px-8 py-4 rounded-full font-semibold text-lg hover:bg-warm-200 transition"
            >
              Ver consultórios e investimento
            </Link>
          </div>
        </section>
      </Layout>
    </>
  );
}
