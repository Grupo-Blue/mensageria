#!/bin/bash

# Script para iniciar frontend localmente apontando para localhost

cd "$(dirname "$0")/frontend"

export VITE_BACKEND_API_URL=http://localhost:3333
export VITE_BACKEND_API_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27

echo "🚀 Iniciando frontend na porta 3000..."
echo "📱 Acesse: http://localhost:3000/whatsapp"
echo ""

pnpm dev

