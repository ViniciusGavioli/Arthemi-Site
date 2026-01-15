// ===========================================================
// Footer - Componente de Rodapé
// ===========================================================

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, MessageCircle } from 'lucide-react';
import { BUSINESS_INFO } from '@/constants/seo';
import { analytics } from '@/lib/analytics';

interface FooterProps {
  /** Usa versão compacta (menos colunas) */
  compact?: boolean;
}

export default function Footer({ compact = false }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const googleMapsLink = 'https://www.google.com/maps/place/Espa%C3%A7o+Arthemi+-+Coworking+de+Sa%C3%BAde+em+BH/@-19.9245428,-43.922652,17z';
  const whatsappLink = `https://wa.me/${BUSINESS_INFO.whatsapp}`;

  // Handler para tracking de clique no WhatsApp
  const handleWhatsAppClick = () => {
    analytics.contactClicked('whatsapp', 'footer');
  };

  // Handler para tracking de clique no telefone
  const handlePhoneClick = () => {
    analytics.contactClicked('phone', 'footer');
  };

  if (compact) {
    return (
      <footer className="bg-primary-950 text-warm-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Espaço Arthemi</h3>
              <p className="text-sm mb-2">
                Coworking de saúde em Belo Horizonte. Consultórios prontos para você atender com profissionalismo e praticidade.
              </p>
              <a 
                href={googleMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-400 hover:text-accent-300 transition"
              >
                Área Hospitalar, Belo Horizonte – MG
              </a>
            </div>
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Links</h3>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/como-funciona" className="hover:text-warm-100 transition">Como funciona</Link>
                <Link href="/salas" className="hover:text-warm-100 transition">Consultórios e Investimento</Link>
                <Link href="/faq" className="hover:text-warm-100 transition">Perguntas frequentes</Link>
              </div>
            </div>
            <div>
              <h3 className="text-warm-100 font-bold text-lg mb-4">Contato</h3>
              <div className="flex flex-col gap-2 text-sm">
                <a 
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-warm-100 transition text-green-400"
                  onClick={handleWhatsAppClick}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                <a 
                  href="tel:+5531984916090"
                  className="flex items-center gap-2 hover:text-warm-100 transition"
                  onClick={handlePhoneClick}
                >
                  <Phone className="w-4 h-4" />
                  (31) 98491-6090
                </a>
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
                src="/images/Logo/logo.webp" 
                alt="Espaço Arthemi" 
                width={160}
                height={64}
                className="h-14 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-warm-500 mb-4 max-w-md">
              Coworking de saúde em Belo Horizonte. Consultórios prontos para você atender com profissionalismo e praticidade.
            </p>
            <a 
              href={googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-accent-400 hover:text-accent-300 transition"
            >
              <MapPin className="w-4 h-4" />
              Área Hospitalar, Belo Horizonte – MG
            </a>
          </div>
          
          {/* Links */}
          <div>
            <h3 className="text-warm-100 font-bold mb-4">Links</h3>
            <div className="flex flex-col gap-3">
              <Link href="/como-funciona" className="hover:text-warm-100 transition">Como funciona</Link>
              <Link href="/salas" className="hover:text-warm-100 transition">Consultórios e Investimento</Link>
              <Link href="/faq" className="hover:text-warm-100 transition">Perguntas frequentes</Link>
            </div>
          </div>
          
          {/* Contato */}
          <div>
            <h3 className="text-warm-100 font-bold mb-4">Contato</h3>
            <div className="flex flex-col gap-3">
              <a 
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-warm-100 transition text-green-400"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
              <a 
                href="tel:+5531984916090" 
                className="flex items-center gap-2 hover:text-warm-100 transition"
                onClick={handlePhoneClick}
              >
                <Phone className="w-4 h-4" />
                (31) 98491-6090
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
