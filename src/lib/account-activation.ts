// ===========================================================
// lib/account-activation.ts - Disparo de Email de Ativação
// ===========================================================
// Usado por: /api/bookings, /api/credits/purchase (checkout anônimo)
// Best-effort: falha NÃO quebra checkout

import prisma from '@/lib/prisma';
import { generateActivationToken, buildActivationUrl } from '@/lib/email-activation';
import { sendAccountActivationEmail } from '@/lib/mailer';

// ============================================================
// DISPARO DE ATIVAÇÃO (best-effort)
// ============================================================

interface TriggerActivationParams {
  userId: string;
  userEmail: string;
  userName: string;
}

interface TriggerActivationResult {
  sent: boolean;
  error?: string;
}

/**
 * Envia email de ativação para usuário não verificado
 * 
 * Condições:
 * - user.emailVerifiedAt == null
 * - email não é temporário (@temp.arthemi)
 * 
 * Best-effort: erros são logados mas não propagados
 */
export async function triggerAccountActivation(
  params: TriggerActivationParams
): Promise<TriggerActivationResult> {
  const { userId, userEmail, userName } = params;
  
  try {
    // 1. Verificar se email é real (não temp)
    if (!userEmail || userEmail.includes('@temp.arthemi')) {
      console.log(`⏭️ [ACTIVATION] Email temporário, skip: ${userEmail}`);
      return { sent: false, error: 'Email temporário' };
    }
    
    // 2. Verificar se usuário já está verificado
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    
    if (user?.emailVerifiedAt) {
      console.log(`⏭️ [ACTIVATION] Usuário já verificado: ${userId}`);
      return { sent: false, error: 'Já verificado' };
    }
    
    // 3. Verificar se já existe token ativo recente (evita spam)
    const recentToken = await prisma.emailActivationToken.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
        // Token criado há menos de 5 minutos
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    
    if (recentToken) {
      console.log(`⏭️ [ACTIVATION] Token recente já existe para: ${userId}`);
      return { sent: false, error: 'Token recente existe' };
    }
    
    // 4. Invalidar tokens antigos (opcional - mantém histórico)
    await prisma.emailActivationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Marca como usado para invalidar
      },
    });
    
    // 5. Gerar novo token
    const { rawToken, tokenHash, expiresAt } = generateActivationToken();
    
    // 6. Salvar token no banco
    await prisma.emailActivationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
    
    // 7. Montar URL e enviar email
    const activationUrl = buildActivationUrl(rawToken);
    
    const emailResult = await sendAccountActivationEmail(
      userEmail,
      userName,
      activationUrl
    );
    
    if (!emailResult.success) {
      console.error(`❌ [ACTIVATION] Falha ao enviar email: ${emailResult.error}`);
      return { sent: false, error: emailResult.error };
    }
    
    console.log(`✅ [ACTIVATION] Email de ativação enviado para: ${userEmail}`);
    return { sent: true };
    
  } catch (error) {
    // Best-effort: log e continua
    console.error('❌ [ACTIVATION] Erro ao processar ativação:', error);
    return { 
      sent: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
