# 🚀 Manual de Operações - Espaço Arthemi

**Versão**: 1.0.0  
**Data de Go-Live**: 27 de Dezembro de 2024  
**Commit de Referência**: `3f107c3`  
**Branch Estável**: `main`

---

## 📋 Índice

1. [Informações do Sistema](#informações-do-sistema)
2. [Acesso ao Painel Admin](#acesso-ao-painel-admin)
3. [Flags de Contingência](#flags-de-contingência)
4. [Procedimentos de Incidente](#procedimentos-de-incidente)
5. [Rotina de Verificação Semanal](#rotina-de-verificação-semanal)
6. [Rotina de Verificação Mensal](#rotina-de-verificação-mensal)
7. [Critérios para Novas Mudanças](#critérios-para-novas-mudanças)
8. [Contatos e Links Úteis](#contatos-e-links-úteis)

---

## Informações do Sistema

### Stack Tecnológico

| Componente | Tecnologia | Propósito |
|------------|------------|-----------|
| Frontend | Next.js 14.2 (Pages Router) | Aplicação web |
| Backend | Next.js API Routes | APIs REST |
| Banco de Dados | PostgreSQL | Persistência |
| ORM | Prisma 5.22 | Acesso ao banco |
| Pagamentos | Asaas | Processamento PIX |
| Emails | Resend | Transacionais |
| Analytics | Plausible | Métricas (privacy-first) |
| Marketing | Meta Pixel | Conversões (opcional) |
| Hosting | Vercel | Deploy automático |

### URLs de Produção

| Ambiente | URL |
|----------|-----|
| Site Público | https://www.arthemisaude.com |
| Admin | https://www.arthemisaude.com/admin |
| Status | https://www.arthemisaude.com/admin/status |

---

## Acesso ao Painel Admin

### Login

1. Acesse `/admin/login`
2. Digite a senha configurada em `ADMIN_PASSWORD`
3. Clique em "Entrar"

### Páginas Disponíveis

| Página | URL | Função |
|--------|-----|--------|
| Dashboard | `/admin/dashboard` | Visão geral |
| Reservas | `/admin/reservas` | Gerenciar reservas |
| Clientes | `/admin/clientes` | Gerenciar clientes |
| Nova Reserva | `/admin/nova-reserva` | Criar reserva manual |
| Auditoria | `/admin/auditoria` | Logs de ações |
| Marketing | `/admin/marketing` | Configurar analytics |
| Status | `/admin/status` | Saúde do sistema |

### Ações Comuns

**Confirmar pagamento manual**:
1. Acessar `/admin/reservas`
2. Clicar na reserva pendente
3. Usar "Confirmar Pagamento"

**Cancelar reserva**:
1. Acessar `/admin/reservas`
2. Clicar na reserva
3. Usar "Cancelar Reserva"

**Ver detalhes do cliente**:
1. Acessar `/admin/clientes`
2. Clicar no cliente
3. Ver histórico de reservas e créditos

---

## Flags de Contingência

### O que são

Flags de contingência permitem desativar funcionalidades rapidamente em caso de problemas, sem deploy.

### Como acessar

1. Acessar `/admin/status`
2. Localizar seção "⚡ Flags de Contingência"
3. Usar os toggles para ativar/desativar

### Flags Disponíveis

| Flag | Efeito quando ATIVA |
|------|---------------------|
| `MAINTENANCE_MODE` | Bloqueia todo o sistema para usuários |
| `DISABLE_PAYMENTS` | Impede criação de novos pagamentos |
| `DISABLE_BOOKINGS` | Impede novas reservas |
| `DISABLE_EMAILS` | Para envio de emails |
| `DISABLE_WEBHOOKS` | Ignora webhooks do Asaas |

### Quando usar

| Situação | Flag a ativar |
|----------|---------------|
| Deploy com breaking change | `MAINTENANCE_MODE` |
| Asaas fora do ar | `DISABLE_PAYMENTS` |
| Resend fora do ar | `DISABLE_EMAILS` |
| Problema no webhook | `DISABLE_WEBHOOKS` |
| Muitas reservas falsas | `DISABLE_BOOKINGS` |

### ⚠️ IMPORTANTE

- Lembre-se de **desativar** as flags após resolver o problema
- Flags têm cache de 30 segundos (pode demorar para efetivar)
- Admin sempre funciona, mesmo com `MAINTENANCE_MODE`

---

## Procedimentos de Incidente

### Classificação de Severidade

| Nível | Descrição | Tempo de Resposta |
|-------|-----------|-------------------|
| 🔴 P0 | Sistema totalmente fora | 15 minutos |
| 🟠 P1 | Pagamentos/reservas quebrados | 1 hora |
| 🟡 P2 | Funcionalidade degradada | 4 horas |
| 🟢 P3 | Problema menor | 24 horas |

### Fluxo de Resposta

```
1. IDENTIFICAR
   └─> Acessar /admin/status
   └─> Verificar qual serviço está com problema

2. MITIGAR
   └─> Ativar flag de contingência apropriada
   └─> Comunicar usuários se necessário

3. DIAGNOSTICAR
   └─> Verificar logs no Vercel
   └─> Consultar status dos serviços externos

4. RESOLVER
   └─> Aplicar correção (se possível sem deploy)
   └─> Ou aguardar serviço externo voltar

5. NORMALIZAR
   └─> Desativar flags de contingência
   └─> Verificar métricas voltaram ao normal

6. DOCUMENTAR
   └─> Registrar incidente em INCIDENT-PLAN.md
```

### Documento Detalhado

Consulte [docs/INCIDENT-PLAN.md](./INCIDENT-PLAN.md) para procedimentos específicos por tipo de falha.

---

## Rotina de Verificação Semanal

### Checklist (toda segunda-feira)

```
[ ] 1. Acessar /admin/status
    - Todos os serviços verdes?
    - Alguma flag ativa por engano?

[ ] 2. Verificar métricas
    - Quantas reservas na semana?
    - Taxa de sucesso de pagamento?
    - Algum erro recorrente?

[ ] 3. Revisar /admin/auditoria
    - Atividades suspeitas?
    - Muitos logins falhados?

[ ] 4. Checar Plausible
    - Tráfego normal?
    - Conversões?

[ ] 5. Verificar email de suporte
    - Reclamações de usuários?
    - Problemas reportados?
```

### Tempo estimado: 15 minutos

---

## Rotina de Verificação Mensal

### Checklist (primeiro dia útil do mês)

```
SEGURANÇA
[ ] Verificar rate limits funcionando
[ ] Revisar logs de login admin
[ ] Confirmar que dados sensíveis não estão expostos

DADOS
[ ] Verificar backups do banco (provedor)
[ ] Validar integridade dos dados
[ ] Limpar dados de teste (se houver)

CONFIGURAÇÕES
[ ] Revisar variáveis de ambiente
[ ] Validar chaves de API (não expiradas)
[ ] Verificar domínio/SSL

PERFORMANCE
[ ] Verificar tempo de resposta das APIs
[ ] Revisar métricas de Core Web Vitals
[ ] Checar uso de recursos (Vercel)

MARKETING
[ ] Validar Meta Pixel no Events Manager
[ ] Verificar dados no Plausible
[ ] Conferir conversões estão sendo rastreadas
```

### Tempo estimado: 30 minutos

---

## Critérios para Novas Mudanças

### 🛑 REGRA FUNDAMENTAL

> **Sem nova fase, não há mudança.**

O pipeline ARTHEMI está encerrado. Qualquer alteração no sistema requer abertura formal de nova fase.

### Processo para Solicitar Mudança

1. **Criar nova fase numerada**
   - Ex: FASE 4.1 (Otimização de Performance)
   - Ex: FASE 4.2 (Nova Funcionalidade X)

2. **Definir escopo isolado**
   - O que será alterado
   - O que NÃO será alterado
   - Arquivos afetados

3. **Avaliar risco**
   - Impacto em funcionalidades existentes
   - Necessidade de rollback
   - Tempo de indisponibilidade

4. **Prompt formal**
   - Descrição clara da tarefa
   - Regras e restrições
   - Critérios de sucesso

### Exceções (sem nova fase)

- Correção de bug crítico P0/P1 em produção
- Atualização de segurança urgente
- Rollback para versão anterior

Mesmo nestes casos, documentar ação tomada.

---

## Contatos e Links Úteis

### Dashboards

| Serviço | URL | Login |
|---------|-----|-------|
| Vercel | https://vercel.com/dashboard | Conta Arthemi |
| Asaas | https://www.asaas.com | Conta Arthemi |
| Resend | https://resend.com/dashboard | Conta Arthemi |
| Plausible | https://plausible.io | Conta Arthemi |
| GitHub | https://github.com/ViniciusGavioli/Arthemi-Site | Conta Vinícius |

### Status Pages

| Serviço | Status URL |
|---------|------------|
| Asaas | https://status.asaas.com |
| Vercel | https://www.vercel-status.com |
| Resend | https://resend.com/status |

### Documentação

| Documento | Caminho | Conteúdo |
|-----------|---------|----------|
| Plano de Incidentes | `/docs/INCIDENT-PLAN.md` | Procedimentos emergenciais |
| Auditoria de Produção | `/docs/PRODUCTION-AUDIT.md` | Status pós go-live |
| Este manual | `/docs/README-OPERATIONS.md` | Operações do dia-a-dia |

---

## 📜 Histórico de Versões

| Versão | Data | Commit | Descrição |
|--------|------|--------|-----------|
| 1.0.0 | 27/12/2024 | `3f107c3` | Go-live inicial |

---

## 🏁 Status do Pipeline

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎉 PIPELINE ARTHEMI ENCERRADO COM SUCESSO 🎉            ║
║                                                           ║
║   Data: 27 de Dezembro de 2024                            ║
║   Versão: 1.0.0                                           ║
║   Status: OPERACIONAL                                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

*Documento criado durante FASE 4.0 - Encerramento do Pipeline*
*Próxima revisão: Quando houver nova fase*
