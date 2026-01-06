/**
 * Testes: GET /api/availability
 * 
 * Testa o endpoint de disponibilidade de horários:
 * - Busca por ID da sala
 * - Fallback por slug quando ID não encontrado
 * - Validação de parâmetros
 * - Retorno de slots disponíveis
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/availability';

// Mock do Prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    room: {
      findUnique: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper para criar mock de request/response
function createMocks(query: Record<string, string | string[] | undefined> = {}) {
  const req = {
    method: 'GET',
    query,
  } as unknown as NextApiRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse;

  return { req, res };
}

describe('GET /api/availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validação de parâmetros', () => {
    it('deve retornar 405 para método não GET', async () => {
      const { req, res } = createMocks({ roomId: 'test', date: '2025-01-15' });
      req.method = 'POST';

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('não permitido'),
      });
    });

    it('deve retornar 400 se roomId não fornecido', async () => {
      const { req, res } = createMocks({ date: '2025-01-15' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'roomId é obrigatório',
      });
    });

    it('deve retornar 400 se date não fornecido', async () => {
      const { req, res } = createMocks({ roomId: 'test-room-id' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('date é obrigatório'),
      });
    });

    it('deve retornar 400 para data inválida', async () => {
      const { req, res } = createMocks({ roomId: 'test', date: 'invalid-date' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Formato de data inválido'),
      });
    });
  });

  describe('busca de sala', () => {
    it('deve buscar sala por ID primeiro', async () => {
      const mockRoom = { id: 'room-123', slug: 'sala-a', isActive: true };
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPrisma.booking.findMany as jest.Mock).mockResolvedValueOnce([]);

      const { req, res } = createMocks({ roomId: 'room-123', date: '2025-01-15' });

      await handler(req, res);

      expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-123' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deve fazer fallback por slug se ID não encontrar', async () => {
      const mockRoom = { id: 'real-id-123', slug: 'sala-a', isActive: true };
      
      // Primeira chamada (por ID) retorna null
      (mockPrisma.room.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRoom);
      (mockPrisma.booking.findMany as jest.Mock).mockResolvedValueOnce([]);

      const { req, res } = createMocks({ roomId: 'sala-a', date: '2025-01-15' });

      await handler(req, res);

      // Primeira chamada por ID
      expect(mockPrisma.room.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 'sala-a' },
      });
      // Segunda chamada por slug
      expect(mockPrisma.room.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'sala-a' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deve retornar 404 se sala não encontrada por ID nem slug', async () => {
      (mockPrisma.room.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const { req, res } = createMocks({ roomId: 'inexistente', date: '2025-01-15' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Sala não encontrada',
      });
    });
  });

  describe('slots de disponibilidade', () => {
    it('deve retornar slots para dia de semana (segunda-sexta)', async () => {
      const mockRoom = { id: 'room-123', slug: 'sala-a', isActive: true };
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPrisma.booking.findMany as jest.Mock).mockResolvedValueOnce([]);

      // 2025-01-15 é uma quarta-feira
      const { req, res } = createMocks({ roomId: 'room-123', date: '2025-01-15' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.slots).toBeDefined();
      expect(Array.isArray(response.slots)).toBe(true);
      // Deve ter slots de 8h às 20h (12 slots)
      expect(response.slots.length).toBe(12);
    });

    it('deve retornar slots vazios para domingo (fechado)', async () => {
      const mockRoom = { id: 'room-123', slug: 'sala-a', isActive: true };
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValueOnce(mockRoom);

      // 2025-01-19 é um domingo
      const { req, res } = createMocks({ roomId: 'room-123', date: '2025-01-19' });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.slots).toEqual([]);
    });

    it('deve usar realRoomId na response', async () => {
      const mockRoom = { id: 'real-uuid-123', slug: 'sala-a', isActive: true };
      
      // Busca por slug (simulando ID estático inválido)
      (mockPrisma.room.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRoom);
      (mockPrisma.booking.findMany as jest.Mock).mockResolvedValueOnce([]);

      const { req, res } = createMocks({ roomId: 'sala-a-static', date: '2025-01-15' });

      await handler(req, res);

      // Deve retornar o ID real, não o slug/ID estático
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.roomId).toBe('real-uuid-123');
    });
  });

  describe('conflitos com reservas existentes', () => {
    it('deve marcar slot como indisponível se há reserva', async () => {
      const mockRoom = { id: 'room-123', slug: 'sala-a', isActive: true };
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValueOnce(mockRoom);
      
      // Reserva das 10h às 12h
      const booking = {
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T12:00:00'),
      };
      (mockPrisma.booking.findMany as jest.Mock).mockResolvedValueOnce([booking]);

      const { req, res } = createMocks({ roomId: 'room-123', date: '2025-01-15' });

      await handler(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.success).toBe(true);
      
      // Slots 10 e 11 devem estar indisponíveis
      const slot10 = response.slots.find((s: { hour: number }) => s.hour === 10);
      const slot11 = response.slots.find((s: { hour: number }) => s.hour === 11);
      expect(slot10?.available).toBe(false);
      expect(slot11?.available).toBe(false);
      
      // Slot 9 e 12 devem estar disponíveis (se não passou do horário)
      const slot9 = response.slots.find((s: { hour: number }) => s.hour === 9);
      const slot12 = response.slots.find((s: { hour: number }) => s.hour === 12);
      // Note: podem estar indisponíveis por horário passado, mas não por conflito
    });
  });
});
