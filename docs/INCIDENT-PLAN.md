# 🚨 Plano de Incidentes - Espaço Arthemi

Este documento descreve os procedimentos a seguir em caso de falhas nos principais sistemas.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Acesso Rápido](#acesso-rápido)
3. [Falha de Pagamento (Asaas)](#falha-de-pagamento-asaas)
4. [Falha de Webhook](#falha-de-webhook)
5. [Falha de Email (Resend)](#falha-de-email-resend)
6. [Falha de Banco de Dados](#falha-de-banco-de-dados)
7. [Modo Manutenção](#modo-manutenção)
8. [Contatos de Emergência](#contatos-de-emergência)

---

## Visão Geral

### Níveis de Severidade

| Nível | Descrição | Tempo de Resposta | Exemplo |
|-------|-----------|-------------------|---------|
| 🔴 P0 | Sistema totalmente indisponível | 15 min | Site fora, BD down |
| 🟠 P1 | Funcionalidade crítica quebrada | 1 hora | Pagamentos não funcionam |
| 🟡 P2 | Funcionalidade degradada | 4 horas | Emails atrasados |
| 🟢 P3 | Problema menor | 24 horas | Relatório com erro visual |

### Checklist Inicial (Qualquer Incidente)

1. **Verificar Status**: Acessar `/admin/status`
2. **Identificar Escopo**: Quantos usuários afetados?
3. **Comunicar**: Ativar modo manutenção se necessário
4. **Documentar**: Anotar horário, sintomas, ações

---

## Acesso Rápido

| Sistema | URL/Acesso | Credenciais |
|---------|------------|-------------|
| Admin Panel | `/admin/dashboard` | Ver .env `ADMIN_PASSWORD` |
| Status do Sistema | `/admin/status` | Admin auth |
| Asaas Dashboard | https://www.asaas.com | Conta Arthemi |
| Vercel | https://vercel.com/dashboard | Conta Arthemi |
| Resend | https://resend.com/dashboard | Conta Arthemi |

---

## Falha de Pagamento (Asaas)

### Sintomas
- Usuários não conseguem completar pagamento
- Erro "Falha ao criar pagamento" no checkout
- Status `PAYMENT` degradado em `/admin/status`

### Diagnóstico Rápido
```bash
# Verificar logs do servidor (Vercel)
# Buscar erros com "PAYMENT" ou "Asaas"

# Testar API Asaas diretamente
curl -X GET "https://api.asaas.com/v3/customers" \
  -H "access_token: $ASAAS_API_KEY"
```

### Ações Imediatas

1. **Ativar Flag de Contingência**
   - Acessar `/admin/status`
   - Ativar `DISABLE_PAYMENTS`
   - Isso exibe mensagem amigável para usuários

2. **Verificar Asaas**
   - Acessar [status.asaas.com](https://status.asaas.com)
   - Verificar se há incidente em andamento

3. **Se Asaas OK, verificar credenciais**
   - Confirmar `ASAAS_API_KEY` no Vercel
   - Verificar se token não expirou

### Procedimento de Recuperação

1. Desativar flag `DISABLE_PAYMENTS`
2. Processar manualmente reservas pendentes:
   - Acessar `/admin/reservas?status=PENDING`
   - Contatar clientes via WhatsApp
   - Gerar novo link de pagamento se necessário

---

## Falha de Webhook

### Sintomas
- Pagamentos confirmados no Asaas mas reserva em PENDING
- Status da reserva não atualiza automaticamente
- Status `WEBHOOK` degradado em `/admin/status`

### Diagnóstico Rápido
```bash
# Verificar últimos webhooks recebidos no banco
# Acessar /admin/auditoria e filtrar por "webhook"
```

### Ações Imediatas

1. **NÃO desativar webhooks** (eles acumulam na fila do Asaas)

2. **Verificar configuração no Asaas**
   - Acessar Asaas > Integrações > Webhooks
   - Confirmar URL: `https://espacoarthemi.com.br/api/webhooks/asaas`
   - Verificar histórico de entregas

3. **Se URL correta, verificar servidor**
   - Logs do Vercel
   - Erro 500? Verificar código
   - Timeout? Verificar tempo de resposta

### Procedimento de Recuperação

1. **Reprocessar webhooks manualmente**:
   - No Asaas, reenviar webhooks falhados
   - Ou sincronizar status manualmente em `/admin/reservas`

2. **Atualizar reservas pendentes**:
   - Para cada reserva PENDING com pagamento confirmado no Asaas:
   - Usar "Confirmar Pagamento" em `/admin/reservas/[id]`

---

## Falha de Email (Resend)

### Sintomas
- Confirmações de reserva não chegam
- Magic links não são enviados
- Status `EMAIL` degradado em `/admin/status`

### Diagnóstico Rápido
- Verificar [status.resend.com](https://resend.com/status)
- Verificar logs no dashboard Resend

### Ações Imediatas

1. **Comunicar via WhatsApp**
   - Para reservas confirmadas, enviar detalhes via WhatsApp
   - Número disponível na ficha do cliente

2. **Ativar Flag de Contingência** (opcional)
   - `DISABLE_EMAILS` só se necessário evitar erros no log
   - Sistema continua funcionando sem emails

### Procedimento de Recuperação

1. Quando Resend voltar, emails não são reenviados automaticamente
2. Para magic links:
   - Usuário pode solicitar novo link
3. Para confirmações:
   - Acessar `/admin/reservas`
   - Usar ação "Reenviar Confirmação"

---

## Falha de Banco de Dados

### Sintomas
- Site completamente fora do ar
- Erros 500 em todas as páginas
- Status `DATABASE` down em `/admin/status` (se acessível)

### Este é um incidente P0!

### Ações Imediatas

1. **Verificar Vercel**
   - Dashboard > Functions > Logs
   - Buscar erros de conexão Prisma/PostgreSQL

2. **Verificar provedor de BD**
   - Se Neon: [status.neon.tech](https://status.neon.tech)
   - Se Supabase: [status.supabase.com](https://status.supabase.com)

3. **Verificar variáveis de ambiente**
   - `DATABASE_URL` no Vercel
   - `DIRECT_URL` se usando pooling

### Procedimento de Recuperação

1. **Restaurar conexão**
   - Se senha/URL mudou, atualizar no Vercel
   - Redeployar para aplicar

2. **Verificar dados**
   - Após retorno, verificar reservas do período
   - Conferir se webhooks foram recebidos
   - Sincronizar status com Asaas se necessário

---

## Modo Manutenção

### Quando Ativar
- Deploy com breaking changes
- Manutenção programada
- Incidente P0 em andamento

### Como Ativar

1. Acessar `/admin/status`
2. Ativar `MAINTENANCE_MODE`
3. Verificar que páginas públicas exibem mensagem

### O que acontece
- Usuários veem "Sistema em manutenção"
- APIs retornam erro 503
- Admin continua acessível

### Como Desativar

1. Testar sistema internamente
2. Desativar `MAINTENANCE_MODE` em `/admin/status`
3. Verificar que páginas voltaram ao normal

---

## Contatos de Emergência

| Quem | Quando Acionar | Contato |
|------|----------------|---------|
| Desenvolvedor | Qualquer P0/P1 | [seu telefone] |
| Suporte Asaas | Falha de pagamento | Via painel Asaas |
| Suporte Vercel | Deploy/hosting | Via painel Vercel |
| Suporte Resend | Falha de email | Via painel Resend |

---

## 📝 Log de Incidentes

### Template

```
Data: YYYY-MM-DD HH:MM
Severidade: P0/P1/P2/P3
Sintoma: [Descrição do problema]
Impacto: [Quantos usuários/reservas afetados]
Causa: [O que causou o problema]
Resolução: [O que foi feito para resolver]
Tempo de indisponibilidade: [X horas/minutos]
Ações preventivas: [O que fazer para evitar no futuro]
```

### Histórico

<!-- Adicionar incidentes aqui -->
| Data | Severidade | Descrição | Tempo Down |
|------|------------|-----------|------------|
| - | - | Nenhum incidente registrado | - |

---

*Documento atualizado em: 27/12/2024*
*Versão: 1.0*
