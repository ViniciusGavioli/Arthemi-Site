/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
    // Desabilitar otimização para usar imagens em qualidade original
    unoptimized: true,
  },
};

module.exports = nextConfig;
