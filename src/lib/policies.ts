// ===========================================================
// lib/policies.ts - Textos Institucionais Centralizados
// ===========================================================
// Fonte única de verdade para comunicação de cancelamento,
// reembolso e cupons. Linguagem profissional e institucional
// alinhada ao setor de saúde.
// ===========================================================

// ============================================================
// 1. CONSTANTES DE NEGÓCIO
// ============================================================

export const POLICY_CONSTANTS = {
  MIN_CANCELLATION_HOURS: 48,
  CREDIT_VALIDITY_MONTHS: 6,
  WHATSAPP_SUPPORT: '(31) 98491-6090',
  EMAIL_SUPPORT: 'contato@arthemi.com.br',
} as const;

// ============================================================
// 2. POLÍTICA OFICIAL (DOCUMENTO CANÔNICO)
// ============================================================

export const OFFICIAL_POLICY = {
  title: 'Política de Cancelamento, Reembolso e Cupons',
  lastUpdate: '11 de janeiro de 2026',
  
  sections: {
    cancellation: {
      title: '1. Cancelamento de Reservas',
      content: `Para garantir a melhor organização dos atendimentos e disponibilidade dos espaços, 
solicitamos que cancelamentos sejam realizados com no mínimo 48 horas de antecedência 
do horário agendado.

Cancelamentos dentro do prazo:
• Elegíveis para reembolso integral do valor efetivamente pago
• Processamento em até 5 dias úteis

Cancelamentos fora do prazo (menos de 48 horas):
• Não elegíveis para reembolso
• Exceções podem ser analisadas em casos excepcionais mediante contato com nossa equipe`,
    },
    
    refund: {
      title: '2. Reembolso',
      content: `O valor do reembolso corresponde sempre ao montante efetivamente pago no momento 
da reserva, após aplicação de eventuais descontos ou cupons promocionais.

Formas de reembolso:
• Créditos para uso futuro (disponíveis imediatamente)
• Estorno financeiro via PIX (processamento em até 5 dias úteis)

Importante: O reembolso nunca excederá o valor líquido pago. Caso a reserva 
tenha utilizado cupom promocional, o desconto obtido não será creditado.`,
    },
    
    coupons: {
      title: '3. Cupons e Promoções',
      content: `Cupons promocionais são benefícios de uso único, válidos exclusivamente para 
a transação em que foram aplicados.

Regras:
• Cupons promocionais NÃO são restaurados após cancelamento
• O desconto obtido não é convertido em crédito ou reembolso
• Cupons com restrição de uso único não podem ser reutilizados

Esta política visa garantir a sustentabilidade das promoções e o tratamento 
equitativo de todos os clientes.`,
    },
    
    partialRefunds: {
      title: '4. Reembolsos Parciais e Revisões',
      content: `Em situações específicas, como estornos iniciados pelo sistema de pagamento 
ou divergências de valores, o reembolso pode ser classificado como "parcial" 
e encaminhado para revisão administrativa.

Nesses casos:
• Nossa equipe analisará a situação em até 2 dias úteis
• O cliente será notificado sobre a resolução
• Valores pendentes serão regularizados conforme análise`,
    },
    
    transparency: {
      title: '5. Transparência e Segurança',
      content: `Todos os valores de reservas, descontos e reembolsos são registrados em 
sistema auditável, garantindo:

• Rastreabilidade completa das transações
• Segurança dos dados financeiros
• Conformidade com boas práticas do setor de saúde
• Comprovantes disponíveis mediante solicitação

Dúvidas ou solicitações podem ser encaminhadas pelo WhatsApp ${POLICY_CONSTANTS.WHATSAPP_SUPPORT} 
ou e-mail ${POLICY_CONSTANTS.EMAIL_SUPPORT}.`,
    },
  },
  
  // Versão resumida para exibição em modais/tooltips
  summary: `Cancelamentos com 48h+ de antecedência são elegíveis para reembolso do valor 
efetivamente pago. Cupons promocionais não são restaurados após cancelamento.`,
};

// ============================================================
// 3. MICROCOPY - FRONTEND
// ============================================================

