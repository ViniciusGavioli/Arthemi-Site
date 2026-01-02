// ===========================================================
// Redirect to Admin Dashboard (with SSR protection)
// ===========================================================

import { GetServerSideProps } from 'next';
import { requireAdminSSR } from '@/lib/auth';

// Proteção SSR: Exige role ADMIN
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const result = requireAdminSSR(ctx);
  
  if ('redirect' in result) {
    return result;
  }

  // Se autenticado como admin, redireciona para dashboard
  return {
    redirect: {
      destination: '/admin/dashboard',
      permanent: false,
    },
  };
};

export default function AdminRedirect() {
  // Esta página nunca será renderizada (sempre redireciona via SSR)
  return null;
}
