// ===========================================================
// Página: /pagamento/sucesso - Pagamento Confirmado
// ===========================================================
// Página pós-pagamento para usuários que ainda não ativaram a conta.
// NÃO requer autenticação. Instrui o usuário a verificar o e-mail.

import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle, Mail, ArrowRight, MessageCircle, RefreshCw } from 'lucide-react';

const WHATSAPP_NUMBER = '5531991153634';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Olá! Acabei de fazer um pagamento no site da Arthemi e preciso de ajuda.'
);

export default function PagamentoSucessoPage() {
  return (
    <>
      <Head>
        <title>Pagamento Confirmado | Arthemi Saúde</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-warm-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Card Principal */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header com ícone de sucesso */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-8 text-center">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-white" strokeWidth={2} />
              </div>
              <h1 className="text-2xl font-bold text-white">
                Pagamento Confirmado!
              </h1>
              <p className="text-emerald-100 mt-2">
                Seus créditos já estão disponíveis
              </p>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6">
              {/* Instrução Principal */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">
                      Verifique seu e-mail
                    </h2>
                    <p className="text-gray-600 mt-1">
                      Enviamos um link de ativação para o e-mail cadastrado.
                      Clique no link para ativar sua conta e começar a agendar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dica de Spam */}
              <div className="flex items-start gap-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                <span className="text-lg">💡</span>
                <p>
                  <strong>Não encontrou?</strong> Verifique também a pasta de 
                  <span className="font-medium text-gray-700"> spam </span> 
                  ou <span className="font-medium text-gray-700">lixo eletrônico</span>.
                </p>
              </div>

              {/* Próximos Passos */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Próximos passos
                </h3>
                <ol className="space-y-3">
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    <span className="text-gray-700">Acesse seu e-mail</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <span className="text-gray-700">Clique no link de ativação</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <span className="text-gray-700">Crie sua senha e acesse o sistema</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
                      ✓
                    </span>
                    <span className="text-gray-700">Agende seus horários!</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer com Ações */}
            <div className="px-6 pb-6 space-y-3">
              {/* Botão Principal - Abrir Email */}
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
              >
                <Mail className="w-5 h-5" />
                Abrir meu e-mail
                <ArrowRight className="w-5 h-5 ml-1" />
              </a>

              {/* Link Secundário - Reenviar */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  Não recebeu o e-mail?
                </p>
                <Link
                  href="/confirme-seu-email"
                  className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium text-sm hover:underline"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reenviar e-mail de ativação
                </Link>
              </div>

              {/* Divisor */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400">ou</span>
                </div>
              </div>

              {/* WhatsApp Suporte */}
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-green-600" />
                Falar com o suporte via WhatsApp
              </a>
            </div>
          </div>

          {/* Link para Home */}
          <div className="text-center mt-6">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              ← Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
