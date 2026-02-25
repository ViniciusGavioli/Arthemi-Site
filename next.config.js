/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Formatos modernos para melhor performance
    formats: ['image/avif', 'image/webp'],
    // Device sizes para responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image sizes para thumbnails e ícones
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Permitir imagens de fontes externas (ex: Unsplash para placeholder)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  // Headers para cache de assets estáticos
  async headers() {
    return [
      {
        // Cache agressivo para imagens estáticas
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache para ícones
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Redirecionamento da Home para a nova LP Premium
  async redirects() {
    return [
      {
        source: '/',
        destination: '/lp-premium',
        permanent: false, // Usando temporary para caso queira voltar atrás fácil
      },
    ];
  },
};

module.exports = nextConfig;
