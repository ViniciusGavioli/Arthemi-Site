// ===========================================================
// API: GET /api/user/booking-window - Janela de reserva do usuário
// ===========================================================

import type { NextApiRequest, NextApiResponse } from 'next';
import { getMaxBookingDate } from '@/lib/business-rules';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiResponse {
  success: boolean;
  maxDate?: string | null; // ISO string ou null se sem limitação
  maxDateFormatted?: string | null; // dd/MM/yyyy
  hasLimit: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      hasLimit: false,
      error: `Método ${req.method} não permitido`,
    });
  }

  try {
    // Buscar userId da sessão (simplificado - assumindo query param por ora)
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({
        success: false,
        hasLimit: false,
        error: 'Usuário não autenticado',
      });
    }

    // Busca data máxima permitida
    const maxDate = await getMaxBookingDate(userId);

    return res.status(200).json({
      success: true,
      maxDate: maxDate ? maxDate.toISOString() : null,
      maxDateFormatted: maxDate ? format(maxDate, 'dd/MM/yyyy', { locale: ptBR }) : null,
      hasLimit: maxDate !== null,
    });
  } catch (error) {
    console.error('Erro ao buscar janela de reserva:', error);
    return res.status(500).json({
      success: false,
      hasLimit: false,
      error: 'Erro interno ao buscar janela de reserva',
    });
  }
}
