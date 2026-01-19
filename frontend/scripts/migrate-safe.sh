#!/bin/sh

# Script seguro para aplicar migrations do Drizzle
# Corrige migrations que tentam criar tabelas que já existem

set -e

echo "🔍 Verificando e corrigindo migrations..."

# Executar script de correção
node scripts/fix-migration.js

echo ""
echo "📦 Gerando novas migrations..."
drizzle-kit generate

echo ""
echo "🔧 Corrigindo migrations recém-geradas..."
node scripts/fix-migration.js

echo ""
echo "🚀 Aplicando migrations..."
drizzle-kit migrate

echo ""
echo "✅ Migrations aplicadas com sucesso!"

