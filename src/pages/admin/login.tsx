// ===========================================================
// Página de Login do Admin (LEGADO - DESATIVADO)
// ===========================================================
// Redireciona permanentemente para o novo fluxo de login unificado

import type { GetServerSideProps } from 'next';

/**
 * Login admin legado foi removido.
 * Redireciona para /login?next=/admin
 */
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/login?next=/admin',
      permanent: true,
    },
  };
};

// Página nunca renderiza (redirect acontece no servidor)
export default function AdminLoginRedirect() {
  return null;
}

