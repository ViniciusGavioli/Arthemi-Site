// ===========================================================
// Dados Centralizados de SEO - Espaço Arthemi
// ===========================================================
// Todas as informações do negócio em um só lugar

export const SITE_CONFIG = {
  // Dados básicos do site
  name: 'Espaço Arthemi',
  shortName: 'Arthemi',
  tagline: 'Coworking de Saúde em Belo Horizonte',

  // URL do site (sem barra no final) - sanitiza \r\n de ENVs corrompidas
  url: (process.env.NEXT_PUBLIC_APP_URL || 'https://www.arthemisaude.com').replace(/[\r\n]+/g, '').replace(/\/$/, ''),

  // Imagem padrão para Open Graph (1200x630 recomendado)
  // TODO: Criar imagem og-image.jpg (1200x630) com logo + tagline
  // Por enquanto usa uma foto do espaço
  ogImage: '/images/hero/banner.jpeg',

  // Cores da marca
  themeColor: '#8B7355',

  // Idioma
  locale: 'pt_BR',
  language: 'pt-BR',
};

export const BUSINESS_INFO = {
  // Dados do negócio para Schema.org
  name: 'Espaço Arthemi',
  legalName: 'Espaço Arthemi Coworking de Saúde',
  description: 'Coworking de saúde em Belo Horizonte. Salas prontas para atendimento com recepção, limpeza e internet inclusos. Ideal para psicólogos, nutricionistas, fisioterapeutas e profissionais de saúde.',

  // Endereço
  address: {
    street: 'Avenida Brasil, 248',
    neighborhood: 'Santa Efigênia',
    city: 'Belo Horizonte',
    state: 'MG',
    stateCode: 'MG',
    postalCode: '30.140-900',
    country: 'BR',
  },

  // Contato
  phone: '+55 31 9992-3910',
  whatsapp: '5531999923910',
  email: 'contato@arthemisaude.com',

  // Redes sociais
  social: {
    instagram: 'https://instagram.com/arthemisaude',
    facebook: 'https://facebook.com/arthemisaude',
    // whatsapp link gerado dinamicamente
  },

  // Horário de funcionamento
  openingHours: [
    { days: 'Monday', hours: '08:00-20:00' },
    { days: 'Tuesday', hours: '08:00-20:00' },
    { days: 'Wednesday', hours: '08:00-20:00' },
    { days: 'Thursday', hours: '08:00-20:00' },
    { days: 'Friday', hours: '08:00-20:00' },
    { days: 'Saturday', hours: '08:00-14:00' },
  ],

  // Coordenadas (Santa Efigênia, BH)
  geo: {
    latitude: -19.920000,
    longitude: -43.930618,
  },

  // Faixa de preço
  priceRange: 'R$ 30 - R$ 150',

  // Palavras-chave do negócio
  keywords: [
    'coworking saúde',
    'sala para atendimento',
    'consultório compartilhado',
    'espaço para psicólogo',
    'sala para nutricionista',
    'sala para fisioterapeuta',
    'consultório por hora',
    'Belo Horizonte',
    'BH',
  ],
};

// SEO específico por página
export const PAGE_SEO = {
  home: {
    title: 'Espaço Arthemi — Coworking de Saúde em Belo Horizonte',
    description: 'Salas prontas para atendimento em saúde. Recepção, limpeza e internet inclusos. Você atende, a gente cuida do resto. Reserve online agora.',
    keywords: 'coworking saúde BH, sala atendimento Belo Horizonte, consultório compartilhado',
  },
  salas: {
    title: 'Consultórios e Investimento — Espaço Arthemi',
    description: 'Conheça nossos consultórios para atendimento. Preços a partir de R$ 39,99/hora. Tudo incluso: recepção, limpeza, internet, café. Sem taxas extras.',
    keywords: 'preço consultório atendimento, aluguel consultório hora, consultório psicólogo BH',
  },
  comoFunciona: {
    title: 'Como Funciona — Espaço Arthemi',
    description: 'Veja como é simples reservar um consultório no Espaço Arthemi. 4 passos para você atender seus pacientes. Sem burocracia, sem contrato.',
    keywords: 'como reservar consultório, coworking sem contrato, espaço saúde flexível',
  },
  faq: {
    title: 'Dúvidas Frequentes — Espaço Arthemi',
    description: 'Tire suas dúvidas sobre o Espaço Arthemi. Contrato, pagamento, cancelamento, o que está incluso e mais. Respostas claras e diretas.',
    keywords: 'dúvidas coworking, perguntas consultório compartilhado, FAQ espaço saúde',
  },
};

// Gera URL completa
export function getFullUrl(path: string = ''): string {
  const base = SITE_CONFIG.url.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return path ? `${base}${cleanPath}` : base;
}

// Gera URL da imagem OG
export function getOgImageUrl(image?: string): string {
  const imagePath = image || SITE_CONFIG.ogImage;
  if (imagePath.startsWith('http')) return imagePath;
  return getFullUrl(imagePath);
}
