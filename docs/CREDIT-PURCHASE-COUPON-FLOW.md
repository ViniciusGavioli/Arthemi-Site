# 🎟️ Fluxo de Compra de Crédito com Cupom

## ✅ VALIDAÇÃO: Sistema está CORRETO

O usuário que compra R$ 100,00 de crédito com cupom de 10%:
- **Paga**: R$ 90,00 (valor com desconto)
- **Recebe**: R$ 100,00 de crédito (valor cheio)

---

## 📊 Fluxo Detalhado

### 1️⃣ Cálculo do Preço do Produto
**Arquivo:** `src/pages/api/credits/purchase.ts`

```typescript
// Linha 172-260: Determina o preço base do produto
let amount: number;

// Exemplo: Pacote de 10 horas = R$ 100,00 (10000 centavos)
amount = 10000; // R$ 100,00
```

### 2️⃣ Guardar Valor Original (grossAmount)
```typescript
// Linha 263: IMPORTANTE - Guarda valor ANTES do cupom
const grossAmount = amount; // 10000 centavos (R$ 100,00)
```

### 3️⃣ Aplicar Cupom (Se fornecido)
```typescript
// Linhas 317-322: Aplica desconto
const discountResult = await applyDiscount(amount, couponKey);
discountAmount = discountResult.discountAmount; // 1000 centavos (R$ 10,00)
amount = discountResult.finalAmount; // 9000 centavos (R$ 90,00)

// IMPORTANTE: 'amount' agora é o valor COM desconto
// 'grossAmount' permanece com o valor ORIGINAL
```

### 4️⃣ Calcular Crédito (Usa grossAmount)
```typescript
// Linhas 390-403: Calcula o crédito baseado no valor ORIGINAL
creditAmount = computeCreditAmountCents({
  amountCents: grossAmount, // ✅ 10000 centavos (R$ 100,00)
  isHoursPurchase: !!data.hours,
  roomId: realRoomId,
  creditHours,
  roomSlug: room.slug,
});

// creditAmount = 10000 (R$ 100,00) - Valor CHEIO sem desconto
```

### 5️⃣ Criar Crédito PENDENTE
```typescript
// Linhas 412-431: Cria crédito no banco
const credit = await tx.credit.create({
  data: {
    userId: userId,
    roomId: realRoomId,
    amount: creditAmount,           // ✅ 10000 centavos (R$ 100,00)
    remainingAmount: 0,             // ⏳ Pendente (será ativado após pagamento)
    status: 'PENDING',
    
    // Auditoria: registra todos os valores
    grossAmount,      // 10000 centavos (valor original)
    discountAmount,   // 1000 centavos (desconto aplicado)
    netAmount,        // 9000 centavos (valor final cobrado)
    couponCode: couponApplied,
  },
});
```

### 6️⃣ Criar Cobrança (Usa netAmount)
```typescript
// Linhas 535-560: Cria cobrança no Asaas
const paymentResult = await createBookingPayment({
  bookingId: credit.id,
  customerName: data.userName,
  customerEmail: data.userEmail,
  customerPhone: data.userPhone,
  customerCpf: data.userCpf,
  value: netAmount, // ✅ 9000 centavos (R$ 90,00) - Valor COM desconto
  description: productName,
  dueDate: undefined,
});

// Cliente paga R$ 90,00 via PIX/Cartão
```

### 7️⃣ Webhook Confirma Pagamento
**Arquivo:** `src/pages/api/webhooks/asaas.ts`

```typescript
// Linhas 844-851: Ativa o crédito após pagamento confirmado
await prisma.credit.update({
  where: { id: creditId },
  data: {
    status: 'CONFIRMED',
    remainingAmount: credit.amount, // ✅ 10000 centavos (R$ 100,00)
    // Libera o valor CHEIO armazenado em 'amount'
  },
});

console.log(`✅ Crédito confirmado: ${creditId} (${credit.amount} centavos liberados)`);
// Log: "Crédito confirmado: xxx (10000 centavos liberados)"
```

---

## 🎯 Resumo do Exemplo

| Etapa | Valor | Descrição |
|-------|-------|-----------|
| **Produto** | R$ 100,00 | Pacote de 10 horas |
| **Cupom** | -10% (R$ 10,00) | Desconto aplicado |
| **Pagamento** | R$ 90,00 | 💰 Valor cobrado do cliente |
| **Crédito recebido** | R$ 100,00 | ✅ Valor disponível para usar |

---

## 🔍 Campos no Banco de Dados

```sql
-- Tabela: Credit
{
  id: "credit_xyz",
  userId: "user_123",
  amount: 10000,           -- ✅ R$ 100,00 (valor cheio)
  remainingAmount: 10000,  -- ✅ R$ 100,00 (disponível para uso)
  grossAmount: 10000,      -- R$ 100,00 (auditoria: valor original)
  discountAmount: 1000,    -- R$ 10,00 (auditoria: desconto)
  netAmount: 9000,         -- R$ 90,00 (auditoria: valor pago)
  couponCode: "PRIMEIRACOMPRA",
  status: "CONFIRMED"
}
```

---

## ✅ Validação do Sistema

### O que está CORRETO:

1. ✅ **Cupom reduz o pagamento, não o crédito**
   - Cliente paga menos (netAmount)
   - Cliente recebe crédito cheio (grossAmount)

2. ✅ **Auditoria completa**
   - `grossAmount`: valor original do produto
   - `discountAmount`: desconto aplicado
   - `netAmount`: valor efetivamente cobrado
   - `amount`: crédito disponível para uso

3. ✅ **Separação clara de responsabilidades**
   - `amount` (Credit): quanto o cliente pode USAR
   - `netAmount`: quanto o cliente PAGOU

4. ✅ **Webhook correto**
   - Ativa o crédito com valor cheio
   - Log mostra valor correto liberado

---

## 🧪 Teste Recomendado

Para validar em produção/staging:

```bash
# 1. Criar cupom de teste (se não existir)
# Cupom: TESTE10 (10% desconto)

# 2. Comprar crédito de R$ 100,00 com cupom
POST /api/credits/purchase
{
  "hours": 10,
  "couponCode": "TESTE10",
  "paymentMethod": "PIX"
}

# 3. Verificar no banco:
# - Payment.value deve ser 90.00 (reais)
# - Credit.amount deve ser 10000 (centavos = R$ 100)
# - Credit.netAmount deve ser 9000 (centavos = R$ 90)
# - Credit.grossAmount deve ser 10000 (centavos = R$ 100)

# 4. Confirmar pagamento via webhook
# - Credit.remainingAmount deve virar 10000 (R$ 100)
# - Status deve mudar para CONFIRMED

# 5. Cliente deve poder reservar R$ 100,00 de serviços
```

---

## 📝 Conclusão

✅ **Sistema está funcionando CORRETAMENTE**

O fluxo de cupom está implementado da forma ideal:
- Cliente recebe incentivo financeiro (paga menos)
- Cliente recebe valor cheio de crédito
- Sistema mantém auditoria completa para análise
- Cupons são ferramentas de marketing eficazes

**Nenhuma correção necessária!** 🎉
