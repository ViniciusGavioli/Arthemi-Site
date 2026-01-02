// ===========================================================
// Componente SEO - Meta tags, Open Graph, Twitter, JSON-LD
// ===========================================================
// Componente reutilizável para SEO em todas as páginas

import Head from 'next/head';
import { SITE_CONFIG, BUSINESS_INFO, getFullUrl, getOgImageUrl } from '@/constants/seo';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  children?: React.ReactNode;
}

export default function SEO({
  title,
  description,
  keywords,
  path = '',
  image,
  type = 'website',
  noindex = false,
  children,
}: SEOProps) {
  const url = getFullUrl(path);
  const ogImage = getOgImageUrl(image);
  
  return (
    <Head>
      {/* Título e descrição básicos */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_CONFIG.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_CONFIG.name} - ${SITE_CONFIG.tagline}`} />
      <meta property="og:locale" content={SITE_CONFIG.locale} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Geo tags para SEO local */}
      <meta name="geo.region" content={`BR-${BUSINESS_INFO.address.stateCode}`} />
      <meta name="geo.placename" content={BUSINESS_INFO.address.city} />
      <meta name="geo.position" content={`${BUSINESS_INFO.geo.latitude};${BUSINESS_INFO.geo.longitude}`} />
      <meta name="ICBM" content={`${BUSINESS_INFO.geo.latitude}, ${BUSINESS_INFO.geo.longitude}`} />
      
      {/* Conteúdo adicional passado como children */}
      {children}
    </Head>
  );
}

// ===========================================================
// JSON-LD Schema.org - LocalBusiness
// ===========================================================

export function LocalBusinessSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': getFullUrl('#organization'),
    name: BUSINESS_INFO.name,
    legalName: BUSINESS_INFO.legalName,
    description: BUSINESS_INFO.description,
    url: SITE_CONFIG.url,
    logo: getFullUrl('/icons/icon-512x512.png'),
    image: getOgImageUrl(),
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    priceRange: BUSINESS_INFO.priceRange,
    currenciesAccepted: 'BRL',
    paymentAccepted: 'Pix, Cartão de Crédito',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.stateCode,
      postalCode: BUSINESS_INFO.address.postalCode,
      addressCountry: BUSINESS_INFO.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    openingHoursSpecification: BUSINESS_INFO.openingHours.map(({ days, hours }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens: hours.split('-')[0],
      closes: hours.split('-')[1],
    })),
    sameAs: [
      BUSINESS_INFO.social.instagram,
      BUSINESS_INFO.social.facebook,
    ].filter(Boolean),
    areaServed: {
      '@type': 'City',
      name: BUSINESS_INFO.address.city,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Consultórios para Atendimento',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Consultório para Atendimento por Hora',
            description: 'Aluguel de consultório equipado para profissionais de saúde',
          },
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ===========================================================
// JSON-LD Schema.org - WebSite (para busca do site)
// ===========================================================

export function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: BUSINESS_INFO.description,
    inLanguage: SITE_CONFIG.language,
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_INFO.name,
      logo: {
        '@type': 'ImageObject',
        url: getFullUrl('/icons/icon-512x512.png'),
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ===========================================================
// JSON-LD Schema.org - FAQPage
// ===========================================================

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSchema({ faqs }: { faqs: FAQItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ===========================================================
// JSON-LD Schema.org - BreadcrumbList
// ===========================================================

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getFullUrl(item.path),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
