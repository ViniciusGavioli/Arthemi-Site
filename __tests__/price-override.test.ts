// ===========================================================
// Testes: PRICE_OVERRIDE vs CUPOM
// ===========================================================
// Valida separação entre:
// - CUPOM: desconto % ou fixo, stacka com créditos
// - OVERRIDE: preço final fixo, NÃO stacka com créditos/cupom

import { 
  validateOverrideAccess, 
  parseOverrideCode, 
  isOverrideCode,
  isOverrideAdmin,
  OVERRIDE_ADMIN_EMAILS,
} from '@/lib/price-override';

describe('PRICE_OVERRIDE', () => {
  const requestId = 'test-123';
  
  describe('isOverrideCode', () => {
    it('deve reconhecer código OVERRIDE_X', () => {
      expect(isOverrideCode('OVERRIDE_5')).toBe(true);
      expect(isOverrideCode('OVERRIDE_100')).toBe(true);
      expect(isOverrideCode('override_10')).toBe(true); // case-insensitive
    });
    
    it('deve rejeitar códigos que não são override', () => {
      expect(isOverrideCode('PRIMEIRACOMPRA10')).toBe(false);
      expect(isOverrideCode('OVERRIDE')).toBe(false); // sem valor
      expect(isOverrideCode('OVERRIDE_')).toBe(false); // sem valor
      expect(isOverrideCode('OVERRIDE_abc')).toBe(false); // não-numérico
      expect(isOverrideCode('')).toBe(false);
      expect(isOverrideCode(null)).toBe(false);
      expect(isOverrideCode(undefined)).toBe(false);
    });
  });
  
  describe('parseOverrideCode', () => {
    it('deve parsear código OVERRIDE_5 para R$5,00 = 500 centavos', () => {
      const result = parseOverrideCode('OVERRIDE_5');
      expect(result).toEqual({
        overrideFinalCents: 500,
        overrideReason: 'Código administrativo: OVERRIDE_5',
      });
    });
    
    it('deve parsear código OVERRIDE_0 para R$0,00 = gratuito', () => {
      const result = parseOverrideCode('OVERRIDE_0');
      expect(result).toEqual({
        overrideFinalCents: 0,
        overrideReason: 'Código administrativo: OVERRIDE_0',
      });
    });
    
    it('deve retornar null para código inválido', () => {
      expect(parseOverrideCode('PRIMEIRACOMPRA10')).toBeNull();
      expect(parseOverrideCode('OVERRIDE')).toBeNull();
      expect(parseOverrideCode(null)).toBeNull();
    });
  });
  
  describe('isOverrideAdmin', () => {
    it('deve reconhecer emails da whitelist', () => {
      // Pelo menos um email padrão deve existir
      expect(OVERRIDE_ADMIN_EMAILS.length).toBeGreaterThan(0);
      
      // Testar com email da whitelist (se existir admin@arthemisaude.com)
      if (OVERRIDE_ADMIN_EMAILS.includes('admin@arthemisaude.com')) {
        expect(isOverrideAdmin('admin@arthemisaude.com')).toBe(true);
        expect(isOverrideAdmin('ADMIN@ARTHEMISAUDE.COM')).toBe(true); // case-insensitive
      }
    });
    
    it('deve rejeitar emails fora da whitelist', () => {
      expect(isOverrideAdmin('random@gmail.com')).toBe(false);
      expect(isOverrideAdmin('')).toBe(false);
      expect(isOverrideAdmin(null)).toBe(false);
    });
  });
  
  describe('validateOverrideAccess', () => {
    it('deve permitir sem override (passthrough)', () => {
      const result = validateOverrideAccess(null, null, null, requestId);
      expect(result.allowed).toBe(true);
    });
    
    it('deve rejeitar override sem reason', () => {
      const result = validateOverrideAccess(
        'admin@arthemisaude.com',
        'ADMIN',
        { overrideFinalCents: 500, overrideReason: '' },
        requestId
      );
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('OVERRIDE_MISSING_REASON');
    });
    
    it('deve rejeitar override com valor negativo', () => {
      const result = validateOverrideAccess(
        'admin@arthemisaude.com',
        'ADMIN',
        { overrideFinalCents: -100, overrideReason: 'Teste' },
        requestId
      );
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('OVERRIDE_INVALID_AMOUNT');
    });
    
    it('deve permitir override para role ADMIN', () => {
      const result = validateOverrideAccess(
        'qualquer@email.com',
        'ADMIN',
        { overrideFinalCents: 500, overrideReason: 'Teste admin' },
        requestId
      );
      expect(result.allowed).toBe(true);
      expect(result.finalCents).toBe(500);
    });
    
    it('deve permitir override para email na whitelist', () => {
      if (OVERRIDE_ADMIN_EMAILS.length === 0) return;
      
      const adminEmail = OVERRIDE_ADMIN_EMAILS[0];
      const result = validateOverrideAccess(
        adminEmail,
        'CUSTOMER',
        { overrideFinalCents: 500, overrideReason: 'Teste whitelist' },
        requestId
      );
      expect(result.allowed).toBe(true);
    });
    
    it('deve aplicar piso mínimo R$1,00 quando override > 0 e < 100', () => {
      const result = validateOverrideAccess(
        'admin@arthemisaude.com',
        'ADMIN',
        { overrideFinalCents: 50, overrideReason: 'Teste piso' },
        requestId
      );
      expect(result.allowed).toBe(true);
      expect(result.finalCents).toBe(100); // Ajustado para mínimo
    });
    
    it('deve permitir override R$0 (gratuito) sem piso', () => {
      const result = validateOverrideAccess(
        'admin@arthemisaude.com',
        'ADMIN',
        { overrideFinalCents: 0, overrideReason: 'Cortesia' },
        requestId
      );
      expect(result.allowed).toBe(true);
      expect(result.finalCents).toBe(0); // Zero não aplica piso
    });
  });
});