export const MICROCOPY = {
  // A) Modal de Cancelamento
  cancellation: {
    title: 'Solicitar Cancelamento',
    
    eligibleMessage: `Esta reserva pode ser cancelada com reembolso integral, 
pois faltam mais de 48 horas para o horário agendado.`,
    
    notEligibleMessage: `Esta reserva não é elegível para reembolso automático, 
pois faltam menos de 48 horas para o horário agendado. 
Para casos excepcionais, entre em contato com nossa equipe.`,
    
    refundInfo: `O reembolso corresponde ao valor efetivamente pago. 
Descontos de cupons promocionais não são restaurados.`,
    
    confirmButton: 'Confirmar Cancelamento',
    cancelButton: 'Manter Reserva',
    
    // Aviso sobre cupom (exibir apenas se booking usou cupom)
    couponWarning: `Atenção: Esta reserva utilizou cupom promocional. 
O desconto aplicado não será creditado em caso de cancelamento.`,
  },
  
  // B) Resumo de Pagamento
  paymentSummary: {
    subtotalLabel: 'Subtotal',
    discountLabel: 'Desconto',
    couponAppliedLabel: (code: string) => `Cupom ${code} aplicado`,
    totalLabel: 'Total a pagar',
    paidLabel: 'Valor pago',
    
    // Tooltip explicativo
    discountTooltip: `O desconto aplicado é válido exclusivamente para esta transação 
e não será restaurado em caso de cancelamento.`,
  },
  
  // C) Página "Minhas Reservas"
  myBookings: {
    // Aviso contextual discreto
    policyNotice: `Cancelamentos com 48h+ de antecedência são elegíveis para reembolso 
do valor efetivamente pago. Cupons não são restaurados.`,
    
    // Status badges
    statusLabels: {
      PENDING: 'Aguardando Pagamento',
      CONFIRMED: 'Confirmada',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Concluída',
      NO_SHOW: 'Não Compareceu',
    },
    
    // Ações
    viewDetails: 'Ver Detalhes',
    requestCancellation: 'Solicitar Cancelamento',
    contactSupport: 'Falar com Suporte',
  },
  
  // D) Página de Detalhes da Reserva
  bookingDetails: {
    refundPolicyTitle: 'Política de Cancelamento',
    refundPolicyText: `Reembolso é do valor efetivamente pago. 
Cupons promocionais não são restaurados.`,
    
    // Resumo com desconto
    paymentBreakdown: {
      original: 'Valor original',
      discount: 'Desconto aplicado',
      paid: 'Valor pago',
    },
  },
  
  // E) Checkout
  checkout: {
    couponPlaceholder: 'Código do cupom',
    applyCoupon: 'Aplicar',
    removeCoupon: 'Remover',
    couponSuccess: (code: string, discount: string) => 
      `Cupom ${code} aplicado! Desconto de ${discount}.`,
    couponError: 'Cupom inválido ou não disponível para uso.',
    couponAlreadyUsed: 'Este cupom já foi utilizado em sua conta.',
    couponNotRecognized: 'Cupom não identificado.',
    
    termsNotice: `Ao confirmar, você concorda com nossa Política de Cancelamento, 
Reembolso e Cupons.`,
  },

  // F) Fluxo de Crédito (Minha Conta)
  creditBooking: {
    couponLabel: 'Cupom de desconto (opcional)',
    couponPlaceholder: 'Digite seu cupom',
    couponHint: 'Cupom será validado na finalização. Cupons só são aplicáveis se houver pagamento em dinheiro.',
    couponNotRecognized: 'Cupom não identificado.',
    couponRequiresCashPayment: `Cupons promocionais são aplicáveis apenas a reservas com pagamento via PIX ou cartão. Quando a reserva é integralmente coberta por créditos, o cupom não é elegível.`,
    couponAlreadyUsed: 'Este cupom já foi utilizado e não pode ser usado novamente.',
  },
};

// ============================================================
// 4. EMAILS TRANSACIONAIS
// ============================================================

