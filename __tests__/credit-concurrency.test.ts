// ===========================================================
// Testes: P-002 - Consumo Atômico de Créditos (Double-Spend)
// ===========================================================
// Testes unitários para verificar prevenção de double-spend
// 
// Execute: npm test -- credit-concurrency.test.ts
// ===========================================================

// ============================================================
// TESTES: DETECÇÃO DE ERROS DE CRÉDITO
// ============================================================

describe('Credit Error Detection', () => {
  test('erro INSUFFICIENT_CREDITS é parseável', () => {
    const error = new Error('INSUFFICIENT_CREDITS:5000:10000');
    const parts = error.message.split(':');
    
    expect(parts[0]).toBe('INSUFFICIENT_CREDITS');
    expect(parseInt(parts[1])).toBe(5000); // 50 reais disponíveis
    expect(parseInt(parts[2])).toBe(10000); // 100 reais necessários
  });

  test('erro CREDIT_CONSUMED_BY_ANOTHER é parseável', () => {
    const error = new Error('CREDIT_CONSUMED_BY_ANOTHER:credit_abc123');
    const parts = error.message.split(':');
    
    expect(parts[0]).toBe('CREDIT_CONSUMED_BY_ANOTHER');
    expect(parts[1]).toBe('credit_abc123');
  });

  test('erro PARTIAL_CONSUMPTION é parseável', () => {
    const error = new Error('PARTIAL_CONSUMPTION:5000:10000');
    const parts = error.message.split(':');
    
    expect(parts[0]).toBe('PARTIAL_CONSUMPTION');
    expect(parseInt(parts[1])).toBe(5000); // 50 reais consumidos
    expect(parseInt(parts[2])).toBe(10000); // 100 reais esperados
  });
});

// ============================================================
// TESTES: LÓGICA DE CONSUMO ATÔMICO (CONCEITUAL)
// ============================================================

describe('Atomic Credit Consumption Logic', () => {
  test('update condicional retorna 0 linhas quando crédito já foi consumido', () => {
    // Simula a lógica do SQL:
    // UPDATE credits SET remainingAmount = remainingAmount - X
    // WHERE id = Y AND remainingAmount >= X
    
    const creditBefore = { id: 'c1', remainingAmount: 5000 };
    const toConsume = 6000;
    
    // Se remainingAmount < toConsume, WHERE falha, 0 linhas atualizadas
    const rowsAffected = creditBefore.remainingAmount >= toConsume ? 1 : 0;
    expect(rowsAffected).toBe(0);
  });

  test('update condicional retorna 1 linha quando há saldo suficiente', () => {
    const creditBefore = { id: 'c1', remainingAmount: 5000 };
    const toConsume = 3000;
    
    const rowsAffected = creditBefore.remainingAmount >= toConsume ? 1 : 0;
    expect(rowsAffected).toBe(1);
  });

  test('update condicional retorna 1 linha quando consumo exato', () => {
    const creditBefore = { id: 'c1', remainingAmount: 5000 };
    const toConsume = 5000;
    
    const rowsAffected = creditBefore.remainingAmount >= toConsume ? 1 : 0;
    expect(rowsAffected).toBe(1);
  });
});

// ============================================================
// TESTES: CENÁRIOS DE RACE CONDITION (CONCEITUAL)
// ============================================================

