// ===========================================================
// Testes: lib/meta/capi.ts
// ===========================================================
// Testes unitários para Meta Conversions API

import {
  hashForMeta,
  buildCapiPayload,
  generateServerEventId,
  type CapiEventInput,
} from '@/lib/meta/capi';

describe('Meta CAPI - hashForMeta', () => {
  it('should hash email correctly', () => {
    const result = hashForMeta('User@Example.COM', 'email');
    
    // Deve ser lowercase + trim + SHA-256
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    // Mesmo input deve gerar mesmo hash
    const result2 = hashForMeta('  USER@EXAMPLE.COM  ', 'email');
    expect(result).toBe(result2);
  });

  it('should hash phone with Brazil country code', () => {
    // Número BR sem código do país
    const result1 = hashForMeta('11999998888', 'phone');
    const result2 = hashForMeta('5511999998888', 'phone');
    
    // Ambos devem resultar em 5511999998888
    expect(result1).toBe(result2);
    expect(result1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should normalize phone removing non-digits', () => {
    const result1 = hashForMeta('(11) 99999-8888', 'phone');
    const result2 = hashForMeta('11999998888', 'phone');
    
    expect(result1).toBe(result2);
  });

  it('should hash name removing accents and special chars', () => {
    const result1 = hashForMeta('João', 'name');
    const result2 = hashForMeta('joao', 'name');
    
    expect(result1).toBe(result2);
  });

  it('should return undefined for empty/null values', () => {
    expect(hashForMeta(null)).toBeUndefined();
    expect(hashForMeta(undefined)).toBeUndefined();
    expect(hashForMeta('')).toBeUndefined();
    expect(hashForMeta('   ')).toBeUndefined();
  });
});

describe('Meta CAPI - generateServerEventId', () => {
  it('should generate valid UUID v4', () => {
    const eventId = generateServerEventId();
    
    // UUID v4 format
    expect(eventId).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
    );
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateServerEventId());
    }
    // Todos devem ser únicos
    expect(ids.size).toBe(100);
  });
});

describe('Meta CAPI - buildCapiPayload', () => {
  const baseInput: CapiEventInput = {
    eventName: 'Purchase',
    eventId: 'test-event-id-123',
    userData: {
      clientIpAddress: '1.2.3.4',
      clientUserAgent: 'Mozilla/5.0 Test',
    },
  };

  it('should include required fields', () => {
    const payload = buildCapiPayload(baseInput);

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      event_name: 'Purchase',
      event_id: 'test-event-id-123',
      action_source: 'website',
    });
    expect(payload.data[0].event_time).toBeDefined();
    expect(typeof payload.data[0].event_time).toBe('number');
  });

  it('should include user_data with IP and UA', () => {
    const payload = buildCapiPayload(baseInput);

    expect(payload.data[0].user_data).toMatchObject({
      client_ip_address: '1.2.3.4',
      client_user_agent: 'Mozilla/5.0 Test',
    });
  });

  it('should include fbp/fbc without hashing', () => {
    const input: CapiEventInput = {
      ...baseInput,
      userData: {
        ...baseInput.userData,
        fbp: 'fb.1.1234567890.1234567890',
        fbc: 'fb.1.1234567890.abcdef',
      },
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].user_data.fbp).toBe('fb.1.1234567890.1234567890');
    expect(payload.data[0].user_data.fbc).toBe('fb.1.1234567890.abcdef');
  });

  it('should hash PII fields (email, phone)', () => {
    const input: CapiEventInput = {
      ...baseInput,
      userData: {
        ...baseInput.userData,
        em: 'test@example.com',
        ph: '11999998888',
      },
    };

    const payload = buildCapiPayload(input);

    // Email e phone devem estar hasheados (64 chars hex)
    expect(payload.data[0].user_data.em).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.data[0].user_data.ph).toMatch(/^[a-f0-9]{64}$/);
    
    // Não devem ser o valor original
    expect(payload.data[0].user_data.em).not.toBe('test@example.com');
    expect(payload.data[0].user_data.ph).not.toBe('11999998888');
  });

  it('should NOT re-hash already hashed values', () => {
    const preHashedEmail = 'a'.repeat(64); // Simula um hash SHA-256
    
    const input: CapiEventInput = {
      ...baseInput,
      userData: {
        ...baseInput.userData,
        em: preHashedEmail,
      },
    };

    const payload = buildCapiPayload(input);

    // Deve manter o hash original
    expect(payload.data[0].user_data.em).toBe(preHashedEmail);
  });

  it('should include custom_data for Purchase', () => {
    const input: CapiEventInput = {
      ...baseInput,
      customData: {
        currency: 'BRL',
        value: 150.50,
        contentIds: ['room-123', 'product-456'],
        contentName: 'Reserva Consultório 1',
        orderId: 'order-789',
        numItems: 2,
      },
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].custom_data).toMatchObject({
      currency: 'BRL',
      value: 150.50,
      content_ids: ['room-123', 'product-456'],
      content_name: 'Reserva Consultório 1',
      order_id: 'order-789',
      num_items: 2,
    });
  });

  it('should include event_source_url when provided', () => {
    const input: CapiEventInput = {
      ...baseInput,
      eventSourceUrl: 'https://arthemi.com.br/reservar',
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].event_source_url).toBe('https://arthemi.com.br/reservar');
  });

  it('should use custom action_source when provided', () => {
    const input: CapiEventInput = {
      ...baseInput,
      actionSource: 'phone_call',
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].action_source).toBe('phone_call');
  });

  it('should use provided event_time', () => {
    const customTime = 1704067200; // 2024-01-01 00:00:00 UTC
    
    const input: CapiEventInput = {
      ...baseInput,
      eventTime: customTime,
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].event_time).toBe(customTime);
  });

  it('should NOT include empty custom_data', () => {
    const input: CapiEventInput = {
      ...baseInput,
      customData: {},
    };

    const payload = buildCapiPayload(input);

    expect(payload.data[0].custom_data).toBeUndefined();
  });
});

describe('Meta CAPI - Event deduplication', () => {
  it('should use same event_id from input', () => {
    const eventId = 'my-unique-event-id';
    
    const payload = buildCapiPayload({
      eventName: 'Purchase',
      eventId,
      userData: {},
    });

    expect(payload.data[0].event_id).toBe(eventId);
  });

  it('should preserve event_id format (UUID)', () => {
    const eventId = generateServerEventId();
    
    const payload = buildCapiPayload({
      eventName: 'Schedule',
      eventId,
      userData: {},
    });

    expect(payload.data[0].event_id).toBe(eventId);
    expect(payload.data[0].event_id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
    );
  });
});
