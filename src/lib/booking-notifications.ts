import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { createMagicLink } from '@/lib/magic-link';
import { getUserCreditsSummary } from '@/lib/business-rules';
import { prisma } from '@/lib/prisma';
import { isContingencyActive } from '@/lib/contingency';

/**
 * Envia notificação de confirmação de booking
 * 
 * CONTROLES IMPLEMENTADOS:
 * - Verifica emailSentAt para evitar duplicidade
 * - Verifica flag DISABLE_EMAILS de contingência
 * - Atualiza emailSentAt após envio bem-sucedido
 * - Falha explícita em produção sem RESEND_API_KEY
 * 
 * @param bookingId - ID do booking
 * @param skipEmailSentAtCheck - Se true, ignora verificação de emailSentAt (usar apenas em casos específicos)
 * @returns true se email enviado com sucesso, false caso contrário
 */
export async function sendBookingConfirmationNotification(
  bookingId: string,
  skipEmailSentAtCheck: boolean = false
): Promise<boolean> {
  try {
    // 1. Verificar flag de contingência DISABLE_EMAILS
    const emailsDisabled = await isContingencyActive('DISABLE_EMAILS');
    if (emailsDisabled) {
      console.log(`📧 [Booking Notification] Email desativado por contingência - booking ${bookingId}`);
      return false;
    }

    // 2. Buscar booking com todas as relações necessárias
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        user: true,
        room: true,
        product: true,
      },
    });

    if (!booking) {
      console.error(`❌ [Booking Notification] Booking não encontrado: ${bookingId}`);
      return false;
    }

    // 3. Verificar emailSentAt para evitar duplicidade
    if (!skipEmailSentAtCheck && booking.emailSentAt) {
      console.log(`⏭️ [Booking Notification] Email já enviado em ${booking.emailSentAt.toISOString()} - booking ${bookingId}`);
      return true; // Retorna true pois email já foi enviado
    }

    // 4. Formatar dados para o email
    const hours = Math.ceil(
      (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
    );
    
    const dateFormatted = format(booking.startTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const startFormatted = format(booking.startTime, 'HH:mm');
    const endFormatted = format(booking.endTime, 'HH:mm');
    
    // 5. Gerar magic link
    let magicLinkToken: string | undefined;
    try {
      const magicLinkResult = await createMagicLink(booking.user.email);
      if (magicLinkResult.success && magicLinkResult.token) {
        magicLinkToken = magicLinkResult.token;
      }
    } catch (mlError) {
      console.warn('⚠️ [Booking Notification] Erro ao gerar magic link:', mlError);
    }

    // 6. Calcular saldo de créditos
    let creditBalance = 0;
    try {
      const creditsSummary = await getUserCreditsSummary(booking.userId);
      creditBalance = creditsSummary.total;
    } catch (credError) {
      console.warn('⚠️ [Booking Notification] Erro ao calcular saldo:', credError);
    }
    
    // 7. Enviar email
    const emailResult = await sendBookingConfirmationEmail({
      userName: booking.user.name,
      userEmail: booking.user.email,
      bookingId: booking.id,
      roomName: booking.room.name,
      date: dateFormatted,
      startTime: startFormatted,
      endTime: endFormatted,
      duration: `${hours}h`,
      amountPaid: booking.amountPaid || booking.creditsUsed || 0,
      paymentMethod: booking.creditsUsed > 0 ? 'Créditos' : 'PIX',
      magicLinkToken,
      creditBalance,
    });
    
    // 8. Verificar resultado e atualizar emailSentAt
    if (emailResult.success) {
      // Atualizar emailSentAt para evitar duplicidade
      await prisma.booking.update({
        where: { id: bookingId },
        data: { emailSentAt: new Date() },
      });
      console.log(`📧 [Booking Notification] Email enviado com sucesso: ${booking.user.email} - booking ${bookingId}`);
      return true;
    } else {
      console.error(`❌ [Booking Notification] Falha ao enviar email para ${booking.user.email}: ${emailResult.error}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ [Booking Notification] Erro ao processar notificação para booking ${bookingId}:`, error);
    return false;
  }
}