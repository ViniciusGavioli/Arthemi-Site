#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# HOTFIX: Correção de Preços em Produção - ARTHEMI
# ═══════════════════════════════════════════════════════════════════════════
# USO: chmod +x scripts/hotfix-precos.sh && ./scripts/hotfix-precos.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════════════════"
echo "  HOTFIX: Correção de Preços - $(date)"
echo "═══════════════════════════════════════════════════════════════════════════"

echo ""
echo "=== 1) BACKUP (Postgres) ==="
pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" > backup-precos-$(date +%Y%m%d-%H%M%S).sql
echo "✅ Backup criado"

echo ""
echo "=== 2) ATUALIZAR CÓDIGO ==="
git pull origin main
echo "✅ Código atualizado"

echo ""
echo "=== 3) DIAGNÓSTICO ANTES ==="
node scripts/check-prices.js

echo ""
echo "=== 4) DRY RUN (NÃO ALTERA NADA) ==="
node scripts/update-room-prices.js --dry-run
node scripts/update-product-prices.js --dry-run

echo ""
read -p "Continuar com execução real? (s/N): " confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "❌ Cancelado pelo usuário"
    exit 1
fi

echo ""
echo "=== 5) EXECUTAR HOTFIX ==="
node scripts/update-room-prices.js
node scripts/update-product-prices.js

echo ""
echo "=== 6) DIAGNÓSTICO DEPOIS ==="
node scripts/check-prices.js

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  ✅ HOTFIX CONCLUÍDO COM SUCESSO!"
echo "═══════════════════════════════════════════════════════════════════════════"
