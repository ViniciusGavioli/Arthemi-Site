// ===========================================================
// Como Funciona - Espaço Arthemi
// ===========================================================

import Link from 'next/link';
import SEO, { BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';

export default function ComoFunciona() {
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
        { name: 'Como Funciona', path: '/como-funciona' },
      ]} />

      <Layout compactFooter>
        {/* Hero */}
        <section className="bg-warm-100 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-900 mb-6">
              Como funciona o Espaço Arthemi?
            </h1>
            <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl mx-auto leading-relaxed">
              Reservar um consultório de forma simples e rápida.
              <br />
              Sem burocracia e com baixo custo.
            </p>
          </div>
        </section>

        {/* 4 Passos */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {/* Passo 1 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold">
                  1
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">
                    Escolha o consultório
                  </h2>
                  <p className="text-base sm:text-lg text-secondary-600">
                    Escolha o layout que melhor atende suas necessidades.
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold">
                  2
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">
                    Escolha seu pacote de horas
                  </h2>
                  <p className="text-base sm:text-lg text-secondary-600">
                    Contrate o consultório por hora ou por turno fixo.
                    <br />
                    O pagamento é 100% online, por PIX ou cartão de crédito.
                  </p>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold">
                  3
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">
                    Realize a reserva do consultório
                  </h2>
                  <p className="text-base sm:text-lg text-secondary-600">
                    Agende o uso do consultório no horário desejado, com confirmação imediata.
                  </p>
                </div>
              </div>

              {/* Passo 4 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold">
                  4
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">
                    Chegue e atenda
                  </h2>
                  <p className="text-base sm:text-lg text-secondary-600">
                    No dia e horário reservados, é só chegar.
                    <br />
                    A sala estará limpa e pronta para seu uso.
                    <br />
                    A recepção recebe seu paciente e avisa quando ele chegar.
                    <br />
                    Você só precisa focar no seu atendimento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O que está incluso */}
        <section className="py-16 bg-warm-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-900 text-center mb-12">
              Tudo isso já está incluso
            </h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">🛋️</span>
                <h3 className="font-semibold text-primary-900">Consultórios profissionais</h3>
              </div>
              <div className="bg-white rounded-xl p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">👋</span>
                <h3 className="font-semibold text-primary-900">Recepção</h3>
              </div>
              <div className="bg-white rounded-xl p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">🧹</span>
                <h3 className="font-semibold text-primary-900">Limpeza</h3>
              </div>
              <div className="bg-white rounded-xl p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">📶</span>
                <h3 className="font-semibold text-primary-900">Internet</h3>
              </div>
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
