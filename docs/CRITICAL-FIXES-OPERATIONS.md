# Operação & Manutenção — Fixes Críticos (Cupons, Bookings PENDING, Asaas)

Este documento descreve as regras operacionais e os pontos de manutenção adicionados nos fixes críticos:
1) **Cupons** (idempotência/concorrência)
2) **Bookings PENDING** (expiração + cleanup)
3) **Asaas** (mínimo por método + normalização de erro)

---

## 1) Cupons — Idempotência e Concorrência

### Objetivo
Evitar race condition e impedir que um uso de cupom sobrescreva outro (ex.: `bookingId` trocando em concorrência).

### Implementação
- O registro de uso de cupom segue padrão **claim-or-create**:
  - **Claim**: tenta reaproveitar registro existente com `status = RESTORED` via `updateMany` (condicional por estado).
  - **Create**: se não houver `RESTORED`, tenta `create`.
  - **P2002**: se `create` der conflito (unique), faz read do registro existente e retorna **`COUPON_ALREADY_USED`** quando apropriado.
- Regra inviolável:
  - **Nunca** atualizar `bookingId` de um registro com `status = USED`.

### Retornos esperados (contrato)
- Sucesso: `{ ok: true, mode: 'CLAIMED_RESTORED' | 'CREATED' | 'CLAIMED_AFTER_RACE' }`
- Conflito: `{ ok: false, code: 'COUPON_ALREADY_USED', existingBookingId?: string | null }`
- Estado inválido: `{ ok: false, code: 'COUPON_INVALID_STATE' }`

### Observabilidade
- Erros devem ser logados sem PII (sem CPF/telefone/email).
- Se for necessário diagnóstico, usar `existingBookingId` (não dados pessoais do usuário).

---

## 2) Bookings PENDING — Expiração + Cleanup (Cron)

### Problema que resolve
Booking pode ficar `PENDING` indefinidamente (pagamento falhou/abandono) e "prender" cupom como `USED`.

### Como funciona
- Ao criar booking `PENDING`:
  - é setado `expiresAt = now + PENDING_BOOKING_EXPIRATION_HOURS`
- Um cron executa periodicamente:
  - cancela bookings PENDING expirados
  - restaura cupom associado (somente se estiver realmente vinculado ao booking)

### Constante de expiração
- `PENDING_BOOKING_EXPIRATION_HOURS` (default: **24h**)

### Cancelamento por expiração
- O booking é marcado como `status = CANCELLED`
- O campo `cancelReason` é preenchido:
  - `cancelReason = 'EXPIRED_NO_PAYMENT'`
- O cron deve processar apenas bookings com:
  - `status = PENDING`
  - `expiresAt < now`
  - `cancelReason = null` (idempotência / evita reprocessar)

### Endpoint do cron
- Rota: `/api/cron/cleanup-pending-bookings`
- Segurança: exige header
  - `Authorization: Bearer <CRON_SECRET>`
- Sem secret: retorna **401**.

### Agendamento (Vercel)
- Cron configurado em `vercel.json` para rodar **a cada 1 hora**.

### Regra de restauração de cupom
- Restaurar cupom **somente** quando:
  - `couponUsage.status = USED`
  - e `couponUsage.bookingId === booking.id`
- Não usar OR genérico que possa restaurar cupom errado.

---

## 3) Asaas — Mínimo por Método + Normalização de Erros

### Objetivo
- Bloquear pedidos abaixo do mínimo (preventivo).
- Se o Asaas rejeitar mesmo assim, retornar erro padronizado e observável.

### Mínimos configuráveis (em centavos)
Defaults sugeridos:
- `MIN_PAYMENT_PIX_CENTS = 100` (R$ 1,00)
- `MIN_PAYMENT_CARD_CENTS = 500` (R$ 5,00)
- `MIN_PAYMENT_BOLETO_CENTS = 500` (R$ 5,00)

Os mínimos são obtidos por `getMinPaymentAmountCents(paymentMethod)`.

### ENV Vars (opcionais)
```env
MIN_PAYMENT_PIX_CENTS=100
MIN_PAYMENT_CARD_CENTS=500
MIN_PAYMENT_BOLETO_CENTS=500
CRON_SECRET=<seu-secret-para-cron>
```

### Função `normalizeAsaasError(rawError)`
- Detecta padrões específicos na resposta do Asaas.
- Retorna erro tipado:
  - `PAYMENT_BELOW_MINIMUM`
  - `INVALID_CUSTOMER`
  - `INVALID_CARD`
  - etc.
- Loga o erro bruto (`rawError`) para diagnóstico (sem PII do usuário).

### Integração
- Antes de chamar Asaas, validar valor mínimo.
- Se Asaas rejeitar mesmo assim, usar `normalizeAsaasError` para erro amigável.

---

## 4) Checklist de Deploy

### Pré-requisitos
- [ ] Rodar migration: `npx prisma migrate dev` (adiciona `expiresAt` ao Booking)
- [ ] Definir `CRON_SECRET` nas env vars da Vercel
- [ ] (Opcional) Ajustar mínimos via env vars se necessário

### Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Campo `expiresAt` + índice |
| `src/lib/coupons.ts` | Padrão claim-or-create + `restoreCouponUsage` específico |
| `src/lib/asaas.ts` | `normalizeAsaasError()` |
| `src/lib/business-rules.ts` | Constantes de mínimo + expiração |
| `src/lib/audit.ts` | Action `BOOKING_CANCELLED_EXPIRED` |
| `src/pages/api/cron/cleanup-pending-bookings.ts` | **NOVO** — endpoint do cron |
| `src/pages/api/bookings/index.ts` | Seta `expiresAt`, valida mínimo |
| `src/pages/api/bookings/create-with-credit.ts` | Seta `expiresAt` |
| `src/pages/api/credits/purchase.ts` | Valida mínimo |
| `vercel.json` | Agendamento do cron (1h) |

### Testes
- Suite: `__tests__/critical-fixes.test.ts` (46 testes)
- Rodar: `npx jest __tests__/critical-fixes.test.ts --no-coverage`

---

## 5) Troubleshooting

### Cupom aparece como "já usado" mas booking não existe
1. Verificar `CouponUsage` no banco:
   ```sql
   SELECT * FROM "CouponUsage" WHERE "couponCode" = 'XXX' AND "userId" = 'YYY';
   ```
2. Se `status = USED` e `bookingId` aponta para booking cancelado/inexistente:
   - O cron deveria ter restaurado. Verificar logs do cron.
   - Pode restaurar manualmente: `UPDATE "CouponUsage" SET status = 'RESTORED', "bookingId" = NULL WHERE id = '...';`

### Cron não está rodando
1. Verificar `vercel.json` tem a entrada de cron.
2. Verificar `CRON_SECRET` está definido.
3. Testar manualmente:
   ```bash
   curl -X POST https://seu-site.vercel.app/api/cron/cleanup-pending-bookings \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

### Pagamento rejeitado por valor mínimo
1. Verificar qual método de pagamento foi usado.
2. Verificar o mínimo configurado para aquele método.
3. Se erro veio do Asaas (não da validação local), verificar logs para o erro bruto.

---

## 6) Contato / Escalação

Para dúvidas sobre a implementação, consultar:
- Este documento
- Código-fonte nos arquivos listados
- Suite de testes para exemplos de uso
