#!/bin/sh
# Entrypoint do serviço Docker de migration (mensageria-migration-dev/prod).
# Não roda drizzle-kit generate — apenas aplica o journal de forma idempotente.
set -e

echo "🔍 Verificando arquivos do journal..."
node scripts/verify-migration-files.mjs

echo ""
echo "🚀 Aplicando migrations..."
node scripts/run-migrations.mjs
