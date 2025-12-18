// ===========================================================
// Página: Política de Privacidade (LGPD)
// ===========================================================

import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { BUSINESS_INFO } from '@/constants/seo';

export default function PrivacidadePage() {
  const lastUpdate = '18 de dezembro de 2024';
  
  return (
    <Layout>
      <Head>
        <title>Política de Privacidade — Espaço Arthemi</title>
        <meta name="description" content="Política de Privacidade do Espaço Arthemi. Saiba como coletamos, usamos e protegemos seus dados pessoais em conformidade com a LGPD." />
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-warm-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12">
            <Link href="/" className="text-accent-600 hover:text-accent-700 text-sm mb-4 inline-block">
              ← Voltar para o site
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-primary-900 mb-4">
              Política de Privacidade
            </h1>
            <p className="text-warm-600">
              Última atualização: {lastUpdate}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none prose-headings:text-primary-900 prose-p:text-warm-700 prose-li:text-warm-700">
            
            {/* 1. Introdução */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">1. Quem somos</h2>
              <p>
                O <strong>Espaço Arthemi</strong> é um coworking de saúde localizado em Belo Horizonte, MG. 
                Oferecemos salas para locação por hora para profissionais de saúde (psicólogos, nutricionistas, 
                médicos, etc.).
              </p>
              <p>
                Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos seus 
                dados pessoais quando você utiliza nosso site e serviços, em conformidade com a 
                Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              </p>
              <p>
                <strong>Controlador dos dados:</strong><br />
                Espaço Arthemi<br />
                E-mail para contato: {BUSINESS_INFO.email}<br />
                Telefone: {BUSINESS_INFO.phone.replace('+55 ', '(').replace(' ', ') ')}
              </p>
            </section>

            {/* 2. Dados que coletamos */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">2. Quais dados coletamos</h2>
              <p>Coletamos apenas os dados necessários para a prestação do serviço de reserva de salas:</p>
              
              <h3 className="text-xl font-medium mt-6 mb-3">2.1 Dados fornecidos por você</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Nome completo</strong> — para identificação da reserva</li>
                <li><strong>Telefone</strong> — para contato sobre a reserva (WhatsApp)</li>
                <li><strong>E-mail</strong> (opcional) — para envio de confirmação de reserva</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.2 Dados coletados automaticamente</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Endereço IP</strong> — para segurança e logs de auditoria</li>
                <li><strong>User-Agent do navegador</strong> — para identificar dispositivo</li>
                <li><strong>Data e hora de acesso</strong> — para registro de operações</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.3 Dados de pagamento</h3>
              <p>
                Não armazenamos dados de cartão de crédito ou dados bancários. Os pagamentos são 
                processados integralmente pelo <strong>Asaas</strong>, que possui sua própria 
                política de privacidade. Apenas recebemos confirmação de pagamento (aprovado/recusado) 
                e o ID da transação.
              </p>
            </section>

            {/* 3. Para que usamos */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">3. Para que usamos seus dados</h2>
              <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Executar o serviço</strong> — processar sua reserva e pagamento</li>
                <li><strong>Comunicação</strong> — enviar confirmação de reserva por e-mail ou WhatsApp</li>
                <li><strong>Suporte</strong> — responder suas dúvidas e solicitações</li>
                <li><strong>Segurança</strong> — registrar logs de auditoria para prevenção de fraudes</li>
                <li><strong>Obrigações legais</strong> — cumprir exigências fiscais e regulatórias</li>
              </ul>
              <p className="mt-4">
                <strong>Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing.</strong>
              </p>
            </section>

            {/* 4. Base legal */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">4. Base legal para tratamento (LGPD)</h2>
              <p>O tratamento dos seus dados pessoais é fundamentado nas seguintes bases legais:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Execução de contrato</strong> (Art. 7º, V) — para processar sua reserva</li>
                <li><strong>Consentimento</strong> (Art. 7º, I) — ao aceitar os termos ao fazer reserva</li>
                <li><strong>Interesse legítimo</strong> (Art. 7º, IX) — para segurança e prevenção de fraudes</li>
                <li><strong>Obrigação legal</strong> (Art. 7º, II) — para cumprimento de exigências fiscais</li>
              </ul>
            </section>

            {/* 5. Compartilhamento */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">5. Com quem compartilhamos seus dados</h2>
              <p>Seus dados podem ser compartilhados apenas com:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Asaas</strong> — processador de pagamentos PIX. Recebe apenas os dados 
                  necessários para processar o pagamento (nome, e-mail, valor).
                </li>
                <li>
                  <strong>Resend</strong> — serviço de envio de e-mails. Recebe apenas nome e e-mail 
                  para envio de confirmações.
                </li>
                <li>
                  <strong>Supabase</strong> — provedor de banco de dados. Armazena os dados de forma 
                  segura e criptografada.
                </li>
                <li>
                  <strong>Autoridades</strong> — quando exigido por lei ou ordem judicial.
                </li>
              </ul>
            </section>

            {/* 6. Armazenamento */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">6. Armazenamento e segurança</h2>
              <p>
                Seus dados são armazenados em servidores seguros com as seguintes proteções:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Conexão criptografada (HTTPS/TLS)</li>
                <li>Banco de dados com acesso restrito e autenticado</li>
                <li>Logs de auditoria para rastrear acessos</li>
                <li>Senhas administrativas protegidas</li>
              </ul>
              <p className="mt-4">
                <strong>Retenção:</strong> Mantemos seus dados de reserva por até 5 anos para fins 
                fiscais e legais, ou até que você solicite a exclusão (quando aplicável).
              </p>
            </section>

            {/* 7. Seus direitos */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">7. Seus direitos (LGPD)</h2>
              <p>Você tem os seguintes direitos garantidos pela LGPD:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Acesso</strong> — saber quais dados temos sobre você</li>
                <li><strong>Correção</strong> — corrigir dados incompletos ou incorretos</li>
                <li><strong>Exclusão</strong> — solicitar a exclusão dos seus dados (quando aplicável)</li>
                <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado</li>
                <li><strong>Revogação</strong> — retirar seu consentimento a qualquer momento</li>
                <li><strong>Oposição</strong> — se opor a determinado tratamento</li>
              </ul>
              <p className="mt-4">
                Para exercer qualquer desses direitos, entre em contato conosco pelo e-mail{' '}
                <a href={`mailto:${BUSINESS_INFO.email}`} className="text-accent-600 hover:underline">
                  {BUSINESS_INFO.email}
                </a>.
              </p>
              <p className="mt-2">
                Responderemos sua solicitação em até 15 dias úteis.
              </p>
            </section>

            {/* 8. Cookies */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
              <p>
                Nosso site utiliza apenas cookies essenciais para funcionamento:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Cookie de sessão admin</strong> — para autenticação na área administrativa</li>
              </ul>
              <p className="mt-4">
                Não utilizamos cookies de rastreamento, analytics de terceiros ou publicidade.
              </p>
            </section>

            {/* 9. Menores */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">9. Menores de idade</h2>
              <p>
                Nosso serviço é destinado a profissionais de saúde maiores de 18 anos. 
                Não coletamos intencionalmente dados de menores de idade.
              </p>
            </section>

            {/* 10. Alterações */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">10. Alterações nesta política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos 
                alterações significativas, atualizaremos a data no topo desta página.
              </p>
              <p className="mt-2">
                Recomendamos que você revise esta página regularmente.
              </p>
            </section>

            {/* 11. Contato */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">11. Contato</h2>
              <p>
                Se você tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento 
                dos seus dados, entre em contato:
              </p>
              <p className="mt-4">
                <strong>Espaço Arthemi</strong><br />
                E-mail: <a href={`mailto:${BUSINESS_INFO.email}`} className="text-accent-600 hover:underline">{BUSINESS_INFO.email}</a><br />
                Telefone: <a href={`tel:${BUSINESS_INFO.phone.replace(/\s/g, '')}`} className="text-accent-600 hover:underline">{BUSINESS_INFO.phone.replace('+55 ', '(').replace(' ', ') ')}</a><br />
                Endereço: {BUSINESS_INFO.address.street} — {BUSINESS_INFO.address.neighborhood}, {BUSINESS_INFO.address.city}/{BUSINESS_INFO.address.stateCode}
              </p>
            </section>

          </div>

          {/* Footer links */}
          <div className="mt-12 pt-8 border-t border-warm-200 flex flex-wrap gap-4 text-sm">
            <Link href="/termos" className="text-accent-600 hover:underline">
              Ver Termos de Uso →
            </Link>
            <Link href="/" className="text-warm-600 hover:text-warm-800">
              Voltar para o site
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
