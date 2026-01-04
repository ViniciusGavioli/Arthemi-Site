import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';

// ============================================================
// CONFIGURAÇÃO DE TIMEOUTS
// ============================================================
const POLLING_INTERVAL_MS = 5000; // 5 segundos entre polls
const SOFT_TIMEOUT_MS = 90 * 1000; // 90s: mostrar alternativa
const HARD_TIMEOUT_MS = 5 * 60 * 1000; // 5min: parar polling

type EntityType = 'booking' | 'credit';

interface PollResult {
  status: string;
  updatedAt?: string;
  requestId?: string;
}

// ============================================================
// HELPER: Parsear query params (suporta legado e novo formato)
// ============================================================
function parseQueryParams(query: Record<string, string | string[] | undefined>): {
  entityId: string | null;
  entityType: EntityType;
} {
  // Novo formato: ?type=credit&id=xxx ou ?type=booking&id=xxx
  const typeParam = query.type as string | undefined;
  const idParam = query.id as string | undefined;
  
  if (idParam && typeof idParam === 'string') {
    const type: EntityType = typeParam === 'credit' ? 'credit' : 'booking';
    return { entityId: idParam, entityType: type };
  }
  
  // Formato legado: ?credit=xxx ou ?booking=xxx
  const creditFromQuery = query.credit as string | undefined;
  const bookingFromQuery = query.booking as string | undefined;
  
  if (creditFromQuery && typeof creditFromQuery === 'string') {
    return { entityId: creditFromQuery, entityType: 'credit' };
  }
  
  if (bookingFromQuery && typeof bookingFromQuery === 'string') {
    return { entityId: bookingFromQuery, entityType: 'booking' };
  }
  
  return { entityId: null, entityType: 'booking' };
}