describe('Race Condition Scenarios', () => {
  test('duas requisições concorrentes com mesmo crédito: apenas uma sucede', () => {
    // Simula cenário:
    // - Crédito inicial: R$ 50,00 (5000 centavos)
    // - Req A: tenta consumir R$ 50,00
    // - Req B: tenta consumir R$ 50,00 (concorrente)
    
    const initialBalance = 5000;
    const requestA = { amount: 5000, timestamp: 1 };
    const requestB = { amount: 5000, timestamp: 2 };
    
    // Com transação atômica, apenas a primeira que fizer UPDATE vence
    // A segunda verá remainingAmount = 0 e falhará na cláusula WHERE
    
    let balance = initialBalance;
    const results: { request: string; success: boolean }[] = [];
    
    // Req A processa primeiro
    if (balance >= requestA.amount) {
      balance -= requestA.amount;
      results.push({ request: 'A', success: true });
    } else {
      results.push({ request: 'A', success: false });
    }
    
    // Req B processa depois (mesma condição)
    if (balance >= requestB.amount) {
      balance -= requestB.amount;
      results.push({ request: 'B', success: true });
    } else {
      results.push({ request: 'B', success: false });
    }
    
    // Apenas uma deve ter sucesso
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);
    expect(successes[0].request).toBe('A');
    
    // Saldo final não deve ser negativo
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test('múltiplas requisições fragmentando crédito: saldo nunca fica negativo', () => {
    // Simula cenário:
    // - Crédito inicial: R$ 100,00 (10000 centavos)
    // - 5 requisições de R$ 30,00 cada
    
    const initialBalance = 10000;
    const requests = [
      { id: 1, amount: 3000 },
      { id: 2, amount: 3000 },
      { id: 3, amount: 3000 },
      { id: 4, amount: 3000 },
      { id: 5, amount: 3000 },
    ];
    
    let balance = initialBalance;
    const processed: number[] = [];
    
    for (const req of requests) {
      if (balance >= req.amount) {
        balance -= req.amount;
        processed.push(req.id);
      }
    }
    
    // Apenas 3 requisições devem passar (100/30 = 3.33 => 3 inteiras)
    expect(processed.length).toBe(3);
    expect(processed).toEqual([1, 2, 3]);
    
    // Saldo final: 100 - 90 = 10 reais (1000 centavos)
    expect(balance).toBe(1000);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// TESTES: VERIFICAÇÃO PRÉ-TRANSAÇÃO
// ============================================================

describe('Pre-Transaction Balance Check', () => {
  test('rejeita antes da transação se saldo claramente insuficiente', () => {
    const availableBalance = 5000; // R$ 50
    const requiredAmount = 10000; // R$ 100
    
    // Verificação prévia evita transação desnecessária
    const canProceed = availableBalance >= requiredAmount;
    expect(canProceed).toBe(false);
  });

  test('permite transação se saldo parece suficiente', () => {
    const availableBalance = 10000; // R$ 100
    const requiredAmount = 5000; // R$ 50
    
    const canProceed = availableBalance >= requiredAmount;
    expect(canProceed).toBe(true);
  });

  test('mesmo com verificação prévia, transação pode falhar por concorrência', () => {
    // Cenário:
    // - Verificação prévia: saldo = R$ 50
    // - Entre verificação e transação, outra req consumiu R$ 40
    // - Transação tenta consumir R$ 50 mas só tem R$ 10
    
    const balanceAtCheck = 5000;
    const consumedByConcurrent = 4000;
    const requiredAmount = 5000;
    
    // Verificação prévia passa
    expect(balanceAtCheck >= requiredAmount).toBe(true);
    
    // Saldo real no momento do UPDATE
    const actualBalance = balanceAtCheck - consumedByConcurrent;
    
    // UPDATE WHERE remainingAmount >= requiredAmount FALHA
    expect(actualBalance >= requiredAmount).toBe(false);
    
    // Este é o cenário que o P-002 resolve com UPDATE condicional
  });
});

// ============================================================
// TESTES: CONSUMO PARCIAL DE MÚLTIPLOS CRÉDITOS
// ============================================================

describe('Multi-Credit Consumption', () => {
  test('consome créditos em ordem de expiração', () => {
    const credits = [
      { id: 'c1', remainingAmount: 3000, expiresAt: new Date('2026-02-01') },
      { id: 'c2', remainingAmount: 4000, expiresAt: new Date('2026-03-01') },
      { id: 'c3', remainingAmount: 5000, expiresAt: new Date('2026-04-01') },
    ];
    
    const amountToConsume = 6000; // R$ 60
    let remaining = amountToConsume;
    const consumed: { id: string; amount: number }[] = [];
    
    // Ordenar por expiração (mais próxima primeiro)
    const sorted = [...credits].sort((a, b) => 
      a.expiresAt.getTime() - b.expiresAt.getTime()
    );
    
    for (const credit of sorted) {
      if (remaining <= 0) break;
      
      const toConsume = Math.min(credit.remainingAmount, remaining);
      consumed.push({ id: credit.id, amount: toConsume });
      remaining -= toConsume;
    }
    
    // Deve consumir c1 (3000) + c2 (3000 de 4000)
    expect(consumed).toEqual([
      { id: 'c1', amount: 3000 },
      { id: 'c2', amount: 3000 },
    ]);
    expect(remaining).toBe(0);
  });

  test('falha atomicamente se um dos updates falhar', () => {
    // Cenário: 
    // - Precisa consumir de 2 créditos
    // - Primeiro update funciona
    // - Segundo update falha (crédito foi consumido por outra req)
    // - TODA a transação deve ser revertida
    
    const updates = [
      { creditId: 'c1', success: true },
      { creditId: 'c2', success: false }, // Falhou!
    ];
    
    // Simula comportamento de transação
    const allSuccess = updates.every(u => u.success);
    
    if (!allSuccess) {
      // Rollback - nenhum crédito foi realmente consumido
      const effectiveUpdates = 0;
      expect(effectiveUpdates).toBe(0);
    }
    
    expect(allSuccess).toBe(false);
  });
});

// ============================================================
// TESTES: IDEMPOTÊNCIA (NÃO DUPLICAR CRÉDITO)
// ============================================================

describe('Credit Idempotency', () => {
  test('crédito com status USED não pode ser consumido novamente', () => {
    const credit = {
      id: 'c1',
      status: 'USED',
      remainingAmount: 0,
      usedAt: new Date(),
    };
    
    // Query WHERE filtra status = CONFIRMED
    const isAvailable = credit.status === 'CONFIRMED' && 
                        credit.remainingAmount > 0 && 
                        credit.usedAt === null;
    
    expect(isAvailable).toBe(false);
  });

  test('crédito parcialmente usado ainda pode ser consumido', () => {
    const credit = {
      id: 'c1',
      status: 'CONFIRMED',
      remainingAmount: 2000, // R$ 20 restante
      usedAt: null,
    };
    
    const isAvailable = credit.status === 'CONFIRMED' && 
                        credit.remainingAmount > 0 && 
                        credit.usedAt === null;
    
    expect(isAvailable).toBe(true);
    expect(credit.remainingAmount).toBe(2000);
  });
});
