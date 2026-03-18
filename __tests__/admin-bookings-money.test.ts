import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockRequireAdminAuth = jest.fn();
const mockRoomFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockBookingFindUnique = jest.fn();
const mockBookingUpdate = jest.fn();
const mockPrismaTransaction = jest.fn();
const mockTxBookingCreate = jest.fn();
const mockTxBookingUpdate = jest.fn();

const mockIsAvailable = jest.fn();
const mockLogAdminAction = jest.fn();
const mockGetCreditBalanceForRoom = jest.fn();
const mockConsumeCreditsForBooking = jest.fn();
const mockGetBookingTotalCentsByDate = jest.fn();

jest.mock('@/lib/admin-auth', () => ({
  requireAdminAuth: (...args: unknown[]) => mockRequireAdminAuth(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findUnique: (...args: unknown[]) => mockRoomFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    booking: {
      findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
      update: (...args: unknown[]) => mockBookingUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
  isOverbookingError: () => false,
  OVERBOOKING_ERROR_MESSAGE: 'OVERBOOKING',
}));

jest.mock('@/lib/availability', () => ({
  isAvailable: (...args: unknown[]) => mockIsAvailable(...args),
}));

jest.mock('@/lib/audit', () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
}));

jest.mock('@/lib/user-resolve', () => ({
  resolveOrCreateUser: jest.fn(),
}));

jest.mock('@/lib/errors', () => ({
  respondError: (res: NextApiResponse, _error: unknown) =>
    res.status(500).json({ success: false, error: 'Erro no handler' }),
}));

jest.mock('@/lib/request-id', () => ({
  generateRequestId: () => 'req-test',
  REQUEST_ID_HEADER: 'x-request-id',
}));

jest.mock('@/lib/business-rules', () => ({
  SHIFT_HOURS: {
    MORNING: { start: 8, end: 12 },
    AFTERNOON: { start: 13, end: 17 },
  },
  getCreditBalanceForRoom: (...args: unknown[]) => mockGetCreditBalanceForRoom(...args),
  consumeCreditsForBooking: (...args: unknown[]) => mockConsumeCreditsForBooking(...args),
}));

jest.mock('@/lib/pricing', () => ({
  getBookingTotalCentsByDate: (...args: unknown[]) => mockGetBookingTotalCentsByDate(...args),
}));

jest.mock('@/lib/business-hours', () => ({
  createDateInBrazilTimezone: (dateStr: string, hour: number) => {
    const d = new Date(dateStr);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  },
  isBookingWithinBusinessHours: () => true,
}));

import createHandler from '@/pages/api/admin/bookings/create';
import updateHandler from '@/pages/api/admin/bookings/[id]';

