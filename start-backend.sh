#!/bin/bash

# Script para iniciar backend localmente com logs visíveis

cd "$(dirname "$0")/backend"

export NODE_ENV=development
export LOCAL_PORT=3333
export AUTH_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export X_AUTH_API=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export INTERNAL_SYNC_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export FRONTEND_API_URL=http://localhost:3000
export IDENTIFICATION=mensageria
export WHATSAPP_GROUPS_CALLBACK_URL=http://localhost:3000/api/whatsapp/groups

echo "🚀 Iniciando backend na porta 3333..."
echo "📊 Logs em tempo real:"
echo ""

npm run dev

