#!/bin/bash

# Script de debug para QR Code
# Este script inicia o backend e mostra logs em tempo real

echo "🔍 DEBUG: QR Code WhatsApp"
echo "========================"
echo ""

cd "$(dirname "$0")/backend"

# Configurar variáveis
export NODE_ENV=development
export LOCAL_PORT=3333
export AUTH_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export X_AUTH_API=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export INTERNAL_SYNC_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export FRONTEND_API_URL=http://localhost:3000
export IDENTIFICATION=mensageria
export WHATSAPP_GROUPS_CALLBACK_URL=http://localhost:3000/api/whatsapp/groups

echo "📋 Variáveis configuradas:"
echo "   NODE_ENV=$NODE_ENV"
echo "   LOCAL_PORT=$LOCAL_PORT"
echo "   FRONTEND_API_URL=$FRONTEND_API_URL"
echo ""

echo "🚀 Iniciando backend..."
echo "   Porta: 3333"
echo "   Socket.IO path: /socket.io"
echo ""
echo "📊 Logs (procure por):"
echo "   - [Socket.IO] Servidor Socket.IO inicializado"
echo "   - [Socket.IO] ✅ Cliente conectado"
echo "   - [Socket.IO] 📥 requestQRCode recebido"
echo "   - [Baileys] 🔄 Iniciando logout"
echo "   - [QR Code] ✅ QR Code gerado"
echo ""
echo "🛑 Pressione Ctrl+C para parar"
echo "================================"
echo ""

npm run dev

