# IMPLEMENTAÇÃO CORE: Cupom + Auditoria + Refund

## Data: 2026-01-10
## Status: ✅ IMPLEMENTADO

---

## 1. RESUMO EXECUTIVO

Esta implementação resolve as lacunas identificadas no sistema de cupons, auditoria financeira e reembolsos:

1. **Cupons**: Rastreamento de uso com bloqueio de reutilização para PRIMEIRACOMPRA
2. **Auditoria**: Campos `grossAmount`, `discountAmount`, `netAmount`, `couponCode`, `couponSnapshot` em Booking e Credit
3. **Refund**: Tabela `Refund` como fonte de verdade contábil com idempotência via UNIQUE(bookingId)

---

## 2. ARQUIVOS MODIFICADOS

### 2.1 Schema (Prisma)
- **prisma/schema.prisma**
  - Booking: +5 campos de auditoria, +relação `refund`
  - Credit: +5 campos de auditoria
  - Novo model: `CouponUsage` (rastreamento de uso)
  - Novo model: `Refund` (registro contábil idempotente)
  - Novos enums: `CouponUsageContext`, `CouponUsageStatus`, `RefundGateway`, `RefundRecordStatus`

### 2.2 Migration
- **prisma/migrations/20260110220000_coupon_audit_refund/migration.sql**
  - ALTER TABLE bookings/credits
  - CREATE TYPE (4 enums)
  - CREATE TABLE coupon_usages, refunds

### 2.3 Biblioteca de Cupons
- **src/lib/coupons.ts**
  - Atualizado `VALID_COUPONS` com `singleUsePerUser: boolean`
  - Nova função: `checkCouponUsage(prisma, userId, code, context)` → verifica uso prévio
  - Nova função: `recordCouponUsage(tx, userId, code, context, bookingId?, creditId?)` → registra uso
  - Nova função: `createCouponSnapshot(code)` → gera snapshot para auditoria
  - Nova função: `restoreCouponUsage(tx, bookingId?, creditId?)` → restaura cupons reutilizáveis (NÃO PRIMEIRACOMPRA)

### 2.4 Endpoint de Booking
- **src/pages/api/bookings/index.ts**
  - Calcula e persiste `grossAmount`, `discountAmount`, `netAmount`
  - Valida uso de cupom via `checkCouponUsage()` antes de aplicar
  - Registra uso via `recordCouponUsage()` dentro da transação
  - Salva `couponCode` e `couponSnapshot` no booking

### 2.5 Endpoint de Compra de Créditos
- **src/pages/api/credits/purchase.ts**
  - Mesma lógica de auditoria aplicada
  - Valida e registra uso de cupom
  - Persiste campos de auditoria no Credit

### 2.6 Endpoint de Cancelamento Admin
- **src/pages/api/admin/bookings/cancel.ts**
  - Envolvido em `$transaction` para atomicidade
  - Usa `booking.netAmount` (não grossAmount) para calcular reembolso
  - Cria registro `Refund` com UNIQUE(bookingId) para idempotência
  - Verifica existência de Refund prévio antes de processar
  - Registra valores detalhados no log de auditoria

### 2.7 Testes
- **__tests__/coupon-audit-refund.test.ts** (17 testes)
  - Validação básica de cupons
  - Aplicação de descontos
  - Snapshot para auditoria
  - Cálculo correto de gross/discount/net
  - Regra: reembolso = NET + créditos (nunca GROSS)
  - Cenários completos de fluxo

---

## 3. REGRAS DE NEGÓCIO IMPLEMENTADAS

### 3.1 Cupons
| Regra | Implementação |
|-------|---------------|
| PRIMEIRACOMPRA só pode ser usado 1x por usuário | `singleUsePerUser: true` + `checkCouponUsage()` |
| Cupom NÃO volta após cancelamento | `restoreCouponUsage()` ignora cupons com `singleUsePerUser: true` |
| Cupons TESTE50 e ARTHEMI10 são reutilizáveis | `singleUsePerUser: false` |

### 3.2 Auditoria
| Campo | Descrição |
|-------|-----------|
| `grossAmount` | Valor bruto antes de qualquer desconto |
| `discountAmount` | Valor do desconto aplicado pelo cupom |
| `netAmount` | Valor líquido após desconto (= grossAmount - discountAmount) |
| `couponCode` | Código do cupom aplicado (ex: "PRIMEIRACOMPRA") |
| `couponSnapshot` | JSON com detalhes do cupom no momento da aplicação |

### 3.3 Reembolso
| Regra | Implementação |
|-------|---------------|
| Reembolso = NET + créditos usados | `totalRefund = booking.netAmount + booking.creditsUsed` |
| NUNCA devolver GROSS | Código usa `netAmount ?? amountPaid` como fallback |
| Idempotência | UNIQUE(bookingId) na tabela Refund impede duplicatas |
| Atomicidade | Tudo em `$transaction` |

---

## 4. COMO APLICAR A MIGRATION

```bash
# 1. Verificar estado atual
npx prisma migrate status

# 2. Aplicar migration
npx prisma migrate deploy

# 3. Regenerar Prisma Client
npx prisma generate

# 4. Verificar schema
npx prisma validate
```

---

## 5. TESTES

```bash
# Rodar testes específicos
npm test -- --testPathPattern=coupon-audit-refund

# Resultado esperado: 17 passed
```

---

## 6. BACKFILL (Opcional)

Para bookings/credits existentes sem os campos de auditoria:

```sql
-- Bookings antigos: netAmount = amountPaid (sem cupom)
UPDATE bookings 
SET "grossAmount" = "amountPaid", 
    "discountAmount" = 0, 
    "netAmount" = "amountPaid"
WHERE "netAmount" IS NULL AND "amountPaid" > 0;

-- Credits antigos: netAmount = amount (sem cupom)
UPDATE credits 
SET "grossAmount" = "amount", 
    "discountAmount" = 0, 
    "netAmount" = "amount"
WHERE "netAmount" IS NULL AND "amount" > 0;
```

---

## 7. PRÓXIMOS PASSOS (Não inclusos nesta implementação)

1. **Credit Ledger**: Tabela de movimentações para rastreio completo
2. **Auto-cancel scheduler**: Job para cancelar bookings PENDING após 30min
3. **Endpoint de restauração de cupom**: Para casos especiais (decisão do admin)
4. **Dashboard de auditoria**: Visualização de gross/net/discount por período

---

## 8. CONCLUSÃO

Esta implementação resolve os problemas identificados no relatório técnico:

✅ Cupons com rastreamento de uso (anti-fraude)  
✅ Campos de auditoria para análise financeira  
✅ Reembolso sempre baseado em NET (valor real pago)  
✅ Idempotência no cancelamento via Refund record  
✅ Atomicidade com $transaction  
✅ Cupom "burned" após uso (PRIMEIRACOMPRA não volta)