describe('Admin bookings money units (centavos)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAdminAuth.mockReturnValue(true);
    mockIsAvailable.mockResolvedValue(true);
    mockLogAdminAction.mockResolvedValue(undefined);

    mockPrismaTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        booking: {
          create: (...args: unknown[]) => mockTxBookingCreate(...args),
          update: (...args: unknown[]) => mockTxBookingUpdate(...args),
        },
      });
    });
  });

  it('admin create (amount=0) usa cálculo em centavos ao consumir crédito', async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      slug: 'sala-a',
      name: 'Sala A',
      isActive: true,
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    mockGetBookingTotalCentsByDate.mockReturnValue(11998);
    mockGetCreditBalanceForRoom.mockResolvedValue(30000);
    mockConsumeCreditsForBooking.mockResolvedValue({
      creditIds: ['credit-1'],
      totalConsumed: 11998,
    });
    mockTxBookingCreate.mockResolvedValue({
      id: 'booking-1',
      financialStatus: 'PAID',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user-1',
        roomId: 'room-1',
        date: '2026-03-20T00:00:00.000Z',
        bookingType: 'HOURLY',
        startHour: 10,
        endHour: 12,
        amount: 0,
        origin: 'COMMERCIAL',
      },
    });

    await createHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(201);
    expect(mockGetBookingTotalCentsByDate).toHaveBeenCalled();
    expect(mockConsumeCreditsForBooking).toHaveBeenCalled();

    const consumedAmount = mockConsumeCreditsForBooking.mock.calls[0][2];
    expect(consumedAmount).toBe(11998);
    expect(Number.isInteger(consumedAmount)).toBe(true);
  });

  it('admin create respeita useCredits=false e não consome crédito', async () => {
    mockRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      slug: 'sala-a',
      name: 'Sala A',
      isActive: true,
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    mockGetBookingTotalCentsByDate.mockReturnValue(10000);
    mockGetCreditBalanceForRoom.mockResolvedValue(50000);
    mockTxBookingCreate.mockResolvedValue({
      id: 'booking-2',
      financialStatus: 'PENDING_PAYMENT',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user-1',
        roomId: 'room-1',
        date: '2026-03-20T00:00:00.000Z',
        bookingType: 'HOURLY',
        startHour: 10,
        endHour: 12,
        amount: 0,
        origin: 'COMMERCIAL',
        useCredits: false,
      },
    });

    await createHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(201);
    expect(mockConsumeCreditsForBooking).not.toHaveBeenCalled();
  });

  it('admin create aceita roomId por slug (fallback)', async () => {
    mockRoomFindUnique
      .mockResolvedValueOnce(null) // Busca por id
      .mockResolvedValueOnce({     // Fallback por slug
        id: 'room-real-id',
        slug: 'sala-a',
        name: 'Sala A',
        isActive: true,
      });
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    mockGetBookingTotalCentsByDate.mockReturnValue(10000);
    mockGetCreditBalanceForRoom.mockResolvedValue(0);
    mockTxBookingCreate.mockResolvedValue({
      id: 'booking-3',
      financialStatus: 'PENDING_PAYMENT',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        userId: 'user-1',
        roomId: 'sala-a',
        date: '2026-03-20T00:00:00.000Z',
        bookingType: 'HOURLY',
        startHour: 10,
        endHour: 12,
        amount: 0,
        origin: 'COMMERCIAL',
      },
    });

    await createHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(201);
    expect(mockRoomFindUnique).toHaveBeenCalledTimes(2);
  });

  it('admin edit usa diferença em centavos para débito adicional de crédito', async () => {
    const start = new Date('2026-03-21T10:00:00.000Z');
    const end = new Date('2026-03-21T12:00:00.000Z');

    mockBookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      roomId: 'room-1',
      userId: 'user-1',
      startTime: start,
      endTime: end,
      creditsUsed: 20000,
      notes: null,
      room: { slug: 'sala-a' },
      user: { id: 'user-1', name: 'User' },
    });
    mockGetBookingTotalCentsByDate.mockImplementation(
      (_roomId: string, _date: Date, hours: number) => {
        if (hours === 2) return 12998;
        if (hours === 4) return 25996;
        return 0;
      }
    );
    mockGetCreditBalanceForRoom.mockResolvedValue(50000);
    mockConsumeCreditsForBooking.mockResolvedValue({
      creditIds: ['credit-2'],
      totalConsumed: 12998,
    });
    mockTxBookingUpdate.mockResolvedValue({
      id: 'booking-1',
      creditsUsed: 32998,
      room: { slug: 'sala-a' },
      user: { id: 'user-1' },
    });

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: 'booking-1' },
      body: {
        startTime: '2026-03-21T10:00:00.000Z',
        endTime: '2026-03-21T14:00:00.000Z',
      },
    });

    await updateHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(mockConsumeCreditsForBooking).toHaveBeenCalled();

    const consumedAmount = mockConsumeCreditsForBooking.mock.calls[0][2];
    expect(consumedAmount).toBe(12998);
    expect(Number.isInteger(consumedAmount)).toBe(true);

    const responseData = JSON.parse(res._getData());
    expect(responseData._adjustment?.amount).toBe(12998);
  });

  it('admin edit bloqueia conflito de agenda na edição', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      roomId: 'room-1',
      userId: 'user-1',
      startTime: new Date('2026-03-21T10:00:00.000Z'),
      endTime: new Date('2026-03-21T12:00:00.000Z'),
      creditsUsed: 20000,
      notes: null,
      room: { slug: 'sala-a' },
      user: { id: 'user-1', name: 'User' },
    });
    mockIsAvailable.mockResolvedValue(false);

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: 'booking-1' },
      body: {
        startTime: '2026-03-21T10:00:00.000Z',
        endTime: '2026-03-21T12:00:00.000Z',
      },
    });

    await updateHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(409);
    expect(mockConsumeCreditsForBooking).not.toHaveBeenCalled();
  });

  it('admin edit aplica roomId novo na atualização e no consumo de crédito', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      roomId: 'room-old',
      userId: 'user-1',
      startTime: new Date('2026-03-21T10:00:00.000Z'),
      endTime: new Date('2026-03-21T12:00:00.000Z'),
      creditsUsed: 20000,
      notes: null,
      room: { id: 'room-old', slug: 'sala-a' },
      user: { id: 'user-1', name: 'User' },
    });
    mockRoomFindUnique.mockResolvedValue({
      id: 'room-new',
      slug: 'sala-b',
      isActive: true,
    });
    mockGetBookingTotalCentsByDate
      .mockReturnValueOnce(10000) // antigo
      .mockReturnValueOnce(12000); // novo (diferença +2000)
    mockGetCreditBalanceForRoom.mockResolvedValue(50000);
    mockConsumeCreditsForBooking.mockResolvedValue({
      creditIds: ['credit-3'],
      totalConsumed: 2000,
    });
    mockTxBookingUpdate.mockResolvedValue({
      id: 'booking-1',
      room: { slug: 'sala-b' },
      user: { id: 'user-1' },
    });

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: 'booking-1' },
      body: {
        roomId: 'room-new',
        startTime: '2026-03-21T10:00:00.000Z',
        endTime: '2026-03-21T12:00:00.000Z',
      },
    });

    await updateHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(mockConsumeCreditsForBooking).toHaveBeenCalled();
    expect(mockConsumeCreditsForBooking.mock.calls[0][1]).toBe('room-new');
    expect(mockTxBookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: 'room-new',
        }),
      })
    );
  });

  it('admin edit aceita status COMPLETED em atualização simples', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
      financialStatus: 'PAID',
      roomId: 'room-1',
      userId: 'user-1',
      startTime: new Date('2026-03-21T10:00:00.000Z'),
      endTime: new Date('2026-03-21T12:00:00.000Z'),
      notes: null,
      room: { slug: 'sala-a' },
      user: { id: 'user-1', name: 'User' },
    });
    mockBookingUpdate.mockResolvedValue({
      id: 'booking-1',
      status: 'COMPLETED',
    });

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: 'booking-1' },
      body: {
        status: 'COMPLETED',
      },
    });

    await updateHandler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(mockBookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });
});
