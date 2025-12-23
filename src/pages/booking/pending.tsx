import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function BookingPendingPage() {
  const router = useRouter();
  const { booking: bookingFromQuery } = router.query;
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Recuperar bookingId da query ou localStorage
  useEffect(() => {
    if (bookingFromQuery && typeof bookingFromQuery === 'string') {
      setBookingId(bookingFromQuery);
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lastBookingId');
      if (stored) {
        setBookingId(stored);
      }
    }
  }, [bookingFromQuery]);

  // Polling para verificar status do pagamento
  useEffect(() => {
    if (!bookingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'CONFIRMED') {
            localStorage.removeItem('lastBookingId');
            router.push(`/booking/success?booking=${bookingId}`);
          } else if (data.status === 'CANCELLED') {
            localStorage.removeItem('lastBookingId');
            router.push(`/booking/failure?booking=${bookingId}`);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [bookingId, router]);

  async function handleCheckStatus() {
    if (!bookingId) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'CONFIRMED') {
          localStorage.removeItem('lastBookingId');
          router.push(`/booking/success?booking=${bookingId}`);
        } else if (data.status === 'CANCELLED') {
          localStorage.removeItem('lastBookingId');
          router.push(`/booking/failure?booking=${bookingId}`);
        } else {
          alert('Pagamento ainda pendente. Continue aguardando.');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Head>
        <title>Pagamento Pendente | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Ícone de Pendente */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-yellow-500 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Mensagem */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Aguardando Pagamento
          </h1>
          <p className="text-gray-600 mb-8">
            Estamos processando seu pagamento. Isso pode levar alguns minutos.
          </p>

          {/* Status */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            </div>
            <p className="text-gray-600">
              Verificando automaticamente a cada 5 segundos...
            </p>
          </div>

          {/* Instruções para Pix */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
            <h3 className="font-semibold text-blue-800 mb-2">
              💡 Se você escolheu Pix
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Abra o app do seu banco</li>
              <li>• Escaneie o QR Code ou copie o código</li>
              <li>• Confirme o pagamento</li>
              <li>• Aguarde a confirmação nesta página</li>
            </ul>
          </div>

          {/* Código da Reserva */}
          {bookingId && (
            <div className="bg-gray-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-gray-500 mb-1">Código da Reserva</p>
              <p className="font-mono text-lg text-gray-800">
                {bookingId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="space-y-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {checking ? 'Verificando...' : 'Verificar Status Agora'}
            </button>
            <Link
              href="/"
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Voltar ao Início
            </Link>
          </div>

          {/* Aviso */}
          <div className="mt-8 text-sm text-gray-500">
            <p>
              Você receberá um e-mail assim que o pagamento for confirmado.
            </p>
            <p className="mt-2">
              Problemas?{' '}
              <a href="https://wa.me/5531984916090" className="text-primary hover:underline">
                Fale conosco
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
