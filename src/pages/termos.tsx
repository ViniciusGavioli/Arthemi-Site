// ===========================================================
// Página: Termos de Uso
// ===========================================================

import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { BUSINESS_INFO } from '@/constants/seo';
import { PRICES_V3 } from '@/constants/prices';

export default function TermosPage() {
  const lastUpdate = '18 de dezembro de 2024';
  
  // Usar preços do Consultório 2 como referência
  const hourlyWeekday = PRICES_V3.SALA_B.prices.HOURLY_RATE;
  const hourlySaturday = PRICES_V3.SALA_B.prices.SATURDAY_HOUR;
  
  return (
    <Layout>
      <Head>
        <title>Termos de Uso — Espaço Arthemi</title>
        <meta name="description" content="Termos de Uso do Espaço Arthemi. Regras para reserva e uso dos consultórios do coworking de saúde." />
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
              Termos de Uso
            </h1>
            <p className="text-warm-600">
              Última atualização: {lastUpdate}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none prose-headings:text-primary-900 prose-p:text-warm-700 prose-li:text-warm-700">
            
            {/* 1. Aceitação */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos termos</h2>
              <p>
                Ao utilizar o site e os serviços do <strong>Espaço Arthemi</strong>, você concorda 
                com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, 
                por favor, não utilize nossos serviços.
              </p>
              <p>
                Estes termos constituem um acordo legal entre você e o Espaço Arthemi para a 
                locação de consultórios por hora.
              </p>
            </section>

            {/* 2. Serviço */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">2. Descrição do serviço</h2>
              <p>
                O Espaço Arthemi oferece locação de consultórios para profissionais de saúde 
                realizarem atendimentos. O serviço inclui:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Uso do consultório pelo período reservado</li>
                <li>Mobiliário básico (mesa, cadeiras, maca quando aplicável)</li>
                <li>Ar condicionado</li>
                <li>Wi-Fi</li>
                <li>Acesso às áreas comuns (recepção, banheiro, copa)</li>
              </ul>
              <p className="mt-4">
                <strong>Não estão inclusos:</strong> materiais de consumo, equipamentos especializados, 
                secretária ou recepcionista exclusiva.
              </p>
            </section>

            {/* 3. Reservas */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">3. Reservas e pagamento</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">3.1 Como reservar</h3>
              <p>
                As reservas são feitas pelo site, selecionando o consultório, data e horário desejados. 
                A reserva só é confirmada após a confirmação do pagamento.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">3.2 Valores</h3>
              <p>Os valores praticados são:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Hora avulsa (segunda a sexta): a partir de R$ {hourlyWeekday.toFixed(2)}</li>
                <li>Hora avulsa (sábado): a partir de R$ {hourlySaturday.toFixed(2)}</li>
                <li>Pacotes com desconto disponíveis (consulte a página de consultórios)</li>
              </ul>
              <p className="mt-4">
                Os valores podem ser alterados a qualquer momento, mas reservas já confirmadas 
                mantêm o valor pago.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">3.3 Pagamento</h3>
              <p>
                O pagamento é processado via <strong>PIX</strong> no momento da reserva. 
                Aceitamos cartão de crédito, débito, Pix e boleto (quando disponível).
              </p>
            </section>

            {/* 4. Cancelamento */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">4. Cancelamento e reembolso</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">4.1 Cancelamento pelo cliente</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Com mais de 2 horas de antecedência:</strong> cancelamento permitido 
                  pelo site. Reembolso integral em até 5 dias úteis.
                </li>
                <li>
                  <strong>Com menos de 2 horas de antecedência:</strong> não é possível cancelar. 
                  O valor não será reembolsado.
                </li>
                <li>
                  <strong>Após o início da reserva:</strong> não há reembolso.
                </li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">4.2 Cancelamento pelo Espaço Arthemi</h3>
              <p>
                Em casos excepcionais (manutenção emergencial, força maior), podemos cancelar 
                uma reserva. Neste caso, oferecemos reembolso integral ou reagendamento sem 
                custo adicional.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">4.3 Não comparecimento (no-show)</h3>
              <p>
                Se você não comparecer e não cancelar com antecedência, a reserva será considerada 
                utilizada e não haverá reembolso.
              </p>
            </section>

            {/* 5. Uso dos consultórios */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">5. Regras de uso dos consultórios</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">5.1 Horário</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Chegue com alguns minutos de antecedência para se acomodar</li>
                <li>Libere o consultório pontualmente ao fim do período reservado</li>
                <li>Atrasos podem comprometer a próxima reserva</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">5.2 Conservação</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Mantenha o consultório limpo e organizado</li>
                <li>Não fume nas dependências</li>
                <li>Comunique imediatamente qualquer dano ou problema</li>
                <li>Não remova ou altere a disposição do mobiliário sem autorização</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">5.3 Comportamento</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Respeite os demais profissionais e pacientes</li>
                <li>Mantenha volume de voz adequado</li>
                <li>Não realize atividades ilegais ou antiéticas</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">5.4 Danos</h3>
              <p>
                O usuário é responsável por danos causados ao consultório ou equipamentos durante o 
                período de sua reserva, devendo arcar com os custos de reparo ou reposição.
              </p>
            </section>

            {/* 6. Responsabilidades */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">6. Responsabilidades e limitações</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">6.1 Responsabilidade do Espaço Arthemi</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fornecer o consultório reservado em condições adequadas de uso</li>
                <li>Manter as instalações limpas e funcionais</li>
                <li>Garantir acesso durante o horário reservado</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">6.2 O que NÃO nos responsabilizamos</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Objetos pessoais esquecidos ou furtados</li>
                <li>Atendimentos realizados pelos profissionais (você é responsável por seus pacientes)</li>
                <li>Questões entre você e seus pacientes ou clientes</li>
                <li>Interrupções por força maior (falta de energia, internet, etc.)</li>
                <li>Dados armazenados em equipamentos pessoais</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">6.3 Responsabilidade profissional</h3>
              <p>
                Você é integralmente responsável por sua atuação profissional, incluindo 
                registro em conselho, seguros, prontuários e sigilo de seus pacientes.
              </p>
            </section>

            {/* 7. Propriedade intelectual */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">7. Propriedade intelectual</h2>
              <p>
                Todo o conteúdo do site (textos, imagens, logotipos, design) é propriedade do 
                Espaço Arthemi ou licenciado para nosso uso. É proibida a reprodução sem 
                autorização prévia.
              </p>
            </section>

            {/* 8. Privacidade */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">8. Privacidade</h2>
              <p>
                O tratamento dos seus dados pessoais é regido pela nossa{' '}
                <Link href="/privacidade" className="text-accent-600 hover:underline">
                  Política de Privacidade
                </Link>
                , que faz parte integrante destes Termos de Uso.
              </p>
            </section>

            {/* 9. Alterações */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">9. Alterações nos termos</h2>
              <p>
                Podemos atualizar estes Termos de Uso a qualquer momento. Alterações 
                significativas serão comunicadas no site. O uso continuado dos serviços 
                após alterações constitui aceitação dos novos termos.
              </p>
            </section>

            {/* 10. Foro */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">10. Legislação e foro</h2>
              <p>
                Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. 
                Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer 
                controvérsias, com exclusão de qualquer outro, por mais privilegiado que seja.
              </p>
            </section>

            {/* 11. Contato */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">11. Contato</h2>
              <p>
                Se você tiver dúvidas sobre estes Termos de Uso, entre em contato:
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
            <Link href="/privacidade" className="text-accent-600 hover:underline">
              Ver Política de Privacidade →
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
