import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Timeout máximo de polling: 5 minutos (300 segundos)
const POLLING_TIMEOUT_MS = 5 * 60 * 1000;

type EntityType = 'booking' | 'credit';

export default function BookingPendingPage() {
  const router = useRouter();
  const { booking: bookingFromQuery, credit: creditFromQuery, type: typeFromQuery } = router.query;
  
  // Suporta tanto booking quanto credit
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('booking');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Determinar tipo e ID da entidade
    if (creditFromQuery && typeof creditFromQuery === 'string') {
      setEntityId(creditFromQuery);
      setEntityType('credit');
    } else if (bookingFromQuery && typeof bookingFromQuery === 'string') {
      setEntityId(bookingFromQuery);
      setEntityType('booking');
    } else if (typeof window !== 'undefined') {
      // Fallback para localStorage
      const storedBookingId = localStorage.getItem('lastBookingId');
      const storedCreditId = localStorage.getItem('lastCreditId');
      
      if (storedCreditId) {
        setEntityId(storedCreditId);
        setEntityType('credit');
      } else if (storedBookingId) {
        setEntityId(storedBookingId);
        setEntityType('booking');
      }
    }

    if (typeof window !== 'undefined') {
      const storedUrl = localStorage.getItem('lastPaymentUrl');
      if (storedUrl) {
        setPaymentUrl(storedUrl);
      }
    }
  }, [bookingFromQuery, creditFromQuery, typeFromQuery]);

  useEffect(() => {
    if (!entityId) return;

    // Timer de timeout máximo
    const timeoutTimer = setTimeout(() => {
      setTimedOut(true);
      console.log('⏰ [PENDING] Timeout de polling atingido após 5 minutos');
    }, POLLING_TIMEOUT_MS);

    // Determinar endpoint baseado no tipo
    const endpoint = entityType === 'credit' 
      ? `/api/credits/${entityId}`
      : `/api/bookings/${entityId}`;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          
          // Para credits, verificar status CONFIRMED
          // Para bookings, verificar status CONFIRMED
          if (data.status === 'CONFIRMED') {
            // Limpar storage
            localStorage.removeItem('lastBookingId');
            localStorage.removeItem('lastCreditId');
            localStorage.removeItem('lastPaymentUrl');
            
            // Redirecionar para minha conta
            router.push('/minha-conta?confirmed=true');
          } else if (data.status === 'CANCELLED' || data.status === 'REFUNDED') {
            localStorage.removeItem('lastBookingId');
            localStorage.removeItem('lastCreditId');
            localStorage.removeItem('lastPaymentUrl');
            router.push(`/booking/failure?${entityType}=${entityId}`);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutTimer);
    };
  }, [entityId, entityType, router]);

  async function handleCheckStatus() {
    if (!entityId) return;
    setChecking(true);
    
    const endpoint = entityType === 'credit' 
      ? `/api/credits/${entityId}`
      : `/api/bookings/${entityId}`;
    
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'CONFIRMED') {
          localStorage.removeItem('lastBookingId');
          localStorage.removeItem('lastCreditId');
          localStorage.removeItem('lastPaymentUrl');
          router.push('/minha-conta?confirmed=true');
        } else if (data.status === 'CANCELLED' || data.status === 'REFUNDED') {
          localStorage.removeItem('lastBookingId');
          localStorage.removeItem('lastCreditId');
          localStorage.removeItem('lastPaymentUrl');
          router.push(`/booking/failure?${entityType}=${entityId}`);
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

  function handleOpenPayment() {
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
      setPaymentOpened(true);
    }
  }

  // UI de timeout - usuário esperou demais
  if (timedOut) {
    return (
      <>
        <Head>
          <title>Verificação de Pagamento | Espaço Arthemi</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Verificação demorou mais que o esperado
            </h1>
            <p className="text-gray-600 mb-6">
              O pagamento pode já ter sido processado. Acesse sua conta para verificar o status da reserva e seus créditos.
            </p>

            <div className="space-y-3">
              <Link
                href="/minha-conta"
                className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Acessar minha conta
              </Link>
              <button
                onClick={() => setTimedOut(false)}
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Continuar aguardando
              </button>
            </div>

            <div className="mt-6 text-sm text-gray-500">
              <p>
                Problemas?{' '}
                <a href="https://wa.me/5531984916090" className="text-primary hover:underline">
                  Fale conosco no WhatsApp
                </a>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Pagamento Pendente | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
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

          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {paymentOpened ? 'Aguardando Pagamento' : 'Realizar Pagamento'}
          </h1>
          <p className="text-gray-600 mb-8">
            {paymentOpened 
              ? 'Estamos verificando seu pagamento. Isso pode levar alguns minutos.'
              : 'Clique no botão abaixo para abrir a página de pagamento PIX.'}
          </p>

          {paymentUrl && !paymentOpened && (
            <button
              onClick={handleOpenPayment}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-semibold text-lg transition-colors mb-6 flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Ir para Pagamento PIX
            </button>
          )}

          {paymentOpened && (
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
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
            <h3 className="font-semibold text-blue-800 mb-2">
              💡 Instruções do PIX
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Clique em &quot;Ir para Pagamento PIX&quot;</li>
              <li>• Escaneie o QR Code ou copie o código</li>
              <li>• Pague no app do seu banco</li>
              <li>• Volte aqui e aguarde a confirmação</li>
            </ul>
          </div>

          {entityId && (
            <div className="bg-gray-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-gray-500 mb-1">
                {entityType === 'credit' ? 'Código da Compra' : 'Código da Reserva'}
              </p>
              <p className="font-mono text-lg text-gray-800">
                {entityId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {paymentOpened && (
              <button
                onClick={handleCheckStatus}
                disabled={checking}
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                {checking ? 'Verificando...' : 'Verificar Status Agora'}
              </button>
            )}
            {paymentUrl && paymentOpened && (
              <button
                onClick={handleOpenPayment}
                className="block w-full border border-green-500 text-green-600 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Abrir Pagamento Novamente
              </button>
            )}
            <Link
              href="/"
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Voltar ao Início
            </Link>
          </div>

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
