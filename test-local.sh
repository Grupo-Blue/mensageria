#!/bin/bash

# Script para testar QR Code localmente
# Uso: ./test-local.sh

set -e

echo "🧪 Iniciando teste local do QR Code WhatsApp"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se as portas estão livres
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Porta $1 já está em uso!${NC}"
        echo "   Execute: lsof -ti:$1 | xargs kill -9"
        exit 1
    fi
}

check_port 3333
check_port 3000

echo -e "${GREEN}✅ Portas 3333 e 3000 estão livres${NC}"
echo ""

# Configurar variáveis de ambiente do backend
export NODE_ENV=development
export LOCAL_PORT=3333
export AUTH_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export X_AUTH_API=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export INTERNAL_SYNC_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export FRONTEND_API_URL=http://localhost:3000
export IDENTIFICATION=mensageria
export WHATSAPP_GROUPS_CALLBACK_URL=http://localhost:3000/api/whatsapp/groups

# Configurar variáveis do frontend para apontar para localhost
export VITE_BACKEND_API_URL=http://localhost:3333
export VITE_BACKEND_API_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27

echo -e "${YELLOW}📦 Instalando dependências do backend...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi

echo ""
echo -e "${YELLOW}📦 Instalando dependências do frontend...${NC}"
cd ../frontend
if [ ! -d "node_modules" ]; then
    pnpm install
fi

echo ""
echo -e "${GREEN}🚀 Iniciando backend na porta 3333...${NC}"
cd ../backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: tail -f backend.log"

# Aguardar backend iniciar
sleep 5

# Verificar se backend está rodando
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend falhou ao iniciar!${NC}"
    echo "   Verifique os logs: cat backend.log"
    exit 1
fi

echo ""
echo -e "${GREEN}🚀 Iniciando frontend na porta 3000...${NC}"
cd ../frontend
pnpm dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: tail -f frontend.log"

# Aguardar frontend iniciar
sleep 5

echo ""
echo -e "${GREEN}✅ Serviços iniciados!${NC}"
echo ""
echo "📱 Acesse: http://localhost:3000/whatsapp"
echo ""
echo "📊 Para ver os logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 Para parar os serviços:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Função de cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Parando serviços...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Serviços parados${NC}"
}

trap cleanup EXIT INT TERM

# Manter script rodando
echo "Pressione Ctrl+C para parar..."
wait

