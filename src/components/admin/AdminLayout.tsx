// ===========================================================
// AdminLayout - Layout principal do painel administrativo
// ===========================================================

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { href: '/admin', icon: '📊', label: 'Dashboard' },
  { href: '/admin/reservas', icon: '📅', label: 'Reservas' },
  { href: '/admin/clientes', icon: '👥', label: 'Clientes' },
  { href: '/admin/nova-reserva', icon: '➕', label: 'Nova Reserva' },
  { href: '/admin/auditoria', icon: '📋', label: 'Auditoria' },
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

      <div className="min-h-screen bg-gray-50 flex">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-center border-b border-gray-100">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <span className="font-bold text-gray-800">Espaço Arthemi</span>
            </Link>
          </div>

          {/* Menu */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = router.pathname === item.href || 
                (item.href !== '/admin' && router.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Voltar ao site */}
          <div className="absolute bottom-4 left-4 right-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← Voltar ao site
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
                title="Abrir menu"
                aria-label="Abrir menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:block">Administrador</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
