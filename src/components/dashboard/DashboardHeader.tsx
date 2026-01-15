// ===========================================================
// Componente: DashboardHeader - Header do painel do usuário
// ===========================================================

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Calendar, CreditCard, User, HelpCircle, LogOut, Plus } from 'lucide-react';

interface DashboardHeaderProps {
  userName?: string;
  onLogout: () => void;
}

const navItems = [
  { href: '/minha-conta/reservas', label: 'Reservas', icon: Calendar },
  { href: '/minha-conta', label: 'Créditos', icon: CreditCard },
  { href: '/minha-conta/perfil', label: 'Perfil', icon: User },
  { href: '/faq', label: 'Suporte', icon: HelpCircle },
];

export function DashboardHeader({ userName, onLogout }: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Título */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/images/Logo/logo.webp"
                alt="Espaço Arthemi"
                width={120}
                height={40}
                className="h-9 w-auto"
              />
            </Link>
            <div className="hidden sm:block h-6 w-px bg-gray-200" />
            <span className="hidden sm:block text-sm font-medium text-gray-600">
              Minha Conta
            </span>
          </div>

          {/* Nav Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Ações Desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/minha-conta/nova-reserva"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Reserva
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Olá, <strong>{userName || 'Usuário'}</strong>
              </span>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-1">
            {/* CTA Mobile */}
            <Link
              href="/minha-conta/nova-reserva"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors mb-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Plus className="w-5 h-5" />
              Nova Reserva
            </Link>

            {/* Nav Links */}
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-5 h-5 text-gray-500" />
                {item.label}
              </Link>
            ))}

            {/* Logout */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
