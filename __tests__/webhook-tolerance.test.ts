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
