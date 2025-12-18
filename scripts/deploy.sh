#!/bin/bash

# Script de Deploy Manual
# Uso: ./scripts/deploy.sh

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações
PROJECT_PATH="${DEPLOY_PATH:-/var/www/mensageria}"
NODE_ENV="${NODE_ENV:-production}"

echo -e "${GREEN}🚀 Starting deployment...${NC}"
echo -e "${YELLOW}📍 Project path: $PROJECT_PATH${NC}"
echo -e "${YELLOW}🌍 Environment: $NODE_ENV${NC}"

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found. Are you in the project root?${NC}"
  exit 1
fi

# Verificar se pnpm está instalado
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}⚠️  pnpm not found. Installing...${NC}"
  npm install -g pnpm
fi

# Pull das mudanças (se for repositório git)
if [ -d ".git" ]; then
  echo -e "${GREEN}⬇️  Pulling latest changes...${NC}"
  git fetch origin
  git pull origin master || echo -e "${YELLOW}⚠️  Git pull failed, continuing anyway...${NC}"
fi

# Instalar dependências
echo -e "${GREEN}📥 Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Build do projeto
echo -e "${GREEN}🔨 Building project...${NC}"
export NODE_ENV=$NODE_ENV
pnpm build

# Verificar se build foi bem-sucedido
if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Build failed: dist directory not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Se existir backend separado, build também
if [ -d "backend" ]; then
  echo -e "${GREEN}🔨 Building backend...${NC}"
  cd backend
  if [ -f "package.json" ]; then
    npm install --production
    if grep -q '"build"' package.json; then
      npm run build
    fi
  fi
  cd ..
fi

# Reiniciar serviços
echo -e "${GREEN}🔄 Restarting services...${NC}"

DEPLOYED=false

# Tentar PM2
if command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}🔄 Using PM2...${NC}"
  if pm2 list | grep -q "mensageria"; then
    pm2 restart mensageria
  else
    pm2 start dist/index.js --name mensageria
  fi
  pm2 save
  DEPLOYED=true
fi

# Tentar Docker Compose
if [ "$DEPLOYED" = false ] && [ -f "docker-compose.yml" ]; then
  echo -e "${YELLOW}🔄 Using Docker Compose...${NC}"
  docker-compose down
  docker-compose up -d --build
  DEPLOYED=true
fi

# Tentar systemd
if [ "$DEPLOYED" = false ] && systemctl list-unit-files | grep -q "mensageria.service" 2>/dev/null; then
  echo -e "${YELLOW}🔄 Using systemd...${NC}"
  sudo systemctl restart mensageria.service
  DEPLOYED=true
fi

if [ "$DEPLOYED" = false ]; then
  echo -e "${YELLOW}⚠️  No deployment method found. Please restart the service manually.${NC}"
  echo -e "${YELLOW}💡 Available methods: PM2, Docker Compose, or systemd${NC}"
else
  echo -e "${GREEN}✅ Service restarted successfully${NC}"
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

