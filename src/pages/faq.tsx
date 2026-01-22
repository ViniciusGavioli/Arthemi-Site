// ===========================================================
// FAQ - Perguntas Frequentes - Espaço Arthemi
// ===========================================================

import Link from 'next/link';
import { useState } from 'react';
import SEO, { FAQSchema, BreadcrumbSchema } from '@/components/SEO';
import Layout from '@/components/Layout';
import { PAGE_SEO } from '@/constants/seo';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border-b border-warm-200">
      <button
        onClick={onClick}
        className="w-full py-5 flex justify-between items-center text-left hover:text-accent-600 transition"
      >
        <span className="text-lg font-medium text-primary-900">{question}</span>
        <span className={`text-2xl text-accent-600 transition-transform ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {isOpen && (
        <div className="pb-5">
          <p className="text-secondary-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Tem fidelidade ou contrato longo?',
      answer: 'Não. Você pode usar o espaço quando precisar, sem compromisso de continuidade. Não exigimos tempo mínimo de permanência nem cobramos multa se você parar de usar.'
    },
    {
      question: 'Preciso assinar algum contrato?',
      answer: 'Para horas avulsas e pacotes, não há contrato formal — apenas os termos de uso que você aceita ao reservar. Para turnos fixos mensais, fazemos um acordo simples por escrito, mas ainda assim sem multa de cancelamento. Você pode encerrar quando quiser, basta avisar com antecedência.'
    },
    {
      question: 'Posso remarcar ou cancelar uma reserva?',
      answer: 'Sim. Você pode cancelar a reserva com 48h de antecedência e poderá reutilizar o crédito para marcar um novo horário dentro de 30 dias, sem qualquer ônus.'
    },
    {
      question: 'O que está incluso no valor?',
      answer: 'Tudo o que você precisa para atender: consultório profissional, insumos básicos (álcool 70%, sabonete líquido, papel toalha, lençol descartável), balança, ar-condicionado, recepção, ambiente limpo, internet de alta velocidade, impressora wi-fi disponível na recepção, café e água.'
    },
    {
      question: 'Posso atender aos sábados?',
      answer: 'Sim. O espaço funciona aos sábados em horário reduzido, de 8h às 12h. Você pode reservar o consultório por hora avulsa ou contratar o pacote semanal fixo de sábados (16h/mês), conforme sua preferência.'
    },
    {
      question: 'Preciso levar alguma coisa?',
      answer: 'Apenas o que for específico para o seu atendimento, como seu notebook e instrumentos próprios da sua profissão (estetoscópio, esfigmomanômetro, equipamentos de proteção individual, etc.). Os insumos básicos para atendimento (álcool 70%, sabonete líquido, papel toalha, lençol descartável), além do seu conforto e dos seus pacientes, estarão sempre disponíveis.'
    },
    {
      question: 'Qual a diferença entre os consultórios?',
      answer: 'O Consultório 1 | Prime e o Consultório 2 | Executive contam com maca com circulação livre (360º), sendo ideais para médicos, nutricionistas, fisioterapeutas, massoterapeutas, terapeutas e fonoaudiólogos.\n\nJá o Consultório 3 | Essential não conta com maca. Ele foi projetado de forma mais intimista, equipado com poltronas confortáveis, sendo ideal para atendimentos de psicólogos, psiquiatras e terapeutas.'
    },
    {
      question: 'Como funciona o pagamento?',
      answer: 'O pagamento é feito online, no momento da reserva, via Pix ou cartão de crédito. É rápido e seguro, com confirmação enviada por e-mail imediatamente.\n\nPara turnos fixos, a cobrança é mensal, realizada no início de cada mês, de forma recorrente no cartão de crédito (sem comprometer o limite total do cartão).'
    },
    {
      question: 'Posso atender pacientes de convênio?',
      answer: 'Sim, sem problema. A relação com convênios é sua. O espaço fornece apenas a estrutura física. Você emite suas guias, recibos e notas normalmente, como faria em qualquer consultório.'
    },
    {
      question: 'O espaço oferece recepcionista?',
      answer: 'Sim. Nossa recepção recebe o paciente, comunica a chegada e faz a condução até o consultório. Serviços de secretariado profissional, como confirmação de consultas, gestão de agenda e emissão de recibos, podem ser contratados à parte. Consulte nossa equipe.'
    }
  ];

  return (
    <>
      <SEO
        title={PAGE_SEO.faq.title}
        description={PAGE_SEO.faq.description}
        keywords={PAGE_SEO.faq.keywords}
        path="/faq"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', path: '/' },
        { name: 'Perguntas frequentes', path: '/faq' },
      ]} />
      <FAQSchema faqs={faqs} />

      <Layout compactFooter>
        {/* Hero */}
        <section className="bg-warm-100 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
              Perguntas Frequentes
            </h1>
          </div>
        </section>

        {/* FAQ List */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="divide-y divide-warm-200 border-t border-warm-200">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openIndex === index}
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Ainda tem dúvidas */}
        <section className="py-16 bg-warm-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-primary-900 mb-4">
              Ainda tem alguma pergunta?
            </h2>
            <p className="text-secondary-600 mb-6">
              Fale conosco! Estamos à disposição para responder qualquer dúvida.
            </p>
            <a
              href="https://wa.me/5531999923910"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              <span>💬</span> Chamar no WhatsApp
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-accent-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Pronto para reservar seu consultório?
            </h2>
            <p className="text-xl text-accent-100 mb-8">
              Veja os preços e escolha o melhor horário para você.
            </p>
            <Link
              href="/lp"
              className="inline-block bg-warm-100 text-accent-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-warm-200 transition"
            >
              Ver consultórios e investimento
            </Link>
          </div>
        </section>
      </Layout>
    </>
  );
}
