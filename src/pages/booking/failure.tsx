import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function BookingFailurePage() {
  const router = useRouter();
  const { booking, error } = router.query;

  return (
    <>
      <Head>
        <title>Pagamento Não Processado | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Ícone de Erro */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>

          {/* Mensagem */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Pagamento Não Processado
          </h1>
          <p className="text-gray-600 mb-8">
            Infelizmente não foi possível processar seu pagamento. 
            Por favor, tente novamente ou escolha outro método de pagamento.
          </p>

          {/* Motivo do Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-red-600">
                <strong>Motivo:</strong> {decodeURIComponent(String(error))}
              </p>
            </div>
          )}

          {/* Dicas */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              💡 Possíveis soluções
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Verifique se os dados do cartão estão corretos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Certifique-se de que há limite disponível
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Tente usar outro método de pagamento (Pix)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Entre em contato com seu banco se o problema persistir
              </li>
            </ul>
          </div>

          {/* Botões */}
          <div className="space-y-3">
            {booking && (
              <button
                onClick={() => router.push(`/api/payments/create?bookingId=${booking}`)}
                className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Tentar Novamente
              </button>
            )}
            <Link
              href="/salas"
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Fazer Nova Reserva
            </Link>
            <Link
              href="/"
              className="block w-full text-gray-500 py-2 font-medium hover:text-gray-700 transition-colors"
            >
              Voltar ao Início
            </Link>
          </div>

          {/* Suporte */}
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">
              Precisa de ajuda? Nossa equipe está disponível para auxiliá-lo.
            </p>
            <a
              href="https://wa.me/5511999999999?text=Olá! Estou com problema no pagamento da minha reserva."
              className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
            >
              <span>💬</span> Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
