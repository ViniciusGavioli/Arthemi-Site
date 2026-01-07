# ═══════════════════════════════════════════════════════════════════════════
# HOTFIX: Correção de Preços em Produção - ARTHEMI-PIPELINE
# ═══════════════════════════════════════════════════════════════════════════
# Bug: seed.js gravava PRICES_V3 (REAIS) como Int → preços 100x menores
# Fix: Scripts idempotentes que detectam e corrigem apenas valores errados
# ═══════════════════════════════════════════════════════════════════════════

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  A) CHECKLIST PRÉ-EXECUÇÃO                                                 ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# [ ] 1. Acesso SSH ao servidor de produção
# [ ] 2. Acesso ao banco de dados (Prisma configurado)
# [ ] 3. Backup do banco ANTES de qualquer alteração
# [ ] 4. Horário de baixo tráfego (sugestão: 6h-8h ou 22h-00h)
# [ ] 5. Canal de comunicação aberto (Slack/WhatsApp) para rollback
# [ ] 6. Commit 952058c ou superior no repositório

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  B) COMANDOS DE EXECUÇÃO                                                   ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Conectar ao servidor e ir para diretório do projeto
# ─────────────────────────────────────────────────────────────────────────────
ssh usuario@servidor-producao
cd /caminho/para/arthemi-site

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Fazer backup do banco (OBRIGATÓRIO)
# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL:
pg_dump -h HOST -U USER -d DATABASE > backup-$(date +%Y%m%d-%H%M%S).sql

# Ou via Prisma (se usar SQLite):
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Atualizar código (pegar commit com scripts corrigidos)
# ─────────────────────────────────────────────────────────────────────────────
git fetch origin
git pull origin main

# Verificar que os scripts existem:
ls -la scripts/update-room-prices.js scripts/update-product-prices.js scripts/check-prices.js

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Diagnóstico ANTES (salvar saída)
# ─────────────────────────────────────────────────────────────────────────────
node scripts/check-prices.js | tee logs/check-prices-ANTES-$(date +%Y%m%d-%H%M%S).log

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 5: DRY-RUN (simular sem alterar)
# ─────────────────────────────────────────────────────────────────────────────
node scripts/update-room-prices.js --dry-run
node scripts/update-product-prices.js --dry-run

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 6: EXECUTAR CORREÇÃO (com log)
# ─────────────────────────────────────────────────────────────────────────────
node scripts/update-room-prices.js | tee logs/update-rooms-$(date +%Y%m%d-%H%M%S).log
node scripts/update-product-prices.js | tee logs/update-products-$(date +%Y%m%d-%H%M%S).log

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 7: Diagnóstico DEPOIS (validar)
# ─────────────────────────────────────────────────────────────────────────────
node scripts/check-prices.js | tee logs/check-prices-DEPOIS-$(date +%Y%m%d-%H%M%S).log

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 8: Reiniciar serviço (se aplicável)
# ─────────────────────────────────────────────────────────────────────────────
# PM2:
pm2 restart arthemi-site

# Vercel (não precisa reiniciar - serverless)

# Docker:
docker-compose restart app

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 9: Teste visual no site
# ─────────────────────────────────────────────────────────────────────────────
# Abrir: https://arthemi.com.br (ou URL de produção)
# Verificar:
# - Modal de compra de créditos → deve mostrar R$ 59,99/h (não R$ 0,50)
# - Preço dos pacotes corretos

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  C) VALIDAÇÕES E QUERIES                                                   ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# Verificar via SQL direto (PostgreSQL):
psql -h HOST -U USER -d DATABASE -c "
SELECT name, slug, 
       pricePerHour as cents, 
       pricePerHour/100.0 as reais
FROM rooms 
ORDER BY tier;
"

# Saída esperada APÓS correção:
# ┌───────────────┬─────────┬───────┬───────┐
# │ name          │ slug    │ cents │ reais │
# ├───────────────┼─────────┼───────┼───────┤
# │ Consultório 1 │ sala-a  │ 5999  │ 59.99 │
# │ Consultório 2 │ sala-b  │ 4999  │ 49.99 │
# │ Consultório 3 │ sala-c  │ 3999  │ 39.99 │
# └───────────────┴─────────┴───────┴───────┘

# Verificar produtos:
psql -h HOST -U USER -d DATABASE -c "
SELECT p.name, p.type, 
       p.price as cents, 
       p.price/100.0 as reais
FROM products p
ORDER BY p.name
LIMIT 10;
"

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  D) ROLLBACK (se algo der errado)                                          ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# Restaurar backup PostgreSQL:
psql -h HOST -U USER -d DATABASE < backup-YYYYMMDD-HHMMSS.sql

# Restaurar backup SQLite:
cp prisma/dev.db.backup-YYYYMMDD-HHMMSS prisma/dev.db

# Reiniciar serviço após rollback:
pm2 restart arthemi-site

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  E) GARANTIAS DE IDEMPOTÊNCIA                                              ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# Os scripts são SEGUROS para rodar múltiplas vezes:
#
# 1. DETECÇÃO AUTOMÁTICA:
#    - Se valor >= 1000 E próximo do esperado → PULA (já está em centavos)
#    - Se valor < 100 → CORRIGE (está em reais)
#
# 2. TRANSAÇÃO:
#    - Todas as alterações rodam em transação
#    - Se der erro, NADA é alterado (rollback automático)
#
# 3. LOGS:
#    - Cada execução loga IDs alterados e valores antes/depois
#    - Log JSON no final para auditoria
#
# 4. DRY-RUN:
#    - Use --dry-run para simular sem alterar nada

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  F) SAÍDA ESPERADA DO check-prices.js (APÓS CORREÇÃO)                      ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# ═══════════════════════════════════════════════════════════════════════════
#   DIAGNÓSTICO: Preços no Banco de Dados
# ═══════════════════════════════════════════════════════════════════════════
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  SALAS (rooms)                                                          │
# └─────────────────────────────────────────────────────────────────────────┘
#
#   Consultório 1 (sala-a)
#     pricePerHour: 5999 (CENTAVOS) → R$ 59,99 ✅ OK
#     hourlyRate:   5999
#     priceShift:   18999
#     Esperado:     5999 centavos = R$ 59,99
#
#   Consultório 2 (sala-b)
#     pricePerHour: 4999 (CENTAVOS) → R$ 49,99 ✅ OK
#     ...
#
#   Consultório 3 (sala-c)
#     pricePerHour: 3999 (CENTAVOS) → R$ 39,99 ✅ OK
#     ...
#
# ═══════════════════════════════════════════════════════════════════════════
#   RESUMO
# ═══════════════════════════════════════════════════════════════════════════
#   Salas:    3 OK, 0 com erro
#   Produtos: 24 OK, 0 com erro
# ═══════════════════════════════════════════════════════════════════════════
#
# ✅ TODOS OS PREÇOS ESTÃO CORRETOS (em centavos)!

# ═══════════════════════════════════════════════════════════════════════════
# FIM DO RUNBOOK
# ═══════════════════════════════════════════════════════════════════════════
