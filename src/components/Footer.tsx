// ===========================================================
// Footer - Componente de Rodapé
// ===========================================================

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Mail } from 'lucide-react';
import { BUSINESS_INFO } from '@/constants/seo';

interface FooterProps {
  /** Usa versão compacta (menos colunas) */
  compact?: boolean;
}

export default function Footer({ compact = false }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (compact) {
    return (
      <footer className="bg-primary-950 text-warm-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Espaço Arthemi</h3>
              <p className="text-sm">
                Coworking de saúde em Belo Horizonte.<br />
                Salas prontas para você atender.
              </p>
            </div>
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Localização</h3>
              <p className="text-sm">
                {BUSINESS_INFO.address.neighborhood}<br />
                {BUSINESS_INFO.address.city} — {BUSINESS_INFO.address.stateCode}
              </p>
            </div>
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Links</h3>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/como-funciona" className="hover:text-warm-100 transition">Como Funciona</Link>
                <Link href="/salas" className="hover:text-warm-100 transition">Salas e Preços</Link>
                <Link href="/faq" className="hover:text-warm-100 transition">Perguntas Frequentes</Link>
                <Link href="/admin" className="hover:text-warm-100 transition text-warm-600">Área Admin</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-primary-800 mt-8 pt-8 text-center text-sm">
            © {currentYear} Espaço Arthemi. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-primary-950 text-warm-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Logo e descrição */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <Image 
                src="/images/Logo/logo.png" 
                alt="Espaço Arthemi" 
                width={160}
                height={64}
                className="h-14 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-warm-500 mb-6 max-w-md">
              Coworking de saúde em Belo Horizonte. Salas prontas para você atender com 
              profissionalismo, sem dor de cabeça.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-accent-500" />
              {BUSINESS_INFO.address.neighborhood}, {BUSINESS_INFO.address.city} — {BUSINESS_INFO.address.stateCode}
            </div>
          </div>
          
          {/* Links */}
          <div>
            <h3 className="text-warm-100 font-bold mb-4">Links</h3>
            <div className="flex flex-col gap-3">
              <Link href="/como-funciona" className="hover:text-warm-100 transition">Como Funciona</Link>
              <Link href="/salas" className="hover:text-warm-100 transition">Salas e Preços</Link>
              <Link href="/faq" className="hover:text-warm-100 transition">Perguntas Frequentes</Link>
              <Link href="/admin" className="hover:text-warm-100 transition">Área Admin</Link>
            </div>
          </div>
          
          {/* Contato */}
          <div>
            <h3 className="text-warm-100 font-bold mb-4">Contato</h3>
            <div className="flex flex-col gap-3">
              <a 
                href={`tel:${BUSINESS_INFO.phone.replace(/\s/g, '')}`} 
                className="flex items-center gap-2 hover:text-warm-100 transition"
              >
                <Phone className="w-4 h-4" />
                {BUSINESS_INFO.phone.replace('+55 ', '(').replace(' ', ') ')}
              </a>
              <a 
                href={`mailto:${BUSINESS_INFO.email}`} 
                className="flex items-center gap-2 hover:text-warm-100 transition"
              >
                <Mail className="w-4 h-4" />
                {BUSINESS_INFO.email}
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom bar */}
        <div className="border-t border-primary-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© {currentYear} Espaço Arthemi. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/termos" className="hover:text-warm-100 transition">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-warm-100 transition">Privacidade</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
