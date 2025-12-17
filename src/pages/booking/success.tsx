import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface BookingDetails {
  id: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
}

export default function BookingSuccessPage() {
  const router = useRouter();
  const { booking } = router.query;
  const [details, setDetails] = useState<BookingDetails | null>(null);

  useEffect(() => {
    if (booking) {
      // Buscar detalhes da reserva
      fetch(`/api/bookings/${booking}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setDetails({
              id: data.id,
              roomName: data.room?.name || 'Sala',
              date: new Date(data.startTime).toLocaleDateString('pt-BR'),
              startTime: new Date(data.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              endTime: new Date(data.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              total: data.payment?.amount || 0,
            });
          }
        })
        .catch(console.error);
    }
  }, [booking]);

  return (
    <>
      <Head>
        <title>Reserva Confirmada | Espaço Arthemi</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Ícone de Sucesso */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Mensagem */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Reserva Confirmada! 🎉
          </h1>
          <p className="text-gray-600 mb-8">
            Sua reserva foi processada com sucesso. Enviamos os detalhes para seu e-mail.
          </p>

          {/* Detalhes da Reserva */}
          {details ? (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8 text-left">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  📋
                </span>
                Detalhes da Reserva
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sala</span>
                  <span className="font-medium text-gray-800">{details.roomName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data</span>
                  <span className="font-medium text-gray-800">{details.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Horário</span>
                  <span className="font-medium text-gray-800">
                    {details.startTime} - {details.endTime}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-700 font-semibold">Total Pago</span>
                  <span className="font-bold text-green-600">
                    R$ {details.total.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          )}

          {/* Código da Reserva */}
          {booking && (
            <div className="bg-gray-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-gray-500 mb-1">Código da Reserva</p>
              <p className="font-mono text-lg text-gray-800">
                {String(booking).slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="space-y-3">
            <Link
              href="/salas"
              className="block w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Fazer Nova Reserva
            </Link>
            <Link
              href="/"
              className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Voltar ao Início
            </Link>
          </div>

          {/* Informações adicionais */}
          <div className="mt-8 text-sm text-gray-500">
            <p>
              Dúvidas? Entre em contato pelo WhatsApp{' '}
              <a href="https://wa.me/5511999999999" className="text-primary hover:underline">
                (11) 99999-9999
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