export const EMAIL_TEMPLATES = {
  // A) Confirmação de Reserva
  bookingConfirmation: {
    subject: 'Reserva Confirmada | Espaço Arthemi',
    
    greeting: (name: string) => `Olá, ${name}`,
    
    intro: `Sua reserva foi confirmada com sucesso. Abaixo estão os detalhes:`,
    
    footer: `Lembramos que cancelamentos com no mínimo 48 horas de antecedência 
são elegíveis para reembolso do valor efetivamente pago.

Cupons promocionais não são restaurados em caso de cancelamento.

Em caso de dúvidas, entre em contato pelo WhatsApp ${POLICY_CONSTANTS.WHATSAPP_SUPPORT}.

Atenciosamente,
Equipe Espaço Arthemi`,
    
    // Template de valores (quando há desconto)
    paymentDetails: {
      withDiscount: (gross: string, discount: string, coupon: string, net: string) => `
Resumo do Pagamento:
• Valor original: ${gross}
• Desconto (${coupon}): -${discount}
• Valor pago: ${net}`,
      
      withoutDiscount: (amount: string) => `
Valor pago: ${amount}`,
    },
  },
  
  // B) Cancelamento com Crédito
  cancellationCredit: {
    subject: 'Cancelamento Processado - Crédito Disponível | Espaço Arthemi',
    
    greeting: (name: string) => `Olá, ${name}`,
    
    intro: `Confirmamos o cancelamento da sua reserva. O reembolso foi 
processado na forma de créditos para uso futuro.`,
    
    creditInfo: (amount: string, expiresAt: string) => `
Crédito disponível: ${amount}
Validade: ${expiresAt}

Você pode utilizar este crédito em novas reservas pelo nosso site.`,
    
    couponNotice: `Importante: Cupons promocionais utilizados na reserva original 
não são restaurados. O crédito corresponde ao valor efetivamente pago.`,
    
    footer: `Em caso de dúvidas, entre em contato pelo WhatsApp ${POLICY_CONSTANTS.WHATSAPP_SUPPORT}.

Atenciosamente,
Equipe Espaço Arthemi`,
  },
  
  // C) Cancelamento com Estorno Financeiro
  cancellationRefund: {
    subject: 'Cancelamento Processado - Estorno em Andamento | Espaço Arthemi',
    
    greeting: (name: string) => `Olá, ${name}`,
    
    intro: `Confirmamos o cancelamento da sua reserva. O reembolso será 
processado via PIX conforme os dados informados.`,
    
    refundInfo: (amount: string) => `
Valor do estorno: ${amount}
Prazo: até 5 dias úteis
Forma: PIX`,
    
    couponNotice: `Importante: Cupons promocionais utilizados na reserva original 
não são restaurados. O estorno corresponde ao valor efetivamente pago.`,
    
    footer: `Em caso de dúvidas sobre o prazo ou valores, entre em contato 
pelo WhatsApp ${POLICY_CONSTANTS.WHATSAPP_SUPPORT}.

Atenciosamente,
Equipe Espaço Arthemi`,
  },
  
  // D) Estorno Parcial (Revisão)
  partialRefundReview: {
    subject: 'Reembolso em Análise | Espaço Arthemi',
    
    greeting: (name: string) => `Olá, ${name}`,
    
    intro: `Identificamos uma divergência no processamento do reembolso 
da sua reserva. O caso foi encaminhado para revisão administrativa.`,
    
    details: (expected: string, received: string) => `
Valor esperado: ${expected}
Valor processado: ${received}

Nossa equipe está analisando a situação e entrará em contato 
em até 2 dias úteis para regularização.`,
    
    footer: `Pedimos desculpas por qualquer inconveniente. 
Para acompanhamento, entre em contato pelo WhatsApp ${POLICY_CONSTANTS.WHATSAPP_SUPPORT}.

Atenciosamente,
Equipe Espaço Arthemi`,
  },
};

// ============================================================
// 5. ADMIN / OPERAÇÃO
// ============================================================

