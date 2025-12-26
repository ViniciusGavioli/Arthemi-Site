// ===========================================================
// Schemas de Validação com Zod
// ===========================================================

import { z } from 'zod';

// ===========================================================
// Validador de CPF (Algoritmo Oficial)
// ===========================================================

/**
 * CPFs inválidos conhecidos (sequências repetidas)
 * Estes são matematicamente válidos mas não existem na Receita Federal
 */
const INVALID_CPFS = [
  '00000000000',
  '11111111111',
  '22222222222',
  '33333333333',
  '44444444444',
  '55555555555',
  '66666666666',
  '77777777777',
  '88888888888',
  '99999999999',
];

/**
 * Calcula um dígito verificador do CPF
 * @param digits - Array de dígitos (9 para primeiro verificador, 10 para segundo)
 * @param weights - Pesos para multiplicação (10→2 para primeiro, 11→2 para segundo)
 * @returns Dígito verificador calculado
 */
function calculateVerifierDigit(digits: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida um CPF brasileiro usando o algoritmo oficial
 * 
 * Regras implementadas:
 * 1. Remove caracteres não numéricos
 * 2. Verifica se tem exatamente 11 dígitos
 * 3. Bloqueia CPFs com todos os dígitos iguais (00000000000, etc.)
 * 4. Calcula e valida o primeiro dígito verificador (posição 10)
 * 5. Calcula e valida o segundo dígito verificador (posição 11)
 * 
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF é válido, false caso contrário
 */
export function validateCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');

  // Deve ter exatamente 11 dígitos
  if (cleanCPF.length !== 11) {
    return false;
  }

  // Bloqueia CPFs inválidos conhecidos (sequências repetidas)
  if (INVALID_CPFS.includes(cleanCPF)) {
    return false;
  }

  // Converte para array de números
  const digits = cleanCPF.split('').map(Number);

  // Calcula primeiro dígito verificador
  // Usa os 9 primeiros dígitos com pesos 10, 9, 8, 7, 6, 5, 4, 3, 2
  const firstWeights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstVerifier = calculateVerifierDigit(digits.slice(0, 9), firstWeights);

  // Valida primeiro dígito verificador
  if (firstVerifier !== digits[9]) {
    return false;
  }

  // Calcula segundo dígito verificador
  // Usa os 10 primeiros dígitos com pesos 11, 10, 9, 8, 7, 6, 5, 4, 3, 2
  const secondWeights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondVerifier = calculateVerifierDigit(digits.slice(0, 10), secondWeights);

  // Valida segundo dígito verificador
  if (secondVerifier !== digits[10]) {
    return false;
  }

  return true;
}

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

// ---- Mock Payment ----

export const mockPaymentSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
});

export type MockPaymentInput = z.infer<typeof mockPaymentSchema>;
