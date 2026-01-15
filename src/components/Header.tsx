// ===========================================================
// Header - Componente de Navegação Principal
// ===========================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Menu, X, MessageCircle, User } from 'lucide-react';
import { BUSINESS_INFO } from '@/constants/seo';

interface NavLink {
  href: string;
  label: string;
}

const navLinks: NavLink[] = [
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/salas', label: 'Consultórios e Investimento' },
  { href: '/faq', label: 'Perguntas Frequentes' },
];

interface HeaderProps {
  /** Usa header fixo (fixed) ou sticky */
  variant?: 'fixed' | 'sticky';
}

export default function Header({ variant = 'sticky' }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  
  const isActive = (href: string) => router.pathname === href;
  
  const positionClass = variant === 'fixed' 
    ? 'fixed top-0 left-0 right-0 pt-safe' 
    : 'sticky top-0';

  const whatsappLink = `https://wa.me/${BUSINESS_INFO.whatsapp}?text=Olá! Gostaria de saber mais sobre o Espaço Arthemi.`;

  return (
    <header className={`${positionClass} z-50 bg-warm-50/90 backdrop-blur-lg border-b border-warm-200`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between min-h-[64px] items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image 
              src="/images/Logo/logo.webp" 
              alt="Espaço Arthemi" 
              width={140}
              height={56}
              className="h-12 w-auto"
              priority
            />
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className={`transition font-medium ${
                  isActive(link.href) 
                    ? 'text-accent-700' 
                    : 'text-primary-700 hover:text-accent-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-700 hover:text-accent-600 transition font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Fale conosco
            </a>
            <Link
              href="/minha-conta"
              className="inline-flex items-center gap-2 text-primary-700 hover:text-accent-600 transition font-medium"
            >
              <User className="w-4 h-4" />
              Entrar
            </Link>
            <Link 
              href="/salas" 
              className="bg-gradient-to-r from-accent-600 to-accent-700 text-white px-6 py-2.5 rounded-full font-semibold hover:shadow-lg hover:shadow-accent-500/30 transition-all duration-300 hover:-translate-y-0.5"
            >
              Reservar consultório
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen ? 'true' : 'false'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-warm-200">
            <div className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className={`font-medium ${
                    isActive(link.href) 
                      ? 'text-accent-700' 
                      : 'text-primary-700'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/minha-conta"
                className="flex items-center justify-center gap-2 text-primary-700 font-medium py-2 border border-primary-300 rounded-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                Entrar / Minha Conta
              </Link>
              <Link 
                href="/salas" 
                className="bg-accent-600 text-white px-6 py-3 rounded-full font-semibold text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Reservar consultório
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-primary-700 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MessageCircle className="w-5 h-5" />
                Fale conosco
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
