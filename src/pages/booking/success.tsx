import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { generateBookingWhatsAppLink, generateSupportWhatsAppLink } from '@/lib/whatsapp';
import { analytics } from '@/lib/analytics';

interface BookingDetails {
  id: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  userName?: string;
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
            const bookingDetails = {
              id: data.id,
              roomName: data.room?.name || 'Consultório',
              date: new Date(data.startTime).toLocaleDateString('pt-BR'),
              startTime: new Date(data.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              endTime: new Date(data.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              total: data.amountPaid || 0,
              userName: data.user?.name || 'Cliente',
            };
            setDetails(bookingDetails);
            
            // Rastrear conversão
            analytics.bookingCompleted(bookingDetails.roomName, bookingDetails.total);
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
                  <span className="text-gray-500">Consultório</span>
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

          {/* Botão WhatsApp - Confirmação Automática */}
          {details && (
            <div className="mb-6">
              <a
                href={generateBookingWhatsAppLink({
                  bookingId: details.id,
                  userName: details.userName || 'Cliente',
                  roomName: details.roomName,
                  date: details.date,
                  startTime: details.startTime,
                  endTime: details.endTime,
                  amountPaid: Math.round(details.total * 100),
                }).fullLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Confirmar via WhatsApp
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Envie uma mensagem automática para confirmar sua presença
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="space-y-3">
            <Link
              href="/lp-whatsapp.html"
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
              Dúvidas? Entre em contato pelo{' '}
              <a 
                href={booking ? generateSupportWhatsAppLink(String(booking)) : 'https://wa.me/5531999999999'} 
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline font-medium"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