// ============================================================
// HELPER: Fallback para localStorage
// ============================================================
function getFromLocalStorage(type: EntityType | null): {
  entityId: string | null;
  entityType: EntityType;
} {
  if (typeof window === 'undefined') {
    return { entityId: null, entityType: 'booking' };
  }
  
  // Se tipo foi especificado, buscar só esse
  if (type === 'credit') {
    const id = localStorage.getItem('lastCreditId');
    return { entityId: id, entityType: 'credit' };
  }
  
  if (type === 'booking') {
    const id = localStorage.getItem('lastBookingId');
    return { entityId: id, entityType: 'booking' };
  }
  
  // Sem tipo especificado: tentar ambos (prioridade para credit mais recente)
  const creditId = localStorage.getItem('lastCreditId');
  const bookingId = localStorage.getItem('lastBookingId');
  
  if (creditId) {
    return { entityId: creditId, entityType: 'credit' };
  }
  
  if (bookingId) {
    return { entityId: bookingId, entityType: 'booking' };
  }
  
  return { entityId: null, entityType: 'booking' };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function BookingPendingPage() {
  const router = useRouter();
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('booking');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  
  // Estados de timeout
  const [softTimeout, setSoftTimeout] = useState(false); // 90s: mostrar alternativa
  const [hardTimeout, setHardTimeout] = useState(false); // 5min: parar polling
  const [pollCount, setPollCount] = useState(0);
  const [lastPollResult, setLastPollResult] = useState<PollResult | null>(null);
  const [noEntityFound, setNoEntityFound] = useState(false);
  
  // Refs para timers
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const softTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // ============================================================
  // EFEITO: Determinar entidade a partir de query/localStorage
  // ============================================================
  useEffect(() => {
    if (!router.isReady) return;
    
    // 1. Tentar extrair da query
    const fromQuery = parseQueryParams(router.query);
    
    if (fromQuery.entityId) {
      console.log(`📍 [PENDING] Entidade da query: ${fromQuery.entityType}/${fromQuery.entityId}`);
      setEntityId(fromQuery.entityId);
      setEntityType(fromQuery.entityType);
      return;
    }
    
    // 2. Fallback para localStorage
    const typeHint = router.query.type as EntityType | undefined;
    const fromStorage = getFromLocalStorage(typeHint || null);
    
    if (fromStorage.entityId) {
      console.log(`📍 [PENDING] Entidade do localStorage: ${fromStorage.entityType}/${fromStorage.entityId}`);
      setEntityId(fromStorage.entityId);
      setEntityType(fromStorage.entityType);
      return;
    }
    
    // 3. Nenhuma entidade encontrada
    console.warn('⚠️ [PENDING] Nenhuma entidade encontrada na query ou localStorage');
    setNoEntityFound(true);
  }, [router.isReady, router.query]);

  // Carregar paymentUrl do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUrl = localStorage.getItem('lastPaymentUrl');
      if (storedUrl) {
        setPaymentUrl(storedUrl);
      }
    }
  }, []);

  // ============================================================
  // FUNÇÃO: Fazer polling de status
  // ============================================================
  const checkStatus = useCallback(async (): Promise<PollResult | null> => {
    if (!entityId) return null;
    
    const endpoint = `/api/pending/status?type=${entityType}&id=${entityId}`;
    const pollStart = Date.now();
    
    try {
      const res = await fetch(endpoint, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      const requestId = res.headers.get('x-request-id') || 'unknown';
      
      if (!res.ok) {
        console.error(`❌ [PENDING] Poll failed: ${res.status}`, { requestId, entityType, entityId });
        return null;
      }
      
      const data = await res.json();
      const durationMs = Date.now() - pollStart;
      
      console.log(`🔄 [PENDING] Poll #${pollCount + 1}`, {
        requestId,
        entityType,
        entityId: entityId.slice(0, 8),
        status: data.status,
        durationMs,
      });
      
      return {
        status: data.status,
        updatedAt: data.updatedAt,
        requestId,
      };
    } catch (error) {
      console.error('❌ [PENDING] Poll error:', error);
      return null;
    }
  }, [entityId, entityType, pollCount]);

  // ============================================================
  // FUNÇÃO: Processar resultado do poll
  // ============================================================
  const handlePollResult = useCallback((result: PollResult | null) => {
    if (!result) return;
    
    setLastPollResult(result);
    setPollCount(prev => prev + 1);
    
    if (result.status === 'CONFIRMED') {
      // Sucesso! Limpar e redirecionar
      console.log('✅ [PENDING] Pagamento confirmado!', { requestId: result.requestId });
      
      localStorage.removeItem('lastBookingId');
      localStorage.removeItem('lastCreditId');
      localStorage.removeItem('lastPaymentUrl');
      
      // Limpar timers
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (softTimeoutRef.current) clearTimeout(softTimeoutRef.current);
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
      
      router.push('/minha-conta?confirmed=true');
    } else if (result.status === 'CANCELLED' || result.status === 'REFUNDED') {
      // Falha
      console.log('❌ [PENDING] Pagamento cancelado/estornado', { status: result.status });
      
      localStorage.removeItem('lastBookingId');
      localStorage.removeItem('lastCreditId');
      localStorage.removeItem('lastPaymentUrl');
      
      router.push(`/booking/failure?${entityType}=${entityId}`);
    }
    // Se PENDING, continua polling
  }, [entityId, entityType, router]);

  // ============================================================
  // EFEITO: Iniciar polling e timers
  // ============================================================
  useEffect(() => {
    if (!entityId) return;
    
    startTimeRef.current = Date.now();
    
    // Timer de soft timeout (90s)
    softTimeoutRef.current = setTimeout(() => {
      console.log('⏰ [PENDING] Soft timeout (90s) - mostrando alternativa');
      setSoftTimeout(true);
    }, SOFT_TIMEOUT_MS);
    
    // Timer de hard timeout (5min)
    hardTimeoutRef.current = setTimeout(() => {
      console.log('⏰ [PENDING] Hard timeout (5min) - parando polling');
      setHardTimeout(true);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }, HARD_TIMEOUT_MS);
    
    // Primeiro poll imediato
    checkStatus().then(handlePollResult);
    
    // Polling interval
    pollIntervalRef.current = setInterval(async () => {
      const result = await checkStatus();
      handlePollResult(result);
    }, POLLING_INTERVAL_MS);
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (softTimeoutRef.current) clearTimeout(softTimeoutRef.current);
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
    };
  }, [entityId, checkStatus, handlePollResult]);

  // ============================================================
  // HANDLER: Verificar status manualmente
  // ============================================================
  async function handleCheckStatus() {
    if (!entityId) return;
    setChecking(true);
    
    try {
      const result = await checkStatus();
      handlePollResult(result);
      
      if (result && result.status === 'PENDING') {
        alert('Pagamento ainda pendente. Continue aguardando.');
      }
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

  // ============================================================
  // UI: Nenhuma entidade encontrada
  // ============================================================
  if (noEntityFound) {
    return (
      <>
        <Head>
          <title>Pagamento não encontrado | Espaço Arthemi</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Reserva não encontrada
            </h1>
            <p className="text-gray-600 mb-6">
              Não encontramos uma reserva ou compra pendente. Acesse sua conta para ver suas reservas.
            </p>

            <div className="space-y-3">
              <Link
                href="/minha-conta"
                className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Acessar minha conta
              </Link>
              <Link
                href="/"
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Voltar ao Início
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================
  // UI: Hard timeout (5min) - parar polling definitivo
  // ============================================================
  if (hardTimeout) {
    return (
      <>
        <Head>
          <title>Verificação de Pagamento | Espaço Arthemi</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Verificação demorou mais que o esperado
            </h1>
            <p className="text-gray-600 mb-6">
              O pagamento pode já ter sido processado. Acesse sua conta para verificar o status.
            </p>

            <div className="space-y-3">
              <Link
                href="/minha-conta"
                className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Acessar minha conta
              </Link>
              <button
                onClick={() => {
                  setHardTimeout(false);
                  setSoftTimeout(false);
                  startTimeRef.current = Date.now();
                  // Reiniciar polling
                  checkStatus().then(handlePollResult);
                  pollIntervalRef.current = setInterval(async () => {
                    const result = await checkStatus();
                    handlePollResult(result);
                  }, POLLING_INTERVAL_MS);
                }}
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Continuar aguardando
              </button>
            </div>

            {entityId && (
              <div className="mt-6 bg-gray-100 rounded-lg p-3 text-sm text-gray-500">
                <p>ID: {entityId.slice(0, 8).toUpperCase()}</p>
                <p>Polls realizados: {pollCount}</p>
              </div>
            )}

            <div className="mt-6 text-sm text-gray-500">
              <a href="https://wa.me/5531984916090" className="text-primary hover:underline">
                Fale conosco no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================
  // UI: Aguardando pagamento (com soft timeout hint)
  // ============================================================
  return (
    <>
      <Head>
        <title>Pagamento Pendente | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-yellow-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

          {/* Botão de pagamento */}
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

          {/* Indicador de polling */}
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
              <p className="text-xs text-gray-400 mt-2">
                Verificação #{pollCount} • {lastPollResult?.status || 'aguardando'}
              </p>
            </div>
          )}

          {/* Soft timeout: mostrar alternativa sem parar polling */}
          {softTimeout && paymentOpened && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium mb-2">
                Pagamento em processamento
              </p>
              <p className="text-blue-700 text-sm mb-3">
                O pagamento pode já ter sido confirmado. Você pode verificar sua conta.
              </p>
              <Link
                href="/minha-conta"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Ver minha conta
              </Link>
            </div>
          )}

          {/* Instruções PIX */}
          {!softTimeout && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-blue-800 mb-2">💡 Instruções do PIX</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Clique em &quot;Ir para Pagamento PIX&quot;</li>
                <li>• Escaneie o QR Code ou copie o código</li>
                <li>• Pague no app do seu banco</li>
                <li>• Volte aqui e aguarde a confirmação</li>
              </ul>
            </div>
          )}

          {/* Código da entidade */}
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

          {/* Botões de ação */}
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
            <p>Você receberá um e-mail assim que o pagamento for confirmado.</p>
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
