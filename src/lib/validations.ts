// ===========================================================
// Schemas de Validação com Zod
// ===========================================================

import { z } from 'zod';

// ---- Booking ----

export const createBookingSchema = z.object({
  roomId: z.string().min(1, 'Sala é obrigatória'),
  startTime: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endTime: z.string().datetime({ message: 'Data/hora de término inválida' }),
  userEmail: z.string().email('Email inválido'),
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return end > start;
}, {
  message: 'Horário de término deve ser após o início',
  path: ['endTime'],
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ---- User ----

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ---- Webhook MercadoPago ----

export const mercadopagoWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

export type MercadopagoWebhookInput = z.infer<typeof mercadopagoWebhookSchema>;

// ---- Mock Payment ----

export const mockPaymentSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
});

export type MockPaymentInput = z.infer<typeof mockPaymentSchema>;
