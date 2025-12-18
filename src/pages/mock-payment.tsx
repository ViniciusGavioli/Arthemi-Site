import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/**
 * Página de Mock Payment para testes locais
 * Simula o checkout do Asaas (PIX)
 */
export default function MockPaymentPage() {
  const router = useRouter();
  const { bookingId, paymentId, amount, pref, booking } = router.query;
  
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'credit' | 'debit'>('pix');

  // bookingId pode vir de diferentes params dependendo da origem
  const resolvedBookingId = bookingId || booking;
  const displayAmount = amount ? Number(amount) : 0;

  async function handlePayment(status: 'approved' | 'rejected' | 'pending') {
    setProcessing(true);
    
    try {
      // Simula processamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Chama endpoint de mock para atualizar status
      const response = await fetch('/api/mock-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: resolvedBookingId,
          paymentId,
          status,
          method: selectedMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao processar pagamento');
      }

      // Redireciona baseado no status
      const redirectPath = status === 'approved' 
        ? `/booking/success?booking=${resolvedBookingId}`
        : status === 'rejected'
          ? `/booking/failure?booking=${resolvedBookingId}`
          : `/booking/pending?booking=${resolvedBookingId}`;

      router.push(redirectPath);
    } catch (error) {
      console.error('Mock payment error:', error);
      alert('Erro ao processar pagamento mock');
      setProcessing(false);
    }
  }

  return (
    <>
      <Head>
        <title>Pagamento (Mock) | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gray-100 py-12">
        <div className="max-w-md mx-auto">
          {/* Banner de Mock */}
          <div className="bg-yellow-400 text-yellow-900 text-center py-2 px-4 rounded-t-lg font-semibold">
            🎭 MODO DE TESTE - Pagamento Simulado
          </div>

          <div className="bg-white shadow-lg rounded-b-lg overflow-hidden">
            {/* Header */}
            <div className="bg-[#00b1ea] text-white p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  💳
                </div>
                <div>
                  <h1 className="text-xl font-bold">Checkout</h1>
                  <p className="text-sm opacity-90">Espaço Arthemi</p>
                </div>
              </div>
            </div>

            {/* Valor */}
            <div className="p-6 border-b">
              <p className="text-gray-500 text-sm">Valor total</p>
              <p className="text-3xl font-bold text-gray-800">
                R$ {displayAmount.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Reserva #{String(resolvedBookingId).slice(0, 8)}...
              </p>
            </div>

            {/* Método de Pagamento */}
            <div className="p-6 border-b">
              <p className="font-semibold text-gray-700 mb-3">Forma de pagamento</p>
              <div className="space-y-2">
                {[
                  { id: 'pix', label: 'Pix', icon: '⚡', desc: 'Aprovação instantânea' },
                  { id: 'credit', label: 'Cartão de Crédito', icon: '💳', desc: 'Até 12x' },
                  { id: 'debit', label: 'Cartão de Débito', icon: '🏦', desc: 'Débito à vista' },
                ].map(method => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMethod === method.id 
                        ? 'border-[#00b1ea] bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={method.id}
                      checked={selectedMethod === method.id}
                      onChange={e => setSelectedMethod(e.target.value as typeof selectedMethod)}
                      className="text-[#00b1ea]"
                    />
                    <span className="text-xl">{method.icon}</span>
                    <div>
                      <p className="font-medium text-gray-800">{method.label}</p>
                      <p className="text-xs text-gray-500">{method.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="p-6 space-y-3">
              <button
                onClick={() => handlePayment('approved')}
                disabled={processing}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Processando...
                  </>
                ) : (
                  <>
                    ✓ Simular Aprovação
                  </>
                )}
              </button>

              <button
                onClick={() => handlePayment('pending')}
                disabled={processing}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⏱ Simular Pendente
              </button>

              <button
                onClick={() => handlePayment('rejected')}
                disabled={processing}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✗ Simular Rejeição
              </button>

              <button
                onClick={() => router.back()}
                disabled={processing}
                className="w-full border border-gray-300 text-gray-600 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ← Voltar
              </button>
            </div>

            {/* Info */}
            <div className="bg-gray-50 p-4 text-xs text-gray-500 text-center">
              <p>
                Este é um ambiente de teste. Nenhuma cobrança real será feita.
              </p>
              <p className="mt-1">
                Em produção, você verá o QR Code PIX do Asaas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
