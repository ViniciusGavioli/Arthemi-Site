// ===========================================================
// Página: /account - REDIRECT para /minha-conta
// ===========================================================
// Mantido para compatibilidade - redireciona para a nova URL

import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/minha-conta',
      permanent: true, // 301 redirect
    },
  };
};

// Componente vazio - nunca será renderizado devido ao redirect
export default function AccountRedirect() {
  return null;
}