export const ADMIN_COPY = {
  // Painel de Refunds Parciais
  partialRefunds: {
    sectionTitle: 'Reembolsos Pendentes de Revisão',
    
    description: `Estes registros representam reembolsos que requerem análise manual. 
Isso pode ocorrer quando o valor efetivamente estornado pelo gateway de pagamento 
difere do valor esperado (estorno parcial), ou quando há pendências administrativas.`,
    
    // Explicação por status
    statusExplanations: {
      PENDING: `Aguardando ação administrativa. O cliente ainda não teve 
o reembolso completo processado.`,
      
      PARTIAL: `O gateway processou um valor menor que o esperado. 
Verificar se há taxas retidas ou divergência de valores.`,
    },
    
    // Ações recomendadas
    actionGuidelines: `
AÇÕES RECOMENDADAS:

1. Verificar o valor esperado vs. valor estornado
2. Consultar o gateway (Asaas) para detalhes da transação
3. Se necessário, complementar o reembolso manualmente
4. Atualizar o status após resolução
5. Comunicar o cliente sobre a regularização`,
    
    // Labels
    labels: {
      expectedAmount: 'Valor Esperado',
      refundedAmount: 'Valor Estornado',
      difference: 'Diferença',
      gateway: 'Gateway',
      externalId: 'ID Externo',
      createdAt: 'Data do Registro',
      viewBooking: 'Ver Reserva',
      markResolved: 'Marcar como Resolvido',
    },
    
    // Mensagem para contato com cliente
    clientCommunication: (name: string, difference: string) => `
Prezado(a) ${name},

Identificamos uma pendência no processamento do seu reembolso no valor de ${difference}.

Estamos trabalhando para regularizar a situação e entraremos em contato 
assim que o processo for concluído.

Pedimos desculpas pelo inconveniente.

Atenciosamente,
Equipe Espaço Arthemi`,
  },
  
  // Painel de Solicitações de Estorno
  refundRequests: {
    sectionTitle: 'Solicitações de Estorno',
    
    statusLabels: {
      REQUESTED: 'Solicitado',
      REVIEWING: 'Em Análise',
      APPROVED: 'Aprovado',
      PAID: 'Pago',
      REJECTED: 'Rejeitado',
    },
    
    // Checklist para aprovação
    approvalChecklist: `
ANTES DE APROVAR, VERIFICAR:
☐ Reserva foi cancelada com 48h+ de antecedência?
☐ Valor do estorno corresponde ao NET (não ao GROSS)?
☐ Cliente não está solicitando valor de cupom?
☐ Dados PIX estão corretos?`,
    
    // Motivos de rejeição padrão
    rejectionReasons: [
      'Cancelamento fora do prazo (menos de 48h)',
      'Valor solicitado excede o valor pago',
      'Dados bancários inválidos ou incompletos',
      'Reserva já reembolsada anteriormente',
      'Não comparecimento (No-Show)',
    ],
  },
  
  // Cancelamento pelo Admin
  adminCancellation: {
    refundTypeLabels: {
      CREDITS: 'Créditos para uso futuro',
      MONEY: 'Estorno financeiro (PIX)',
      NONE: 'Sem reembolso',
    },
    
    confirmationMessage: (type: string, amount: string) => {
      switch (type) {
        case 'CREDITS':
          return `Será gerado crédito de ${amount} para o cliente.`;
        case 'MONEY':
          return `Será processado estorno de ${amount} via PIX.`;
        case 'NONE':
          return `A reserva será cancelada sem reembolso.`;
        default:
          return '';
      }
    },
    
    auditNote: `IMPORTANTE: O valor de reembolso é sempre baseado no NET 
(valor efetivamente pago), nunca no GROSS (valor bruto antes do desconto).`,
  },
};

// ============================================================
// 6. HELPERS DE FORMATAÇÃO
// ============================================================

/**
 * Formata valor em centavos para moeda brasileira
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Formata data para exibição
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Gera texto de resumo de pagamento com ou sem desconto
 */
export function generatePaymentSummaryText(
  grossAmount: number,
  discountAmount: number,
  netAmount: number,
  couponCode?: string | null
): string {
  if (discountAmount > 0 && couponCode) {
    return EMAIL_TEMPLATES.bookingConfirmation.paymentDetails.withDiscount(
      formatCurrency(grossAmount),
      formatCurrency(discountAmount),
      couponCode,
      formatCurrency(netAmount)
    );
  }
  return EMAIL_TEMPLATES.bookingConfirmation.paymentDetails.withoutDiscount(
    formatCurrency(netAmount)
  );
}

// ============================================================
// 7. PÁGINA DE POLÍTICA (MARKDOWN/HTML)
// ============================================================

/**
 * Gera o HTML completo da política para exibição em página dedicada
 */
export function generatePolicyPageHTML(): string {
  const { title, lastUpdate, sections } = OFFICIAL_POLICY;
  
  return `
<article class="policy-document">
  <header>
    <h1>${title}</h1>
    <p class="last-update">Última atualização: ${lastUpdate}</p>
  </header>
  
  <section>
    <h2>${sections.cancellation.title}</h2>
    <p>${sections.cancellation.content.replace(/\n/g, '<br>')}</p>
  </section>
  
  <section>
    <h2>${sections.refund.title}</h2>
    <p>${sections.refund.content.replace(/\n/g, '<br>')}</p>
  </section>
  
  <section>
    <h2>${sections.coupons.title}</h2>
    <p>${sections.coupons.content.replace(/\n/g, '<br>')}</p>
  </section>
  
  <section>
    <h2>${sections.partialRefunds.title}</h2>
    <p>${sections.partialRefunds.content.replace(/\n/g, '<br>')}</p>
  </section>
  
  <section>
    <h2>${sections.transparency.title}</h2>
    <p>${sections.transparency.content.replace(/\n/g, '<br>')}</p>
  </section>
</article>
  `.trim();
}
