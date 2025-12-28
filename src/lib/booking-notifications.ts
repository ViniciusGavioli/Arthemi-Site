import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { createMagicLink } from '@/lib/magic-link';
import { getUserCreditsSummary } from '@/lib/business-rules';
import { prisma } from '@/lib/prisma';

export async function sendBookingConfirmationNotification(bookingId: string) {
  try {
    // Buscar booking com todas as relações necessárias
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

    // Formatar dados para o email
    const hours = Math.ceil(
      (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60)
    );
    
    const dateFormatted = format(booking.startTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const startFormatted = format(booking.startTime, 'HH:mm');
    const endFormatted = format(booking.endTime, 'HH:mm');
    
    // Gerar magic link
    let magicLinkToken: string | undefined;
    try {
      const magicLinkResult = await createMagicLink(booking.user.email);
      if (magicLinkResult.success && magicLinkResult.token) {
        magicLinkToken = magicLinkResult.token;
      }
    } catch (mlError) {
      console.warn('⚠️ [Booking Notification] Erro ao gerar magic link:', mlError);
    }

    // Calcular saldo de créditos
    let creditBalance = 0;
    try {
      const creditsSummary = await getUserCreditsSummary(booking.userId);
      creditBalance = creditsSummary.total;
    } catch (credError) {
      console.warn('⚠️ [Booking Notification] Erro ao calcular saldo:', credError);
    }
    
    // Enviar email
    await sendBookingConfirmationEmail({
      userName: booking.user.name,
      userEmail: booking.user.email,
      bookingId: booking.id,
      roomName: booking.room.name,
      date: dateFormatted,
      startTime: startFormatted,
      endTime: endFormatted,
      duration: `${hours}h`,
      amountPaid: booking.amountPaid || 0,
      paymentMethod: 'PIX',
      magicLinkToken,
      creditBalance,
    });
    
    console.log(`📧 [Booking Notification] Email enviado: ${booking.user.email}`);
    return true;
    
  } catch (error) {
    console.error('❌ [Booking Notification] Erro ao enviar confirmação:', error);
    return false;
  }
}