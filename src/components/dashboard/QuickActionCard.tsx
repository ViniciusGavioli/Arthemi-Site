// ===========================================================
// Componente: QuickActionCard - Ação rápida do dashboard
// Suporta href (Link) ou onClick (button)
// ===========================================================

import Link from 'next/link';

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'primary';
}

export function QuickActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  variant = 'default',
}: QuickActionCardProps) {
  const isPrimary = variant === 'primary';
  
  const baseClasses = `flex items-center gap-4 p-4 rounded-xl transition-all w-full text-left ${
    isPrimary
      ? 'bg-primary-600 hover:bg-primary-700 text-white'
      : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
  }`;

  const content = (
    <>
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isPrimary ? 'bg-primary-500' : 'bg-gray-100'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isPrimary ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className={`text-sm truncate ${isPrimary ? 'text-primary-100' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>
    </>
  );

  // Se tem onClick, renderiza button
  if (onClick) {
    return (
      <button onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  // Se tem href, renderiza Link
  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  // Fallback: div (não deveria acontecer)
  return <div className={baseClasses}>{content}</div>;
}
