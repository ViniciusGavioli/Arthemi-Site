// ===========================================================
// Componente: EmailVerificationBanner
// ===========================================================
// Banner fixo que aparece quando o email não está verificado
// Mostra botões para reenviar verificação ou confirmar verificação

import { useState } from 'react';
import { AlertTriangle, Mail, RefreshCw } from 'lucide-react';

interface EmailVerificationBannerProps {
  userEmail: string;
  onVerificationConfirmed?: () => void;
}

export function EmailVerificationBanner({ 
  userEmail, 
  onVerificationConfirmed 
}: EmailVerificationBannerProps) {
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleResendEmail() {
    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      const res = await fetch('/api/auth/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (res.ok) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        const data = await res.json();
        setResendError(data.error || 'Erro ao reenviar e-mail');
      }
    } catch {
      setResendError('Erro ao reenviar e-mail. Tente novamente.');
    } finally {
      setResending(false);
    }
  }

  async function handleCheckVerification() {
    setChecking(true);
    
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.authenticated && data.user?.emailVerified) {
        // Email foi verificado! Notifica o parent
        if (onVerificationConfirmed) {
          onVerificationConfirmed();
        }
        // Força reload para atualizar toda a UI
        window.location.reload();
      } else {
        // Ainda não verificado
        setResendError('E-mail ainda não verificado. Verifique sua caixa de entrada.');
        setTimeout(() => setResendError(''), 5000);
      }
    } catch {
      setResendError('Erro ao verificar status. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">Verificação de e-mail pendente</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Para agendar, você precisa confirmar seu e-mail. Compras de créditos ficam disponíveis, 
                mas o agendamento só libera após a verificação.
              </p>
              
              {resendSuccess && (
                <p className="text-sm text-green-700 mt-2 font-medium">
                  ✓ E-mail de verificação enviado para {userEmail}
                </p>
              )}
              
              {resendError && (
                <p className="text-sm text-red-700 mt-2">
                  {resendError}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Reenviar e-mail
                </>
              )}
            </button>
            
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Já verifiquei
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