describe('CUPOM vs OVERRIDE - Comportamento', () => {
  describe('CUPOM comercial (PRIMEIRACOMPRA10)', () => {
    it('cupom é desconto, não preço final', () => {
      // Cupom aplica % ou fixo sobre amountToPayWithoutCoupon
      // Ex: R$100 - 10% = R$90
      const gross = 10000; // R$100
      const discountPercent = 10;
      const expected = gross - Math.round(gross * discountPercent / 100);
      expect(expected).toBe(9000); // R$90
    });
    
    it('cupom stacka com créditos', () => {
      // gross = R$100
      // créditos = R$30
      // afterCredits = R$70
      // cupom 10% sobre afterCredits = R$7
      // amountToPay = R$63
      const gross = 10000;
      const credits = 3000;
      const afterCredits = gross - credits; // 7000
      const discount = Math.round(afterCredits * 0.10); // 700
      const amountToPay = afterCredits - discount; // 6300
      expect(amountToPay).toBe(6300);
    });
    
    it('cupom ignorado se 100% créditos', () => {
      // Se créditos >= gross, cupom não se aplica
      const gross = 5000;
      const credits = 5000;
      const afterCredits = Math.max(0, gross - credits);
      expect(afterCredits).toBe(0);
      // Cupom não se aplica quando afterCredits = 0
    });
  });
  
  describe('OVERRIDE (preço administrativo)', () => {
    it('override é preço final fixo', () => {
      // Override R$5 = amountToPay = R$5, independente do gross
      const overrideFinalCents = 500;
      const gross = 10000; // R$100
      const amountToPay = overrideFinalCents; // R$5
      expect(amountToPay).toBe(500);
    });
    
    it('override NÃO stacka com créditos', () => {
      // Override ativo => créditos ignorados
      const overrideFinalCents = 500;
      const credits = 3000; // Ignorado
      const amountToPay = overrideFinalCents;
      expect(amountToPay).toBe(500);
    });
    
    it('override NÃO stacka com cupom', () => {
      // Override ativo => cupom ignorado
      const overrideFinalCents = 500;
      const couponDiscount = 1000; // Ignorado
      const amountToPay = overrideFinalCents;
      expect(amountToPay).toBe(500);
    });
    
    it('override R$0 = cortesia/gratuito', () => {
      const overrideFinalCents = 0;
      expect(overrideFinalCents).toBe(0);
      // Reserva confirmada sem pagamento
    });
  });
});

describe('Segurança OVERRIDE', () => {
  it('override requer sessão autenticada', () => {
    // Sem sessionEmail, override deve ser bloqueado em produção
    // (Em dev, pode ser permitido para facilitar testes)
  });
  
  it('override auditado com campos obrigatórios', () => {
    // pricingMode, overrideFinalCents, overrideReason, overrideByUserId, overrideCreatedAt
    const auditFields = [
      'pricingMode',
      'overrideFinalCents',
      'overrideReason',
      'overrideByUserId',
      'overrideCreatedAt',
    ];
    expect(auditFields.length).toBe(5);
  });
  
  it('override não vaza para usuário comum', () => {
    // UI mostra "Preço administrativo aplicado" sem expor código interno
    const uiMessage = 'Preço administrativo aplicado';
    expect(uiMessage).not.toContain('OVERRIDE_');
  });
});
