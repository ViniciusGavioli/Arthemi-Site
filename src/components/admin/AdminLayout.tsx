// ===========================================================
// AdminLayout - Layout principal do painel administrativo
// ===========================================================

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { href: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/admin/reservas', icon: '📅', label: 'Reservas' },
  { href: '/admin/clientes', icon: '👥', label: 'Clientes' },
  { href: '/admin/nova-reserva', icon: '➕', label: 'Nova Reserva' },
  { href: '/admin/auditoria', icon: '📋', label: 'Auditoria' },
  { href: '/admin/marketing', icon: '📈', label: 'Marketing & Integrações' },
  { href: '/admin/status', icon: '🖥️', label: 'Status do Sistema' },
];

export default function AdminLayout({ children, title = 'Admin' }: AdminLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout');
      router.push('/admin/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <>
      <Head>
        <title>{title} | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Dark elegant */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-gradient-to-b from-primary-900 via-primary-900 to-primary-950 shadow-2xl transform transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Logo */}
          <div className="h-20 flex items-center justify-center border-b border-primary-800/50">
            <Link href="/admin/dashboard" className="flex items-center gap-3">
              <Image 
                src="/images/Logo/logo.png" 
                alt="Espaço Arthemi" 
                width={140}
                height={50}
                className="h-10 w-auto brightness-0 invert opacity-90"
              />
            </Link>
          </div>

          {/* Badge Admin */}
          <div className="px-6 py-4">
            <div className="bg-primary-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <p className="text-white font-medium text-sm">Administrador</p>
                <p className="text-primary-400 text-xs">Painel de Gestão</p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="px-4 py-2 space-y-1">
            <p className="px-4 py-2 text-xs font-semibold text-primary-500 uppercase tracking-wider">
              Menu Principal
            </p>
            {menuItems.map((item) => {
              const isActive = router.pathname === item.href || 
                (item.href !== '/admin/dashboard' && router.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/30'
                      : 'text-primary-300 hover:bg-primary-800/50 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer sidebar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-800/50">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-3 text-sm text-primary-400 hover:text-white hover:bg-primary-800/50 rounded-xl transition-all"
            >
              <span>🌐</span>
              <span>Voltar ao site</span>
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-20 bg-white/80 backdrop-blur-lg shadow-sm flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-xl transition-all"
                title="Abrir menu"
                aria-label="Abrir menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{title}</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Painel Administrativo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-600">Online</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 text-sm font-medium text-red-600 hover:text-white hover:bg-red-500 rounded-xl transition-all duration-200 flex items-center gap-2"
              >
                <span>🚪</span>
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
