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
            <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
              Como funciona o Espaço Arthemi
            </h1>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              Reservar uma sala é simples e rápido. Sem burocracia, sem complicação.
            </p>
          </div>
        </section>

        {/* 4 Passos */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {/* Passo 1 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-16 h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  1
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-primary-900 mb-2">
                    Escolha a sala e o horário
                  </h2>
                  <p className="text-lg text-secondary-600">
                    Veja a disponibilidade online e escolha a sala que melhor atende sua necessidade. 
                    Temos opções com e sem maca, em diferentes tamanhos. Você pode reservar por hora, 
                    pacote de horas ou turno fixo mensal.
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-16 h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  2
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-primary-900 mb-2">
                    Faça sua reserva e pague online
                  </h2>
                  <p className="text-lg text-secondary-600">
                    Confirme sua reserva em poucos cliques. O pagamento é feito de forma segura, 
                    via Pix ou cartão. Você recebe a confirmação na hora por e-mail.
                  </p>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-16 h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  3
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-primary-900 mb-2">
                    Chegue e atenda
                  </h2>
                  <p className="text-lg text-secondary-600">
                    No dia e horário reservados, é só chegar. A sala estará limpa e pronta. 
                    A recepção recebe seu paciente e avisa quando ele chegar. Você só precisa focar no atendimento.
                  </p>
                </div>
              </div>

              {/* Passo 4 */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 w-16 h-16 bg-accent-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  4
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-primary-900 mb-2">
                    Termine e vá embora
                  </h2>
                  <p className="text-lg text-secondary-600">
                    Após o atendimento, você está livre para ir. A limpeza é por nossa conta. 
                    Sem preocupações, sem tarefas extras. Simples assim.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O que está incluso */}
        <section className="py-16 bg-warm-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 text-center mb-12">
              Tudo isso já está incluso no valor
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">🛋️</span>
                <h3 className="font-semibold text-primary-900">Sala equipada</h3>
                <p className="text-sm text-secondary-600 mt-1">Mobília, ar-condicionado e ambiente profissional</p>
              </div>
              <div className="bg-white rounded-lg p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">👋</span>
                <h3 className="font-semibold text-primary-900">Recepção</h3>
                <p className="text-sm text-secondary-600 mt-1">Recebemos e acolhemos seus pacientes</p>
              </div>
              <div className="bg-white rounded-lg p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">🧹</span>
                <h3 className="font-semibold text-primary-900">Limpeza</h3>
                <p className="text-sm text-secondary-600 mt-1">Higienização entre cada atendimento</p>
              </div>
              <div className="bg-white rounded-lg p-6 text-center border border-warm-200">
                <span className="text-3xl mb-3 block">📶</span>
                <h3 className="font-semibold text-primary-900">Internet</h3>
                <p className="text-sm text-secondary-600 mt-1">Wi-Fi rápido para prontuários e chamadas</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-accent-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Pronto para começar?
            </h2>
            <p className="text-xl text-accent-100 mb-8">
              Escolha sua sala e faça sua primeira reserva. Sem contrato, sem fidelidade.
            </p>
            <Link
              href="/salas"
              className="inline-block bg-warm-100 text-accent-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-warm-200 transition"
            >
              Ver Salas e Preços
            </Link>
          </div>
        </section>
      </Layout>
    </>
  );
}
