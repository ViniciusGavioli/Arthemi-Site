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
      answer: 'Não. Você pode usar o espaço quando precisar, sem compromisso de continuidade. Não exigimos tempo mínimo de permanência nem cobramos multa se você parar de usar. Funciona de forma simples: você reserva, usa e paga pelo que usou.'
    },
    {
      question: 'Preciso assinar algum contrato?',
      answer: 'Para horas avulsas e pacotes, não há contrato formal — apenas os termos de uso que você aceita ao reservar. Para turnos fixos mensais, fazemos um acordo simples por escrito, mas ainda assim sem multa de cancelamento. Você pode encerrar quando quiser, basta avisar com antecedência.'
    },
    {
      question: 'Posso remarcar ou cancelar uma reserva?',
      answer: 'Sim. Pedimos apenas que você avise com pelo menos 24 horas de antecedência. Assim conseguimos reorganizar a agenda e liberar o horário para outros profissionais. Cancelamentos em cima da hora podem ter a cobrança mantida.'
    },
    {
      question: 'O que está incluso no valor?',
      answer: 'Tudo o que você precisa para atender: sala mobiliada, ar-condicionado, recepção para seus pacientes, limpeza entre atendimentos, internet de alta velocidade, café e água, e acesso ao prontuário online. Não há taxas extras ou custos escondidos.'
    },
    {
      question: 'Como funciona o sábado?',
      answer: 'Aos sábados o espaço funciona com horários reduzidos e valores diferenciados. Você pode reservar por hora ou um bloco de 5 horas com desconto. Os valores estão na página de preços. A estrutura é a mesma dos dias de semana: recepção, limpeza e tudo incluso.'
    },
    {
      question: 'Preciso levar alguma coisa?',
      answer: 'Apenas o que for específico do seu atendimento. Insumos básicos como lençol descartável, papel toalha e álcool em gel já estão disponíveis. Se você usa materiais ou equipamentos específicos da sua especialidade, pode trazer e guardar em um espaço reservado (converse conosco sobre isso).'
    },
    {
      question: 'Qual a diferença entre os consultórios?',
      answer: 'Temos três opções: o Consultório 1 | Prime é o mais amplo, com maca e circulação 360º, ideal para fisioterapia, massoterapia e procedimentos. O Consultório 2 | Executive também tem maca, ótimo para consultas médicas e nutrição. O Consultório 3 | Essential é mais intimista, com poltronas, perfeito para psicologia e terapia. Todos têm ar-condicionado, boa iluminação e privacidade.'
    },
    {
      question: 'Como funciona o pagamento?',
      answer: 'O pagamento é feito online, no momento da reserva, via Pix ou cartão de crédito. É rápido e seguro. Você recebe a confirmação por e-mail na hora. Para turnos fixos mensais, a cobrança é recorrente no início de cada mês.'
    },
    {
      question: 'Posso atender pacientes de convênio?',
      answer: 'Sim, sem problema. A relação com convênios é sua. O espaço fornece apenas a estrutura física. Você emite suas guias, recibos e notas normalmente, como faria em qualquer consultório.'
    },
    {
      question: 'O espaço oferece recepcionista?',
      answer: 'Sim. Nossa recepção recebe seus pacientes, confirma a agenda e avisa você quando eles chegam. Você não precisa se preocupar com isso — pode focar no atendimento.'
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
              Perguntas frequentes
            </h1>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              Respostas diretas para as dúvidas mais comuns sobre o Espaço Arthemi.
            </p>
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
              Ainda tem alguma dúvida?
            </h2>
            <p className="text-secondary-600 mb-6">
              Fale com a gente. Respondemos rápido e sem enrolação.
            </p>
            <a
              href="https://wa.me/5531984916090"
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
              Pronto para reservar sua sala?
            </h2>
            <p className="text-xl text-accent-100 mb-8">
              Veja os preços e escolha o melhor horário para você.
            </p>
            <Link
              href="/salas"
              className="inline-block bg-warm-100 text-accent-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-warm-200 transition"
            >
              Ver consultórios e preços
            </Link>
          </div>
        </section>
      </Layout>
    </>
  );
}
