// ===========================================================
// Página: /auth/entrar - REDIRECIONAMENTO para /login
// ===========================================================
// ⚠️ DESATIVADO: Magic link substituído por login email+senha
// Esta página agora apenas redireciona para /login
// Código legado removido - consultar git history para rollback

import { GetServerSideProps } from 'next';

// Redireciona no servidor para evitar flash
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/login?from=magic_link',
      permanent: false,
    },
  };
};

// Componente vazio (nunca renderizado devido ao redirect)
export default function EntrarPage() {
  return null;
}
