// ===========================================================
// Componente: KpiCard - Card de KPI para dashboard
// ===========================================================

import Link from 'next/link';

interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  href?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  loading?: boolean;
}

const variantStyles = {
  default: 'bg-white border-gray-200',
  primary: 'bg-primary-50 border-primary-200',
  success: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
};

const iconBgStyles = {
  default: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary-100 text-primary-600',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
};

export function KpiCard({
  icon,
  title,
  value,
  subtitle,
  href,
  variant = 'default',
  loading = false,
}: KpiCardProps) {
  const content = (
    <div className={`rounded-xl border p-5 transition-all ${variantStyles[variant]} ${href ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${iconBgStyles[variant]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          {loading ? (
            <div className="mt-1 h-7 w-24 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="mt-1 text-xl font-bold text-gray-900 truncate">{value}</p>
          )}
          {subtitle && !loading && (
            <p className="mt-0.5 text-sm text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Skeleton para loading
export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="mt-2 h-6 w-28 bg-gray-200 rounded" />
          <div className="mt-1 h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
