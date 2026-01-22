# IMPLEMENTAÇÃO: Comunicação Institucional Padronizada

## Data: 11 de janeiro de 2026
## Status: ✅ IMPLEMENTADO

---

## 1. ARQUIVOS CRIADOS/MODIFICADOS

### 1.1 Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/policies.ts` | **Fonte única de verdade** - Textos centralizados para toda a comunicação |
| `src/lib/email-templates.ts` | Templates HTML de emails transacionais |
| `src/components/PaymentSummary.tsx` | Componentes reutilizáveis de UI |
| `src/pages/politica-cancelamento.tsx` | Página pública da política oficial |

### 1.2 Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/booking/[id].tsx` | Usa `MICROCOPY` para textos institucionais |
| `src/pages/admin/estornos.tsx` | Usa `ADMIN_COPY` para textos do painel |

---

## 2. ESTRUTURA DA LIB/POLICIES.TS

```typescript
// Constantes de negócio
POLICY_CONSTANTS = {
  MIN_CANCELLATION_HOURS: 48,
  CREDIT_VALIDITY_MONTHS: 6,
  WHATSAPP_SUPPORT: '(31) 9992-3910',
  EMAIL_SUPPORT: 'contato@arthemi.com.br',
}

// Política oficial (documento canônico)
OFFICIAL_POLICY = {
  title: 'Política de Cancelamento, Reembolso e Cupons',
  sections: {
    cancellation: { title, content },
    refund: { title, content },
    coupons: { title, content },
    partialRefunds: { title, content },
    transparency: { title, content },
  },
  summary: '...',
}

// Microcopy para frontend
MICROCOPY = {
  cancellation: { ... },      // Modal de cancelamento
  paymentSummary: { ... },    // Labels de resumo de pagamento
  myBookings: { ... },        // Página minhas reservas
  bookingDetails: { ... },    // Página de detalhes
  checkout: { ... },          // Checkout
}

// Templates de email
EMAIL_TEMPLATES = {
  bookingConfirmation: { ... },
  cancellationCredit: { ... },
  cancellationRefund: { ... },
  partialRefundReview: { ... },
}

// Textos para admin
ADMIN_COPY = {
  partialRefunds: { ... },
  refundRequests: { ... },
  adminCancellation: { ... },
}
```

---

## 3. TEXTOS INSTITUCIONAIS IMPLEMENTADOS

### 3.1 Política de Cancelamento

```
Para garantir a melhor organização dos atendimentos e disponibilidade dos espaços, 
solicitamos que cancelamentos sejam realizados com no mínimo 48 horas de antecedência 
do horário agendado.

Cancelamentos dentro do prazo:
• Elegíveis para reembolso integral do valor efetivamente pago
• Processamento em até 5 dias úteis

Cancelamentos fora do prazo (menos de 48 horas):
• Não elegíveis para reembolso
• Exceções podem ser analisadas em casos excepcionais mediante contato com nossa equipe
```

### 3.2 Política de Reembolso

```
O valor do reembolso corresponde sempre ao montante efetivamente pago no momento 
da reserva, após aplicação de eventuais descontos ou cupons promocionais.

Formas de reembolso:
• Créditos para uso futuro (disponíveis imediatamente)
• Estorno financeiro via PIX (processamento em até 5 dias úteis)

Importante: O reembolso nunca excederá o valor líquido pago. Caso a reserva 
tenha utilizado cupom promocional, o desconto obtido não será creditado.
```

### 3.3 Política de Cupons

```
Cupons promocionais são benefícios de uso único, válidos exclusivamente para 
a transação em que foram aplicados.

Regras:
• Cupons promocionais NÃO são restaurados após cancelamento
• O desconto obtido não é convertido em crédito ou reembolso
• Cupons com restrição de uso único não podem ser reutilizados

Esta política visa garantir a sustentabilidade das promoções e o tratamento 
equitativo de todos os clientes.
```

---

## 4. COMPONENTES DE UI

### 4.1 PaymentSummary

```tsx
<PaymentSummary
  grossAmount={10000}
  discountAmount={1500}
  netAmount={8500}
  couponCode="PRIMEIRACOMPRA"
  variant="paid"
  showDiscountTooltip
/>
```

Renderiza:
```
Subtotal           R$ 100,00
Cupom PRIMEIRACOMPRA  -R$ 15,00
─────────────────────────────
Valor pago         R$ 85,00
```

### 4.2 RefundPolicyNotice

```tsx
<RefundPolicyNotice variant="info" size="md" />
```

Renderiza:
```
ℹ️ Política de Cancelamento
Reembolso é do valor efetivamente pago. 
Cupons promocionais não são restaurados.
```

### 4.3 CouponWarning

