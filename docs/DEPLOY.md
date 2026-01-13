# Deploy - Arthemi Site

## Arquitetura de Deploy

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│  buildCommand: prisma generate && next build                │
│  (SEM migrate - build não acessa banco)                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│  DATABASE_URL  = pooler (6543) → runtime/serverless         │
│  DIRECT_URL    = direta (5432) → migrações                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Variáveis de Ambiente

### Obrigatórias em Production (Vercel)

| Variável | Porta | Uso | Exemplo |
|----------|-------|-----|---------|
| `DATABASE_URL` | 6543 | Runtime (API routes) | `postgresql://...pooler.supabase.com:6543/postgres` |
| `DIRECT_URL` | 5432 | Migrações (CLI) | `postgresql://...supabase.co:5432/postgres` |

### Como obter no Supabase

1. **Settings** → **Database** → **Connection string**
2. **Session pooling** (6543) → `DATABASE_URL`
3. **Direct connection** (5432) → `DIRECT_URL`

⚠️ **IMPORTANTE**: Migrações (`prisma migrate deploy`) DEVEM usar `DIRECT_URL` (porta 5432). O pooler (6543) não suporta transações longas e causa timeout.

---

## Fluxo de Deploy

### Passo 1: Aplicar Migrações (ANTES do deploy)

```bash
# Definir DIRECT_URL (conexão direta, porta 5432)
export DIRECT_URL="postgresql://postgres.[PROJECT]:[SENHA]@aws-0-sa-east-1.supabase.co:5432/postgres"
export DATABASE_URL="postgresql://postgres.[PROJECT]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Verificar status das migrações
npm run migrate:status

# Aplicar migrações pendentes
npm run migrate:deploy
```

### Passo 2: Deploy (automático via git push)

```bash
git add .
git commit -m "feat: ..."
git push origin main
# Vercel detecta e faz build automaticamente
```

### Passo 3: Validar

```bash
# Testar endpoint
curl -s https://www.arthemisaude.com/api/bookings -X POST -H "Content-Type: application/json" -d "{}"
# Esperado: 400 (validação), NÃO 500
```

---

## Scripts npm

| Script | Comando | Descrição |
|--------|---------|-----------|
| `migrate:deploy` | Valida `DIRECT_URL` + `prisma migrate deploy` | Aplica migrações em produção |
| `migrate:status` | `prisma migrate status` | Verifica migrações pendentes |
| `migrate:prod` | `prisma migrate deploy` (legado) | Sem validação de env |

---

## Opções de Execução de Migrações

### Opção A: Manual Controlada (Recomendado)

1. Desenvolvedor roda `npm run migrate:deploy` localmente com `DIRECT_URL` de produção
2. Confirma que migração aplicou
3. Faz push do código
4. Vercel faz build (sem migrate)

**Vantagens:**
- Controle total
- Rollback fácil
- Não depende de network do Vercel

### Opção B: CI Separado (GitHub Actions)

Criar `.github/workflows/migrate.yml`:

```yaml
name: Apply Migrations
on:
  workflow_dispatch:  # Manual trigger
  push:
    paths:
      - 'prisma/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
```

**Vantagens:**
- Automático quando há nova migração
- Separado do build
- Logs isolados

---

## Troubleshooting

### Build travando no Vercel

**Sintoma:** Build timeout após 45 minutos

**Causa:** `prisma migrate deploy` no `buildCommand` tentando conectar ao banco

**Solução:** Remover `prisma migrate deploy` do `vercel.json` (já feito)

### Erro P1001 / Connection refused

**Causa:** Usando pooler (6543) para migração

**Solução:** Usar `DIRECT_URL` com porta 5432

### Erro "DIRECT_URL não definida"

**Causa:** Variável não configurada

**Solução:** Adicionar `DIRECT_URL` nas env vars da Vercel (Settings → Environment Variables)

---

## Checklist de Deploy

- [ ] Migrações aplicadas (`npm run migrate:status` mostra "up to date")
- [ ] `DIRECT_URL` configurada na Vercel (porta 5432)
- [ ] `DATABASE_URL` configurada na Vercel (porta 6543)
- [ ] Build passou sem timeout
- [ ] Endpoints testados (200/400, não 500)
