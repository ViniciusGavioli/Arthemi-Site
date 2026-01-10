// ===========================================================
// API: POST /api/me/bookings/[id]/cancel - DESABILITADO
// ===========================================================
// P0-3: Cancelamento pelo usuário foi DESABILITADO.
// Usuários devem solicitar cancelamento via WhatsApp.
// Apenas ADMINs podem cancelar reservas.

import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // P0-3: Cancelamento pelo usuário DESABILITADO
  // Retornar 403 Forbidden para qualquer método
  return res.status(403).json({ 
    ok: false, 
    error: 'Cancelamento não disponível. Para cancelar sua reserva, entre em contato pelo WhatsApp: (31) 98491-6090',
  });
}