```tsx
<CouponWarning couponCode="PRIMEIRACOMPRA" />
```

Renderiza:
```
⚠️ Atenção
Esta reserva utilizou o cupom PRIMEIRACOMPRA. 
O desconto aplicado não será creditado em caso de cancelamento.
```

---

## 5. TEMPLATES DE EMAIL

### 5.1 Confirmação de Reserva

```typescript
import { generateBookingConfirmationEmail } from '@/lib/email-templates';

const { subject, html } = generateBookingConfirmationEmail({
  userName: 'João Silva',
  roomName: 'Sala Jade',
  startTime: new Date('2026-01-15T10:00:00'),
  endTime: new Date('2026-01-15T12:00:00'),
  grossAmount: 10000,
  discountAmount: 1500,
  netAmount: 8500,
  couponCode: 'PRIMEIRACOMPRA',
  bookingId: 'abc123',
});
```

### 5.2 Cancelamento com Crédito

```typescript
import { generateCancellationCreditEmail } from '@/lib/email-templates';

const { subject, html } = generateCancellationCreditEmail({
  userName: 'João Silva',
  roomName: 'Sala Jade',
  bookingDate: new Date('2026-01-15'),
  creditAmount: 8500,
  creditExpiresAt: new Date('2026-07-15'),
  bookingId: 'abc123',
  hadCoupon: true,
});
```

### 5.3 Cancelamento com Estorno

```typescript
import { generateCancellationRefundEmail } from '@/lib/email-templates';

const { subject, html } = generateCancellationRefundEmail({
  userName: 'João Silva',
  roomName: 'Sala Jade',
  bookingDate: new Date('2026-01-15'),
  refundAmount: 8500,
  bookingId: 'abc123',
  hadCoupon: true,
});
```

---

## 6. PÁGINA PÚBLICA DE POLÍTICA

- **URL**: `/politica-cancelamento`
- **SEO**: Título e meta description configurados
- **Conteúdo**: Renderiza `OFFICIAL_POLICY` em formato de página
- **Links**: WhatsApp e email de suporte

---

## 7. PAINEL ADMIN

### 7.1 Seção de Refunds Parciais

Textos atualizados para usar `ADMIN_COPY.partialRefunds`:

- **Título**: "Reembolsos Pendentes de Revisão"
- **Descrição**: Explica por que refunds estão pendentes
- **Ações recomendadas**: Checklist para equipe administrativa

---

## 8. REGRAS DE CONSISTÊNCIA

### 8.1 Termos Padronizados

| Termo | Uso |
|-------|-----|
| "valor efetivamente pago" | Sempre ao falar de reembolso |
| "cupons promocionais não são restaurados" | Obrigatório em contexto de cancelamento |
| "48 horas de antecedência" | Prazo para elegibilidade |
| "até 5 dias úteis" | Prazo para estorno financeiro |

### 8.2 Tom de Voz

- ✅ Profissional e institucional
- ✅ Claro e objetivo
- ✅ Empático sem ser informal
- ❌ Sem juridiquês excessivo
- ❌ Sem tom comercial agressivo

---

## 9. COMO USAR

### 9.1 Em Componentes React

```tsx
import { MICROCOPY, POLICY_CONSTANTS, formatCurrency } from '@/lib/policies';

// Usar textos
<p>{MICROCOPY.bookingDetails.refundPolicyText}</p>

// Usar constantes
<p>Cancelamentos com {POLICY_CONSTANTS.MIN_CANCELLATION_HOURS}h+ de antecedência...</p>

// Formatar valores
<span>{formatCurrency(8500)}</span> // R$ 85,00
```

### 9.2 Em APIs

```typescript
import { ADMIN_COPY, EMAIL_TEMPLATES } from '@/lib/policies';

// Mensagem para log
console.log(ADMIN_COPY.adminCancellation.confirmationMessage('CREDITS', 'R$ 85,00'));

// Template de email
const template = EMAIL_TEMPLATES.cancellationCredit;
```

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Criar lib/policies.ts com textos centralizados
- [x] Criar lib/email-templates.ts com templates HTML
- [x] Criar componentes reutilizáveis (PaymentSummary)
- [x] Criar página /politica-cancelamento
- [x] Atualizar booking/[id].tsx para usar MICROCOPY
- [x] Atualizar admin/estornos.tsx para usar ADMIN_COPY
- [x] Verificar compilação TypeScript (sem erros)

---

## 11. PRÓXIMOS PASSOS (NÃO INCLUSOS)

1. Integrar templates de email com sistema de envio existente
2. Adicionar link para /politica-cancelamento no footer do site
3. Adicionar checkbox de aceite de política no checkout
4. Traduzir para inglês (se necessário)
