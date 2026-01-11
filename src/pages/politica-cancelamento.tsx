// ===========================================================
// Página: /politica-cancelamento - Política Oficial
// ===========================================================

import Head from 'next/head';
import Link from 'next/link';
import { OFFICIAL_POLICY, POLICY_CONSTANTS } from '@/lib/policies';

export default function PoliticaCancelamentoPage() {
  const { title, lastUpdate, sections } = OFFICIAL_POLICY;

  return (
    <>
      <Head>
        <title>{title} | Espaço Arthemi</title>
        <meta 
          name="description" 
          content="Política de cancelamento, reembolso e cupons do Espaço Arthemi. Conheça as regras para cancelar reservas e receber reembolsos." 
        />
      </Head>

      <div className="min-h-screen bg-warm-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/" 
              className="text-primary-600 hover:text-primary-700 text-sm inline-flex items-center gap-1"
            >
              ← Voltar ao site
            </Link>
          </div>

          {/* Documento */}
          <article className="bg-white rounded-2xl shadow-lg p-8">
            
            {/* Título */}
            <header className="mb-8 pb-6 border-b border-gray-200">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {title}
              </h1>
              <p className="text-sm text-gray-500">
                Última atualização: {lastUpdate}
              </p>
            </header>

            {/* Seções */}
            <div className="space-y-8">
              
              {/* 1. Cancelamento */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {sections.cancellation.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {sections.cancellation.content}
                </div>
              </section>

              {/* 2. Reembolso */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {sections.refund.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {sections.refund.content}
                </div>
              </section>

              {/* 3. Cupons */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {sections.coupons.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {sections.coupons.content}
                </div>
              </section>

              {/* 4. Reembolsos Parciais */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {sections.partialRefunds.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {sections.partialRefunds.content}
                </div>
              </section>

              {/* 5. Transparência */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {sections.transparency.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {sections.transparency.content}
                </div>
              </section>

            </div>

            {/* Rodapé */}
            <footer className="mt-10 pt-6 border-t border-gray-200">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>Dúvidas?</strong> Entre em contato pelo WhatsApp{' '}
                  <a 
                    href={`https://wa.me/55${POLICY_CONSTANTS.WHATSAPP_SUPPORT.replace(/\D/g, '')}`}
                    className="text-primary-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {POLICY_CONSTANTS.WHATSAPP_SUPPORT}
                  </a>
                  {' '}ou e-mail{' '}
                  <a 
                    href={`mailto:${POLICY_CONSTANTS.EMAIL_SUPPORT}`}
                    className="text-primary-600 hover:underline"
                  >
                    {POLICY_CONSTANTS.EMAIL_SUPPORT}
                  </a>.
                </p>
              </div>
            </footer>

          </article>

          {/* Link para reservar */}
          <div className="text-center mt-8">
            <Link
              href="/reservar"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              Fazer uma Reserva
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
