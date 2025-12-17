// ===========================================================
// Home Page - Espaço Arthemi MVP
// ===========================================================

import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>Espaço Arthemi — MVP</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800">
        {/* Header */}
        <header className="bg-white/10 backdrop-blur-sm">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <span className="text-2xl font-bold text-white">Arthemi</span>
              <div className="flex items-center space-x-6">
                <Link href="/salas" className="text-white/90 hover:text-white transition">
                  Salas
                </Link>
                <Link 
                  href="/salas" 
                  className="bg-white text-primary-700 px-4 py-2 rounded-lg font-semibold hover:bg-primary-50 transition"
                >
                  Reservar
                </Link>
              </div>
            </div>
          </nav>
        </header>

        {/* Hero */}
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-center px-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Espaço Arthemi — MVP
          </h1>
          <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-2xl">
            Coworking de Saúde em São Paulo. Salas equipadas para profissionais de saúde.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/salas"
              className="bg-white text-primary-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition shadow-lg"
            >
              Ver Salas Disponíveis
            </Link>
            <Link
              href="/admin"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition"
            >
              Área Admin
            </Link>
          </div>
          
          {/* Status Badge */}
          <div className="mt-12 bg-white/20 backdrop-blur-sm rounded-full px-6 py-2">
            <span className="text-white text-sm">
              ✅ MVP Funcional — Next.js + TypeScript + Tailwind + Prisma
            </span>
          </div>
        </main>
      </div>
    </>
  );
}
