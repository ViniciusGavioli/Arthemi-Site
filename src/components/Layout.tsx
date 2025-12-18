// ===========================================================
// Layout - Wrapper com Header e Footer
// ===========================================================

import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  /** Variante do header: fixed (home) ou sticky (outras páginas) */
  headerVariant?: 'fixed' | 'sticky';
  /** Usa footer compacto ou completo */
  compactFooter?: boolean;
  /** Desativa o header (para páginas especiais) */
  noHeader?: boolean;
  /** Desativa o footer (para páginas especiais) */
  noFooter?: boolean;
  /** Classe CSS adicional para o container principal */
  className?: string;
}

export default function Layout({
  children,
  headerVariant = 'sticky',
  compactFooter = false,
  noHeader = false,
  noFooter = false,
  className = '',
}: LayoutProps) {
  return (
    <div className={`min-h-screen bg-warm-50 ${className}`}>
      {!noHeader && <Header variant={headerVariant} />}
      <main>{children}</main>
      {!noFooter && <Footer compact={compactFooter} />}
    </div>
  );
}
