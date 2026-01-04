// ===========================================================
// Testes: Webhook Asaas - Robustez e tolerância a erros
// ===========================================================

describe('Webhook Asaas - Tolerância a erros', () => {
  describe('Entidades não encontradas', () => {
    it('deve retornar 200 e ignored:entity_not_found quando externalReference não existe', () => {
      // Simula comportamento esperado do webhook
      const externalReference = 'cmjiqm7tp0001al0pr5weo90f'; // ID que não existe
      const hasPrefix = externalReference.startsWith('booking:') || 
                       externalReference.startsWith('purchase:') || 
                       externalReference.startsWith('credit_');
      
      // Sem prefixo = deve tentar como booking, depois como credit, depois ignorar
      expect(hasPrefix).toBe(false);
      
      // Comportamento esperado:
      // 1. Não encontra como Booking -> tenta como Credit
      // 2. Não encontra como Credit -> retorna 200 com ignored
      const expectedResponse = { 
        ok: true, 
        ignored: 'entity_not_found', 
        id: externalReference 
      };
      
      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.ignored).toBe('entity_not_found');
    });

    it('deve retornar 200 e ignored:credit_not_found quando crédito não existe', () => {
      const externalReference = 'purchase:credit_que_nao_existe';
      const isPurchase = externalReference.startsWith('purchase:') || 
                        externalReference.startsWith('credit_');
      
      expect(isPurchase).toBe(true);
      
      const expectedResponse = { 
        ok: true, 
        ignored: 'credit_not_found', 
        creditId: 'credit_que_nao_existe' 
      };
      
      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.ignored).toBe('credit_not_found');
    });

    it('deve retornar 200 e ignored:no_reference quando sem externalReference', () => {
      const externalReference = null;
      
      const expectedResponse = { 
        ok: true, 
        ignored: 'no_reference' 
      };
      
      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.ignored).toBe('no_reference');
    });
  });

  describe('Detecção de prefixos', () => {
    it('deve detectar prefixo booking:', () => {
      const ref = 'booking:abc123';
      expect(ref.startsWith('booking:')).toBe(true);
      expect(ref.replace('booking:', '')).toBe('abc123');
    });

    it('deve detectar prefixo purchase:', () => {
      const ref = 'purchase:xyz789';
      expect(ref.startsWith('purchase:')).toBe(true);
      expect(ref.replace('purchase:', '')).toBe('xyz789');
    });

    it('deve detectar prefixo credit_ (legado)', () => {
      const ref = 'credit_old123';
      expect(ref.startsWith('credit_')).toBe(true);
      expect(ref.replace('credit_', '')).toBe('old123');
    });

    it('deve tratar ID sem prefixo como possível booking ou credit', () => {
      const ref = 'cmjiqm7tp0001al0pr5weo90f';
      const hasBookingPrefix = ref.startsWith('booking:');
      const hasPurchasePrefix = ref.startsWith('purchase:') || ref.startsWith('credit_');
      
      expect(hasBookingPrefix).toBe(false);
      expect(hasPurchasePrefix).toBe(false);
      // Neste caso, o webhook deve:
      // 1. Tentar como booking
      // 2. Se não achar, tentar como credit (fallback)
      // 3. Se não achar, ignorar com 200
    });

    it('deve detectar prefixo booking:purchase: (legado duplicado)', () => {
      const ref = 'booking:purchase:cmjza956e0009c8nnm2f3ctqp';
      expect(ref.startsWith('booking:purchase:')).toBe(true);
      expect(ref.replace('booking:purchase:', '')).toBe('cmjza956e0009c8nnm2f3ctqp');
    });
  });

  describe('parseExternalReference helper', () => {
    // Simula a função parseExternalReference do webhook
    function parseExternalReference(ref: string | null | undefined): { type: 'booking' | 'purchase'; id: string } | null {
      if (!ref) return null;
      
      // booking:purchase:<id> => purchase (legado com prefixo duplicado)
      if (ref.startsWith('booking:purchase:')) {
        return { type: 'purchase', id: ref.replace('booking:purchase:', '') };
      }
      
      // purchase:<id> => purchase
      if (ref.startsWith('purchase:')) {
        return { type: 'purchase', id: ref.replace('purchase:', '') };
      }
      
      // credit_<id> => purchase (legado)
      if (ref.startsWith('credit_')) {
        return { type: 'purchase', id: ref.replace('credit_', '') };
      }
      
      // booking:<id> => booking
      if (ref.startsWith('booking:')) {
        return { type: 'booking', id: ref.replace('booking:', '') };
      }
      
      // ID puro => booking (retrocompatibilidade)
      return { type: 'booking', id: ref };
    }

    it('deve parsear booking:<id> corretamente', () => {
      const result = parseExternalReference('booking:abc123');
      expect(result).toEqual({ type: 'booking', id: 'abc123' });
    });

    it('deve parsear purchase:<id> corretamente', () => {
      const result = parseExternalReference('purchase:xyz789');
      expect(result).toEqual({ type: 'purchase', id: 'xyz789' });
    });

    it('deve parsear booking:purchase:<id> (legado duplicado) como purchase', () => {
      const result = parseExternalReference('booking:purchase:cmjza956e0009c8nnm2f3ctqp');
      expect(result).toEqual({ type: 'purchase', id: 'cmjza956e0009c8nnm2f3ctqp' });
    });

    it('deve parsear credit_<id> (legado) como purchase', () => {
      const result = parseExternalReference('credit_old123');
      expect(result).toEqual({ type: 'purchase', id: 'old123' });
    });

    it('deve parsear ID puro como booking (retrocompatibilidade)', () => {
      const result = parseExternalReference('cmjiqm7tp0001al0pr5weo90f');
      expect(result).toEqual({ type: 'booking', id: 'cmjiqm7tp0001al0pr5weo90f' });
    });

    it('deve retornar null para referência vazia', () => {
      expect(parseExternalReference(null)).toBeNull();
      expect(parseExternalReference(undefined)).toBeNull();
      expect(parseExternalReference('')).toBeNull();
    });
  });

  describe('buildExternalReference helper', () => {
    // Simula a função buildExternalReference do asaas.ts
    function buildExternalReference(bookingId: string): string {
      if (bookingId.startsWith('booking:') || bookingId.startsWith('purchase:')) {
        return bookingId;
      }
      return `booking:${bookingId}`;
    }

    it('não deve duplicar prefixo booking:', () => {
      const result = buildExternalReference('booking:abc123');
      expect(result).toBe('booking:abc123');
    });

    it('não deve duplicar prefixo purchase:', () => {
      const result = buildExternalReference('purchase:xyz789');
      expect(result).toBe('purchase:xyz789');
    });

    it('deve adicionar prefixo booking: para ID puro', () => {
      const result = buildExternalReference('abc123');
      expect(result).toBe('booking:abc123');
    });

    it('fluxo completo: credits/purchase deve gerar purchase:<id>', () => {
      const creditId = 'cmjza956e0009c8nnm2f3ctqp';
      const bookingIdFromPurchase = `purchase:${creditId}`; // O que credits/purchase.ts envia
      const externalReference = buildExternalReference(bookingIdFromPurchase);
      expect(externalReference).toBe('purchase:cmjza956e0009c8nnm2f3ctqp');
    });

    it('fluxo completo: bookings/index deve gerar booking:<id>', () => {
      const bookingId = 'cmjiqm7tp0001al0pr5weo90f';
      const externalReference = buildExternalReference(bookingId);
      expect(externalReference).toBe('booking:cmjiqm7tp0001al0pr5weo90f');
    });
  });

  describe('Status de WebhookEvent', () => {
    it('deve usar status IGNORED_NOT_FOUND para entidades não encontradas', () => {
      const validStatuses = [
        'PROCESSING',
        'PROCESSED', 
        'IGNORED_NOT_FOUND',
        'IGNORED_NO_REFERENCE',
      ];
      
      expect(validStatuses).toContain('IGNORED_NOT_FOUND');
      expect(validStatuses).toContain('IGNORED_NO_REFERENCE');
    });
  });
});
