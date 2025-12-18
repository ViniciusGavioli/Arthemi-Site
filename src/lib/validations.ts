// ===========================================================
// Schemas de Validação com Zod
// ===========================================================

import { z } from 'zod';

// ---- Validador de Telefone Brasileiro ----

const phoneRegex = /^\(?[1-9]{2}\)?\s?9?[0-9]{4}-?[0-9]{4}$/;

/**
 * Validador customizado para telefone brasileiro
 * Aceita com ou sem máscara
 */
export const brazilianPhone = z.string()
  .min(10, 'Telefone deve ter pelo menos 10 dígitos')
  .max(16, 'Telefone muito longo')
  .refine((val) => {
    // Remove máscara para validar
    const digits = val.replace(/\D/g, '');
    
    // Deve ter 10 (fixo) ou 11 (celular) dígitos
    if (digits.length < 10 || digits.length > 11) return false;
    
    // DDD válido (11-99)
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    
    // Se tem 11 dígitos, o terceiro deve ser 9 (celular)
    if (digits.length === 11 && digits[2] !== '9') return false;
    
    return true;
  }, {
    message: 'Telefone inválido. Use o formato (XX) 9XXXX-XXXX',
  });

// ---- Booking ----

export const createBookingSchema = z.object({
  roomId: z.string().min(1, 'Sala é obrigatória'),
  startTime: z.string().datetime({ message: 'Data/hora de início inválida' }),
  endTime: z.string().datetime({ message: 'Data/hora de término inválida' }),
  userEmail: z.string().email('Email inválido'),
  userName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  userPhone: brazilianPhone,
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
  phone: brazilianPhone.optional(),
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
